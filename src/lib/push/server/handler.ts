import { createHash, randomBytes } from "node:crypto";

import { tokenHash, tokenMatches } from "@/lib/family/server/handler";
import type { FamilyStore } from "@/lib/family/server/store";

import { dueWakes } from "../due";
import { verifyQstash } from "../qstash";
import { vapidAuthorization, type VapidKeys } from "../vapid";
import {
  FAMILY_WAKES_PER_DAY,
  FLAG_TTL_SECONDS,
  MAX_BODY,
  MAX_PER_FAMILY,
  MAX_SUBS,
  REQUESTS_PER_IP_MIN,
  SEND_CONCURRENCY,
  SUBSCRIBES_PER_IP_DAY,
  SUB_TTL_SECONDS,
  bodies,
} from "./limits";
import type { PushStore, PushSub } from "./store";

/**
 * La ruta de los avisos, sin Next (S8 · ADR-012). El servidor guarda horas sin etiqueta y
 * manda toques VACÍOS: el aviso lo arma el teléfono con su copia local. Jamás registra un
 * cuerpo, un encabezado, una dirección de envío ni un código; sus errores son códigos fijos.
 */

export type Incoming = {
  op: string;
  method: string;
  body: string;
  authorization: string | null;
  signature: string | null;
  ip: string;
};
export type Outgoing = { status: number; json: Record<string, unknown> };

/** Envía un toque vacío; devuelve el estado HTTP del servicio de push (0 = sin red). */
export type Sender = (
  endpoint: string,
  authorization: string,
) => Promise<number>;

export type PushDeps = {
  store: PushStore | null;
  family: FamilyStore | null;
  vapid: VapidKeys | null;
  signingKeys: string[];
  sender: Sender;
  /** Sal del hash de IP (un secreto del servidor): sin ella, la IP se recuperaría por fuerza bruta. */
  ipSalt?: string;
};

export const TICK_PATH = "/api/push/tick";

const fail = (status: number, error: string): Outgoing => ({
  status,
  json: { error },
});
const ipKey = (ip: string, salt: string) =>
  createHash("sha256").update(`np|ip|${salt}|${ip}`).digest("hex").slice(0, 16);

/** Un servicio de push que no contesta no retiene un lote: a los 5 s se da por perdido. */
const SEND_TIMEOUT_MS = 5000;
/** Respuestas que dicen «esta dirección no sirve» (inventada o de otra llave): se purga a las 3. */
const BAD_STATUS = new Set([400, 401, 403]);
const BAD_STRIKES = 3;

function bearer(header: string | null): string | null {
  const m = header ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header) : null;
  return m ? m[1] : null;
}

/** El toque: POST sin cuerpo, con VAPID. Ni texto, ni tema, ni nada que diga qué toca. */
export function fetchSender(
  fetcher: typeof fetch = fetch,
  timeoutMs: number = SEND_TIMEOUT_MS,
): Sender {
  return async (endpoint, authorization) => {
    try {
      const res = await fetcher(endpoint, {
        method: "POST",
        headers: {
          authorization,
          ttl: "600",
          urgency: "normal",
          "content-length": "0",
        },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.status;
    } catch {
      return 0;
    }
  };
}

async function inBatches<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += SEND_CONCURRENCY) {
    await Promise.all(items.slice(i, i + SEND_CONCURRENCY).map(fn));
  }
}

type Tally = { sent: number; gone: number; failed: number };

async function touch(
  sub: PushSub,
  deps: PushDeps & { store: PushStore; vapid: VapidKeys },
  now: number,
  tally: Tally,
): Promise<void> {
  const status = await deps.sender(
    sub.endpoint,
    await vapidAuthorization(sub.endpoint, deps.vapid, now),
  );
  if (status >= 200 && status < 300) tally.sent++;
  else if (status === 404 || status === 410) {
    // El teléfono ya no existe para el servicio: se borra su suscripción.
    await deps.store.remove(sub);
    tally.gone++;
  } else if (BAD_STATUS.has(status)) {
    // Una dirección que el servicio rechaza una y otra vez no es un teléfono: se purga, para
    // que direcciones inventadas no llenen el tope. Un fallo suelto (red, 5xx) no cuenta.
    const strikes = await deps.store.count(`b:${sub.id}`, FLAG_TTL_SECONDS);
    if (strikes >= BAD_STRIKES) {
      await deps.store.remove(sub);
      tally.gone++;
    } else tally.failed++;
  } else tally.failed++;
}

async function tick(
  deps: PushDeps & { store: PushStore; vapid: VapidKeys },
  now: number,
): Promise<Outgoing> {
  const subs = await deps.store.all();
  const tally: Tally = { sent: 0, gone: 0, failed: 0 };
  let skipped = 0;
  const toTouch: PushSub[] = [];
  await inBatches(subs, async (sub) => {
    let send = false;
    for (const d of dueWakes(sub.wakes, sub.tz, now)) {
      if (await deps.store.skipped(sub.id, d.date, d.m)) {
        skipped++;
        continue;
      }
      // «Enviado» se marca ANTES de enviar: un toque tarde o doble no se repite.
      if (await deps.store.markSent(sub.id, d.date, d.m, FLAG_TTL_SECONDS))
        send = true;
    }
    if (send) toTouch.push(sub);
  });
  await inBatches(toTouch, (sub) => touch(sub, deps, now, tally));
  return {
    status: 200,
    json: { subs: subs.length, due: toTouch.length, skipped, ...tally },
  };
}

export async function handlePush(
  req: Incoming,
  deps: PushDeps,
  now: number = Date.now(),
): Promise<Outgoing> {
  const { store, vapid } = deps;
  if (req.op === "health") {
    const available = store !== null && vapid !== null;
    return {
      status: 200,
      json: {
        available,
        store: store?.label ?? "none",
        key: available ? vapid.publicKey : null,
      },
    };
  }
  if (!store || !vapid) return fail(503, "unavailable");
  if (req.method !== "POST") return fail(405, "method");
  if (req.body.length > MAX_BODY) return fail(413, "too-large");
  const ready = { ...deps, store, vapid };

  if (req.op === "tick") {
    const ok = await verifyQstash(
      req.signature,
      req.body,
      deps.signingKeys,
      TICK_PATH,
      now,
    );
    return ok ? tick(ready, now) : fail(401, "signature");
  }
  if (!Object.hasOwn(bodies, req.op)) return fail(404, "op");

  const ip = ipKey(req.ip, deps.ipSalt ?? "");
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
  if (!bodies[op].safeParse(raw).success) return fail(400, "shape");
  const day = Math.floor(now / 86_400_000);

  /** ¿Prueba ser de esa familia? Huella del token del S7, en tiempo constante. */
  const member = async (code: string, token: string | null) => {
    const meta = deps.family ? await deps.family.meta(code) : null;
    return tokenMatches(token, meta?.tokenHash ?? null) && meta !== null
      ? meta
      : null;
  };
  /** Un teléfono, una dirección: si otro registro ya usa esa dirección, se retira. */
  const dropDuplicate = async (endpoint: string, keep: string | null) => {
    const dup = await store.byEndpoint(endpoint);
    if (dup && dup.id !== keep) await store.remove(dup);
  };

  if (op === "subscribe") {
    const b = bodies.subscribe.parse(raw);
    if ((await store.count(`s:${ip}:${day}`, 86_400)) > SUBSCRIBES_PER_IP_DAY)
      return fail(429, "slow-down");
    if (b.family && !(await member(b.family.code, b.family.token)))
      return fail(403, "denied");
    const id = randomBytes(16).toString("base64url");
    await dropDuplicate(b.endpoint, null);
    const out = await store.add(
      {
        id,
        endpoint: b.endpoint,
        tokenHash: tokenHash(b.token),
        tz: b.tz,
        wakes: b.wakes,
        family: b.family?.code ?? null,
        famTh: b.family ? tokenHash(b.family.token) : null,
      },
      MAX_SUBS,
      MAX_PER_FAMILY,
      SUB_TTL_SECONDS,
    );
    if (out === "full") return fail(503, "full");
    if (out === "family-full") return fail(409, "family-full");
    return { status: 201, json: { id } };
  }

  if (op === "family") {
    const b = bodies.family.parse(raw);
    if (!(await member(b.family, bearer(req.authorization))))
      return fail(403, "denied");
    if (
      (await store.count(`f:${b.family}:${day}`, 86_400)) > FAMILY_WAKES_PER_DAY
    )
      return fail(429, "slow-down");
    // Solo los teléfonos que probaron el token VIGENTE de la familia: quien fue sacado y no
    // lo renovó deja de recibir toques.
    const meta = await deps.family?.meta(b.family);
    const others = (await store.family(b.family)).filter(
      (s) => s.id !== b.from && meta && s.famTh === meta.tokenHash,
    );
    const tally: Tally = { sent: 0, gone: 0, failed: 0 };
    await inBatches(others, (sub) => touch(sub, ready, now, tally));
    return { status: 200, json: { sent: tally.sent } };
  }

  // Desde aquí, todo pide el token de ESTE teléfono.
  const id = (raw as { id: string }).id;
  const sub = await store.get(id);
  if (!tokenMatches(bearer(req.authorization), sub?.tokenHash ?? null) || !sub)
    return fail(403, "denied");

  if (op === "update") {
    const b = bodies.update.parse(raw);
    if (b.family && !(await member(b.family.code, b.family.token)))
      return fail(403, "denied");
    await dropDuplicate(b.endpoint, sub.id);
    const out = await store.put(
      {
        ...sub,
        endpoint: b.endpoint,
        tz: b.tz,
        wakes: b.wakes,
        family: b.family?.code ?? null,
        famTh: b.family ? tokenHash(b.family.token) : null,
      },
      sub,
      MAX_PER_FAMILY,
      SUB_TTL_SECONDS,
    );
    return out === "ok"
      ? { status: 200, json: { ok: true } }
      : fail(409, "family-full");
  }

  if (op === "skip") {
    const b = bodies.skip.parse(raw);
    await store.setSkip(sub.id, b.date, b.m, b.on, FLAG_TTL_SECONDS);
    return { status: 200, json: { ok: true } };
  }

  // unsubscribe
  await store.remove(sub);
  return { status: 200, json: { ok: true } };
}
