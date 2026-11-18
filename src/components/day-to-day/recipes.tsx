"use client";

import { useMemo, useState } from "react";

import { useToday } from "@/components/day-checklist/use-today";
import { useWellbeingDays } from "@/components/wellbeing/use-wellbeing";
import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import {
  clearPantry,
  getOwnRecipes,
  getPantry,
  togglePantry,
} from "@/lib/day-to-day/store";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import {
  RECIPES,
  timeLevel,
  type Cost,
  type TimeLevel,
} from "@/lib/recipes/book";
import type { RecipeSteps } from "@/lib/recipes/steps";
import {
  INGREDIENTS,
  INGREDIENT_IDS,
  type IngredientId,
} from "@/lib/recipes/catalog";
import {
  filterRecipes,
  likedFoodIds,
  pantryPlan,
  reviewAll,
  type PantryRecipe,
  type RecipeState,
  type ReviewedRecipe,
} from "@/lib/recipes/review";
import { cn } from "@/lib/utils";

import { StateChip } from "./state-chip";
import { useRecipesDt, useReviewInput } from "./use-dt";

import OwnRecipes from "./own-recipes";

const TIMES: TimeLevel[] = ["quick", "medium", "long"];
const COSTS: Cost[] = ["low", "mid", "high"];
const COSTS_PRESENT = COSTS.filter((c) => RECIPES.some((r) => r.cost === c));
const EMPTY_OWN: ReturnType<typeof getOwnRecipes> = [];
const EMPTY_PANTRY: IngredientId[] = [];

/** Recetario (S11 · ADR-017): recetas revisadas contra el plan, «con lo que tengo» y recetas propias. */
export function Recipes() {
  const d = useRecipesDt();
  const { l } = useI18n();
  const today = useToday();
  const input = useReviewInput(today);
  const days = useWellbeingDays();
  const pantryIds = useLocalStore(getPantry, EMPTY_PANTRY);
  const own = useLocalStore(getOwnRecipes, EMPTY_OWN);

  const [time, setTime] = useState<TimeLevel | null>(null);
  const [cost, setCost] = useState<Cost | null>(null);
  const [liked, setLiked] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);

  const likedPlanIds = useMemo(() => likedFoodIds(days), [days]);
  const reviewed = useMemo(
    () => (input ? reviewAll(RECIPES, input) : { shown: [], hidden: [] }),
    [input],
  );
  const pantry = useMemo(
    () =>
      new Set(pantryIds.filter((id): id is IngredientId => id in INGREDIENTS)),
    [pantryIds],
  );
  const plan = useMemo(
    () => (input ? pantryPlan(reviewed.shown, pantry, input) : null),
    [input, reviewed, pantry],
  );

  if (!today || !input)
    return <p className="text-muted-foreground">{d.common.planLoading}</p>;

  const list = filterRecipes(
    reviewed.shown,
    { time, cost, liked },
    likedPlanIds,
  );
  const pantryActive = pantry.size > 0;
  const ingredient = (id: IngredientId) => l(INGREDIENTS[id]);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{d.recipes.title}</h1>
      <p className="-mt-2 text-muted-foreground">{d.recipes.lead}</p>
      <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        {d.common.notMedical}
      </p>

      <section className="flex flex-col gap-3" aria-labelledby="rec-filters">
        <h2 id="rec-filters" className="sr-only">
          {d.recipes.timeLabel} · {d.recipes.costLabel}
        </h2>
        <Chips
          label={d.recipes.timeLabel}
          allLabel={d.recipes.all}
          value={time}
          onChange={setTime}
          options={TIMES.map((x) => ({ id: x, text: d.recipes.time[x] }))}
        />
        <Chips
          label={d.recipes.costLabel}
          allLabel={d.recipes.all}
          value={cost}
          onChange={setCost}
          options={COSTS_PRESENT.map((x) => ({
            id: x,
            text: d.recipes.cost[x],
          }))}
        />
        <div>
          <button
            type="button"
            aria-pressed={liked}
            onClick={() => setLiked((v) => !v)}
            className={cn(
              "min-h-11 rounded-full border px-3 text-sm font-medium",
              liked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent",
            )}
          >
            {liked && <span aria-hidden>✓ </span>}
            {d.recipes.likedOnly}
          </button>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.recipes.likedHint}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="rec-pantry">
        <h2 id="rec-pantry" className="text-xl">
          {d.recipes.pantryTitle}
        </h2>
        <p className="-mt-2 text-sm text-muted-foreground">
          {d.recipes.pantryLead}
        </p>
        <Button
          variant="outline"
          className="min-h-11 self-start"
          aria-expanded={pantryOpen}
          onClick={() => setPantryOpen((v) => !v)}
        >
          {d.recipes.pantryTitle}
        </Button>
        {pantryOpen && (
          <div className="flex flex-col gap-2" data-testid="pantry">
            <div role="group" className="flex flex-wrap gap-1.5">
              {INGREDIENT_IDS.filter((id) => !INGREDIENTS[id].staple).map(
                (id) => {
                  const on = pantry.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        togglePantry(id);
                        notifyLocalStore();
                      }}
                      className={cn(
                        "min-h-11 rounded-full border px-3 text-sm font-medium",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      {on && <span aria-hidden>✓ </span>}
                      {ingredient(id)}
                    </button>
                  );
                },
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {d.recipes.pantryStaples}
            </p>
            {pantryActive && (
              <Button
                variant="ghost"
                className="min-h-11 self-start"
                onClick={() => {
                  clearPantry();
                  notifyLocalStore();
                }}
              >
                {d.recipes.pantryClear}
              </Button>
            )}
          </div>
        )}
        {pantryActive && plan && (
          <PantryResult
            ready={plan.ready}
            swap={plan.swap}
            almost={plan.almost}
            ingredient={ingredient}
          />
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="rec-list">
        <h2 id="rec-list" className="sr-only">
          {d.recipes.title}
        </h2>
        {list.length === 0 ? (
          <p className="text-sm">{d.recipes.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="recipe-list">
            {list.map((r) => (
              <RecipeCard key={r.recipe.id} r={r} ingredient={ingredient} />
            ))}
          </ul>
        )}

        {reviewed.hidden.length > 0 && (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="min-h-11 self-start"
              aria-expanded={showHidden}
              onClick={() => setShowHidden((v) => !v)}
            >
              {d.recipes.hiddenToggle}
            </Button>
            {showHidden && (
              <div data-testid="recipe-hidden" className="flex flex-col gap-1">
                <h3 className="font-semibold">{d.recipes.hiddenTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {d.recipes.hiddenLead}
                </p>
                <ul className="text-sm">
                  {reviewed.hidden.map((h) => (
                    <li key={h.recipe.id}>
                      {fmt(d.recipes.hiddenLine, {
                        recipe: l(h.recipe.name),
                        ingredient: ingredient(h.blockers[0].ingredient),
                        why: d.recipes.hiddenWhy[h.blockers[0].why],
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <OwnRecipes own={own} input={input} />
      <p className="text-sm text-muted-foreground">{d.common.offline}</p>
    </div>
  );
}

function Chips<T extends string>({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: T | null;
  onChange: (v: T | null) => void;
  options: { id: T; text: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {[{ id: null, text: allLabel }, ...options].map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm font-medium",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {active && <span aria-hidden>✓ </span>}
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecipeCard({
  r,
  ingredient,
}: {
  r: ReviewedRecipe;
  ingredient: (id: IngredientId) => string;
}) {
  const d = useRecipesDt();
  const { l } = useI18n();
  const [open, setOpen] = useState(false);
  // Los pasos se piden la primera vez que se abre la receta, no al cargar la pantalla.
  const [detail, setDetail] = useState<RecipeSteps | null>(null);
  const toggle = () => {
    setOpen((v) => !v);
    if (!detail)
      import("@/lib/recipes/steps").then((m) =>
        setDetail(m.STEPS[r.recipe.id] ?? { steps: [] }),
      );
  };
  const state = r.state as Exclude<RecipeState, "blocked">;
  const id = `rec-${r.recipe.id}`;
  return (
    <li
      className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-3"
      data-testid={`recipe-${r.recipe.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{l(r.recipe.name)}</h3>
        <StateChip state={state} />
      </div>
      <p className="text-sm text-muted-foreground">
        {fmt(d.recipes.minutes, { n: r.recipe.minutes })} ·{" "}
        {d.recipes.time[timeLevel(r.recipe.minutes)]} ·{" "}
        {d.recipes.cost[r.recipe.cost]}
      </p>
      {r.cautions.map((c) => (
        <p key={c.ingredient} className="text-sm">
          {fmt(d.recipes.cautionLine, {
            food: ingredient(c.ingredient),
            limit: l(c.limit),
          })}
        </p>
      ))}
      {r.unknown.length > 0 && (
        <p className="text-sm">
          {fmt(d.recipes.unknownLine, {
            foods: r.unknown.map(ingredient).join(", "),
          })}
        </p>
      )}
      {r.textureNotAccepted && (
        <p className="text-sm">{d.recipes.textureNote}</p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 self-start"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
      >
        {open ? d.recipes.close : d.recipes.open}
      </Button>
      {open && (
        <div id={id} className="flex flex-col gap-2">
          <h4 className="font-semibold">{d.recipes.ingredientsTitle}</h4>
          <ul className="list-disc pl-5 text-sm">
            {r.recipe.ingredients.map((i) => (
              <li key={i.id}>
                {l(i.qty)} {ingredient(i.id)}
                {i.optional ? ` ${d.recipes.optional}` : ""}
              </li>
            ))}
          </ul>
          {detail ? (
            <>
              <h4 className="font-semibold">{d.recipes.stepsTitle}</h4>
              <ol className="list-decimal pl-5 text-sm">
                {detail.steps.map((s, i) => (
                  <li key={i}>{l(s)}</li>
                ))}
              </ol>
              {detail.tip && (
                <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                  <span className="font-semibold">{d.recipes.tipTitle}: </span>
                  {l(detail.tip)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {d.recipes.stepsLoading}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function PantryResult({
  ready,
  swap,
  almost,
  ingredient,
}: {
  ready: PantryRecipe[];
  swap: PantryRecipe[];
  almost: PantryRecipe[];
  ingredient: (id: IngredientId) => string;
}) {
  const d = useRecipesDt();
  const { l } = useI18n();
  if (ready.length + swap.length + almost.length === 0)
    return <p className="text-sm">{d.recipes.pantryNone}</p>;
  const block = (title: string, rows: PantryRecipe[], testid: string) =>
    rows.length > 0 && (
      <div className="flex flex-col gap-1" data-testid={testid}>
        <h3 className="font-semibold">{title}</h3>
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li
              key={r.recipe.id}
              className="flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2"
            >
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {l(r.recipe.name)}
                <StateChip state={r.state as Exclude<RecipeState, "blocked">} />
              </span>
              {r.swaps.map((s) => (
                <span key={s.from} className="text-sm">
                  {fmt(d.recipes.swapLine, {
                    from: ingredient(s.from),
                    to: l(s.planName),
                  })}
                </span>
              ))}
              {r.missing.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {fmt(d.recipes.missingLine, {
                    foods: r.missing.map(ingredient).join(", "),
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {block(d.recipes.pantryReady, ready, "pantry-ready")}
      {block(d.recipes.pantrySwap, swap, "pantry-swap")}
      {block(d.recipes.pantryAlmost, almost, "pantry-almost")}
    </div>
  );
}
