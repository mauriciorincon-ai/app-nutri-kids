import type { InsightDay } from "@/lib/diet/day-log";
import { buildDayChecklist, dateKey } from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import type { PressureEntry } from "@/lib/pressure/values";

import {
  acceptedByDay,
  byDay,
  dayKeys,
  judgeDay,
  type DayCheck,
  type DayStatus,
} from "./days";

/**
 * Cómo va el plan (S15 · ADR-021 · G-Plan 1a): en palabras y conteos, jamás un porcentaje.
 * «5 de 7 días dentro del plan · lo más difícil: la merienda». Es una cuenta de lo anotado, no
 * una nota del niño ni de quien lo cuida: un día sin anotar se dice aparte y nunca resta.
 */

export type Week = {
  /** Los siete días, del más viejo al más nuevo (para dibujar la semana en orden). */
  days: { day: string; status: DayStatus }[];
  /** Días anotados sin nada distinto al plan. */
  inPlan: number;
  /** Días anotados. */
  recorded: number;
  /** Días sin anotar. */
  unrecorded: number;
};

export type Hardest = {
  /** El checkId de la comida o el suplemento. */
  checkId: string;
  /** Días en que quedó sin marcar o con «no lo quiso». */
  misses: number;
  /** Días anotados en que tocaba. */
  of: number;
};

export type Adherence = {
  /** Hoy: lo marcado de las comidas y suplementos que tocan hoy. */
  today: { done: number; total: number };
  /** Los siete días que terminan hoy. */
  week: Week;
  /** Los siete anteriores. */
  prev: Week;
  /** Lo que más cuesta en las últimas cuatro semanas, si algo se repite. */
  hardest: Hardest | null;
};

/** «Lo más difícil» mira cuatro semanas y aparece desde la segunda vez. */
export const HARDEST_DAYS = 28;
export const HARDEST_MIN = 2;

function week(checks: DayCheck[]): Week {
  const days = [...checks]
    .reverse()
    .map((c) => ({ day: c.day, status: c.status }));
  return {
    days,
    inPlan: checks.filter((c) => c.status === "in").length,
    recorded: checks.filter((c) => c.status !== "none").length,
    unrecorded: checks.filter((c) => c.status === "none").length,
  };
}

export function adherence(
  diet: DietPlan,
  days: readonly InsightDay[],
  pressure: readonly PressureEntry[],
  now: Date,
): Adherence {
  const map = byDay(days);
  const accepted = acceptedByDay(pressure);
  const judge = (key: string) =>
    judgeDay(diet, key, map.get(key), accepted.get(key) ?? 0, now);

  const todayKey = dateKey(now);
  const todayItems = buildDayChecklist(
    diet,
    now,
    Object.keys(map.get(todayKey)?.record.marks ?? {}),
  ).items.filter((i) => i.kind !== "water");

  // «Lo más difícil»: cuatro semanas sin contar hoy (hoy aún está a tiempo).
  const order = buildDayChecklist(diet, now, [])
    .items.filter((i) => i.kind !== "water")
    .map((i) => i.checkId);
  const misses = new Map<string, number>();
  const of = new Map<string, number>();
  for (const key of dayKeys(now, HARDEST_DAYS, 1)) {
    const c = judge(key);
    if (c.status === "none") continue;
    const lost = new Set([...c.missed, ...c.rejected]);
    for (const id of c.expected) {
      of.set(id, (of.get(id) ?? 0) + 1);
      if (lost.has(id)) misses.set(id, (misses.get(id) ?? 0) + 1);
    }
  }
  let hardest: Hardest | null = null;
  for (const [checkId, n] of misses) {
    if (n < HARDEST_MIN) continue;
    const better =
      !hardest ||
      n > hardest.misses ||
      (n === hardest.misses &&
        order.indexOf(checkId) < order.indexOf(hardest.checkId));
    if (better) hardest = { checkId, misses: n, of: of.get(checkId) ?? n };
  }

  return {
    today: {
      done: todayItems.filter((i) => i.done).length,
      total: todayItems.length,
    },
    week: week(dayKeys(now, 7, 0).map(judge)),
    prev: week(dayKeys(now, 7, 7).map(judge)),
    hardest,
  };
}
