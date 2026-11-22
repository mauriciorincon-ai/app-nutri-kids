"use client";

import { CircleHelp } from "lucide-react";

import { StatusChip } from "@/components/traffic-light/status-chip";
import { fmt, useI18n } from "@/i18n";
import { cameraText } from "@/i18n/camera";
import type { Plate, PlateState } from "@/lib/camera/plate";
import type { Meal } from "@/lib/diet/schema";

/**
 * Mirar el plato (S12 · ADR-018): cada alimento visto con su estado en el plan —siempre símbolo +
 * texto + color—, lo que choca con una alergia o intolerancia anotada y los grupos que el texto de la
 * comida nombra y la foto no trajo. Todo lo decide `readPlate`; aquí solo se dibuja.
 */
export function PlateReading({
  plate,
  meals,
  mealId,
  onMeal,
}: {
  plate: Plate;
  meals: readonly Meal[];
  mealId: string | undefined;
  onMeal: (id: string) => void;
}) {
  const { locale, l } = useI18n();
  const c = cameraText[locale];
  const label: Record<PlateState, string> = {
    allergy: c.plateAllergy,
    red: c.plateRed,
    yellow: c.plateYellow,
    green: c.plateGreen,
    unknown: c.plateUnknown,
  };
  const names = (list: { name: { es: string; en: string } }[]) =>
    list.map((g) => l(g.name)).join(", ");
  const empty = plate.foods.length === 0 && plate.allergyUnknown.length === 0;

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border p-4"
      aria-labelledby="cam-plate"
      data-testid="camera-plate"
    >
      <h2 id="cam-plate" className="text-xl">
        {c.plateTitle}
      </h2>
      <p className="text-sm text-muted-foreground">{c.plateLead}</p>
      {meals.length > 1 && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {c.plateMealLabel}
          <select
            value={mealId ?? plate.meal?.id ?? ""}
            onChange={(e) => onMeal(e.target.value)}
            className="min-h-11 rounded-lg border bg-card px-3 font-normal"
            data-testid="camera-plate-meal"
          >
            {meals.map((m) => (
              <option key={m.id} value={m.id}>
                {l(m.name)}
              </option>
            ))}
          </select>
        </label>
      )}
      {empty && <p className="text-sm">{c.plateNone}</p>}
      {plate.foods.length > 0 && (
        <ul className="flex flex-col divide-y" data-testid="camera-plate-foods">
          {plate.foods.map((f) => (
            <li
              key={f.label}
              className="flex flex-col gap-1 py-2"
              data-state={f.state}
            >
              <span className="font-semibold">{f.label}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {f.state === "unknown" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold">
                    <CircleHelp aria-hidden className="size-4 shrink-0" />
                    {label.unknown}
                  </span>
                ) : (
                  <StatusChip
                    color={f.state === "allergy" ? "red" : f.state}
                    label={label[f.state]}
                  />
                )}
                {f.planName && f.state !== "allergy" && (
                  <span className="text-muted-foreground">
                    {l(f.planName)}
                    {f.limit ? ` · ${l(f.limit)}` : ""}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {plate.allergyUnknown.length > 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-tl-red-surface px-3 py-2 text-sm font-medium text-tl-red"
          data-testid="camera-plate-allergy"
        >
          <span aria-hidden>✖</span>
          <span>
            {fmt(c.plateAllergyUnknown, {
              foods: plate.allergyUnknown.join(", "),
            })}
          </span>
        </p>
      )}
      <div className="flex flex-col gap-1 text-sm" data-testid="camera-groups">
        {plate.expected.length === 0 ? (
          <p>{c.groupsUnknown}</p>
        ) : (
          <>
            <p>{fmt(c.groupsExpected, { groups: names(plate.expected) })}</p>
            <p className="font-medium">
              {plate.missing.length > 0
                ? fmt(c.groupsMissing, { groups: names(plate.missing) })
                : c.groupsComplete}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
