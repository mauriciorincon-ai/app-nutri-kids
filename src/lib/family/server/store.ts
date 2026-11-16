import type { Kind } from "../records";
import { createMemoryStore } from "./memory";
import { createUpstashStore } from "./upstash";

/**
 * El almacén de la familia: guarda solo cifrados con su id opaco, la sal, la huella del
 * token y la época. Dos implementaciones con la MISMA conducta (la prueba de contrato las
 * corre igual): Upstash Redis (la real) y la memoria (el doble de la CI y las e2e).
 */

export type StoredRecord = {
  id: string;
  kind: Kind;
  ver: number;
  seq: number;
  iv: string;
  ct: string;
};
export type PushItem = Omit<StoredRecord, "seq">;
export type PushOutcome = { status: "ok" | "conflict" | "full"; ver: number };
export type FamilyMeta = { salt: string; tokenHash: string; epoch: number };
export type PullPage = { seq: number; more: boolean; records: StoredRecord[] };

export interface FamilyStore {
  readonly label: "real" | "memory";
  /** false = el código ya existe. */
  create(
    family: string,
    salt: string,
    tokenHash: string,
    ttl: number,
  ): Promise<boolean>;
  meta(family: string): Promise<FamilyMeta | null>;
  /** null = la época cambió (la frase es otra). */
  pull(
    family: string,
    epoch: number,
    since: number,
    maxBytes: number,
    ttl: number,
  ): Promise<PullPage | null>;
  push(
    family: string,
    epoch: number,
    items: PushItem[],
    maxRecords: number,
    ttl: number,
  ): Promise<PushOutcome[] | null>;
  /** Frase nueva: época + 1, sal y huella nuevas, y TODO lo guardado se borra. */
  rotate(
    family: string,
    epoch: number,
    salt: string,
    tokenHash: string,
    ttl: number,
  ): Promise<number | null>;
  destroy(family: string): Promise<void>;
  /** Suma uno al contador `key` (que vence a los `windowSeconds`) y devuelve el total. */
  count(key: string, windowSeconds: number): Promise<number>;
}

type Env = Record<string, string | undefined>;

/**
 * Qué almacén usa el servidor:
 * 1. `FAMILY_STORE=memory` → el doble en memoria (CI y e2e). Va PRIMERO: con él jamás se
 *    leen las variables de la base real, aunque estén en `.env.local`. Dentro de Vercel se
 *    niega (null).
 * 2. Las variables de Upstash (las que pone la integración de Vercel) → la base real.
 * 3. Ninguna → null: la ruta contesta 503 y la app dice que compartir no está disponible.
 */
export function selectStore(
  env: Env,
  fetcher: typeof fetch = fetch,
): FamilyStore | null {
  if (env.FAMILY_STORE === "memory") {
    return env.VERCEL ? null : createMemoryStore();
  }
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return createUpstashStore(url, token, fetcher);
  return null;
}
