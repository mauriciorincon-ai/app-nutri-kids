"use client";

import { useWt } from "@/components/wellbeing/use-wellbeing";
import { useI18n } from "@/i18n";
import type { DayWellbeing } from "@/lib/diet/day-log";
import type { DietPlan } from "@/lib/diet/schema";
import { acceptableFoods } from "@/lib/wellbeing/foods";
import { formatMinutes } from "@/lib/wellbeing/habits";
import {
  HABITS,
  SYMPTOM_IDS,
  WELL_NOTE_KEY,
  parseFoodKey,
} from "@/lib/wellbeing/values";

/**
 * Lo anotado del bienestar de un día, en el Historial: solo lectura, en las mismas palabras
 * de casa con que se anotó. No suma, no compara y no dice qué significa.
 */
export function WellbeingBlock({
  wellbeing,
  diet,
  mealLabel,
}: {
  wellbeing: DayWellbeing;
  diet: DietPlan;
  /** Nombre de la comida a partir de su checkId («meal:<id>»). */
  mealLabel: (checkId: string) => string;
}) {
  const w = useWt();
  const { t, l } = useI18n();

  const moods = Object.entries(wellbeing.moods).map(
    ([checkId, mood]) => `${mealLabel(checkId)}: ${w.moods[mood]}`,
  );
  const symptoms = SYMPTOM_IDS.filter((id) => wellbeing.well[id]).map(
    (id) =>
      `${w.symptoms[id]}: ${
        (w.symptomOptions[id] as Record<string, string>)[wellbeing.well[id]]
      }`,
  );
  const note = wellbeing.well[WELL_NOTE_KEY];
  const habits = HABITS.filter((h) => wellbeing.habits[h] !== undefined).map(
    (h) => `${w.habits[h]}: ${formatMinutes(wellbeing.habits[h])}`,
  );
  const foods = acceptableFoods(diet);
  const foodLines = Object.entries(wellbeing.food).flatMap(([key, v]) => {
    const k = parseFoodKey(key);
    if (!k) return [];
    const food = foods.find((f) => f.id === k.foodId);
    const name = food ? l(food.name) : t.history.unknownItem;
    return [
      `${name} (${mealLabel(`meal:${k.mealId}`)}): ${w.foodStages[v.stage]}${
        v.verdict ? ` · ${w.foodVerdicts[v.verdict]}` : ""
      }`,
    ];
  });

  if (
    moods.length + symptoms.length + habits.length + foodLines.length === 0 &&
    !note
  )
    return null;

  const row = (label: string, items: string[]) =>
    items.length > 0 && (
      <p className="mt-0.5 text-muted-foreground">
        <span className="font-semibold">{label}</span> {items.join(" · ")}
      </p>
    );

  return (
    <div className="mt-2 border-t pt-2 text-sm" data-testid="history-wellbeing">
      {row(w.historyMoods, moods)}
      {row(w.historySymptoms, symptoms)}
      {note && <p className="mt-0.5 text-muted-foreground">{note}</p>}
      {row(w.historyHabits, habits)}
      {row(w.historyFood, foodLines)}
    </div>
  );
}
