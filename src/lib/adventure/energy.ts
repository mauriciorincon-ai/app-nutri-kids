/**
 * La energía de la aventura (S14 · ADR-020, parte 2). Puro y sin reloj: el día lo trae quien llama.
 *
 * Reglas duras, cada una con su test (`tests/unit/adventure.test.ts`):
 *  - La energía sale de hábitos y de explorar, JAMÁS de comer: ninguna comida marcada, ninguna
 *    cantidad, ningún «aceptó» o «rechazó» la mueve. Conocer algo nuevo cuenta igual si solo se
 *    miró que si se probó: es una exposición, no un bocado.
 *  - SOLO SUBE. El libro de chispas es un conjunto al que solo se añaden claves `día:fuente`; la
 *    energía es cuántas hay. Corregir un hábito después no quita nada. No hay rachas.
 *  - Una chispa por fuente y día: hacerlo diez veces no da diez.
 *  - La pantalla no es fuente (no se premia ni se castiga).
 */

export const SOURCES = [
  "sleep",
  "activity",
  "sun",
  "water",
  "try",
  "kitchen",
] as const;
export type Source = (typeof SOURCES)[number];

/** Lo que el día de la familia ya sabe; la cocina solo la toca quien juega. */
export type DaySignals = {
  /** Minutos por hábito (`sleep`, `screen`, `activity`, `sun`). */
  habits: Readonly<Record<string, number>>;
  /** Ids de las marcas del día (`meal:…`, `supplement:…`, `water:N`). */
  markIds: readonly string[];
  /** Alimentos con exposición anotada; solo importa si eran nuevos. */
  food: Readonly<Record<string, { isNew: boolean }>>;
};

/** Qué fuentes ya cumplió ese día. Las comidas, los suplementos y la pantalla no figuran. */
export function sourcesOfDay(d: DaySignals): Source[] {
  const out: Source[] = [];
  if ((d.habits.sleep ?? 0) > 0) out.push("sleep");
  if ((d.habits.activity ?? 0) > 0) out.push("activity");
  if ((d.habits.sun ?? 0) > 0) out.push("sun");
  if (d.markIds.some((id) => id.startsWith("water:"))) out.push("water");
  if (Object.values(d.food).some((f) => f.isNew)) out.push("try");
  return out;
}

const KEY_RE = new RegExp(`^\\d{4}-\\d{2}-\\d{2}:(${SOURCES.join("|")})$`);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const LEDGER_MAX = 4000;

export const sparkKey = (day: string, source: Source) => `${day}:${source}`;

/** Lectura defensiva: solo claves bien formadas, sin repetir, con tope. */
export function coerceSparks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const k of raw) {
    if (typeof k === "string" && KEY_RE.test(k)) seen.add(k);
    if (seen.size >= LEDGER_MAX) break;
  }
  return [...seen];
}

/**
 * Suma las chispas de un día al libro. Devuelve SIEMPRE un libro que contiene al anterior:
 * esta función no tiene forma de quitar una.
 */
export function earnSparks(
  ledger: readonly string[],
  day: string,
  sources: readonly Source[],
): string[] {
  const next = new Set(ledger);
  if (!DAY_RE.test(day)) return [...next];
  for (const s of sources) {
    if (next.size >= LEDGER_MAX) break;
    next.add(sparkKey(day, s));
  }
  return [...next];
}

export const energyOf = (ledger: readonly string[]): number => ledger.length;

/** Cada cuántas chispas el mundo da un paso, y cuántos pasos tiene. Después de ahí la cuenta sigue. */
export const STAGE_EVERY = 5;
export const STAGE_MAX = 5;

/** Cuántos pasos lleva el mundo (0 a 5). Es de la energía, así que es el mismo en los tres mundos. */
export const stageOf = (energy: number): number =>
  Math.min(STAGE_MAX, Math.floor(energy / STAGE_EVERY));

/** Cuántas chispas más para el siguiente paso (1 a 5). Solo se muestra mientras quedan pasos. */
export const untilNext = (energy: number): number =>
  STAGE_EVERY - (energy % STAGE_EVERY);

/** Qué fuentes de ESTE día ya están en el libro (las fichas de la pantalla). */
export function doneOnDay(ledger: readonly string[], day: string): Set<Source> {
  const out = new Set<Source>();
  for (const s of SOURCES) if (ledger.includes(sparkKey(day, s))) out.add(s);
  return out;
}
