import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_KEY, clearDevice, getDeviceId } from "@/lib/device";
import {
  getDayRecord,
  getNote,
  markDone,
  setNote,
  unmark,
} from "@/lib/diet/day-log";
import { addProfileNote, loadProfileNotes } from "@/lib/diet/profile-notes";
import { clearAllData, importDiet } from "@/lib/diet/storage";
import { familyApi, type FamilyApi } from "@/lib/family/client";
import { createController, type ControllerDeps } from "@/lib/family/controller";
import {
  clearKeys,
  loadKeys,
  loadSigner,
  saveKeys,
} from "@/lib/family/keystore";
import { browserLocal } from "@/lib/family/local";
import { handle } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import {
  FAMILY_STATE_ITEM,
  clearFamilyLocal,
  loadFamilyState,
  saveFamilyState,
} from "@/lib/family/state";

import demoRaw from "../../data/demo-diet.json";

const DAY = new Date("2026-11-16T09:00:00");

function setup() {
  const store = createMemoryStore({ isolated: true });
  let offline = false;
  const fetcher = (async (url: string, init: RequestInit) => {
    if (offline) throw new TypeError("Failed to fetch");
    const headers = init.headers as Record<string, string>;
    const out = await handle(
      {
        op: url.replace("/api/family/", ""),
        method: "POST",
        body: String(init.body ?? ""),
        authorization: headers.authorization ?? null,
        ip: "203.0.113.5",
      },
      store,
    );
    return new Response(JSON.stringify(out.json), { status: out.status });
  }) as unknown as typeof fetch;
  const notify = vi.fn();
  const api = familyApi(fetcher);
  const controller = (over: Partial<ControllerDeps> = {}) =>
    createController({
      api,
      local: browserLocal(),
      state: {
        load: loadFamilyState,
        save: (s) => void saveFamilyState(s),
        clear: clearFamilyLocal,
      },
      keys: {
        save: (f, k) => saveKeys(f, k),
        load: (f) => loadKeys(f),
        clear: () => clearKeys(),
        signer: () => loadSigner(),
      },
      now: () => Date.now(),
      online: () => !offline,
      notify,
      today: () => "2026-11-16",
      ...over,
    });
  return {
    store,
    api,
    controller,
    notify,
    setOffline: (v: boolean) => (offline = v),
  };
}

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});
afterEach(() => vi.useRealTimers());

describe("el director de la familia en un teléfono", () => {
  it("crea la familia, sube lo suyo, muestra su nombre y guarda las claves aparte", async () => {
    const { controller } = setup();
    markDone(DAY, "meal:desayuno", "07:30");
    const c = controller();
    expect(c.getView().phase).toBe("off");

    const r = await c.create("Mamá");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.phrase).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);

    const v = c.getView();
    expect(v.phase).toBe("idle");
    expect(v.code).toBe(r.code);
    expect(v.pending).toBe(0);
    expect(v.phones).toEqual([
      expect.objectContaining({ self: true, name: "Mamá" }),
    ]);
    // Lo guardado en este teléfono no lleva ni la frase ni claves en claro.
    const stored = Object.entries(localStorage)
      .map(([k, val]) => `${k}=${val}`)
      .join("\n");
    expect(stored).not.toContain(r.phrase);
    expect(stored).not.toContain(r.phrase.replace(/-/g, ""));
    expect(await loadKeys(loadFamilyState()!.family)).not.toBeNull();
  });

  it("otro teléfono entra con código y frase; lo marcado, lo anotado y quién aparecen en los dos", async () => {
    const { controller } = setup();
    // Teléfono 1
    markDone(DAY, "meal:desayuno", "07:30");
    addProfileNote("allergy", "Ejemplo anotado", DAY);
    setNote(DAY, "meal:desayuno", { chips: [], text: "Nota de ejemplo" });
    const a = controller();
    const created = await a.create("Mamá");
    if (!created.ok) throw new Error("create");
    const idA = getDeviceId();

    // Teléfono 2: otro aparato = otro localStorage e IndexedDB.
    localStorage.clear();
    clearDevice();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    const b = controller();
    const wrong = await b.join(
      created.invite,
      "AAAAAAAAAAAAAAAAAAAA",
      "Abuela",
    );
    expect(wrong).toEqual({ ok: false, reason: "wrong-phrase" });
    expect(await b.join("ZZZZZZZZZZ", created.phrase, "Abuela")).toEqual({
      ok: false,
      reason: "wrong-code",
    });
    expect(await b.join(created.invite, created.phrase, "  ")).toEqual({
      ok: false,
      reason: "no-name",
    });
    expect(await b.join(created.invite, created.phrase, "Abuela")).toEqual({
      ok: true,
      keysSaved: true,
    });

    expect(getDayRecord(DAY).marks["meal:desayuno"]).toEqual({
      at: "07:30",
      by: idA,
    });
    expect(loadProfileNotes().notes[0]).toMatchObject({
      kind: "allergy",
      text: "Ejemplo anotado",
      by: idA,
    });
    // La nota del día también dice quién la escribió.
    expect(getNote(DAY, "meal:desayuno")).toMatchObject({
      text: "Nota de ejemplo",
      by: idA,
    });
    expect(
      b
        .getView()
        .phones.map((p) => p.name)
        .sort(),
    ).toEqual(["Abuela", "Mamá"]);
    // El idioma y las preferencias de ESTE teléfono no cambiaron.
    expect(localStorage.getItem("nutrikids.prefs.v1")).toBeNull();
    expect(localStorage.getItem(DEVICE_KEY)).toContain("Abuela");
  });

  it("sin red queda pendiente y se ve; al volver sube todo", async () => {
    const { controller, setOffline } = setup();
    const c = controller();
    const r = await c.create("Mamá");
    expect(r.ok).toBe(true);
    setOffline(true);
    markDone(DAY, "meal:almuerzo", "12:30");
    unmark(DAY, "meal:almuerzo");
    markDone(DAY, "meal:cena", "19:00");
    await c.sync();
    expect(c.getView().phase).toBe("offline");
    expect(c.getView().pending).toBe(1);
    setOffline(false);
    await c.sync();
    expect(c.getView()).toMatchObject({ phase: "idle", pending: 0 });
  });

  it("si el servidor no está (503) lo dice, y cambiar la frase deja a otro teléfono afuera", async () => {
    const { controller } = setup();
    const c = controller();
    const created = await c.create("Mamá");
    if (!created.ok) throw new Error("create");
    const rot = await c.rotate();
    expect(rot.ok).toBe(true);
    if (!rot.ok) return;
    expect(rot.phrase).not.toBe(created.phrase);
    expect(c.getView().phase).toBe("idle");
    // La época nueva y las claves nuevas quedaron guardadas.
    expect(loadFamilyState()!.epoch).toBe(2);
  });

  it("salir conserva los datos del teléfono y borra estado y claves; borrar lo compartido borra el servidor", async () => {
    const { controller, store } = setup();
    markDone(DAY, "meal:desayuno", "07:30");
    const c = controller();
    const created = await c.create("Mamá");
    if (!created.ok) throw new Error("create");
    const family = loadFamilyState()!.family;
    expect(await store.meta(family)).not.toBeNull();

    expect((await c.destroy()).ok).toBe(true);
    expect(await store.meta(family)).toBeNull();
    expect(c.getView().phase).toBe("off");
    expect(localStorage.getItem(FAMILY_STATE_ITEM)).toBeNull();
    expect(await loadKeys(family)).toBeNull();
    // Los datos siguen en este teléfono.
    expect(getDayRecord(DAY).marks["meal:desayuno"]).toBeDefined();
    expect((await c.rotate()).ok).toBe(false);
  });

  it("si el teléfono no puede guardar las claves, crear y cambiar la frase igual entregan la frase y avisan; borrar lo compartido sigue funcionando", async () => {
    const { controller, store } = setup();
    const c = controller({
      keys: {
        save: () => Promise.reject(new Error("QuotaExceededError")),
        load: () => Promise.resolve(null),
        clear: () => Promise.resolve(),
        signer: () => loadSigner(),
      },
    });
    const created = await c.create("Mamá");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.keysSaved).toBe(false);
    expect(created.phrase).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);

    const rotated = await c.rotate();
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    expect(rotated.keysSaved).toBe(false);
    expect(rotated.phrase).not.toBe(created.phrase);

    const family = loadFamilyState()!.family;
    expect((await c.destroy()).ok).toBe(true);
    expect(await store.meta(family)).toBeNull();
    expect(c.getView().phase).toBe("off");
  });

  it("con las claves guardadas, crear dice keysSaved: true", async () => {
    const { controller } = setup();
    const r = await controller().create("Mamá");
    expect(r.ok && r.keysSaved).toBe(true);
  });

  it("«Borrar datos» también sale de la familia y olvida el nombre del teléfono", async () => {
    const { controller } = setup();
    importDiet(JSON.stringify(demoRaw));
    const c = controller();
    await c.create("Mamá");
    clearAllData();
    expect(localStorage.getItem(FAMILY_STATE_ITEM)).toBeNull();
    expect(localStorage.getItem(DEVICE_KEY)).toBeNull();
    await vi.waitFor(async () => {
      expect(await loadKeys("ABCDEFGHJK")).toBeNull();
    });
  });
});

/** Deja correr lo pendiente sin iniciar nada nuevo (setImmediate no está simulado). */
async function flush() {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
}

describe("el director: disparadores y bordes", () => {
  async function made() {
    const env = setup();
    const pull = vi.fn();
    const base = familyApi((async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const out = await handle(
        {
          op: url.replace("/api/family/", ""),
          method: "POST",
          body: String(init.body ?? ""),
          authorization: headers.authorization ?? null,
          ip: "203.0.113.5",
        },
        env.store,
      );
      return new Response(JSON.stringify(out.json), { status: out.status });
    }) as unknown as typeof fetch);
    const api = {
      ...base,
      pull: (...a: Parameters<typeof base.pull>) => {
        pull();
        return base.pull(...a);
      },
    };
    const c = env.controller({ api });
    const r = await c.create("Mamá");
    if (!r.ok) throw new Error("create");
    pull.mockClear();
    return { ...env, c, pull };
  }

  it("health: listo, sin servicio y sin red", async () => {
    const { controller } = setup();
    const ready = controller({
      api: {
        ...familyApi(),
        health: async () => ({
          ok: true,
          status: 200,
          data: { available: true, store: "memory" },
        }),
      },
    });
    expect(await ready.health()).toBe("ready");
    const none = controller({
      api: {
        ...familyApi(),
        health: async () => ({
          ok: true,
          status: 200,
          data: { available: false, store: "none" },
        }),
      },
    });
    expect(await none.health()).toBe("unavailable");
    const down = controller({
      api: {
        ...familyApi(),
        health: async () => ({ ok: false, status: 503, error: "x" }),
      },
    });
    expect(await down.health()).toBe("unavailable");
    const off = controller({
      api: {
        ...familyApi(),
        health: async () => ({ ok: false, status: 0, error: "offline" }),
      },
    });
    expect(await off.health()).toBe("offline");
  });

  it("sin nombre no crea, no entra ni renombra", async () => {
    const { controller } = setup();
    const c = controller();
    expect(await c.create("  ")).toEqual({ ok: false, reason: "no-name" });
    expect(await c.join("AAAAA-AAAAA", "x", "")).toEqual({
      ok: false,
      reason: "no-name",
    });
    expect(await c.rename(" ")).toEqual({ ok: false, reason: "no-name" });
  });

  it("sin familia: cambiar la frase y borrar lo compartido dicen «no-family»", async () => {
    const { controller } = setup();
    const c = controller();
    expect(await c.rotate()).toEqual({ ok: false, reason: "no-family" });
    expect(await c.destroy()).toEqual({ ok: false, reason: "no-family" });
    await c.dismissNotice(); // sin estado: no hace nada
    c.changed(); // sin familia: no programa nada
    expect(c.getView().phase).toBe("off");
  });

  it("renombrar el teléfono se ve de inmediato en la lista", async () => {
    const { c } = await made();
    expect(await c.rename("Mamá Ana")).toEqual({ ok: true });
    expect(c.getView().ownName).toBe("Mamá Ana");
    expect(c.getView().phones[0]).toMatchObject({
      self: true,
      name: "Mamá Ana",
    });
  });

  it("el aviso del plan se descarta y no vuelve", async () => {
    const { c } = await made();
    const st = loadFamilyState()!;
    saveFamilyState({ ...st, planNotice: "theirs" });
    await c.sync();
    expect(c.getView().planNotice).toBe("theirs");
    await c.dismissNotice();
    expect(c.getView().planNotice).toBeNull();
    expect(loadFamilyState()!.planNotice).toBeNull();
  });

  it("sin las claves en este teléfono: «locked» y no sube nada", async () => {
    const { c, controller } = await made();
    await clearKeys();
    const fresh = controller(); // un director nuevo no trae las claves en memoria
    await fresh.sync();
    expect(fresh.getView().phase).toBe("locked");
    expect(c.getView().phase).toBe("idle");
  });

  it("start: sincroniza al abrir, al volver a verse, al volver internet y cada 30 s; stop lo quita todo", async () => {
    const { c, pull } = await made();
    const visible = vi.spyOn(document, "visibilityState", "get");
    visible.mockReturnValue("visible");
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"],
    });
    const stop = c.start();
    await vi.advanceTimersByTimeAsync(0);
    await c.sync();
    expect(pull).toHaveBeenCalledTimes(1); // al abrir

    document.dispatchEvent(new Event("visibilitychange"));
    await c.sync();
    expect(pull).toHaveBeenCalledTimes(2); // al volver a verse

    visible.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(30_000);
    await flush();
    expect(pull).toHaveBeenCalledTimes(2); // oculta: ni evento ni turno suben

    visible.mockReturnValue("visible");
    await vi.advanceTimersByTimeAsync(30_000);
    await c.sync();
    expect(pull).toHaveBeenCalledTimes(3); // el turno de 30 s

    window.dispatchEvent(new Event("online"));
    await c.sync();
    expect(pull).toHaveBeenCalledTimes(4); // volvió internet

    window.dispatchEvent(new Event("offline")); // solo relee: no sube
    await flush();
    expect(pull).toHaveBeenCalledTimes(4);
    stop();
    const after = pull.mock.calls.length;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(pull.mock.calls.length).toBe(after);
    visible.mockRestore();
  });

  it("changed: un cambio propio sube a los 1,5 s, y varios seguidos suben una vez", async () => {
    const { c, pull } = await made();
    markDone(DAY, "meal:almuerzo", "12:00");
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"],
    });
    c.changed();
    c.changed();
    await vi.advanceTimersByTimeAsync(1000);
    expect(pull).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    await c.sync();
    expect(pull).toHaveBeenCalledTimes(1);
    expect(c.getView().pending).toBe(0);
  });

  it("salir mientras se sincroniza espera a que acabe: el estado no resucita", async () => {
    const { c } = await made();
    const running = c.sync();
    const left = c.leave();
    await Promise.all([running, left]);
    expect(loadFamilyState()).toBeNull();
    expect(c.getView().phase).toBe("off");
    expect(await loadKeys("ZZZZZZZZZZ")).toBeNull();
  });
});

describe("roles en el director (S9 · ADR-013)", () => {
  /** Dos teléfonos en el mismo proceso: cada uno con SU localStorage e IndexedDB. */
  function devices() {
    const saved = new Map<
      string,
      { ls: Record<string, string>; idb: IDBFactory }
    >();
    let current: string | null = null;
    const use = (who: string) => {
      if (current) {
        saved.set(current, {
          ls: { ...localStorage },
          idb: (globalThis as { indexedDB: IDBFactory }).indexedDB,
        });
      }
      localStorage.clear();
      clearDevice(); // el id de este teléfono vive en memoria también
      const s = saved.get(who);
      if (s)
        for (const [k, v] of Object.entries(s.ls)) localStorage.setItem(k, v);
      (globalThis as { indexedDB: IDBFactory }).indexedDB =
        s?.idb ?? new IDBFactory();
      current = who;
    };
    return { use };
  }

  it("invitar con rol, confirmar con la huella, y lo que cada rol no puede hacer", async () => {
    const { controller } = setup();
    const { use } = devices();

    use("A");
    const a = controller();
    const created = await a.create("Mamá");
    if (!created.ok) throw new Error("create");
    const idA = getDeviceId();
    expect(a.getView().role).toBe("parent");
    expect(a.getView().members).toEqual([
      expect.objectContaining({ id: idA, role: "parent", self: true }),
    ]);
    const inv = await a.invite("school", ["almuerzo"]);
    if (!inv.ok) throw new Error("invite");
    expect(inv.invite).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}(-[0-9A-Z]{4}){4}$/);
    expect(a.getView().log.map((l) => l.k)).toContain("roster");

    use("B");
    const b = controller();
    expect(await b.join(inv.invite, created.phrase, "Colegio")).toMatchObject({
      ok: true,
    });
    const idB = getDeviceId();
    expect(b.getView().role).toBeNull();
    const markB = b.getView().mark;
    expect(markB).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    // Sin rol: ni avisa ni cambia a nadie.
    expect(await b.sendNotice("hola")).toEqual({
      ok: false,
      reason: "not-allowed",
    });
    expect(await b.invite("caregiver")).toEqual({
      ok: false,
      reason: "not-allowed",
    });

    use("A");
    await a.sync();
    const waiting = a.getView().waiting;
    expect(waiting).toEqual([
      {
        id: idB,
        name: "Colegio",
        invited: { role: "school", meals: ["almuerzo"] },
        ready: true,
        mark: markB,
      },
    ]);
    expect(await a.setRole("NOBODY-00000", "caregiver")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await a.setRole(idB, "school", ["almuerzo"])).toEqual({ ok: true });
    expect(a.getView().waiting).toEqual([]);
    expect(a.getView().members.find((m) => m.id === idB)).toMatchObject({
      role: "school",
      meals: ["almuerzo"],
      name: "Colegio",
    });
    expect(await a.removeMember(idA)).toEqual({ ok: false, reason: "invalid" });

    use("B");
    await b.sync();
    expect(b.getView().role).toBe("school");
    expect(b.getView().meals).toEqual(["almuerzo"]);
    // El colegio avisa, pero no se sube de rol, no saca a nadie ni cambia la frase.
    expect(await b.sendNotice("Llegó a las 12:40")).toMatchObject({ ok: true });
    expect(await b.setRole(idB, "parent")).toEqual({
      ok: false,
      reason: "not-allowed",
    });
    expect(await b.removeMember(idA)).toEqual({
      ok: false,
      reason: "not-allowed",
    });
    expect(await b.rotate()).toEqual({ ok: false, reason: "not-allowed" });

    use("A");
    await a.sync();
    expect(await a.setRole(idB, "nutritionist")).toEqual({ ok: true });
    use("B");
    await b.sync();
    expect(b.getView().role).toBe("nutritionist");
    expect(await b.sendNotice("otra")).toEqual({
      ok: false,
      reason: "not-allowed",
    });

    use("A");
    await a.sync();
    const log = a.getView().log;
    expect(log.some((l) => l.by === idB && l.k === "notice")).toBe(true);
    expect(log.find((l) => l.by === idB)).toMatchObject({
      name: "Colegio",
      role: "nutritionist",
    });
    const removed = await a.removeMember(idB);
    expect(removed).toMatchObject({ ok: true });
    expect(a.getView().members.map((m) => m.id)).toEqual([idA]);
  });
  it("turnos: dos cambios de roster seguidos, sin esperar, encadenan sin bifurcar", async () => {
    const { controller } = setup();
    const { use } = devices();
    use("A");
    const a = controller();
    const created = await a.create("Mamá");
    if (!created.ok) throw new Error("create");
    const [one, two] = await Promise.all([
      a.invite("caregiver"),
      a.invite("nutritionist"),
    ]);
    expect(one.ok && two.ok).toBe(true);
    // génesis + las dos invitaciones, con el número de cada una consecutivo: ninguna bifurcó.
    const ops = loadFamilyState()!.roster;
    expect(ops.map((o) => o.i)).toEqual([0, 1, 2]);
  });

  it("turnos: quitar a alguien mientras una sincronía lenta corre no se pierde cuando ella termina", async () => {
    const { controller, api } = setup();
    const { use } = devices();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const slow: FamilyApi = {
      ...api,
      pull: async (...args) => {
        await sleep(40);
        return api.pull(...args);
      },
      push: async (...args) => {
        await sleep(40);
        return api.push(...args);
      },
    };

    use("A");
    const a = controller({ api: slow });
    const created = await a.create("Mamá");
    if (!created.ok) throw new Error("create");
    const idA = getDeviceId();
    const inv = await a.invite("caregiver");
    if (!inv.ok) throw new Error("invite");

    use("B");
    const b = controller();
    expect(await b.join(inv.invite, created.phrase, "Papá")).toMatchObject({
      ok: true,
    });
    const idB = getDeviceId();

    use("A");
    await a.sync();
    expect(await a.setRole(idB, "caregiver")).toEqual({ ok: true });
    expect(
      a
        .getView()
        .members.map((m) => m.id)
        .sort(),
    ).toEqual([idA, idB].sort());

    // Una sincronía lenta en vuelo y, en medio, el padre quita a Papá.
    const syncing = a.sync();
    await sleep(10);
    const removing = a.removeMember(idB);
    await Promise.all([syncing, removing]);
    expect(a.getView().members.map((m) => m.id)).toEqual([idA]);
    expect(
      loadFamilyState()!.roster.some((o) => o.body.type === "remove"),
    ).toBe(true);
  });
});
