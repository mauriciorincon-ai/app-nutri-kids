import type { InsightDay } from "@/lib/diet/day-log";
import { buildDayChecklist, clockLabel, dateKey } from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import type { PressureEntry } from "@/lib/pressure/values";

/**
 * Lo común de «Lo que aprende» (S15 · ADR-021): qué es un día anotado y qué cuenta como algo
 * distinto al plan. Puro: toda fecha entra por parámetro y nada lee el almacenamiento.
 *
 * Un día SIN anotar nunca es una falta: es «sin anotar». Solo se mira un día en el que alguien
 * marcó o anotó algo del plan (una marca o una nota) o registró que le ofrecieron algo.
 */

export type DayStatus = "in" | "off" | "none";

export type DayCheck = {
  day: string;
  status: DayStatus;
  /** Lo que el plan esperaba y se pudo mirar (comidas ya pasadas; los suplementos, al terminar el día). */
  expected: string[];
  /** De lo esperado, lo que quedó sin marcar. */
  missed: string[];
  /** Comidas con la nota «no lo quiso». */
  rejected: string[];
  /** Veces que, cuando le ofrecieron algo, se aceptó. */
  accepted: number;
};

/** La clave `YYYY-MM-DD` como fecha local al mediodía (lejos de los cambios de hora). */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Las claves de `count` días que terminan `offset` días antes de `now`, de la más nueva a la más vieja. */
export function dayKeys(now: Date, count: number, offset = 0): string[] {
  const out: string[] = [];
  for (let i = offset; i < offset + count; i++) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - i,
      12,
    );
    out.push(dateKey(d));
  }
  return out;
}

/** Los días por clave, para buscarlos sin recorrer la lista. */
export function byDay(days: readonly InsightDay[]): Map<string, InsightDay> {
  return new Map(days.map((d) => [d.day, d]));
}

/** Las aceptaciones de lo ofrecido, contadas por día. */
export function acceptedByDay(
  pressure: readonly PressureEntry[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of pressure)
    if (e.answer === "accepted") out.set(e.date, (out.get(e.date) ?? 0) + 1);
  return out;
}

/** Un día cuenta como anotado si tiene una marca o una nota del plan. El bienestar solo, no. */
export function isPlanRecorded(day: InsightDay | undefined): boolean {
  if (!day) return false;
  return (
    Object.keys(day.record.marks).length > 0 ||
    Object.keys(day.record.notes).length > 0
  );
}

/**
 * Cómo fue un día frente al plan. Hoy solo se miran las comidas cuya franja ya terminó; los
 * suplementos de hoy aún están a tiempo. El agua no cuenta: es una cantidad, no un momento.
 */
export function judgeDay(
  diet: DietPlan,
  key: string,
  day: InsightDay | undefined,
  accepted: number,
  now: Date,
): DayCheck {
  const isToday = key === dateKey(now);
  const recorded = isPlanRecorded(day) || accepted > 0;
  const empty: DayCheck = {
    day: key,
    status: "none",
    expected: [],
    missed: [],
    rejected: [],
    accepted: 0,
  };
  if (!recorded) return empty;
  const clock = clockLabel(now);
  const marks = day?.record.marks ?? {};
  const notes = day?.record.notes ?? {};
  const expected = buildDayChecklist(diet, keyToDate(key), [])
    .items.filter((i) => {
      if (i.kind === "meal") return !isToday || i.meal.end <= clock;
      if (i.kind === "supplement") return !isToday;
      return false;
    })
    .map((i) => i.checkId);
  const missed = expected.filter((id) => !(id in marks));
  const rejected = Object.entries(notes)
    .filter(([, n]) => n.chips.includes("rejected"))
    .map(([id]) => id);
  const off = missed.length > 0 || rejected.length > 0 || accepted > 0;
  return {
    day: key,
    status: off ? "off" : "in",
    expected,
    missed,
    rejected,
    accepted,
  };
}
