import { z } from "zod";

import { hashOf, sign, SIG_RE, verify, type Signer } from "./sign";

/**
 * La bitácora de la familia (S9 · ADR-013): quién cambió qué y cuándo. Cada teléfono lleva
 * la SUYA, encadenada (cada evento nombra el hash del anterior) y firmada con su llave; los
 * demás la guardan y la comparan con lo que ya vieron. Nadie puede escribir en la bitácora
 * de otro (no tiene su llave), y quien reescribe la propia queda a la vista: lo que este
 * teléfono ya vio no cambia, y la pantalla avisa.
 *
 * Un evento dice el tipo de cambio y a qué se refiere (una fecha, una comida, una nota), nunca
 * el contenido: el detalle ya está en su lugar. Viaja cifrado, como todo.
 */

export const LOG_KINDS = [
  "mark",
  "unmark",
  "day-note",
  "profile-note",
  "textures",
  "plan",
  "plan-line",
  "roster",
  "notice",
] as const;
export type LogKind = (typeof LOG_KINDS)[number];
/** Eventos que se guardan por teléfono (los más nuevos). */
export const LOG_MAX = 200;

export const logEventSchema = z
  .object({
    i: z.number().int().nonnegative(),
    t: z.number().int().nonnegative(),
    k: z.enum(LOG_KINDS),
    /** A qué se refiere: «2026-11-16|meal:almuerzo», «roster:set:<id>:caregiver»… */
    r: z.string().max(100),
    /** Hash del evento anterior ("" en el primero). */
    p: z.string().max(64),
  })
  .strict();
export type LogEvent = z.infer<typeof logEventSchema>;

export const logSharedSchema = z
  .object({
    by: z.string().min(1).max(24),
    ev: z.array(logEventSchema).min(1).max(LOG_MAX),
    s: z.string().regex(SIG_RE),
  })
  .strict();
export type LogShared = z.infer<typeof logSharedSchema>;

const payload = (by: string, ev: LogEvent[]) => ({ n: `log:${by}`, by, ev });

/** Suma un evento propio, encadenado al último. */
export async function appendEvent(
  own: LogEvent[],
  t: number,
  k: LogKind,
  r: string,
): Promise<LogEvent[]> {
  const last = own.at(-1);
  const ev: LogEvent = {
    i: last ? last.i + 1 : 0,
    t,
    k,
    r: r.slice(0, 100),
    p: last ? await hashOf(last) : "",
  };
  return [...own, ev].slice(-LOG_MAX);
}

export async function sealLog(
  signer: Signer,
  by: string,
  ev: LogEvent[],
): Promise<LogShared> {
  return { by, ev, s: await sign(signer, payload(by, ev)) };
}

/** ¿Encadena por dentro? (cada `p` es el hash del evento anterior, índices seguidos). */
async function chained(ev: LogEvent[]): Promise<boolean> {
  for (let k = 1; k < ev.length; k++) {
    if (ev[k].i !== ev[k - 1].i + 1) return false;
    if (ev[k].p !== (await hashOf(ev[k - 1]))) return false;
  }
  return true;
}

export type LogVerdict =
  | { ok: true; ev: LogEvent[]; changed: boolean }
  | { ok: false; why: "signature" | "rewritten" };

/**
 * Lo que llegó de la bitácora de otro teléfono, contra lo que este ya tenía de él.
 * - firma o cadena rota → se descarta;
 * - un pedazo viejo (termina antes) → se queda lo que había;
 * - un evento que ya se vio con otro contenido → «reescrita»: se queda lo que había.
 */
export async function acceptLog(
  stored: LogEvent[],
  remote: unknown,
  pub: string | undefined,
): Promise<LogVerdict> {
  const parsed = logSharedSchema.safeParse(remote);
  if (!parsed.success) return { ok: false, why: "signature" };
  const { by, ev, s } = parsed.data;
  if (!(await verify(pub, payload(by, ev), s)))
    return { ok: false, why: "signature" };
  if (!(await chained(ev))) return { ok: false, why: "signature" };
  const seen = new Map<number, string>();
  for (const e of stored) seen.set(e.i, await hashOf(e));
  for (const e of ev) {
    const h = seen.get(e.i);
    if (h !== undefined && h !== (await hashOf(e)))
      return { ok: false, why: "rewritten" };
  }
  const lastStored = stored.at(-1)?.i ?? -1;
  if (ev.at(-1)!.i <= lastStored)
    return { ok: true, ev: stored, changed: false };
  const byI = new Map<number, LogEvent>();
  for (const e of [...stored, ...ev]) byI.set(e.i, e);
  const merged = [...byI.values()].sort((a, b) => a.i - b.i).slice(-LOG_MAX);
  return { ok: true, ev: merged, changed: true };
}
