import { createHash } from "node:crypto";

import {
  decodeWakes,
  encodeWakes,
  type AddOutcome,
  type PushStore,
  type PushSub,
} from "./store";

/**
 * El registro de avisos en el Upstash Redis del S7, por su API REST, sin dependencias.
 * Claves (prefijo propio, aparte de las de la familia):
 *   np:s:<id>            hash  ep (dirección) · th (huella del token) · tz · w («m:d,…») · fam · fth
 *   np:e:<huella>        id    la suscripción de esa dirección de envío (una por dirección)
 *   np:all               set   ids de todas las suscripciones
 *   np:f:<familia>       set   ids que quieren los avisos de esa familia
 *   np:x:<id>:<fecha>:<m>      «enviado» (SET NX: el toque no se repite)
 *   np:k:<id>:<fecha>:<m>      «saltar» (lo ya marcado no avisa)
 *   np:c:<nombre>              contadores de los topes
 * Los topes se miden antes de escribir (sin bloqueo): un tope blando, suficiente aquí.
 * Jamás se registra ni se reenvía el token de la base ni lo guardado.
 */

type Reply = string | number | null | Reply[];

const subKey = (id: string) => `np:s:${id}`;
const famKey = (family: string) => `np:f:${family}`;
const epKey = (endpoint: string) =>
  `np:e:${createHash("sha256").update(endpoint).digest("hex").slice(0, 32)}`;
const ALL = "np:all";

function fromHash(id: string, flat: Reply): PushSub | null {
  if (!Array.isArray(flat) || flat.length === 0) return null;
  const h: Record<string, string> = {};
  for (let i = 0; i + 1 < flat.length; i += 2)
    h[String(flat[i])] = String(flat[i + 1]);
  if (!h.ep || !h.th || !h.tz) return null;
  return {
    id,
    endpoint: h.ep,
    tokenHash: h.th,
    tz: h.tz,
    wakes: decodeWakes(h.w ?? ""),
    family: h.fam ? h.fam : null,
    famTh: h.fth ? h.fth : null,
  };
}

export function createUpstashPushStore(
  url: string,
  token: string,
  fetcher: typeof fetch = fetch,
): PushStore {
  const base = url.replace(/\/+$/, "");

  async function post(path: string, body: unknown): Promise<unknown> {
    const res = await fetcher(base + path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok || json === null) throw new Error("push-store");
    return json;
  }

  async function call(command: (string | number)[]): Promise<Reply> {
    const json = (await post("", command.map(String))) as {
      result?: Reply;
      error?: string;
    };
    // El mensaje de la base no se propaga: puede repetir argumentos.
    if (json.error !== undefined) throw new Error("push-store");
    return json.result ?? null;
  }

  async function pipeline(commands: (string | number)[][]): Promise<Reply[]> {
    if (commands.length === 0) return [];
    const json = (await post(
      "/pipeline",
      commands.map((c) => c.map(String)),
    )) as { result?: Reply; error?: string }[];
    if (!Array.isArray(json) || json.some((r) => r.error !== undefined))
      throw new Error("push-store");
    return json.map((r) => r.result ?? null);
  }

  function writeSub(sub: PushSub, ttl: number): (string | number)[][] {
    return [
      [
        "HSET",
        subKey(sub.id),
        "ep",
        sub.endpoint,
        "th",
        sub.tokenHash,
        "tz",
        sub.tz,
        "w",
        encodeWakes(sub.wakes),
        "fam",
        sub.family ?? "",
        "fth",
        sub.famTh ?? "",
      ],
      ["EXPIRE", subKey(sub.id), ttl],
      ["SET", epKey(sub.endpoint), sub.id, "EX", ttl],
      ["SADD", ALL, sub.id],
      ...(sub.family ? [["SADD", famKey(sub.family), sub.id]] : []),
    ];
  }

  /**
   * Las suscripciones de esos ids. Un hash vencido (EXPIRE) deja su id en los sets: aquí se
   * quita, para que los topes no cuenten teléfonos que ya no existen.
   */
  async function many(ids: string[], setKey: string): Promise<PushSub[]> {
    const out: PushSub[] = [];
    const dead: string[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const replies = await pipeline(
        chunk.map((id) => ["HGETALL", subKey(id)]),
      );
      replies.forEach((r, k) => {
        const sub = fromHash(chunk[k], r);
        if (sub) out.push(sub);
        else if (Array.isArray(r) && r.length === 0) dead.push(chunk[k]);
      });
    }
    if (dead.length > 0)
      await pipeline([
        ...dead.map((id) => ["SREM", setKey, id]),
        ...(setKey === ALL ? [] : dead.map((id) => ["SREM", ALL, id])),
      ]);
    return out;
  }

  const members = async (key: string) => {
    const r = await call(["SMEMBERS", key]);
    return Array.isArray(r) ? r.map(String) : [];
  };

  /** Cuántas hay de verdad en un set: lo vencido se quita antes de contar. */
  async function liveCount(setKey: string): Promise<number> {
    return (await many(await members(setKey), setKey)).length;
  }
  /** SCARD barato; solo si ya está en el tope se cuenta bien (lo vencido libera sitio). */
  async function overCap(setKey: string, cap: number): Promise<boolean> {
    if (Number(await call(["SCARD", setKey])) < cap) return false;
    return (await liveCount(setKey)) >= cap;
  }

  return {
    label: "real",
    async add(sub, maxTotal, maxPerFamily, ttl): Promise<AddOutcome> {
      if (await overCap(ALL, maxTotal)) return "full";
      if (sub.family && (await overCap(famKey(sub.family), maxPerFamily)))
        return "family-full";
      await pipeline(writeSub(sub, ttl));
      return "ok";
    },
    async get(id) {
      return fromHash(id, await call(["HGETALL", subKey(id)]));
    },
    async byEndpoint(endpoint) {
      const id = await call(["GET", epKey(endpoint)]);
      if (typeof id !== "string") return null;
      const sub = fromHash(id, await call(["HGETALL", subKey(id)]));
      return sub && sub.endpoint === endpoint ? sub : null;
    },
    async put(sub, prev, maxPerFamily, ttl): Promise<AddOutcome> {
      if (
        sub.family &&
        sub.family !== prev.family &&
        (await overCap(famKey(sub.family), maxPerFamily))
      )
        return "family-full";
      await pipeline([
        ...(prev.family && prev.family !== sub.family
          ? [["SREM", famKey(prev.family), sub.id]]
          : []),
        ...(prev.endpoint !== sub.endpoint
          ? [["DEL", epKey(prev.endpoint)]]
          : []),
        ...writeSub(sub, ttl),
      ]);
      return "ok";
    },
    async remove(sub) {
      await pipeline([
        ["DEL", subKey(sub.id)],
        ["DEL", epKey(sub.endpoint)],
        ["SREM", ALL, sub.id],
        ...(sub.family ? [["SREM", famKey(sub.family), sub.id]] : []),
      ]);
    },
    async all() {
      return many(await members(ALL), ALL);
    },
    async family(family) {
      const key = famKey(family);
      const subs = await many(await members(key), key);
      return subs.filter((s) => s.family === family);
    },
    async setSkip(id, date, m, on, ttl) {
      const key = `np:k:${id}:${date}:${m}`;
      await call(on ? ["SET", key, "1", "EX", ttl] : ["DEL", key]);
    },
    async skipped(id, date, m) {
      return Number(await call(["EXISTS", `np:k:${id}:${date}:${m}`])) === 1;
    },
    async markSent(id, date, m, ttl) {
      const r = await call([
        "SET",
        `np:x:${id}:${date}:${m}`,
        "1",
        "NX",
        "EX",
        ttl,
      ]);
      return r === "OK";
    },
    async count(key, windowSeconds) {
      const [n] = await pipeline([
        ["INCR", `np:c:${key}`],
        ["EXPIRE", `np:c:${key}`, windowSeconds, "NX"],
      ]);
      return Number(n);
    },
  };
}
