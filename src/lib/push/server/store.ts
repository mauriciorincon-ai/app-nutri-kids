import type { ServerWake } from "../schedule";
import { createMemoryPushStore } from "./memory";
import { createUpstashPushStore } from "./upstash";

/**
 * El registro de avisos (S8 · ADR-012): por teléfono, la dirección de envío, sus horas de
 * despertar SIN etiqueta (minuto + días), su zona horaria, la huella de su token y, si
 * quiere avisos de la familia, el código de la familia (sin nombre). Nada más: ni qué
 * toca, ni cómo se llama nadie. Vive en el mismo Upstash Redis del S7.
 *
 * Dos implementaciones con la MISMA conducta (la prueba de contrato corre las dos).
 */

export type PushSub = {
  id: string;
  endpoint: string;
  tokenHash: string;
  tz: string;
  wakes: ServerWake[];
  /** Código de la familia, solo si este teléfono quiere los avisos de la familia. */
  family: string | null;
};

export type AddOutcome = "ok" | "full" | "family-full";

export interface PushStore {
  readonly label: "real" | "memory";
  /** Suscripción nueva; respeta el tope total y el de teléfonos por familia. */
  add(
    sub: PushSub,
    maxTotal: number,
    maxPerFamily: number,
    ttl: number,
  ): Promise<AddOutcome>;
  get(id: string): Promise<PushSub | null>;
  /** Reemplaza la suscripción (`prev` es la guardada: dice de qué familia salir). */
  put(
    sub: PushSub,
    prev: PushSub,
    maxPerFamily: number,
    ttl: number,
  ): Promise<AddOutcome>;
  remove(sub: PushSub): Promise<void>;
  all(): Promise<PushSub[]>;
  family(family: string): Promise<PushSub[]>;
  /** Saltar (o volver a avisar) un despertar de un día: solo fecha y minuto. */
  setSkip(
    id: string,
    date: string,
    m: number,
    on: boolean,
    ttl: number,
  ): Promise<void>;
  skipped(id: string, date: string, m: number): Promise<boolean>;
  /** true la PRIMERA vez para (id, fecha, minuto): así un toque nunca se repite. */
  markSent(id: string, date: string, m: number, ttl: number): Promise<boolean>;
  count(key: string, windowSeconds: number): Promise<number>;
}

/** «m:d,m:d» ↔ despertares (lo que guarda la base real). */
export function encodeWakes(wakes: ServerWake[]): string {
  return wakes.map((w) => `${w.m}:${w.d}`).join(",");
}
export function decodeWakes(raw: string): ServerWake[] {
  if (!raw) return [];
  const out: ServerWake[] = [];
  for (const part of raw.split(",")) {
    const m = /^(\d{1,4}):(\d{1,3})$/.exec(part);
    if (m) out.push({ m: Number(m[1]), d: Number(m[2]) });
  }
  return out;
}

type Env = Record<string, string | undefined>;

/** Mismo orden que el almacén de la familia: el doble primero; dentro de Vercel se niega. */
export function selectPushStore(
  env: Env,
  fetcher: typeof fetch = fetch,
): PushStore | null {
  if (env.FAMILY_STORE === "memory") {
    return env.VERCEL ? null : createMemoryPushStore();
  }
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return createUpstashPushStore(url, token, fetcher);
  return null;
}
