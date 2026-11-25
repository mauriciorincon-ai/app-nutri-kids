import { z } from "zod";

/**
 * El registro de «cuando le ofrecen algo» (S14 · ADR-020). Una anotación dice QUIÉN ofreció (el
 * id de un teléfono de la familia, o «otra persona»), QUÉ (un alimento del plan, o «algo fuera del
 * plan»), DÓNDE y CÓMO se respondió. No hay texto libre: así ninguna anotación puede guardar el
 * nombre de un tercero, una dirección o un dato del niño. Viaja solo cifrada y firmada.
 */

export const PLACES = [
  "relatives",
  "school",
  "party",
  "kids",
  "outing",
  "other",
] as const;
export type Place = (typeof PLACES)[number];

export const ANSWERS = ["calm-no", "swap", "accepted", "other"] as const;
export type Answer = (typeof ANSWERS)[number];

/** Quien ofreció y no tiene un teléfono en la familia. */
export const OTHER_PERSON = "other";
/** Lo ofrecido no está en el plan. */
export const OUTSIDE_PLAN = "outside";

/** Lo que se guarda por teléfono (≈ 150 B cada una: caben holgadas en un registro de 64 KB). */
export const PRESSURE_MAX = 200;
/** Lo más viejo se poda: el patrón mira el último mes; la lista, los últimos tres. */
export const PRESSURE_KEEP_DAYS = 90;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const device = z.string().regex(/^[0-9A-Za-z-]{1,24}$/);

export const pressureEntrySchema = z
  .object({
    id: z.string().regex(/^[0-9a-z]{8,24}$/),
    t: z.number().int().nonnegative(),
    date: z.string().regex(DATE),
    /** El teléfono que la anotó. */
    by: device,
    /** El teléfono de quien ofreció, o «other». */
    who: z.union([device, z.literal(OTHER_PERSON)]),
    /** El id de un alimento del plan, o «outside». */
    what: z.string().min(1).max(80),
    place: z.enum(PLACES),
    answer: z.enum(ANSWERS),
  })
  .strict();
export type PressureEntry = z.infer<typeof pressureEntrySchema>;

/** Valida una lista; lo que no encaja se descarta, lo demás se ordena y se poda. */
export function coerceEntries(v: unknown, now: number): PressureEntry[] {
  if (!Array.isArray(v)) return [];
  const out: PressureEntry[] = [];
  for (const e of v) {
    const r = pressureEntrySchema.safeParse(e);
    if (r.success) out.push(r.data);
  }
  return prune(out, now);
}

export function prune(list: PressureEntry[], now: number): PressureEntry[] {
  const floor = now - PRESSURE_KEEP_DAYS * 24 * 3600 * 1000;
  const seen = new Set<string>();
  return list
    .filter((e) => e.t >= floor && !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => a.t - b.t)
    .slice(-PRESSURE_MAX);
}

export function newEntryId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => (b % 36).toString(36)).join("");
}
