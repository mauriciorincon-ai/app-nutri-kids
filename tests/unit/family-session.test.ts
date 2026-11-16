// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { familyApi } from "@/lib/family/client";
import { dayName, deviceName, type Named } from "@/lib/family/records";
import { handle } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import type { FamilyStore } from "@/lib/family/server/store";
import {
  createFamily,
  destroyFamily,
  joinFamily,
  pullSince,
  pushNamed,
  rotateFamily,
} from "@/lib/family/session";

/** Lo que jamás puede aparecer en la red: nombres, comida, notas, la frase. */
const SENTINELS = [
  "SENTINEL-NAME",
  "SENTINEL-FOOD",
  "SENTINEL-NOTE",
  "SENTINEL-MED",
];

type Wire = { url: string; body: string; headers: string };

/** Un `fetch` que pasa por la ruta real contra el doble y anota TODO lo que sale. */
function network(store: FamilyStore, ip = "203.0.113.1") {
  const wire: Wire[] = [];
  let offline = false;
  const fetcher = (async (url: string, init: RequestInit) => {
    if (offline) throw new TypeError("Failed to fetch");
    const headers = init.headers as Record<string, string>;
    wire.push({
      url,
      body: String(init.body),
      headers: JSON.stringify(headers),
    });
    const out = await handle(
      {
        op: url.replace("/api/family/", ""),
        method: init.method ?? "GET",
        body: String(init.body ?? ""),
        authorization: headers.authorization ?? null,
        ip,
      },
      store,
    );
    return new Response(JSON.stringify(out.json), { status: out.status });
  }) as unknown as typeof fetch;
  return {
    api: familyApi(fetcher),
    wire,
    setOffline: (v: boolean) => {
      offline = v;
    },
  };
}

const stamp = (t: number, by = "DEV-A") => ({ t, by });
const records = (): Named[] => [
  {
    name: "plan",
    data: {
      ...stamp(1),
      diet: { foods: ["SENTINEL-FOOD"], child: "SENTINEL-NAME" },
    },
  },
  {
    name: "profile",
    data: {
      textures: { ...stamp(1), v: ["puree"] },
      notes: {
        n1: {
          ...stamp(1),
          v: { kind: "medication", text: "SENTINEL-MED", at: "2026-11-15" },
        },
      },
    },
  },
  {
    name: dayName("2026-11-15"),
    data: {
      marks: { "meal:breakfast": { ...stamp(2), v: { at: "08:10" } } },
      notes: {
        "meal:breakfast": {
          ...stamp(2),
          v: { chips: ["rejected"], text: "SENTINEL-NOTE" },
        },
      },
    },
  },
  {
    name: deviceName("DEV-A"),
    data: {
      id: "DEV-A",
      name: "SENTINEL-NAME",
      seen: 3,
      consent: "2026-11-15",
    },
  },
];

function assertNothingInClear(wire: Wire[], phrases: string[]) {
  expect(wire.length).toBeGreaterThan(0);
  for (const w of wire) {
    const all = w.url + w.body + w.headers;
    for (const s of [
      ...SENTINELS,
      ...phrases,
      ...phrases.map((p) => p.replace(/-/g, "")),
    ]) {
      expect(all, `${w.url} lleva «${s}» en claro`).not.toContain(s);
    }
    // Ni las claves del registro en claro.
    expect(all).not.toMatch(/"marks"|"notes"|"diet"|"consent"|2026-11-15/);
  }
}

describe("la familia sobre la red, de punta a punta, contra el doble", () => {
  it("crear, subir, entrar desde otro teléfono y leer lo mismo; nada viaja en claro", async () => {
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    const { ctx, phrase } = created.value;
    expect(ctx.epoch).toBe(1);

    const up = await pushNamed(
      a.api,
      ctx,
      records().map((named) => ({ named, ver: 0 })),
    );
    expect(
      up.ok && up.value.every((p) => p.status === "ok" && p.ver === 1),
    ).toBe(true);

    const b = network(store, "198.51.100.9");
    const joined = await joinFamily(
      b.api,
      ctx.family.toLowerCase(),
      phrase.toLowerCase(),
    );
    if (!joined.ok) throw new Error(joined.reason);
    const pulled = await pullSince(b.api, joined.value, 0);
    if (!pulled.ok) throw new Error(pulled.reason);
    expect(pulled.value.unreadable).toBe(0);
    expect(
      pulled.value.items
        .map((i) => i.named)
        .sort((x, y) => x.name.localeCompare(y.name)),
    ).toEqual(records().sort((x, y) => x.name.localeCompare(y.name)));

    // Centinela sobre CADA cuerpo y encabezado que salió de los dos teléfonos.
    assertNothingInClear([...a.wire, ...b.wire], [phrase]);
  });

  it("frase equivocada: «wrong-phrase» y no se lleva nada", async () => {
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    const b = network(store);
    const wrong = await joinFamily(
      b.api,
      created.value.ctx.family,
      "0000-0000-0000-0000-0000",
    );
    expect(wrong).toEqual({ ok: false, reason: "wrong-phrase" });
    expect(await joinFamily(b.api, created.value.ctx.family, "corta")).toEqual({
      ok: false,
      reason: "wrong-phrase",
    });
    expect(await joinFamily(b.api, "nada", created.value.phrase)).toEqual({
      ok: false,
      reason: "wrong-code",
    });
    expect(await joinFamily(b.api, "Z9Z9Z9Z9Z9", created.value.phrase)).toEqual(
      { ok: false, reason: "wrong-code" },
    );
  });

  it("versión vieja: el registro vuelve como conflicto con la versión actual", async () => {
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    const day = records()[2];
    await pushNamed(a.api, created.value.ctx, [{ named: day, ver: 0 }]);
    const again = await pushNamed(a.api, created.value.ctx, [
      { named: day, ver: 0 },
    ]);
    expect(again).toEqual({
      ok: true,
      value: [{ name: day.name, status: "conflict", ver: 1 }],
    });
  });

  it("sacar un teléfono: frase nueva, todo re-cifrado; el de fuera recibe 403 y no abre nada", async () => {
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    await pushNamed(
      a.api,
      created.value.ctx,
      records().map((named) => ({ named, ver: 0 })),
    );
    const out = network(store);
    const outside = await joinFamily(
      out.api,
      created.value.ctx.family,
      created.value.phrase,
    );
    if (!outside.ok) throw new Error(outside.reason);

    const keep = records().filter((r) => r.name !== deviceName("DEV-B"));
    const rotated = await rotateFamily(a.api, created.value.ctx, keep);
    if (!rotated.ok) throw new Error(rotated.reason);
    expect(rotated.value.ctx.epoch).toBe(2);
    expect(rotated.value.phrase).not.toBe(created.value.phrase);
    expect(rotated.value.pushed).toHaveLength(keep.length);

    // El teléfono sacado: 403 al leer y al escribir, y con su clave vieja no abre lo nuevo.
    expect(await pullSince(out.api, outside.value, 0)).toEqual({
      ok: false,
      reason: "denied",
    });
    expect(
      await pushNamed(out.api, outside.value, [
        { named: records()[2], ver: 0 },
      ]),
    ).toEqual({
      ok: false,
      reason: "denied",
    });
    expect(
      await joinFamily(out.api, created.value.ctx.family, created.value.phrase),
    ).toEqual({
      ok: false,
      reason: "wrong-phrase",
    });
    const stolen = await store.pull(created.value.ctx.family, 2, 0, 1e9, 1);
    const { openNamed } = await import("@/lib/family/records");
    for (const rec of stolen!.records) {
      expect(
        await openNamed(outside.value.keys, outside.value.family, 2, rec),
      ).toBeNull();
    }
    // Con la frase nueva sí se entra y se lee todo.
    const back = await joinFamily(
      out.api,
      created.value.ctx.family,
      rotated.value.phrase,
    );
    if (!back.ok) throw new Error(back.reason);
    const all = await pullSince(out.api, back.value, 0);
    expect(all.ok && all.value.items.length).toBe(keep.length);
    assertNothingInClear(
      [...a.wire, ...out.wire],
      [created.value.phrase, rotated.value.phrase],
    );
  });

  it("borrar lo compartido: la familia ya no existe para nadie", async () => {
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    expect(await destroyFamily(a.api, created.value.ctx)).toEqual({
      ok: true,
      value: null,
    });
    expect(
      await joinFamily(a.api, created.value.ctx.family, created.value.phrase),
    ).toEqual({
      ok: false,
      reason: "wrong-code",
    });
    expect(await destroyFamily(a.api, created.value.ctx)).toEqual({
      ok: false,
      reason: "denied",
    });
  });

  it("sin red: cada paso dice «offline» y no lanza", async () => {
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    a.setOffline(true);
    const ctx = created.value.ctx;
    expect(await createFamily(a.api)).toEqual({ ok: false, reason: "offline" });
    expect(await joinFamily(a.api, ctx.family, created.value.phrase)).toEqual({
      ok: false,
      reason: "offline",
    });
    expect(await pullSince(a.api, ctx, 0)).toEqual({
      ok: false,
      reason: "offline",
    });
    expect(
      await pushNamed(a.api, ctx, [{ named: records()[2], ver: 0 }]),
    ).toEqual({ ok: false, reason: "offline" });
    expect(await rotateFamily(a.api, ctx, [])).toEqual({
      ok: false,
      reason: "offline",
    });
    expect(await destroyFamily(a.api, ctx)).toEqual({
      ok: false,
      reason: "offline",
    });
    expect(await a.api.health()).toEqual({
      ok: false,
      status: 0,
      error: "offline",
    });
  });

  it("sin almacén en el servidor: «unavailable»", async () => {
    const fetcher = (async () =>
      new Response(JSON.stringify({ error: "unavailable" }), {
        status: 503,
      })) as unknown as typeof fetch;
    expect(await createFamily(familyApi(fetcher))).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("código repetido: reintenta con otro; demasiadas familias: «busy»", async () => {
    let n = 0;
    const statuses = [409, 201];
    const fetcher = (async () => {
      const status = statuses[n++] ?? 429;
      return new Response(
        JSON.stringify(status === 201 ? { epoch: 1 } : { error: "x" }),
        { status },
      );
    }) as unknown as typeof fetch;
    const api = familyApi(fetcher);
    expect((await createFamily(api)).ok).toBe(true);
    expect(await createFamily(api)).toEqual({ ok: false, reason: "busy" });
    const always409 = familyApi(
      (async () =>
        new Response("{}", { status: 409 })) as unknown as typeof fetch,
    );
    expect(await createFamily(always409)).toEqual({
      ok: false,
      reason: "error",
    });
  });

  it("muchos registros: sube en tandas de ≤ 50 y baja por páginas; lo que no abre se cuenta", async () => {
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    const ctx = created.value.ctx;
    const days: Named[] = Array.from({ length: 120 }, (_, i) => ({
      name: dayName(
        `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, "0")}`,
      ),
      data: { marks: {}, notes: {} },
    }));
    const big: Named = {
      name: "plan",
      data: { ...stamp(1), diet: { pad: "x".repeat(150_000) } },
    };
    const up = await pushNamed(
      a.api,
      ctx,
      [big, ...days].map((named) => ({ named, ver: 0 })),
    );
    expect(up.ok && up.value.length).toBe(121);
    const pushes = a.wire.filter((w) => w.url.endsWith("/push"));
    expect(pushes.length).toBeGreaterThanOrEqual(3);
    for (const p of pushes)
      expect(
        (JSON.parse(p.body).records as unknown[]).length,
      ).toBeLessThanOrEqual(50);

    // Un registro ajeno (de otra clave) se deja y se cuenta, sin tumbar la bajada.
    await store.push(
      ctx.family,
      ctx.epoch,
      [
        {
          id: "x".repeat(22),
          kind: "item",
          ver: 0,
          iv: "i".repeat(16),
          ct: "c".repeat(40),
        },
      ],
      1000,
      1,
    );
    const all = await pullSince(a.api, ctx, 0);
    expect(all.ok && all.value.items.length).toBe(121);
    expect(all.ok && all.value.unreadable).toBe(1);
  });

  it("los errores del servidor se traducen a motivos llanos (lleno, sin espacio, otro)", async () => {
    const answer = (status: number, error: string) =>
      familyApi(
        (async () =>
          new Response(JSON.stringify({ error }), {
            status,
          })) as unknown as typeof fetch,
      );
    expect(await createFamily(answer(503, "full"))).toEqual({
      ok: false,
      reason: "full",
    });
    expect(await createFamily(answer(500, "x"))).toEqual({
      ok: false,
      reason: "error",
    });
    const store = createMemoryStore({ isolated: true });
    const created = await createFamily(network(store).api);
    if (!created.ok) throw new Error(created.reason);
    const full = await pushNamed(answer(507, "x"), created.value.ctx, [
      { named: records()[2], ver: 0 },
    ]);
    expect(full).toEqual({ ok: false, reason: "full" });
    const garbage = familyApi(
      (async () =>
        new Response("no es json", { status: 500 })) as unknown as typeof fetch,
    );
    expect(await garbage.health()).toEqual({
      ok: false,
      status: 500,
      error: "error",
      data: {},
    });
  });

  it("baja página por página siguiendo la última seq", async () => {
    const pages = [
      { seq: 9, more: true, records: [] as unknown[] },
      { seq: 9, more: false, records: [] as unknown[] },
    ];
    const store = createMemoryStore({ isolated: true });
    const a = network(store);
    const created = await createFamily(a.api);
    if (!created.ok) throw new Error(created.reason);
    const ctx = created.value.ctx;
    await pushNamed(
      a.api,
      ctx,
      records().map((named) => ({ named, ver: 0 })),
    );
    const real = await store.pull(ctx.family, ctx.epoch, 0, 1e9, 1);
    pages[0].records = real!.records.slice(0, 2);
    pages[1].records = real!.records.slice(2);
    const sinces: number[] = [];
    const fetcher = (async (_url: string, init: RequestInit) => {
      sinces.push(JSON.parse(String(init.body)).since);
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    }) as unknown as typeof fetch;
    const all = await pullSince(familyApi(fetcher), ctx, 0);
    expect(all.ok && all.value.items.length).toBe(4);
    expect(sinces).toEqual([0, real!.records[1].seq]);
  });

  it("sin fetch inyectado usa el del navegador, siempre hacia /api/family", async () => {
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ available: true, store: "memory" })),
    );
    vi.stubGlobal("fetch", spy);
    try {
      expect((await familyApi().health()).ok).toBe(true);
      expect((spy.mock.calls[0] as unknown[])[0]).toBe("/api/family/health");
      expect(
        ((spy.mock.calls[0] as unknown[])[1] as RequestInit).credentials,
      ).toBe("omit");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
