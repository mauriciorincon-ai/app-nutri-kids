"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import { cameraText } from "@/i18n/camera";
import type { Seen, SeenResult } from "@/lib/camera/match";
import { allItemIds, resolveItemStatus } from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import { INGREDIENTS, INGREDIENT_IDS } from "@/lib/recipes/catalog";
import { cn } from "@/lib/utils";

/**
 * Sin foto (S12 · ADR-018): la rejilla de ingredientes del catálogo y de los alimentos del plan. Lo
 * elegido se lee igual que lo que vio el modelo (misma despensa, mismo plato). Es el respaldo
 * cuando el teléfono no puede con el modelo, no se descargó o falló.
 */
export function ManualPick({
  diet,
  today,
  open,
  onUse,
}: {
  diet: DietPlan;
  today: Date | null;
  open: boolean;
  onUse: (seen: SeenResult) => void;
}) {
  const { locale, l } = useI18n();
  const c = cameraText[locale];
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const ingredients = INGREDIENT_IDS.filter((id) => !INGREDIENTS[id].staple);
  const planFoods = useMemo(
    () =>
      today
        ? allItemIds(diet).flatMap((id) => {
            const s = resolveItemStatus(diet, id, today);
            return s ? [{ id, name: s.name }] : [];
          })
        : [],
    [diet, today],
  );

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const use = () => {
    const known: Seen[] = [];
    for (const id of ingredients)
      if (picked.has(`i:${id}`))
        known.push({ label: l(INGREDIENTS[id]), ingredient: id, planIds: [] });
    for (const f of planFoods)
      if (picked.has(`p:${f.id}`))
        known.push({ label: l(f.name), ingredient: null, planIds: [f.id] });
    onUse({ known, unknown: [] });
  };

  const chip = (key: string, text: string) => {
    const on = picked.has(key);
    return (
      <button
        key={key}
        type="button"
        aria-pressed={on}
        aria-label={fmt(on ? c.manualOn : c.manualOff, { label: text })}
        onClick={() => toggle(key)}
        className={cn(
          "min-h-11 rounded-full border px-3 text-sm font-medium",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:bg-accent",
        )}
      >
        {on && <span aria-hidden>✓ </span>}
        {text}
      </button>
    );
  };

  return (
    <details
      className="rounded-2xl border p-4"
      open={open || expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
      data-testid="camera-manual"
    >
      <summary className="min-h-11 cursor-pointer text-xl font-semibold">
        {c.manualTitle}
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{c.manualLead}</p>
        <div
          role="group"
          aria-label={c.manualIngredients}
          className="flex flex-col gap-1"
        >
          <h3 className="font-semibold">{c.manualIngredients}</h3>
          <div className="flex flex-wrap gap-1.5">
            {ingredients.map((id) => chip(`i:${id}`, l(INGREDIENTS[id])))}
          </div>
        </div>
        <div
          role="group"
          aria-label={c.manualPlan}
          className="flex flex-col gap-1"
        >
          <h3 className="font-semibold">{c.manualPlan}</h3>
          <div className="flex flex-wrap gap-1.5">
            {planFoods.map((f) => chip(`p:${f.id}`, l(f.name)))}
          </div>
        </div>
        <Button
          className="min-h-11 self-start"
          disabled={picked.size === 0}
          onClick={use}
        >
          {fmt(c.manualUse, { n: picked.size })}
        </Button>
      </div>
    </details>
  );
}
