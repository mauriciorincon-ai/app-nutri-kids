import type { DayRecord } from "@/lib/diet/day-log";

/**
 * «Alguien nuevo» del día (S15 · ADR-021), calculado de la familia sin tocar su criptografía:
 * un teléfono que entró a la familia hace poco y que hoy marcó o anotó algo. Es una pista para
 * preparar el día, jamás una acusación: no dice quién es ni qué hizo.
 */

/** Cuántos días se considera «nuevo» a quien entró a la familia. */
export const NEWCOMER_DAYS = 14;
const DAY_MS = 24 * 3600 * 1000;

/** Los que entraron después de fundar la familia llevan su hora de entrada; los fundadores, null. */
export type Joiner = { id: string; joined: number | null };

/**
 * ¿Hoy marcó o anotó algo alguien que entró a la familia hace ≤ 14 días? Los fundadores
 * (`joined` null) nunca cuentan: en una familia recién creada todos serían «nuevos».
 */
export function someoneNewToday(
  members: readonly Joiner[],
  today: DayRecord,
  now: number,
): boolean {
  const recent = new Set(
    members
      .filter(
        (m) =>
          m.joined !== null &&
          m.joined <= now &&
          now - m.joined <= NEWCOMER_DAYS * DAY_MS,
      )
      .map((m) => m.id),
  );
  if (recent.size === 0) return false;
  const by = [
    ...Object.values(today.marks).map((m) => m.by),
    ...Object.values(today.notes).map((n) => n.by),
  ];
  return by.some((id) => id !== undefined && recent.has(id));
}
