// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handle,
  tokenMatches,
  type Incoming,
} from "@/lib/family/server/handler";
import {
  CREATES_PER_IP_DAY,
  ITEM_MAX_CT,
  MAX_BODY,
  MAX_RECORDS,
  PLAN_MAX_CT,
  REQUESTS_PER_IP_MIN,
} from "@/lib/family/server/limits";
import { createMemoryStore } from "@/lib/family/server/memory";
import { selectStore, type FamilyStore } from "@/lib/family/server/store";

const FAMILY = "A1B2C3D4E5";
const SALT = "s".repeat(22);
const TOKEN = "t".repeat(43);
const BAD = "u".repeat(43);
const id = (n: number) => n.toString().padStart(22, "0");
const IV = "i".repeat(16);

function call(
  store: FamilyStore | null,
  op: string,
  body: unknown,
  extra: Partial<Incoming> = {},
  now?: number,
) {
  return handle(
    {
      op,
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      authorization: `Bearer ${TOKEN}`,
      ip: "203.0.113.7",
      ...extra,
    },
    store,
    now,
  );
}

async function family(store = createMemoryStore({ isolated: true })) {
  expect(
    (await call(store, "create", { family: FAMILY, salt: SALT, token: TOKEN }))
      .status,
  ).toBe(201);
  return store;
}

const rec = (
  n: number,
  ver = 0,
  kind: "plan" | "item" = "item",
  ct = "c".repeat(40),
) => ({
  id: id(n),
  kind,
  ver,
  iv: IV,
  ct,
});

describe("la ruta de la familia, contra el doble", () => {
  it("health dice qué almacén hay sin mostrar variables", async () => {
    expect(await call(null, "health", "")).toEqual({
      status: 200,
      json: { available: false, store: "none" },
    });
    const ok = await call(createMemoryStore({ isolated: true }), "health", "", {
      method: "GET",
    });
    expect(ok.json).toEqual({ available: true, store: "memory" });
  });

  it("sin almacén: 503; GET a una operación: 405; operación desconocida: 404", async () => {
    expect((await call(null, "create", {})).status).toBe(503);
    const s = createMemoryStore({ isolated: true });
    expect((await call(s, "pull", {}, { method: "GET" })).status).toBe(405);
    expect((await call(s, "secret", {})).status).toBe(404);
  });

  it("cuerpo enorme: 413; JSON roto o de otra forma: 400", async () => {
    const s = createMemoryStore({ isolated: true });
    expect((await call(s, "join", "x".repeat(MAX_BODY + 1))).status).toBe(413);
    expect((await call(s, "join", "{no")).status).toBe(400);
    expect((await call(s, "join", { family: "corto" })).status).toBe(400);
    expect((await call(s, "join", { family: FAMILY, extra: 1 })).status).toBe(
      400,
    );
  });

  it("crear, entrar (devuelve la sal), y un código repetido: 409", async () => {
    const s = await family();
    expect(await call(s, "join", { family: FAMILY })).toEqual({
      status: 200,
      json: { salt: SALT, epoch: 1 },
    });
    expect((await call(s, "join", { family: "Z9Z9Z9Z9Z9" })).status).toBe(404);
    expect(
      (await call(s, "create", { family: FAMILY, salt: SALT, token: TOKEN }))
        .json,
    ).toEqual({
      error: "exists",
    });
  });

  it("guarda solo la huella SHA-256 del token, jamás el token", async () => {
    const s = await family();
    const meta = await s.meta(FAMILY);
    expect(meta?.tokenHash).toBe(
      createHash("sha256").update(TOKEN).digest("hex"),
    );
    expect(JSON.stringify(meta)).not.toContain(TOKEN);
  });

  it("token equivocado, ausente o de otra forma: 403 en todo lo que lee o escribe", async () => {
    const s = await family();
    for (const op of ["pull", "push", "rotate", "destroy"]) {
      const body = {
        family: FAMILY,
        epoch: 1,
        since: 0,
        records: [rec(1)],
        salt: SALT,
        token: TOKEN,
      };
      const pick = (keys: string[]) =>
        Object.fromEntries(
          keys.map((k) => [k, (body as Record<string, unknown>)[k]]),
        );
      const shape = {
        pull: pick(["family", "epoch", "since"]),
        push: pick(["family", "epoch", "records"]),
        rotate: pick(["family", "epoch", "salt", "token"]),
        destroy: pick(["family"]),
      }[op];
      expect(
        (await call(s, op, shape, { authorization: `Bearer ${BAD}` })).status,
      ).toBe(403);
      expect((await call(s, op, shape, { authorization: null })).status).toBe(
        403,
      );
      expect(
        (await call(s, op, shape, { authorization: "Basic abc" })).status,
      ).toBe(403);
    }
    // Familia que no existe: también 403 (no se distingue de un token malo).
    expect(
      (await call(s, "pull", { family: "Z9Z9Z9Z9Z9", epoch: 1, since: 0 }))
        .status,
    ).toBe(403);
  });

  it("la comparación del token es en tiempo constante y no acepta huellas raras", () => {
    const h = createHash("sha256").update(TOKEN).digest("hex");
    expect(tokenMatches(TOKEN, h)).toBe(true);
    expect(tokenMatches(BAD, h)).toBe(false);
    expect(tokenMatches(null, h)).toBe(false);
    expect(tokenMatches(TOKEN, null)).toBe(false);
    expect(tokenMatches(TOKEN, "zz")).toBe(false);
  });

  it("escribir y leer; una versión vieja: 409 con la versión actual", async () => {
    const s = await family();
    const ok = await call(s, "push", {
      family: FAMILY,
      epoch: 1,
      records: [rec(1), rec(2)],
    });
    expect(ok.status).toBe(200);
    expect(ok.json.results).toEqual([
      { id: id(1), status: "ok", ver: 1 },
      { id: id(2), status: "ok", ver: 1 },
    ]);
    const stale = await call(s, "push", {
      family: FAMILY,
      epoch: 1,
      records: [rec(1, 0), rec(2, 1)],
    });
    expect(stale.status).toBe(409);
    expect(stale.json.results).toEqual([
      { id: id(1), status: "conflict", ver: 1 },
      { id: id(2), status: "ok", ver: 2 },
    ]);
    const all = await call(s, "pull", { family: FAMILY, epoch: 1, since: 0 });
    expect(all.json.seq).toBe(3);
    expect(
      (all.json.records as { id: string; ver: number }[]).map((r) => [
        r.id,
        r.ver,
      ]),
    ).toEqual([
      [id(1), 1],
      [id(2), 2],
    ]);
    const since = await call(s, "pull", { family: FAMILY, epoch: 1, since: 2 });
    expect((since.json.records as unknown[]).length).toBe(1);
  });

  it("topes de tamaño: el plan hasta 256 KB, lo demás hasta 64 KB; 50 por subida", async () => {
    const s = await family();
    const push = (records: unknown[]) =>
      call(s, "push", { family: FAMILY, epoch: 1, records });
    expect(
      (await push([rec(1, 0, "plan", "c".repeat(PLAN_MAX_CT))])).status,
    ).toBe(200);
    expect(
      (await push([rec(2, 0, "plan", "c".repeat(PLAN_MAX_CT + 1))])).status,
    ).toBe(413);
    expect(
      (await push([rec(3, 0, "item", "c".repeat(ITEM_MAX_CT))])).status,
    ).toBe(200);
    expect(
      (await push([rec(4, 0, "item", "c".repeat(ITEM_MAX_CT + 1))])).status,
    ).toBe(413);
    expect(
      (await push(Array.from({ length: 51 }, (_, i) => rec(100 + i)))).status,
    ).toBe(413);
    expect((await push([{ ...rec(5), ct: "no válido" }])).status).toBe(400);
  });

  it(`tope de ${MAX_RECORDS} registros por familia: 507, y lo que ya existe se sigue actualizando`, async () => {
    const s = await family();
    for (let b = 0; b < MAX_RECORDS / 50; b++) {
      const records = Array.from({ length: 50 }, (_, i) => rec(b * 50 + i));
      const r = await call(
        s,
        "push",
        { family: FAMILY, epoch: 1, records },
        {},
        b * 61_000,
      );
      expect(r.status).toBe(200);
    }
    const over = await call(s, "push", {
      family: FAMILY,
      epoch: 1,
      records: [rec(5000)],
    });
    expect(over.status).toBe(507);
    expect(over.json.results).toEqual([
      { id: id(5000), status: "full", ver: 0 },
    ]);
    expect(
      (
        await call(s, "push", {
          family: FAMILY,
          epoch: 1,
          records: [rec(0, 1)],
        })
      ).status,
    ).toBe(200);
  });

  it("baja por páginas cuando lo guardado pasa de 2 MB", async () => {
    const s = await family();
    for (let i = 0; i < 12; i++) {
      const r = await call(s, "push", {
        family: FAMILY,
        epoch: 1,
        records: [rec(i, 0, "plan", "c".repeat(PLAN_MAX_CT))],
      });
      expect(r.status).toBe(200);
    }
    const first = await call(s, "pull", { family: FAMILY, epoch: 1, since: 0 });
    expect(first.json.more).toBe(true);
    const got = first.json.records as { seq: number }[];
    expect(got.length).toBeLessThan(12);
    const rest = await call(s, "pull", {
      family: FAMILY,
      epoch: 1,
      since: got.at(-1)!.seq,
    });
    expect(rest.json.more).toBe(false);
    expect(got.length + (rest.json.records as unknown[]).length).toBe(12);
  });

  it(`${CREATES_PER_IP_DAY} familias nuevas por IP al día; ${REQUESTS_PER_IP_MIN} peticiones por minuto`, async () => {
    const s = createMemoryStore({ isolated: true });
    const codes = [
      "A1A1A1A1A1",
      "B2B2B2B2B2",
      "C3C3C3C3C3",
      "D4D4D4D4D4",
      "E5E5E5E5E5",
      "F6F6F6F6F6",
    ];
    const statuses = [];
    for (const [i, family] of codes.entries()) {
      statuses.push(
        (
          await call(
            s,
            "create",
            { family, salt: SALT, token: TOKEN },
            {},
            i * 61_000,
          )
        ).status,
      );
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    // Otra IP sí puede.
    expect(
      (
        await call(
          s,
          "create",
          { family: "G7G7G7G7G7", salt: SALT, token: TOKEN },
          { ip: "198.51.100.1" },
        )
      ).status,
    ).toBe(201);

    const t = 10 * 60_000;
    const burst = [];
    for (let i = 0; i <= REQUESTS_PER_IP_MIN; i++) {
      burst.push(
        (
          await call(
            s,
            "join",
            { family: "A1A1A1A1A1" },
            { ip: "192.0.2.9" },
            t,
          )
        ).status,
      );
    }
    expect(burst.slice(0, -1).every((st) => st === 200)).toBe(true);
    expect(burst.at(-1)).toBe(429);
    // Al minuto siguiente, vuelve.
    expect(
      (
        await call(
          s,
          "join",
          { family: "A1A1A1A1A1" },
          { ip: "192.0.2.9" },
          t + 60_000,
        )
      ).status,
    ).toBe(200);
  });

  it("techo global de familias nuevas por día: 503 «full»", async () => {
    const s = createMemoryStore({ isolated: true });
    const real = s.count.bind(s);
    s.count = async (key, w) =>
      key.startsWith("c:all:") ? 10_000 : real(key, w);
    const r = await call(s, "create", {
      family: FAMILY,
      salt: SALT,
      token: TOKEN,
    });
    expect(r).toEqual({ status: 503, json: { error: "full" } });
  });

  it("cambiar la frase: época nueva, todo lo guardado se borra, el token viejo ya no vale", async () => {
    const s = await family();
    await call(s, "push", { family: FAMILY, epoch: 1, records: [rec(1)] });
    const NEW = "n".repeat(43);
    const rot = await call(s, "rotate", {
      family: FAMILY,
      epoch: 1,
      salt: "z".repeat(22),
      token: NEW,
    });
    expect(rot).toEqual({ status: 200, json: { epoch: 2 } });
    expect(
      (await call(s, "pull", { family: FAMILY, epoch: 1, since: 0 })).status,
    ).toBe(403);
    const fresh = await call(
      s,
      "pull",
      { family: FAMILY, epoch: 2, since: 0 },
      { authorization: `Bearer ${NEW}` },
    );
    expect(fresh.json.records).toEqual([]);
    // Época vieja con el token nuevo: 403.
    const old = { authorization: `Bearer ${NEW}` };
    expect(
      (await call(s, "pull", { family: FAMILY, epoch: 1, since: 0 }, old))
        .status,
    ).toBe(403);
    expect(
      (
        await call(
          s,
          "push",
          { family: FAMILY, epoch: 1, records: [rec(1)] },
          old,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          s,
          "rotate",
          { family: FAMILY, epoch: 1, salt: SALT, token: TOKEN },
          old,
        )
      ).status,
    ).toBe(403);
    expect((await call(s, "join", { family: FAMILY })).json).toEqual({
      salt: "z".repeat(22),
      epoch: 2,
    });
  });

  it("borrar lo compartido: la familia deja de existir", async () => {
    const s = await family();
    expect((await call(s, "destroy", { family: FAMILY })).status).toBe(200);
    expect((await call(s, "join", { family: FAMILY })).status).toBe(404);
  });

  it("los errores son códigos fijos: jamás repiten lo que llegó", async () => {
    const s = await family();
    const r = await call(s, "join", { family: "SENTINEL!!" });
    expect(JSON.stringify(r.json)).not.toContain("SENTINEL");
  });
});

describe("qué almacén usa el servidor", () => {
  const fakeFetch = vi.fn() as unknown as typeof fetch;

  it("FAMILY_STORE=memory va primero: jamás toca la base real aunque estén sus variables", () => {
    const s = selectStore(
      {
        FAMILY_STORE: "memory",
        KV_REST_API_URL: "https://x",
        KV_REST_API_TOKEN: "y",
      },
      fakeFetch,
    );
    expect(s?.label).toBe("memory");
  });

  it("el doble se niega dentro de Vercel", () => {
    expect(selectStore({ FAMILY_STORE: "memory", VERCEL: "1" })).toBeNull();
  });

  it("con las variables de Upstash (KV_* o UPSTASH_*), la base real; sin nada, ninguno", () => {
    expect(
      selectStore({ KV_REST_API_URL: "https://x", KV_REST_API_TOKEN: "y" })
        ?.label,
    ).toBe("real");
    expect(
      selectStore({
        UPSTASH_REDIS_REST_URL: "https://x",
        UPSTASH_REDIS_REST_TOKEN: "y",
      })?.label,
    ).toBe("real");
    expect(selectStore({ KV_REST_API_URL: "https://x" })).toBeNull();
    expect(selectStore({})).toBeNull();
  });
});

describe("la ruta de Next", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("responde con no-store, lee el cuerpo y rechaza un content-length enorme", async () => {
    vi.stubEnv("FAMILY_STORE", "memory");
    vi.stubEnv("VERCEL", "");
    const { GET, POST } = await import("@/app/api/family/[...op]/route");
    const ctx = (op: string) => ({ params: Promise.resolve({ op: [op] }) });
    const health = await GET(
      new Request("http://127.0.0.1/api/family/health"),
      ctx("health"),
    );
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(await health.json()).toEqual({ available: true, store: "memory" });
    const join = await POST(
      new Request("http://127.0.0.1/api/family/join", {
        method: "POST",
        body: JSON.stringify({ family: "Q0Q0Q0Q0Q0" }),
        headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" },
      }),
      ctx("join"),
    );
    expect(join.status).toBe(404);
    const big = await POST(
      new Request("http://127.0.0.1/api/family/join", {
        method: "POST",
        body: "{}",
        headers: { "content-length": String(MAX_BODY + 1) },
      }),
      ctx("join"),
    );
    expect(big.status).toBe(413);
  });
});
