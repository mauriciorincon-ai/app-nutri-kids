import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_KEY, clearDevice, getDeviceId } from "@/lib/device";
import { getDayRecord, markDone, unmark } from "@/lib/diet/day-log";
import { addProfileNote, loadProfileNotes } from "@/lib/diet/profile-notes";
import { clearAllData, importDiet } from "@/lib/diet/storage";
import { familyApi } from "@/lib/family/client";
import { createController } from "@/lib/family/controller";
import { clearKeys, loadKeys, saveKeys } from "@/lib/family/keystore";
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
  const controller = () =>
    createController({
      api: familyApi(fetcher),
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
      },
      now: () => Date.now(),
      online: () => !offline,
      notify,
      today: () => "2026-11-16",
    });
  return {
    store,
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
    const a = controller();
    const created = await a.create("Mamá");
    if (!created.ok) throw new Error("create");
    const idA = getDeviceId();

    // Teléfono 2: otro aparato = otro localStorage e IndexedDB.
    localStorage.clear();
    clearDevice();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    const b = controller();
    const wrong = await b.join(created.code, "AAAAAAAAAAAAAAAAAAAA", "Abuela");
    expect(wrong).toEqual({ ok: false, reason: "wrong-phrase" });
    expect(await b.join("ZZZZZZZZZZ", created.phrase, "Abuela")).toEqual({
      ok: false,
      reason: "wrong-code",
    });
    expect(await b.join(created.code, created.phrase, "  ")).toEqual({
      ok: false,
      reason: "no-name",
    });
    expect(await b.join(created.code, created.phrase, "Abuela")).toEqual({
      ok: true,
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
