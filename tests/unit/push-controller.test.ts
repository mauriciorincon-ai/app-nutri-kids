// @vitest-environment node
import { describe, expect, it } from "vitest";

import { tokenHash } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import type { BrowserPush, Permission, Support } from "@/lib/push/browser";
import { pushApi } from "@/lib/push/client";
import { createPushController, type PushDeps } from "@/lib/push/controller";
import type { PushCopy } from "@/lib/push/copy";
import { createMemoryPushStore } from "@/lib/push/server/memory";
import {
  handlePush,
  type PushDeps as ServerDeps,
} from "@/lib/push/server/handler";
import { forTypes, planItems, serverWakes } from "@/lib/push/schedule";
import { freshPushState, type PushState } from "@/lib/push/state";
import { pushTexts } from "@/lib/push/text";
import { generateVapidKeys, importVapid } from "@/lib/push/vapid";
import { dietPlanSchema } from "@/lib/diet/schema";

import demoRaw from "../../data/demo-diet.json";

const diet = dietPlanSchema.parse(demoRaw);
// Lunes 2026-11-16 a las 07:00 en Bogotá (UTC-5).
const MONDAY_7 = Date.UTC(2026, 10, 16, 12, 0);
const TZ = "America/Bogota";
const FAM = "A1B2C3D4E5";
const FAM_TOKEN = "F".repeat(43);

async function world(
  opts: {
    support?: Support;
    permission?: Permission;
    ask?: Permission;
    available?: boolean;
    withFamily?: boolean;
    offline?: boolean;
  } = {},
) {
  const store = createMemoryPushStore({ isolated: true, now: () => MONDAY_7 });
  const familyStore = createMemoryStore({
    isolated: true,
    now: () => MONDAY_7,
  });
  await familyStore.create(FAM, "s".repeat(22), tokenHash(FAM_TOKEN), 99);
  const pair = await generateVapidKeys();
  const vapid = await importVapid(
    pair.publicKey,
    pair.privateKey,
    "mailto:avisos@example.org",
  );
  const server: ServerDeps = {
    store: opts.available === false ? null : store,
    family: familyStore,
    vapid: opts.available === false ? null : vapid,
    signingKeys: [],
    sender: async () => 201,
  };
  const wire: string[] = [];
  const net = { offline: opts.offline ?? false };
  let ip = 0;
  const fetcher = (async (url: string, init: RequestInit) => {
    if (net.offline) throw new TypeError("Failed to fetch");
    wire.push(`${url} ${String(init.body)}`);
    const headers = init.headers as Record<string, string>;
    const out = await handlePush(
      {
        op: url.replace("/api/push/", ""),
        method: "POST",
        body: String(init.body ?? ""),
        authorization: headers.authorization ?? null,
        signature: null,
        ip: `10.1.0.${ip++ % 250}`,
      },
      server,
      MONDAY_7,
    );
    return new Response(JSON.stringify(out.json), { status: out.status });
  }) as unknown as typeof fetch;

  let saved: PushState | null = null;
  const copies: PushCopy[] = [];
  const pointers: unknown[] = [];
  let permission: Permission = opts.permission ?? "default";
  let endpoint: string | null = null;
  let unsubscribed = 0;
  let asked = 0;
  let workerReady = true;
  const done: string[] = [];
  const clock = { now: MONDAY_7 };
  let counter = 0;
  const browser: BrowserPush = {
    support: () => opts.support ?? "supported",
    permission: () => permission,
    requestPermission: async () => {
      asked++;
      permission = opts.ask ?? "granted";
      return permission;
    },
    subscribe: async () => {
      if (!workerReady) return null;
      endpoint = "https://fcm.googleapis.com/fcm/send/phone-1";
      return endpoint;
    },
    endpoint: async () => endpoint,
    unsubscribe: async () => {
      unsubscribed++;
      endpoint = null;
    },
  };
  const deps: PushDeps = {
    api: pushApi(fetcher),
    state: {
      load: () => (saved ? structuredClone(saved) : null),
      save: (s) => {
        saved = structuredClone(s);
        return true;
      },
      clear: () => {
        saved = null;
      },
    },
    browser,
    copy: {
      save: async (c) => {
        copies.push(structuredClone(c));
        return true;
      },
      pointer: async (p) => {
        pointers.push(p);
        return true;
      },
      clear: async () => {
        copies.length = 0;
        pointers.push("cleared");
      },
    },
    diet: () => diet,
    locale: () => "es",
    family: async () =>
      opts.withFamily
        ? {
            family: FAM,
            epoch: 1,
            seq: 7,
            self: "SELF-PHONE-01",
            token: FAM_TOKEN,
          }
        : null,
    doneIds: () => [...done],
    now: () => clock.now,
    timeZone: () => TZ,
    randomToken: () => `${"R".repeat(42)}${counter++ % 10}`,
  };
  return {
    controller: createPushController(deps),
    store,
    wire,
    net,
    copies,
    pointers,
    done,
    clock,
    get saved() {
      return saved;
    },
    set saved(s: PushState | null) {
      saved = s;
    },
    get asked() {
      return asked;
    },
    get unsubscribed() {
      return unsubscribed;
    },
    setPermission: (p: Permission) => (permission = p),
    setEndpoint: (e: string | null) => (endpoint = e),
    breakWorker: () => (workerReady = false),
  };
}

/** Los ids que tocan en el primer despertar del día (a las 07:00 son comidas y suplemento). */
function firstWake() {
  const items = planItems(diet, "es", pushTexts("es").schedule);
  const minute = Math.min(...items.map((i) => i.minute));
  return {
    minute,
    ids: items
      .filter((i) => i.minute === minute && i.days.includes(1))
      .map((i) => i.id),
  };
}

function allDietStrings(): string[] {
  const out: string[] = [];
  for (const m of diet.dailyMenu) out.push(m.name.es, m.name.en, m.content.es);
  for (const s of diet.supplements) out.push(s.name.es, s.dose.es);
  return out.filter((s) => s.length > 3);
}

describe("encender los avisos en este teléfono", () => {
  it("pide el permiso una vez, registra solo horas sin etiqueta y deja la copia para el trabajador", async () => {
    const w = await world({ withFamily: true });
    await w.controller.init();
    expect(w.controller.getView().status).toBe("off");
    expect(w.asked).toBe(0); // el permiso no se pide al abrir

    await w.controller.enable();
    expect(w.asked).toBe(1);
    const v = w.controller.getView();
    expect(v.status).toBe("on");
    expect(v.error).toBeNull();
    expect(v.inFamily).toBe(true);

    // El servidor tiene la dirección, el huso y los minutos; nada más.
    const sub = (await w.store.all())[0];
    expect(sub.endpoint).toBe("https://fcm.googleapis.com/fcm/send/phone-1");
    expect(sub.tz).toBe(TZ);
    expect(sub.family).toBe(FAM);
    expect(sub.wakes.length).toBeGreaterThan(0);
    const wire = w.wire.join("\n");
    for (const s of allDietStrings()) expect(wire).not.toContain(s);
    expect(wire).not.toMatch(/Suplemento de hoy|Un vaso de agua|title|body/);

    // La copia sí lleva el texto, en el teléfono, y el puntero a la familia.
    const copy = w.copies.at(-1)!;
    expect(copy.items.some((i) => i.title === diet.dailyMenu[0].name.es)).toBe(
      true,
    );
    expect(copy.hide).toBe(false);
    expect(copy.types).toEqual({
      supplements: true,
      meals: true,
      water: true,
      family: true,
    });
    expect(w.pointers.at(-1)).toEqual({
      family: FAM,
      epoch: 1,
      seq: 7,
      self: "SELF-PHONE-01",
    });
    expect(w.saved?.id).toBe(sub.id);
  });

  it("sin familia no manda prueba de familia ni puntero", async () => {
    const w = await world();
    await w.controller.enable();
    expect((await w.store.all())[0].family).toBeNull();
    expect(w.pointers.at(-1)).toBeNull();
    expect(w.controller.getView().inFamily).toBe(false);
  });

  it("el servicio sin llaves: «unavailable», y el permiso no se pidió", async () => {
    const w = await world({ available: false });
    await w.controller.enable();
    expect(w.controller.getView().status).toBe("unavailable");
    expect(w.asked).toBe(0);
  });

  it("sin red: lo dice y no pide permiso; permiso negado queda «denied»; cerrar el diálogo no activa nada", async () => {
    const off = await world({ offline: true });
    await off.controller.enable();
    expect(off.controller.getView().error).toBe("offline");
    expect(off.asked).toBe(0);

    const denied = await world({ ask: "denied" });
    await denied.controller.enable();
    expect(denied.controller.getView().status).toBe("denied");

    const dismissed = await world({ ask: "default" });
    await dismissed.controller.enable();
    expect(dismissed.controller.getView().error).toBe("dismissed");
    expect(dismissed.controller.getView().status).not.toBe("on");
    expect(dismissed.saved).toBeNull();
  });

  it("sin trabajador listo: «worker»; el estado no queda a medias", async () => {
    const w = await world();
    w.breakWorker();
    await w.controller.enable();
    expect(w.controller.getView().error).toBe("worker");
    expect(w.saved).toBeNull();
    expect(await w.store.all()).toEqual([]);
  });

  it("un teléfono que no puede mostrar avisos o necesita instalarse no pregunta nada", async () => {
    const a = await world({ support: "unsupported" });
    await a.controller.init();
    expect(a.controller.getView().status).toBe("unsupported");
    const b = await world({ support: "needs-install" });
    await b.controller.init();
    expect(b.controller.getView().status).toBe("needs-install");
    expect(b.wire).toEqual([]);
  });

  it("con el permiso ya negado al abrir, lo dice sin pedir nada", async () => {
    const w = await world({ permission: "denied" });
    await w.controller.init();
    expect(w.controller.getView().status).toBe("denied");
  });

  it("dos toques seguidos al botón activan una sola vez", async () => {
    const w = await world();
    await Promise.all([w.controller.enable(), w.controller.enable()]);
    expect(await w.store.all()).toHaveLength(1);
  });
});

describe("tipos, detalle y el servidor al día", () => {
  it("quitar un tipo cambia las horas del servidor y de la copia; el detalle oculto solo toca la copia", async () => {
    const w = await world();
    await w.controller.enable();
    const before = (await w.store.all())[0].wakes.length;
    await w.controller.setType("water", false);
    const after = (await w.store.all())[0].wakes;
    expect(after.length).toBeLessThan(before);
    expect(w.copies.at(-1)!.items.some((i) => i.kind === "water")).toBe(false);
    expect(w.copies.at(-1)!.types.water).toBe(false);
    expect(w.controller.getView().types.water).toBe(false);

    const calls = w.wire.length;
    await w.controller.setHide(true);
    expect(w.wire.length).toBe(calls); // nada nuevo por la red
    expect(w.copies.at(-1)!.hide).toBe(true);
    expect(w.controller.getView().hide).toBe(true);
  });

  it("quitar «familia» saca la prueba de familia del servidor", async () => {
    const w = await world({ withFamily: true });
    await w.controller.enable();
    expect((await w.store.all())[0].family).toBe(FAM);
    await w.controller.setType("family", false);
    expect((await w.store.all())[0].family).toBeNull();
  });

  it("sin cambios, una puesta al día no llama a la red", async () => {
    const w = await world();
    await w.controller.enable();
    const calls = w.wire.length;
    await w.controller.refresh();
    expect(w.wire.length).toBe(calls);
  });

  it("sin red en una puesta al día: no pierde nada y no muestra error; al volver se pone al día", async () => {
    const w = await world();
    await w.controller.enable();
    w.net.offline = true;
    await w.controller.setType("meals", false);
    expect(w.controller.getView().error).toBeNull();
    expect(w.copies.at(-1)!.types.meals).toBe(false); // la copia sí
    w.net.offline = false;
    await w.controller.refresh();
    const expected = serverWakes(
      forTypes(planItems(diet, "es", pushTexts("es").schedule), {
        supplements: true,
        meals: false,
        water: true,
        family: true,
      }),
    );
    expect((await w.store.all())[0].wakes).toEqual(expected);
    expect(w.saved?.sent).not.toBe("");
  });

  it("si el servidor ya no conoce a este teléfono (venció), se vuelve a registrar con id y token nuevos", async () => {
    const w = await world();
    await w.controller.enable();
    const oldId = w.saved!.id;
    const [sub] = await w.store.all();
    await w.store.remove(sub);
    await w.controller.setType("water", false);
    expect(w.saved!.id).not.toBe(oldId);
    expect(await w.store.all()).toHaveLength(1);
  });

  it("el navegador quitó la suscripción: se limpia todo y se avisa; el permiso quitado deja «denied»", async () => {
    const w = await world();
    await w.controller.enable();
    w.setEndpoint(null);
    await w.controller.refresh();
    expect(w.controller.getView()).toMatchObject({
      status: "off",
      error: "lost",
    });
    expect(w.saved).toBeNull();
    expect(await w.store.all()).toEqual([]);

    const x = await world();
    await x.controller.enable();
    x.setPermission("denied");
    await x.controller.refresh();
    expect(x.controller.getView().status).toBe("denied");
  });

  it("puestas al día en tropel se encadenan: una corre y otra recoge lo último", async () => {
    const w = await world();
    await w.controller.enable();
    w.done.push("meal:x");
    await Promise.all([
      w.controller.refresh(),
      w.controller.refresh(),
      w.controller.refresh(),
    ]);
    expect(w.copies.at(-1)!.done.ids).toContain("meal:x");
  });

  it("un interruptor tocado mientras una puesta al día corre no se pierde ni se revierte", async () => {
    const w = await world();
    await w.controller.enable();
    const running = w.controller.refresh();
    const toggled = Promise.all([
      w.controller.setType("water", false),
      w.controller.setHide(true),
    ]);
    await Promise.all([running, toggled]);
    expect(w.saved!.types.water).toBe(false);
    expect(w.saved!.hide).toBe(true);
    const last = w.copies.at(-1)!;
    expect(last.types.water).toBe(false);
    expect(last.hide).toBe(true);
    expect(last.items.some((i) => i.kind === "water")).toBe(false);
  });

  it("«dejar de recibir» mientras una puesta al día corre no resucita el estado", async () => {
    const w = await world();
    await w.controller.enable();
    const running = w.controller.refresh();
    await w.controller.disable();
    await running;
    expect(w.saved).toBeNull();
    expect(w.copies).toHaveLength(0);
  });
});

describe("marcar antes de la hora: el servidor salta ese despertar", () => {
  it("marcar todo lo de un despertar pide saltarlo hoy; desmarcar lo devuelve; nada viaja con etiqueta", async () => {
    const w = await world();
    const first = firstWake();
    // Cinco minutos antes del primer despertar.
    w.clock.now = Date.UTC(2026, 10, 16, 5, 0) + (first.minute - 5) * 60_000;
    await w.controller.enable();
    expect(w.saved!.skipped.ms).toEqual([]);

    w.done.push(...first.ids);
    await w.controller.refresh();
    expect(w.saved!.skipped).toEqual({
      date: "2026-11-16",
      ms: [first.minute],
    });
    const skipCall = w.wire.find((l) => l.startsWith("/api/push/skip"))!;
    expect(JSON.parse(skipCall.split(" ").slice(1).join(" "))).toMatchObject({
      date: "2026-11-16",
      m: first.minute,
      on: true,
    });
    expect(skipCall).not.toMatch(/meal:|supplement:|water:/);

    w.done.length = 0;
    await w.controller.refresh();
    expect(w.saved!.skipped.ms).toEqual([]);
    expect(w.wire.filter((l) => l.startsWith("/api/push/skip"))).toHaveLength(
      2,
    );
  });

  it("marcar solo una parte no salta nada; y un despertar de hace horas no se toca", async () => {
    const w = await world();
    const first = firstWake();
    w.clock.now = Date.UTC(2026, 10, 16, 5, 0) + (first.minute - 5) * 60_000;
    await w.controller.enable();
    if (first.ids.length > 1) {
      w.done.push(first.ids[0]);
      await w.controller.refresh();
      expect(w.saved!.skipped.ms).toEqual([]);
    }
    // Tres horas después, marcar lo de aquel despertar ya no llama al servidor.
    w.clock.now += 3 * 3_600_000;
    const skips = () =>
      w.wire.filter((l) => l.startsWith("/api/push/skip")).length;
    const before = skips();
    w.done.push(...first.ids);
    await w.controller.refresh();
    expect(skips()).toBe(before);
    expect(w.saved!.skipped.ms).toEqual([]);
  });

  it("sin red el salto queda pendiente y sale en la siguiente puesta al día", async () => {
    const w = await world();
    const first = firstWake();
    w.clock.now = Date.UTC(2026, 10, 16, 5, 0) + (first.minute - 5) * 60_000;
    await w.controller.enable();
    w.net.offline = true;
    w.done.push(...first.ids);
    await w.controller.refresh();
    expect(w.saved!.skipped.ms).toEqual([]);
    w.net.offline = false;
    await w.controller.refresh();
    expect(w.saved!.skipped.ms).toEqual([first.minute]);
  });
});

describe("dejar de recibir avisos", () => {
  it("borra la suscripción del servidor, la del navegador, el estado y la copia", async () => {
    const w = await world({ withFamily: true });
    await w.controller.enable();
    const r = await w.controller.disable();
    expect(r.server).toBe(true);
    expect(await w.store.all()).toEqual([]);
    expect(w.unsubscribed).toBe(1);
    expect(w.saved).toBeNull();
    expect(w.copies).toEqual([]);
    expect(w.controller.getView().status).toBe("off");
  });

  it("sin red igual deja de recibir en el teléfono y dice que el servidor la borrará sola", async () => {
    const w = await world();
    await w.controller.enable();
    w.net.offline = true;
    const r = await w.controller.disable();
    expect(r.server).toBe(false);
    expect(w.saved).toBeNull();
    expect(w.unsubscribed).toBe(1);
  });

  it("sin haber activado nada no toca el navegador ni la red", async () => {
    const w = await world();
    const r = await w.controller.disable();
    expect(r.server).toBe(true);
    expect(w.unsubscribed).toBe(0);
    expect(w.wire).toEqual([]);
  });
});

describe("estado propio", () => {
  it("un estado fresco trae todos los tipos prendidos y el detalle a la vista", () => {
    const s = freshPushState("i".repeat(22), "t".repeat(43));
    expect(s.types).toEqual({
      supplements: true,
      meals: true,
      water: true,
      family: true,
    });
    expect(s.hide).toBe(false);
  });
});
