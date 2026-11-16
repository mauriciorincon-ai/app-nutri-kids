// @vitest-environment node
import { describe, expect, it } from "vitest";

import { tokenHash } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import { signLikeQstash } from "@/lib/push/qstash";
import { createMemoryPushStore } from "@/lib/push/server/memory";
import { memorySender, pushDeps } from "@/lib/push/server/deps";
import {
  TICK_PATH,
  fetchSender,
  handlePush,
  type Incoming,
  type PushDeps,
} from "@/lib/push/server/handler";
import {
  FAMILY_WAKES_PER_DAY,
  MAX_PER_FAMILY,
  MAX_SUBS,
  REQUESTS_PER_IP_MIN,
  SUBSCRIBES_PER_IP_DAY,
} from "@/lib/push/server/limits";
import {
  decodeWakes,
  encodeWakes,
  selectPushStore,
  type PushStore,
  type PushSub,
} from "@/lib/push/server/store";
import { createUpstashPushStore } from "@/lib/push/server/upstash";
import { generateVapidKeys, importVapid } from "@/lib/push/vapid";

const NOW = Date.UTC(2026, 10, 16, 12, 0); // lunes 07:00 en Bogotá
const SEVEN = 7 * 60;
const TOKEN = "T".repeat(43);
const OTHER = "O".repeat(43);
const FAM = "A1B2C3D4E5";
const FAM_TOKEN = "F".repeat(43);
const EP = (n: number) => `https://fcm.googleapis.com/fcm/send/phone-${n}`;
const SIGNING = "llave-de-prueba";

type Sent = { endpoint: string; authorization: string };

async function setup(sendStatus = 201) {
  const store = createMemoryPushStore({ isolated: true, now: () => NOW });
  const family = createMemoryStore({ isolated: true, now: () => NOW });
  await family.create(FAM, "s".repeat(22), tokenHash(FAM_TOKEN), 99);
  const pair = await generateVapidKeys();
  const vapid = await importVapid(
    pair.publicKey,
    pair.privateKey,
    "mailto:avisos@example.org",
  );
  const sent: Sent[] = [];
  const deps: PushDeps = {
    store,
    family,
    vapid,
    signingKeys: [SIGNING],
    sender: async (endpoint, authorization) => {
      sent.push({ endpoint, authorization });
      return sendStatus;
    },
  };
  let ip = 0;
  const call = (
    op: string,
    body: unknown,
    extra: Partial<Incoming> = {},
    now = NOW,
  ) =>
    handlePush(
      {
        op,
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        authorization: null,
        signature: null,
        ip: `10.0.0.${ip++ % 250}`,
        ...extra,
      },
      deps,
      now,
    );
  const subscribe = async (
    n: number,
    opts: {
      token?: string;
      family?: boolean;
      wakes?: { m: number; d: number }[];
    } = {},
  ) => {
    const r = await call("subscribe", {
      endpoint: EP(n),
      token: opts.token ?? TOKEN,
      tz: "America/Bogota",
      wakes: opts.wakes ?? [{ m: SEVEN, d: 127 }],
      family: opts.family ? { code: FAM, token: FAM_TOKEN } : null,
    });
    return r.json.id as string;
  };
  const tick = async (now = NOW, body = "") =>
    call(
      "tick",
      body,
      {
        signature: await signLikeQstash(
          SIGNING,
          `https://app.example${TICK_PATH}`,
          body,
          now,
        ),
      },
      now,
    );
  return { store, family, deps, sent, call, subscribe, tick, pair };
}

describe("la ruta de avisos: salud y disponibilidad", () => {
  it("health dice si hay registro y llave pública; sin ellas, todo 503", async () => {
    const { deps, call } = await setup();
    const h = await call("health", "", { method: "GET" });
    expect(h.json).toMatchObject({ available: true, store: "memory" });
    expect(typeof h.json.key).toBe("string");
    const none = await handlePush(
      {
        op: "health",
        method: "GET",
        body: "",
        authorization: null,
        signature: null,
        ip: "x",
      },
      { ...deps, vapid: null },
    );
    expect(none.json).toEqual({ available: false, store: "memory", key: null });
    for (const op of ["subscribe", "tick"]) {
      const r = await handlePush(
        {
          op,
          method: "POST",
          body: "{}",
          authorization: null,
          signature: null,
          ip: "x",
        },
        { ...deps, store: null },
      );
      expect(r.status).toBe(503);
    }
  });

  it("método, operación, tamaño, JSON y forma: códigos fijos", async () => {
    const { call } = await setup();
    expect((await call("subscribe", "{}", { method: "GET" })).status).toBe(405);
    expect((await call("constructor", {})).status).toBe(404);
    expect((await call("toString", {})).status).toBe(404);
    expect((await call("subscribe", "x".repeat(9000))).status).toBe(413);
    expect((await call("subscribe", "{no")).status).toBe(400);
    expect((await call("subscribe", { endpoint: EP(1) })).json).toEqual({
      error: "shape",
    });
  });
});

describe("suscribirse: solo dirección, horas sin etiqueta, zona y huella", () => {
  it("guarda lo mínimo; un campo de más (texto, etiqueta) se rechaza", async () => {
    const { store, subscribe, call } = await setup();
    const id = await subscribe(1);
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const saved = await store.get(id);
    expect(saved).toEqual({
      id,
      endpoint: EP(1),
      tokenHash: tokenHash(TOKEN),
      tz: "America/Bogota",
      wakes: [{ m: SEVEN, d: 127 }],
      family: null,
      famTh: null,
    });
    expect(JSON.stringify(saved)).not.toContain(TOKEN);
    const extra = await call("subscribe", {
      endpoint: EP(2),
      token: TOKEN,
      tz: "America/Bogota",
      wakes: [{ m: SEVEN, d: 127, label: "Desayuno" }],
      family: null,
    });
    expect(extra.status).toBe(400);
    const extra2 = await call("subscribe", {
      endpoint: EP(2),
      token: TOKEN,
      tz: "America/Bogota",
      wakes: [],
      family: null,
      text: "Merienda",
    });
    expect(extra2.status).toBe(400);
  });

  it("una dirección que no es de un servicio de push se rechaza (sin SSRF)", async () => {
    const { call } = await setup();
    const r = await call("subscribe", {
      endpoint: "https://169.254.169.254/latest",
      token: TOKEN,
      tz: "UTC",
      wakes: [],
      family: null,
    });
    expect(r.status).toBe(400);
  });

  it("zona horaria inventada, minuto fuera de rango o días vacíos: 400", async () => {
    const { call } = await setup();
    const base = { endpoint: EP(1), token: TOKEN, family: null };
    for (const bad of [
      { ...base, tz: "Marte/Olympus", wakes: [] },
      { ...base, tz: "UTC", wakes: [{ m: 1440, d: 1 }] },
      { ...base, tz: "UTC", wakes: [{ m: 0, d: 0 }] },
      {
        ...base,
        tz: "UTC",
        wakes: Array.from({ length: 97 }, () => ({ m: 1, d: 1 })),
      },
    ])
      expect((await call("subscribe", bad)).status).toBe(400);
  });

  it("para los avisos de la familia hay que probar que se es de ella (token del S7)", async () => {
    const { store, call, subscribe } = await setup();
    const denied = await call("subscribe", {
      endpoint: EP(1),
      token: TOKEN,
      tz: "UTC",
      wakes: [],
      family: { code: FAM, token: OTHER },
    });
    expect(denied).toEqual({ status: 403, json: { error: "denied" } });
    const ghost = await call("subscribe", {
      endpoint: EP(1),
      token: TOKEN,
      tz: "UTC",
      wakes: [],
      family: { code: "ZZZZZZZZZZ", token: FAM_TOKEN },
    });
    expect(ghost.status).toBe(403);
    const id = await subscribe(1, { family: true });
    expect((await store.get(id))?.family).toBe(FAM);
  });

  it("topes: por familia, en total y por IP al día", async () => {
    const { store, call, subscribe } = await setup();
    for (let i = 0; i < MAX_PER_FAMILY; i++)
      await store.add(
        {
          id: `f${i}`.padEnd(22, "x"),
          endpoint: EP(i),
          tokenHash: "h",
          tz: "UTC",
          wakes: [],
          family: FAM,
          famTh: tokenHash(FAM_TOKEN),
        },
        MAX_SUBS,
        MAX_PER_FAMILY,
        9,
      );
    const r = await call("subscribe", {
      endpoint: EP(99),
      token: TOKEN,
      tz: "UTC",
      wakes: [],
      family: { code: FAM, token: FAM_TOKEN },
    });
    expect(r).toEqual({ status: 409, json: { error: "family-full" } });
    expect(await subscribe(100)).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const full = await setup();
    for (let i = 0; i < MAX_SUBS; i++)
      await full.store.add(
        {
          id: `s${i}`.padEnd(22, "x"),
          endpoint: EP(i),
          tokenHash: "h",
          tz: "UTC",
          wakes: [],
          family: null,
          famTh: null,
        },
        MAX_SUBS,
        MAX_PER_FAMILY,
        9,
      );
    const r2 = await full.call("subscribe", {
      endpoint: EP(MAX_SUBS + 5),
      token: TOKEN,
      tz: "UTC",
      wakes: [],
      family: null,
    });
    expect(r2.status).toBe(503);

    const ipCase = await setup();
    const statuses: number[] = [];
    for (let i = 0; i <= SUBSCRIBES_PER_IP_DAY; i++) {
      const res = await ipCase.call(
        "subscribe",
        { endpoint: EP(i), token: TOKEN, tz: "UTC", wakes: [], family: null },
        { ip: "1.2.3.4" },
      );
      statuses.push(res.status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("más de 60 peticiones por minuto desde una IP: 429", async () => {
    const { call } = await setup();
    let last = 0;
    for (let i = 0; i <= REQUESTS_PER_IP_MIN; i++)
      last = (
        await call("unsubscribe", { id: "x".repeat(22) }, { ip: "9.9.9.9" })
      ).status;
    expect(last).toBe(429);
  });
});

describe("con el token del teléfono: cambiar horas, saltar, dejar de recibir", () => {
  it("token equivocado o suscripción inexistente: el mismo 403", async () => {
    const { call, subscribe } = await setup();
    const id = await subscribe(1);
    const body = { id, date: "2026-11-16", m: SEVEN, on: true };
    expect(await call("skip", body)).toEqual({
      status: 403,
      json: { error: "denied" },
    });
    expect(
      await call("skip", body, { authorization: `Bearer ${OTHER}` }),
    ).toEqual({
      status: 403,
      json: { error: "denied" },
    });
    expect(
      await call(
        "skip",
        { ...body, id: "n".repeat(22) },
        { authorization: `Bearer ${TOKEN}` },
      ),
    ).toEqual({ status: 403, json: { error: "denied" } });
    expect(
      (await call("skip", body, { authorization: `Bearer ${TOKEN}` })).status,
    ).toBe(200);
  });

  it("update cambia horas, zona, dirección y familia; probarla sigue siendo obligatorio", async () => {
    const { store, call, subscribe } = await setup();
    const id = await subscribe(1);
    const auth = { authorization: `Bearer ${TOKEN}` };
    const ok = await call(
      "update",
      {
        id,
        endpoint: EP(2),
        tz: "Europe/Madrid",
        wakes: [{ m: 600, d: 2 }],
        family: { code: FAM, token: FAM_TOKEN },
      },
      auth,
    );
    expect(ok.status).toBe(200);
    expect(await store.get(id)).toMatchObject({
      endpoint: EP(2),
      tz: "Europe/Madrid",
      wakes: [{ m: 600, d: 2 }],
      family: FAM,
    });
    const bad = await call(
      "update",
      {
        id,
        endpoint: EP(2),
        tz: "UTC",
        wakes: [],
        family: { code: FAM, token: OTHER },
      },
      auth,
    );
    expect(bad.status).toBe(403);
    await call(
      "update",
      { id, endpoint: EP(2), tz: "UTC", wakes: [], family: null },
      auth,
    );
    expect(await store.family(FAM)).toEqual([]);
  });

  it("update hacia una familia llena: 409", async () => {
    const { store, call, subscribe } = await setup();
    const id = await subscribe(1);
    for (let i = 0; i < MAX_PER_FAMILY; i++)
      await store.add(
        {
          id: `f${i}`.padEnd(22, "x"),
          endpoint: EP(i),
          tokenHash: "h",
          tz: "UTC",
          wakes: [],
          family: FAM,
          famTh: tokenHash(FAM_TOKEN),
        },
        MAX_SUBS,
        MAX_PER_FAMILY,
        9,
      );
    const r = await call(
      "update",
      {
        id,
        endpoint: EP(1),
        tz: "UTC",
        wakes: [],
        family: { code: FAM, token: FAM_TOKEN },
      },
      { authorization: `Bearer ${TOKEN}` },
    );
    expect(r).toEqual({ status: 409, json: { error: "family-full" } });
  });

  it("dejar de recibir borra la suscripción del servidor", async () => {
    const { store, call, subscribe } = await setup();
    const id = await subscribe(1, { family: true });
    expect(
      (await call("unsubscribe", { id }, { authorization: `Bearer ${TOKEN}` }))
        .status,
    ).toBe(200);
    expect(await store.get(id)).toBeNull();
    expect(await store.family(FAM)).toEqual([]);
  });
});

describe("el disparador: firmado, idempotente y con toques vacíos", () => {
  it("sin firma válida no envía nada (401)", async () => {
    const { call, subscribe, sent } = await setup();
    await subscribe(1);
    expect(await call("tick", "")).toEqual({
      status: 401,
      json: { error: "signature" },
    });
    const forged = await signLikeQstash(
      "otra-llave",
      `https://app.example${TICK_PATH}`,
      "",
      NOW,
    );
    expect((await call("tick", "", { signature: forged })).status).toBe(401);
    expect(sent).toEqual([]);
  });

  it("toca a la hora con VAPID, sin cuerpo; un toque doble (o tarde) es UN aviso", async () => {
    const { subscribe, tick, sent, pair } = await setup();
    await subscribe(1);
    await subscribe(2, { wakes: [{ m: 9 * 60, d: 127 }] });
    expect((await tick(NOW - 60_000)).json).toMatchObject({ due: 0, sent: 0 });
    const r = await tick();
    expect(r.json).toMatchObject({
      subs: 2,
      due: 1,
      sent: 1,
      skipped: 0,
      gone: 0,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].endpoint).toBe(EP(1));
    expect(sent[0].authorization).toMatch(
      new RegExp(`^vapid t=.+, k=${pair.publicKey}$`),
    );
    // El mismo despertar en el siguiente tick (5 min después) ya no se envía.
    expect((await tick(NOW + 5 * 60_000)).json).toMatchObject({
      due: 0,
      sent: 0,
    });
    expect((await tick()).json).toMatchObject({ due: 0 });
    expect(sent).toHaveLength(1);
  });

  it("lo saltado no se envía; deshacer el salto vuelve a avisar", async () => {
    const { call, subscribe, tick, sent } = await setup();
    const id = await subscribe(1);
    const auth = { authorization: `Bearer ${TOKEN}` };
    await call("skip", { id, date: "2026-11-16", m: SEVEN, on: true }, auth);
    expect((await tick()).json).toMatchObject({ skipped: 1, sent: 0 });
    await call("skip", { id, date: "2026-11-16", m: SEVEN, on: false }, auth);
    expect((await tick()).json).toMatchObject({ skipped: 0, sent: 1 });
    expect(sent).toHaveLength(1);
  });

  it("404 o 410 del servicio borran la suscripción; un 500 solo se cuenta", async () => {
    const gone = await setup(410);
    const id = await gone.subscribe(1);
    expect((await gone.tick()).json).toMatchObject({ gone: 1 });
    expect(await gone.store.get(id)).toBeNull();
    const down = await setup(500);
    const id2 = await down.subscribe(1);
    expect((await down.tick()).json).toMatchObject({ failed: 1 });
    expect(await down.store.get(id2)).not.toBeNull();
  });
});

describe("avisar a la familia", () => {
  it("con el token de la familia, toca a los demás de la familia (no a quien avisa)", async () => {
    const { call, subscribe, sent } = await setup();
    const me = await subscribe(1, { family: true });
    await subscribe(2, { family: true });
    await subscribe(3); // sin avisos de la familia
    const r = await call(
      "family",
      { family: FAM, from: me },
      { authorization: `Bearer ${FAM_TOKEN}` },
    );
    expect(r).toEqual({ status: 200, json: { sent: 1 } });
    expect(sent.map((s) => s.endpoint)).toEqual([EP(2)]);
  });

  it("sin token de la familia: 403; más de 30 al día: 429", async () => {
    const { call, subscribe } = await setup();
    await subscribe(1, { family: true });
    expect((await call("family", { family: FAM, from: null })).status).toBe(
      403,
    );
    expect(
      (
        await call(
          "family",
          { family: FAM, from: null },
          { authorization: `Bearer ${OTHER}` },
        )
      ).status,
    ).toBe(403);
    let last = 0;
    for (let i = 0; i <= FAMILY_WAKES_PER_DAY; i++)
      last = (
        await call(
          "family",
          { family: FAM, from: null },
          { authorization: `Bearer ${FAM_TOKEN}` },
        )
      ).status;
    expect(last).toBe(429);
  });

  it("sin almacén de la familia, nadie prueba ser de ella", async () => {
    const { deps } = await setup();
    const r = await handlePush(
      {
        op: "family",
        method: "POST",
        body: JSON.stringify({ family: FAM, from: null }),
        authorization: `Bearer ${FAM_TOKEN}`,
        signature: null,
        ip: "x",
      },
      { ...deps, family: null },
      NOW,
    );
    expect(r.status).toBe(403);
  });
});

describe("lo que el auditor del S8 pidió cerrar en el servidor", () => {
  it("un teléfono, una dirección: suscribirse otra vez con la misma retira el registro viejo y manda UN toque", async () => {
    const { store, subscribe, tick, sent } = await setup();
    const first = await subscribe(1);
    const second = await subscribe(1); // estado local perdido, suscripción del navegador viva
    expect(second).not.toBe(first);
    expect(await store.get(first)).toBeNull();
    expect((await store.all()).map((x) => x.id)).toEqual([second]);
    await tick();
    expect(sent).toHaveLength(1);
  });

  it("update hacia una dirección que ya usa otro registro lo retira", async () => {
    const { store, call, subscribe } = await setup();
    const a = await subscribe(1, { token: TOKEN });
    const b = await subscribe(2, { token: OTHER });
    await call(
      "update",
      { id: b, endpoint: EP(1), tz: "UTC", wakes: [], family: null },
      { authorization: `Bearer ${OTHER}` },
    );
    expect(await store.get(a)).toBeNull();
    expect((await store.get(b))?.endpoint).toBe(EP(1));
  });

  it("update rechaza una dirección fuera de la lista de servicios de push", async () => {
    const { call, subscribe } = await setup();
    const id = await subscribe(1);
    const r = await call(
      "update",
      {
        id,
        endpoint: "https://intranet.example/send",
        tz: "UTC",
        wakes: [],
        family: null,
      },
      { authorization: `Bearer ${TOKEN}` },
    );
    expect(r).toEqual({ status: 400, json: { error: "shape" } });
  });

  it("quien salió de la familia por un token nuevo deja de recibir sus toques", async () => {
    const { family, call, subscribe, sent } = await setup();
    const me = await subscribe(1, { family: true });
    await subscribe(2, { family: true });
    // La familia saca a un teléfono: el token cambia (S7 · rotate) y el teléfono 2 no lo renovó.
    const NEW = "N".repeat(43);
    await family.rotate(FAM, 1, "t".repeat(22), tokenHash(NEW), 99);
    const before = await call(
      "family",
      { family: FAM, from: me },
      { authorization: `Bearer ${NEW}` },
    );
    expect(before).toEqual({ status: 200, json: { sent: 0 } });
    expect(sent).toEqual([]);
  });

  it("un servicio que rechaza la dirección (400/401/403) 3 veces la purga; un 500 jamás", async () => {
    for (const status of [400, 401, 403]) {
      const bad = await setup(status);
      const id = await bad.subscribe(1);
      await bad.tick();
      expect(await bad.store.get(id)).not.toBeNull();
      for (const minute of [5, 10]) {
        // Otro despertar: se agrega al teléfono para que el disparador lo vuelva a tocar.
        const sub = (await bad.store.get(id))!;
        await bad.store.put(
          { ...sub, wakes: [{ m: SEVEN - minute, d: 127 }] },
          sub,
          9,
          99,
        );
        await bad.tick(NOW - minute * 60_000);
      }
      expect(await bad.store.get(id)).toBeNull();
    }
    const down = await setup(500);
    const id = await down.subscribe(1);
    for (let i = 0; i < 5; i++) {
      await down.store.put(
        { ...(await down.store.get(id))!, wakes: [{ m: SEVEN - i, d: 127 }] },
        (await down.store.get(id))!,
        9,
        99,
      );
      await down.tick(NOW - i * 60_000);
    }
    expect(await down.store.get(id)).not.toBeNull();
  });

  it("el hash de IP lleva la sal del servidor: otra sal, otra clave", async () => {
    const a = await setup();
    const b = await setup();
    a.deps.ipSalt = "sal-a";
    b.deps.ipSalt = "sal-b";
    const body = JSON.stringify({ id: "x".repeat(22) });
    const send = (d: PushDeps) =>
      handlePush(
        {
          op: "unsubscribe",
          method: "POST",
          body,
          authorization: null,
          signature: null,
          ip: "10.9.9.9",
        },
        d,
        NOW,
      );
    // Con la MISMA IP y el mismo almacén, dos sales cuentan en cubos distintos.
    for (let i = 0; i < REQUESTS_PER_IP_MIN; i++) await send(a.deps);
    expect((await send(a.deps)).status).toBe(429);
    const shared = { ...b.deps, store: a.deps.store };
    expect((await send(shared)).status).not.toBe(429);
  });

  it("sin llaves de firma configuradas el disparador falla cerrado, aunque la firma esté bien hecha", async () => {
    const { deps, subscribe, sent } = await setup();
    await subscribe(1);
    const signature = await signLikeQstash(
      SIGNING,
      `https://app.example${TICK_PATH}`,
      "",
      NOW,
    );
    const r = await handlePush(
      {
        op: "tick",
        method: "POST",
        body: "",
        authorization: null,
        signature,
        ip: "10.0.0.1",
      },
      { ...deps, signingKeys: [] },
      NOW,
    );
    expect(r).toEqual({ status: 401, json: { error: "signature" } });
    expect(sent).toEqual([]);
  });

  it("un servicio de push que no contesta se da por perdido (tiempo límite): 0 y sin retener el lote", async () => {
    const hang = fetchSender(
      ((_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          (init.signal as AbortSignal).addEventListener("abort", () =>
            reject(new Error("timeout")),
          ),
        )) as unknown as typeof fetch,
      20,
    );
    expect(await hang(EP(1), "v")).toBe(0);
  });
});

describe("el emisor real: POST vacío, sin seguir redirecciones", () => {
  it("manda solo VAPID, TTL y urgencia; sin cuerpo; sin red, 0", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const send = fetchSender((async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch);
    expect(await send(EP(1), "vapid t=x, k=y")).toBe(201);
    expect(calls[0].url).toBe(EP(1));
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBeUndefined();
    expect(calls[0].init.redirect).toBe("manual");
    expect(calls[0].init.headers).toEqual({
      authorization: "vapid t=x, k=y",
      ttl: "600",
      urgency: "normal",
      "content-length": "0",
    });
    const offline = fetchSender((async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch);
    expect(await offline(EP(1), "v")).toBe(0);
  });

  it("el doble de la CI no sale a la red y dice «entregado»", async () => {
    expect(await memorySender(EP(7), "v")).toBe(201);
    expect((globalThis as { __nkPushSent?: string[] }).__nkPushSent).toContain(
      EP(7),
    );
  });
});

describe("qué almacén y qué llaves usa el servidor", () => {
  it("FAMILY_STORE=memory → el doble (y el emisor doble); dentro de Vercel se niega", async () => {
    const pair = await generateVapidKeys();
    const env = {
      FAMILY_STORE: "memory",
      VAPID_PUBLIC_KEY: pair.publicKey,
      VAPID_PRIVATE_KEY: pair.privateKey,
      VAPID_SUBJECT: "mailto:avisos@example.org",
      QSTASH_CURRENT_SIGNING_KEY: "a",
    };
    const d = await pushDeps(env);
    expect(d.store?.label).toBe("memory");
    expect(d.vapid?.publicKey).toBe(pair.publicKey);
    expect(d.signingKeys).toEqual(["a"]);
    expect(d.sender).toBe(memorySender);
    expect((await pushDeps({ ...env, VERCEL: "1" })).store).toBeNull();
    expect((await pushDeps({ FAMILY_STORE: "memory" })).vapid).toBeNull();
  });

  it("con Upstash → la base real; sin nada → null", () => {
    expect(
      selectPushStore({ KV_REST_API_URL: "https://db", KV_REST_API_TOKEN: "t" })
        ?.label,
    ).toBe("real");
    expect(selectPushStore({})).toBeNull();
  });

  it("las horas se guardan como «m:d,…» y lo que no encaja se descarta", () => {
    expect(
      encodeWakes([
        { m: 420, d: 127 },
        { m: 600, d: 2 },
      ]),
    ).toBe("420:127,600:2");
    expect(decodeWakes("420:127,basura,600:2")).toEqual([
      { m: 420, d: 127 },
      { m: 600, d: 2 },
    ]);
    expect(decodeWakes("")).toEqual([]);
  });
});

/** Un Redis de mentira que entiende los comandos que usa el registro (REST y pipeline). */
function fakeRedis(now: () => number) {
  const data = new Map<string, unknown>();
  const exp = new Map<string, number>();
  const sent: string[][] = [];
  const live = (k: string) => {
    const e = exp.get(k);
    if (e !== undefined && e <= now()) {
      data.delete(k);
      exp.delete(k);
    }
    return data.get(k);
  };
  function run(cmd: string[]): unknown {
    sent.push(cmd);
    const [op, key, ...rest] = cmd;
    switch (op) {
      case "HSET": {
        const h = (live(key) as Map<string, string>) ?? new Map();
        for (let i = 0; i < rest.length; i += 2) h.set(rest[i], rest[i + 1]);
        data.set(key, h);
        return rest.length / 2;
      }
      case "HGETALL": {
        const h = live(key) as Map<string, string> | undefined;
        return h ? [...h.entries()].flat() : [];
      }
      case "EXPIRE":
        if (rest[1] === "NX" && exp.has(key)) return 0;
        exp.set(key, now() + Number(rest[0]) * 1000);
        return 1;
      case "SADD": {
        const s = (live(key) as Set<string>) ?? new Set();
        rest.forEach((m) => s.add(m));
        data.set(key, s);
        return 1;
      }
      case "SREM": {
        const s = live(key) as Set<string> | undefined;
        rest.forEach((m) => s?.delete(m));
        return 1;
      }
      case "SMEMBERS":
        return [...((live(key) as Set<string>) ?? [])];
      case "SCARD":
        return ((live(key) as Set<string>) ?? new Set()).size;
      case "DEL":
        [key, ...rest].forEach((k) => data.delete(k));
        return 1;
      case "EXISTS":
        return live(key) === undefined ? 0 : 1;
      case "GET": {
        const v = live(key);
        return v === undefined ? null : v;
      }
      case "SET": {
        if (rest.includes("NX") && live(key) !== undefined) return null;
        data.set(key, rest[0]);
        const ex = rest.indexOf("EX");
        if (ex >= 0) exp.set(key, now() + Number(rest[ex + 1]) * 1000);
        return "OK";
      }
      case "INCR": {
        const n = Number(live(key) ?? 0) + 1;
        data.set(key, String(n));
        return n;
      }
      default:
        throw new Error(`comando no previsto: ${op}`);
    }
  }
  const fetcher = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (url.endsWith("/pipeline"))
      return Response.json(
        (body as string[][]).map((c) => ({ result: run(c) })),
      );
    return Response.json({ result: run(body as string[]) });
  }) as unknown as typeof fetch;
  return { fetcher, sent, data };
}

const SUB = (n: number, family: string | null = null): PushSub => ({
  id: `id${n}`.padEnd(22, "x"),
  endpoint: EP(n),
  tokenHash: "h".repeat(64),
  tz: "America/Bogota",
  wakes: [{ m: SEVEN, d: 127 }],
  family,
  famTh: family ? "t".repeat(64) : null,
});

describe.each([
  [
    "memoria",
    (now: () => number) => createMemoryPushStore({ isolated: true, now }),
  ],
  [
    "Upstash",
    (now: () => number) =>
      createUpstashPushStore(
        "https://db.example/",
        "SECRET",
        fakeRedis(now).fetcher,
      ),
  ],
] as const)("contrato del registro (%s)", (_name, make) => {
  let t = NOW;
  const store = (): PushStore => make(() => t);

  it("alta, lectura, familia, cambio y baja", async () => {
    const s = store();
    expect(await s.add(SUB(1, FAM), 10, 2, 99)).toBe("ok");
    expect(await s.add(SUB(2, FAM), 10, 2, 99)).toBe("ok");
    expect(await s.add(SUB(3, FAM), 10, 2, 99)).toBe("family-full");
    expect(await s.add(SUB(4), 2, 2, 99)).toBe("full");
    expect(await s.get(SUB(1).id)).toEqual(SUB(1, FAM));
    expect(await s.get("nadie".padEnd(22, "x"))).toBeNull();
    expect((await s.family(FAM)).map((x) => x.id).sort()).toEqual(
      [SUB(1).id, SUB(2).id].sort(),
    );
    expect(await s.put({ ...SUB(1), family: null }, SUB(1, FAM), 2, 99)).toBe(
      "ok",
    );
    expect((await s.family(FAM)).map((x) => x.id)).toEqual([SUB(2).id]);
    expect(await s.put({ ...SUB(5), family: FAM }, SUB(5), 1, 99)).toBe(
      "family-full",
    );
    expect((await s.all()).length).toBe(2);
    await s.remove(SUB(2, FAM));
    expect(await s.get(SUB(2).id)).toBeNull();
    expect(await s.family(FAM)).toEqual([]);
  });

  it("lo vencido libera sitio: los topes no cuentan teléfonos que ya no existen", async () => {
    const s = store();
    expect(await s.add(SUB(1, FAM), 1, 1, 60)).toBe("ok");
    expect(await s.add(SUB(2, FAM), 1, 1, 60)).toBe("full");
    t += 61_000; // el primero venció (EXPIRE en la base; vencimiento en el doble)
    expect(await s.all()).toEqual([]);
    expect(await s.add(SUB(3, FAM), 1, 1, 60)).toBe("ok");
    expect((await s.family(FAM)).map((x) => x.id)).toEqual([SUB(3).id]);
    t = NOW;
  });

  it("vencida una suscripción, el tope por familia también queda libre", async () => {
    const s = store();
    expect(await s.add(SUB(1, FAM), 9, 1, 60)).toBe("ok");
    t += 61_000;
    expect(await s.add(SUB(2, FAM), 9, 1, 60)).toBe("ok");
    t = NOW;
  });

  it("por dirección: una sola; cambiar de dirección suelta la vieja", async () => {
    const s = store();
    await s.add(SUB(1), 9, 9, 99);
    expect((await s.byEndpoint(EP(1)))?.id).toBe(SUB(1).id);
    expect(await s.byEndpoint(EP(2))).toBeNull();
    await s.put({ ...SUB(1), endpoint: EP(2) }, SUB(1), 9, 99);
    expect(await s.byEndpoint(EP(1))).toBeNull();
    expect((await s.byEndpoint(EP(2)))?.id).toBe(SUB(1).id);
    await s.remove({ ...SUB(1), endpoint: EP(2) });
    expect(await s.byEndpoint(EP(2))).toBeNull();
  });

  it("«enviado» vale una vez por fecha y minuto, y vence", async () => {
    const s = store();
    expect(await s.markSent("a", "2026-11-16", 420, 60)).toBe(true);
    expect(await s.markSent("a", "2026-11-16", 420, 60)).toBe(false);
    expect(await s.markSent("a", "2026-11-17", 420, 60)).toBe(true);
    t += 61_000;
    expect(await s.markSent("a", "2026-11-16", 420, 60)).toBe(true);
    t = NOW;
  });

  it("saltar y deshacer; contadores con ventana", async () => {
    const s = store();
    expect(await s.skipped("a", "2026-11-16", 420)).toBe(false);
    await s.setSkip("a", "2026-11-16", 420, true, 60);
    expect(await s.skipped("a", "2026-11-16", 420)).toBe(true);
    await s.setSkip("a", "2026-11-16", 420, false, 60);
    expect(await s.skipped("a", "2026-11-16", 420)).toBe(false);
    expect(await s.count("k", 60)).toBe(1);
    expect(await s.count("k", 60)).toBe(2);
    t += 61_000;
    expect(await s.count("k", 60)).toBe(1);
    t = NOW;
  });
});

describe("la base real por REST", () => {
  it("usa el token como Bearer, el prefijo np: y jamás guarda texto", async () => {
    const calls: { url: string; auth: string }[] = [];
    const { fetcher: inner, sent } = fakeRedis(() => NOW);
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({
        url,
        auth: (init.headers as Record<string, string>).authorization,
      });
      return inner(url, init);
    }) as unknown as typeof fetch;
    const s = createUpstashPushStore("https://db.example/", "SECRET", fetcher);
    await s.add(SUB(1, FAM), 10, 10, 99);
    expect(calls.every((c) => c.auth === "Bearer SECRET")).toBe(true);
    expect(calls.some((c) => c.url === "https://db.example/pipeline")).toBe(
      true,
    );
    const keys = sent.map((c) => c[1]).filter(Boolean);
    expect(keys.every((k) => k.startsWith("np:"))).toBe(true);
    const hset = sent.find((c) => c[0] === "HSET")!;
    expect(hset).toEqual([
      "HSET",
      `np:s:${SUB(1).id}`,
      "ep",
      EP(1),
      "th",
      "h".repeat(64),
      "tz",
      "America/Bogota",
      "w",
      "420:127",
      "fam",
      FAM,
      "fth",
      "t".repeat(64),
    ]);
  });

  it("un error de la base es un error fijo, sin repetir argumentos", async () => {
    const bad = createUpstashPushStore("https://db", "T", (async () =>
      Response.json({ error: "ERR np:s:secreto" })) as unknown as typeof fetch);
    await expect(bad.get("x")).rejects.toThrow(/^push-store$/);
    const badPipe = createUpstashPushStore("https://db", "T", (async () =>
      Response.json([{ error: "ERR" }])) as unknown as typeof fetch);
    await expect(badPipe.add(SUB(1), 9, 9, 9)).rejects.toThrow(/^push-store$/);
    const down = createUpstashPushStore(
      "https://db",
      "T",
      (async () =>
        new Response("x", { status: 500 })) as unknown as typeof fetch,
    );
    await expect(down.get("x")).rejects.toThrow(/^push-store$/);
  });

  it("una suscripción incompleta en la base se ignora", async () => {
    const s = createUpstashPushStore("https://db", "T", (async (url: string) =>
      url.endsWith("/pipeline")
        ? Response.json([{ result: ["ep", "x"] }])
        : Response.json({ result: ["a"] })) as unknown as typeof fetch);
    expect(await s.all()).toEqual([]);
  });
});
