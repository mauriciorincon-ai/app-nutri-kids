"use client";

import { useMemo, useState } from "react";

import { ChoiceRow } from "@/components/wellbeing/choice-row";
import {
  useWellbeing,
  useWellbeingDays,
  useWt,
  wellbeingChanged,
} from "@/components/wellbeing/use-wellbeing";
import { useProfileNotes } from "@/components/use-profile-notes";
import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import { setFood } from "@/lib/diet/day-log";
import { dateKey } from "@/lib/diet/logic";
import type { LocalizedText } from "@/lib/diet/schema";
import { summarizeFood } from "@/lib/wellbeing/acceptance";
import {
  FOOD_TEXTURES,
  PRESENTATIONS,
  STAGES,
  VERDICTS,
  foodKey,
  parseFoodKey,
  type FoodValue,
  type PresentationId,
  type StageId,
  type VerdictId,
} from "@/lib/wellbeing/values";

type Option = { id: string; name: LocalizedText };

/** El día al que pertenece lo que se anota ahora (si cruzó la medianoche, el real). */
function writeDate(today: Date): Date {
  const now = new Date();
  return dateKey(now) === dateKey(today) ? today : now;
}

/**
 * Bitácora de aceptación: qué hizo con un alimento en una comida (lo miró, lo tocó o lo
 * probó: las tres cuentan), cómo le cayó, con qué textura y presentación funcionó y si es
 * nuevo. Solo anota: ni metas, ni cifras, ni presión. Se carga solo al abrirla.
 */
export default function FoodLog({
  today,
  meals,
  foods,
  mealId,
  foodId,
  canWrite,
}: {
  today: Date;
  meals: Option[];
  foods: Option[];
  /** Fijo cuando se abre desde una comida. */
  mealId?: string;
  /** Fijo cuando se abre desde la ficha de un alimento. */
  foodId?: string;
  canWrite: (mealId: string) => boolean;
}) {
  const w = useWt();
  const { t, l } = useI18n();
  const { acceptedTextures } = useProfileNotes();
  const day = useWellbeing(today);
  const days = useWellbeingDays();

  const writable = meals.filter((m) => canWrite(m.id));
  const [meal, setMeal] = useState(mealId ?? writable[0]?.id ?? "");
  const [food, setFoodId] = useState(foodId ?? "");
  const [stage, setStage] = useState<StageId>("tasted");
  const [verdict, setVerdict] = useState<VerdictId | null>(null);
  const [texture, setTexture] = useState<FoodValue["texture"]>(null);
  const [presentation, setPresentation] = useState<PresentationId | null>(null);
  const [isNew, setIsNew] = useState(false);

  const textures = useMemo(
    () =>
      [...FOOD_TEXTURES].sort(
        (a, b) =>
          Number(acceptedTextures.includes(b)) -
          Number(acceptedTextures.includes(a)),
      ),
    [acceptedTextures],
  );

  const nameOf = (id: string) => {
    const f = foods.find((x) => x.id === id);
    return f ? l(f.name) : id;
  };
  const mealName = (id: string) => {
    const m = meals.find((x) => x.id === id);
    return m ? l(m.name) : id;
  };

  const summary = food ? summarizeFood(days, food) : null;
  const showCount =
    summary && (summary.isNew || isNew) && summary.exposures > 0;
  const allowed = meal !== "" && canWrite(meal);

  // Lo ya anotado hoy en esta comida (o, desde la ficha, de este alimento).
  const entries = Object.entries(day.food)
    .map(([key, value]) => ({ key, value, k: parseFoodKey(key) }))
    .filter(
      (e) => e.k && (mealId ? e.k.mealId === mealId : e.k.foodId === foodId),
    );

  const edit = (key: string, v: FoodValue) => {
    const k = parseFoodKey(key);
    if (!k) return;
    setMeal(k.mealId);
    setFoodId(k.foodId);
    setStage(v.stage);
    setVerdict(v.verdict);
    setTexture(v.texture);
    setPresentation(v.presentation);
    setIsNew(v.isNew);
  };

  const save = () => {
    if (!food || !allowed) return;
    setFood(writeDate(today), foodKey(meal, food), {
      stage,
      verdict,
      texture,
      presentation,
      isNew,
    });
    wellbeingChanged();
    setVerdict(null);
    setTexture(null);
    setPresentation(null);
  };

  const remove = (key: string) => {
    setFood(writeDate(today), key, null);
    wellbeingChanged();
  };

  return (
    <div
      className="mt-1 ml-9 flex flex-col gap-3 rounded-xl border bg-card px-3 py-3"
      role="group"
      aria-label={w.foodTitle}
    >
      <p className="text-sm text-muted-foreground">{w.exposuresHint}</p>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="food-entries">
          {entries.map(({ key, value, k }) => (
            <li
              key={key}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                <span className="font-semibold">
                  {nameOf(k!.foodId)}
                  {!mealId && ` · ${mealName(k!.mealId)}`}
                </span>
                {` · ${w.foodStages[value.stage]}`}
                {value.verdict && ` · ${w.foodVerdicts[value.verdict]}`}
              </span>
              {canWrite(k!.mealId) && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => edit(key, value)}
                    className="min-h-11 px-2 font-medium text-primary hover:underline"
                  >
                    {t.today.editNote}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(key)}
                    className="min-h-11 px-2 font-medium text-primary hover:underline"
                  >
                    {w.foodRemove}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!foodId && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            {w.foodPick}
          </span>
          <select
            value={food}
            onChange={(e) => setFoodId(e.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3 text-base"
          >
            <option value="">—</option>
            {foods.map((f) => (
              <option key={f.id} value={f.id}>
                {l(f.name)}
              </option>
            ))}
          </select>
        </label>
      )}

      {!mealId && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            {t.today.meals}
          </span>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3 text-base"
          >
            {writable.map((m) => (
              <option key={m.id} value={m.id}>
                {l(m.name)}
              </option>
            ))}
          </select>
        </label>
      )}

      <ChoiceRow
        label={w.foodStage}
        optional={false}
        value={stage}
        onChange={(v) => v && setStage(v)}
        options={STAGES.map((id) => ({ id, text: w.foodStages[id] }))}
      />
      <ChoiceRow
        label={w.foodVerdict}
        value={verdict}
        onChange={setVerdict}
        options={VERDICTS.map((id) => ({ id, text: w.foodVerdicts[id] }))}
      />
      <ChoiceRow
        label={w.foodTexture}
        value={texture}
        onChange={setTexture}
        options={textures.map((id) => ({ id, text: t.texture[id] }))}
      />
      <ChoiceRow
        label={w.foodPresentation}
        value={presentation}
        onChange={setPresentation}
        options={PRESENTATIONS.map((id) => ({
          id,
          text: w.foodPresentations[id],
        }))}
      />

      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isNew}
          onChange={(e) => setIsNew(e.target.checked)}
          className="size-5 accent-primary"
        />
        {w.foodNew}
      </label>

      {summary && summary.exposures > 0 && (
        <div className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          {showCount && (
            <p className="font-semibold">
              {summary.exposures === 1
                ? w.exposuresOne
                : fmt(w.exposuresMany, { n: summary.exposures })}
            </p>
          )}
          {summary.lastVerdict && (
            <p>
              {fmt(w.lastVerdict, {
                verdict: w.foodVerdicts[summary.lastVerdict],
              })}
            </p>
          )}
          {summary.texturesThatWorked.length > 0 && (
            <p>
              {fmt(w.workedTextures, {
                list: summary.texturesThatWorked
                  .map((x) => t.texture[x])
                  .join(", "),
              })}
            </p>
          )}
          {summary.presentationsThatWorked.length > 0 && (
            <p>
              {fmt(w.workedPresentations, {
                list: summary.presentationsThatWorked
                  .map((x) => w.foodPresentations[x])
                  .join(", "),
              })}
            </p>
          )}
        </div>
      )}

      <Button
        size="sm"
        onClick={save}
        disabled={!food || !allowed}
        className="min-h-11"
      >
        {w.foodSave}
      </Button>
    </div>
  );
}
