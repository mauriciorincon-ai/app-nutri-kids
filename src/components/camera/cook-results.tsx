"use client";

import { CircleHelp } from "lucide-react";
import Link from "next/link";

import { StatusChip } from "@/components/traffic-light/status-chip";
import { fmt, useI18n } from "@/i18n";
import { cameraCookText, templateKindKey } from "@/i18n/camera-cook";
import type { Cooked } from "@/lib/camera/cook";
import { INGREDIENTS, type IngredientId } from "@/lib/recipes/catalog";
import type { PantryRecipe, RecipeState } from "@/lib/recipes/review";

/**
 * Lo que sale de lo confirmado (S12 · ADR-018): primero el recetario revisado contra el plan
 * («hazla ya», «con un cambio seguro», «te falta poco»); las plantillas de cocina solo si ninguna
 * receta del recetario sale. Todo viene de `cookFromPantry`: aquí solo se dibuja.
 */
export function CookResults({
  cooked,
  pantry,
}: {
  cooked: Cooked;
  pantry: IngredientId[];
}) {
  const { locale, l } = useI18n();
  const c = cameraCookText[locale];
  const name = (id: IngredientId) => l(INGREDIENTS[id]);
  const { ready, swap, almost } = cooked.plan;
  const none =
    ready.length + swap.length + almost.length + cooked.templates.length === 0;

  // Lo que el plan no nombra NUNCA se pinta verde: símbolo «?» + palabra, como en el recetario.
  const chip = (state: RecipeState) =>
    state === "caution" ? (
      <StatusChip color="yellow" label={c.stateCaution} />
    ) : state === "unknown" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold">
        <CircleHelp aria-hidden className="size-4 shrink-0" />
        {c.stateUnknown}
      </span>
    ) : (
      <StatusChip color="green" label={c.stateOk} />
    );

  // Lo que la receta lleva y el plan no nombra, y la textura de hoy: lo mismo que dice /recetas.
  const notes = (r: PantryRecipe) => (
    <>
      {r.unknown.length > 0 && (
        <span className="text-sm">
          {fmt(c.unknownLine, { foods: r.unknown.map(name).join(", ") })}
        </span>
      )}
      {r.textureNotAccepted && <span className="text-sm">{c.textureNote}</span>}
    </>
  );

  const block = (title: string, rows: PantryRecipe[], testid: string) =>
    rows.length > 0 && (
      <div className="flex flex-col gap-1" data-testid={testid}>
        <h2 className="font-semibold">{title}</h2>
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li
              key={r.recipe.id}
              className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2"
            >
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {l(r.recipe.name)}
                {chip(r.state)}
              </span>
              {r.cautions.map((x) => (
                <span key={x.ingredient} className="text-sm">
                  {fmt(c.cautionLine, {
                    food: name(x.ingredient),
                    limit: l(x.limit),
                  })}
                </span>
              ))}
              {notes(r)}
              {r.swaps.map((s) => (
                <span key={s.from} className="text-sm">
                  {fmt(c.swapLine, { from: name(s.from), to: l(s.planName) })}
                </span>
              ))}
              {r.missing.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {fmt(c.missingLine, {
                    foods: r.missing.map(name).join(", "),
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border p-4"
      aria-label={c.resultsTitle}
      data-testid="camera-cook"
    >
      <p role="status" className="text-sm font-medium">
        {fmt(c.pantryLine, { foods: pantry.map(name).join(", ") })}
      </p>
      {(
        [
          [false, c.pantryAvoided],
          [true, c.pantryAllergy],
        ] as const
      ).map(([allergy, line]) => {
        const ids = cooked.avoided.filter((a) => a.allergy === allergy);
        return (
          ids.length > 0 && (
            <p
              key={String(allergy)}
              className="flex items-start gap-2 rounded-xl bg-tl-red-surface px-3 py-2 text-sm font-medium text-tl-red"
              data-testid={`camera-cook-avoided${allergy ? "-allergy" : ""}`}
            >
              <span aria-hidden>✖</span>
              <span>
                {fmt(line, { foods: ids.map((a) => name(a.id)).join(", ") })}
              </span>
            </p>
          )
        );
      })}
      {none && <p className="text-sm">{c.nothingToCook}</p>}
      {block(c.resultReady, ready, "camera-cook-ready")}
      {block(c.resultSwap, swap, "camera-cook-swap")}
      {block(c.resultAlmost, almost, "camera-cook-almost")}
      {cooked.templates.length > 0 && (
        <div
          className="flex flex-col gap-2"
          data-testid="camera-cook-templates"
        >
          <h2 className="font-semibold">{c.templateTitle}</h2>
          <p className="text-sm text-muted-foreground">{c.templateLead}</p>
          <ul className="flex flex-col gap-2">
            {cooked.templates.map((t) => {
              const r = t.reviewed;
              return (
                <li
                  key={r.recipe.id}
                  className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2"
                  data-testid={`camera-template-${t.template}`}
                >
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {l(r.recipe.name)}
                    {chip(r.state)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {c[templateKindKey[t.template]]} ·{" "}
                    {fmt(c.minutes, { n: r.recipe.minutes })}
                  </span>
                  <span className="text-sm">
                    {fmt(c.templateWith, {
                      foods: r.recipe.ingredients
                        .filter((i) => !INGREDIENTS[i.id].staple)
                        .map((i) => name(i.id))
                        .join(", "),
                    })}
                  </span>
                  {r.cautions.map((x) => (
                    <span key={x.ingredient} className="text-sm">
                      {fmt(c.cautionLine, {
                        food: name(x.ingredient),
                        limit: l(x.limit),
                      })}
                    </span>
                  ))}
                  <span className="mt-1 text-sm font-semibold">
                    {c.templateStepsTitle}
                  </span>
                  <ol className="list-decimal pl-5 text-sm">
                    {t.steps.map((s, i) => (
                      <li key={i}>{l(s)}</li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Link
        href="/recetas"
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
      >
        {c.seeRecipes}
      </Link>
    </section>
  );
}
