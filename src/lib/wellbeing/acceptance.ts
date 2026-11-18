import type { DayWellbeing } from "@/lib/diet/day-log";

import {
  parseFoodKey,
  type FoodValue,
  type PresentationId,
  type VerdictId,
} from "./values";

/**
 * La bitácora de aceptación por alimento, DERIVADA de lo anotado en los días (ADR-015): no hay
 * un contador guardado que pueda desincronizarse entre teléfonos. Mirar, tocar o probar son
 * exposiciones: las tres cuentan. Aquí no hay metas ni cifras: el copy dice que suele hacer
 * falta ofrecerlo muchas veces, sin presión (fuentes: USDA NESR 2019 y 2025).
 */

export type FoodSummary = {
  foodId: string;
  /** Veces que lo vio, tocó o probó (cada comida de cada día cuenta una). */
  exposures: number;
  /** Alguien lo anotó como alimento nuevo. */
  isNew: boolean;
  /** Lo último que se dijo de cómo le cayó (null = solo se anotó que lo vio). */
  lastVerdict: VerdictId | null;
  /** Las texturas y presentaciones con las que lo aceptó (le gustó o lo aceptó). */
  texturesThatWorked: NonNullable<FoodValue["texture"]>[];
  presentationsThatWorked: PresentationId[];
};

type Row = { day: string; meal: string; value: FoodValue };

/** Las entradas de un alimento, de la más vieja a la más nueva. */
function rowsOf(
  days: { day: string; wellbeing: DayWellbeing }[],
  foodId: string,
): Row[] {
  const rows: Row[] = [];
  for (const { day, wellbeing } of days)
    for (const [key, value] of Object.entries(wellbeing.food)) {
      const f = parseFoodKey(key);
      if (f && f.foodId === foodId) rows.push({ day, meal: f.mealId, value });
    }
  return rows.sort((a, b) =>
    a.day === b.day
      ? a.meal < b.meal
        ? -1
        : a.meal > b.meal
          ? 1
          : 0
      : a.day < b.day
        ? -1
        : 1,
  );
}

export function summarizeFood(
  days: { day: string; wellbeing: DayWellbeing }[],
  foodId: string,
): FoodSummary {
  const rows = rowsOf(days, foodId);
  const worked = rows.filter(
    (r) => r.value.verdict === "loves" || r.value.verdict === "accepts",
  );
  const uniq = <T>(xs: (T | null)[]): T[] => [
    ...new Set(xs.filter((x): x is T => x !== null)),
  ];
  return {
    foodId,
    exposures: rows.length,
    isNew: rows.some((r) => r.value.isNew),
    lastVerdict:
      [...rows].reverse().find((r) => r.value.verdict !== null)?.value
        .verdict ?? null,
    texturesThatWorked: uniq(worked.map((r) => r.value.texture)),
    presentationsThatWorked: uniq(worked.map((r) => r.value.presentation)),
  };
}

/** Los ids de alimento con alguna entrada, para listar en el historial. */
export function foodIdsAnnotated(
  days: { day: string; wellbeing: DayWellbeing }[],
): string[] {
  const ids = new Set<string>();
  for (const { wellbeing } of days)
    for (const key of Object.keys(wellbeing.food)) {
      const f = parseFoodKey(key);
      if (f) ids.add(f.foodId);
    }
  return [...ids];
}
