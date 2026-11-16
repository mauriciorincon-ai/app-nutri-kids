import { createHash, timingSafeEqual } from "node:crypto";

import {
  CREATES_PER_DAY,
  CREATES_PER_IP_DAY,
  FAMILY_TTL_SECONDS,
  MAX_BODY,
  MAX_RECORDS,
  PULL_PAGE_BYTES,
  REQUESTS_PER_IP_MIN,
  bodies,
} from "./limits";
import type { FamilyStore } from "./store";

/**
 * La ruta de la familia, sin Next: recibe la petición ya leída y devuelve estado + JSON.
 * El servidor NO sabe leer nada de lo que guarda: valida formas y tamaños, compara la
 * huella del token en tiempo constante y aplica los topes. Jamás registra un cuerpo,
 * un encabezado ni un código de familia; sus errores son códigos fijos.
 */

export type Incoming = {
  op: string;
  method: string;
  body: string;
  authorization: string | null;
  ip: string;
};
export type Outgoing = { status: number; json: Record<string, unknown> };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const tokenHash = sha256;
/** La IP nunca se guarda: solo una huella corta, para los topes. */
const ipKey = (ip: string) => sha256(`nk|ip|${ip}`).slice(0, 16);
/** Huella de relleno: con familia inexistente se compara igual (mismo tiempo). */
const DUMMY = sha256("nk|no-family");

const fail = (status: number, error: string): Outgoing => ({
  status,
  json: { error },
});

function bearer(header: string | null): string | null {
  const m = header ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header) : null;
  return m ? m[1] : null;
}

/** ¿El token corresponde a la huella guardada? En tiempo constante. */
export function tokenMatches(
  token: string | null,
  stored: string | null,
): boolean {
  const a = Buffer.from(sha256(token ?? ""), "hex");
  const b = Buffer.from(
    stored && /^[0-9a-f]{64}$/.test(stored) ? stored : DUMMY,
    "hex",
  );
  return timingSafeEqual(a, b) && token !== null && stored !== null;
}

export async function handle(
  req: Incoming,
  store: FamilyStore | null,
  now: number = Date.now(),
): Promise<Outgoing> {
  if (req.op === "health") {
    return {
      status: 200,
      json: { available: store !== null, store: store?.label ?? "none" },
    };
  }
  if (!store) return fail(503, "unavailable");
  if (req.method !== "POST") return fail(405, "method");
  if (!Object.hasOwn(bodies, req.op)) return fail(404, "op");
  if (req.body.length > MAX_BODY) return fail(413, "too-large");

  const ip = ipKey(req.ip);
  const minute = Math.floor(now / 60_000);
  if ((await store.count(`m:${ip}:${minute}`, 60)) > REQUESTS_PER_IP_MIN) {
    return fail(429, "slow-down");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(req.body);
  } catch {
    return fail(400, "json");
  }
  const op = req.op as keyof typeof bodies;
  const parsed = bodies[op].safeParse(raw);
  if (!parsed.success) {
    const big = parsed.error.issues.some(
      (i) => i.message === "too-large" || i.code === "too_big",
    );
    return fail(big ? 413 : 400, big ? "too-large" : "shape");
  }
  const ttl = FAMILY_TTL_SECONDS;

  if (op === "create") {
    const b = bodies.create.parse(raw);
    const day = Math.floor(now / 86_400_000);
    if ((await store.count(`c:${ip}:${day}`, 86_400)) > CREATES_PER_IP_DAY) {
      return fail(429, "too-many-families");
    }
    if ((await store.count(`c:all:${day}`, 86_400)) > CREATES_PER_DAY) {
      return fail(503, "full");
    }
    const ok = await store.create(b.family, b.salt, tokenHash(b.token), ttl);
    return ok ? { status: 201, json: { epoch: 1 } } : fail(409, "exists");
  }

  if (op === "join") {
    const b = bodies.join.parse(raw);
    const meta = await store.meta(b.family);
    return meta
      ? { status: 200, json: { salt: meta.salt, epoch: meta.epoch } }
      : fail(404, "no-family");
  }

  // Desde aquí, todo pide el token de la familia.
  const family = (raw as { family: string }).family;
  const meta = await store.meta(family);
  if (
    !tokenMatches(bearer(req.authorization), meta?.tokenHash ?? null) ||
    !meta
  ) {
    return fail(403, "denied");
  }

  if (op === "pull") {
    const b = bodies.pull.parse(raw);
    const page = await store.pull(
      family,
      b.epoch,
      b.since,
      PULL_PAGE_BYTES,
      ttl,
    );
    if (!page) return fail(403, "denied");
    return { status: 200, json: { ...page } };
  }

  if (op === "push") {
    const b = bodies.push.parse(raw);
    const results = await store.push(
      family,
      b.epoch,
      b.records,
      MAX_RECORDS,
      ttl,
    );
    if (!results) return fail(403, "denied");
    const json = {
      results: results.map((r, i) => ({ id: b.records[i].id, ...r })),
    };
    if (results.some((r) => r.status === "full")) return { status: 507, json };
    if (results.some((r) => r.status === "conflict"))
      return { status: 409, json };
    return { status: 200, json };
  }

  if (op === "rotate") {
    const b = bodies.rotate.parse(raw);
    const epoch = await store.rotate(
      family,
      b.epoch,
      b.salt,
      tokenHash(b.token),
      ttl,
    );
    return epoch === null
      ? fail(403, "denied")
      : { status: 200, json: { epoch } };
  }

  // destroy
  await store.destroy(family);
  return { status: 200, json: { ok: true } };
}
