"use client";

import { useMemo, useState } from "react";
import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";

import { useToday } from "@/components/day-checklist/use-today";
import { useWellbeingDays } from "@/components/wellbeing/use-wellbeing";
import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import {
  clearPantry,
  getOwnRecipes,
  getPantry,
  OWN_LINES_MAX,
  OWN_MAX,
  OWN_NAME_MAX,
  OWN_STEPS_MAX,
  removeOwnRecipe,
  saveOwnRecipe,
  togglePantry,
} from "@/lib/day-to-day/store";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import {
  RECIPES,
  timeLevel,
  type Cost,
  type TimeLevel,
} from "@/lib/recipes/book";
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
  reviewOwn,
  type PantryRecipe,
  type RecipeState,
  type ReviewedRecipe,
} from "@/lib/recipes/review";
import { cn } from "@/lib/utils";

import { useDt, useReviewInput } from "./use-dt";

const TIMES: TimeLevel[] = ["quick", "medium", "long"];
const COSTS: Cost[] = ["low", "mid", "high"];
const COSTS_PRESENT = COSTS.filter((c) => RECIPES.some((r) => r.cost === c));
const EMPTY_OWN: ReturnType<typeof getOwnRecipes> = [];
const EMPTY_PANTRY: IngredientId[] = [];

const STATE_STYLE: Record<
  Exclude<RecipeState, "blocked">,
  { chip: string; Icon: typeof CircleCheck }
> = {
  ok: { chip: "bg-tl-green-surface text-tl-green", Icon: CircleCheck },
  caution: { chip: "bg-tl-yellow-surface text-tl-yellow", Icon: TriangleAlert },
  unknown: { chip: "bg-muted text-foreground", Icon: CircleHelp },
};

/** Recetario (S11 · ADR-017): recetas revisadas contra el plan, «con lo que tengo» y recetas propias. */
export function Recipes() {
  const d = useDt();
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

function StateChip({ state }: { state: Exclude<RecipeState, "blocked"> }) {
  const d = useDt();
  const { chip, Icon } = STATE_STYLE[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
        chip,
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {d.recipes.states[state]}
    </span>
  );
}

function RecipeCard({
  r,
  ingredient,
}: {
  r: ReviewedRecipe;
  ingredient: (id: IngredientId) => string;
}) {
  const d = useDt();
  const { l } = useI18n();
  const [open, setOpen] = useState(false);
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
        onClick={() => setOpen((v) => !v)}
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
          <h4 className="font-semibold">{d.recipes.stepsTitle}</h4>
          <ol className="list-decimal pl-5 text-sm">
            {r.recipe.steps.map((s, i) => (
              <li key={i}>{l(s)}</li>
            ))}
          </ol>
          {r.recipe.tip && (
            <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
              <span className="font-semibold">{d.recipes.tipTitle}: </span>
              {l(r.recipe.tip)}
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
  const d = useDt();
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

function OwnRecipes({
  own,
  input,
}: {
  own: ReturnType<typeof getOwnRecipes>;
  input: NonNullable<ReturnType<typeof useReviewInput>>;
}) {
  const d = useDt();
  const { l } = useI18n();
  const [name, setName] = useState("");
  const [lines, setLines] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState<"invalid" | "full" | null>(null);

  const save = () => {
    const ingredients = lines.split("\n");
    const r = saveOwnRecipe({ name, ingredients, steps }, new Date());
    if (!r) {
      setError(own.length >= OWN_MAX ? "full" : "invalid");
      return;
    }
    setError(null);
    setName("");
    setLines("");
    setSteps("");
    notifyLocalStore();
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="rec-own">
      <h2 id="rec-own" className="text-xl">
        {d.recipes.ownTitle}
      </h2>
      <p className="-mt-2 text-sm text-muted-foreground">{d.recipes.ownLead}</p>
      <p className="text-sm text-muted-foreground">{d.recipes.ownLocal}</p>

      {own.length === 0 ? (
        <p className="text-sm">{d.recipes.ownEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="own-list">
          {own.map((r) => {
            const rev = reviewOwn(r, input);
            return (
              <li
                key={r.id}
                className="flex flex-col gap-1 rounded-xl border bg-card px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{r.name}</h3>
                  {rev.state !== "blocked" && <StateChip state={rev.state} />}
                </div>
                {rev.state === "blocked" ? (
                  <p className="text-sm">
                    {fmt(d.recipes.ownHidden, {
                      foods: rev.blocked.map((b) => b.text).join(", "),
                    })}
                  </p>
                ) : (
                  <>
                    {rev.cautions.map((c) => (
                      <p key={c.text} className="text-sm">
                        {fmt(d.recipes.cautionLine, {
                          food: c.text,
                          limit: l(c.limit),
                        })}
                      </p>
                    ))}
                    {rev.unknown.length > 0 && (
                      <p className="text-sm">
                        {fmt(d.recipes.unknownLine, {
                          foods: rev.unknown.join(", "),
                        })}
                      </p>
                    )}
                    <ul className="list-disc pl-5 text-sm">
                      {r.ingredients.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                    {r.steps && (
                      <p className="whitespace-pre-line text-sm">{r.steps}</p>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 self-start"
                  aria-label={fmt(d.recipes.ownRemoveAria, { name: r.name })}
                  onClick={() => {
                    removeOwnRecipe(r.id);
                    notifyLocalStore();
                  }}
                >
                  {d.recipes.ownRemove}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            {d.recipes.ownName}
          </span>
          <input
            type="text"
            value={name}
            maxLength={OWN_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            {d.recipes.ownIngredients}
          </span>
          <textarea
            value={lines}
            rows={4}
            onChange={(e) =>
              setLines(
                e.target.value.split("\n").slice(0, OWN_LINES_MAX).join("\n"),
              )
            }
            className="rounded-lg border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            {d.recipes.ownSteps}
          </span>
          <textarea
            value={steps}
            rows={3}
            maxLength={OWN_STEPS_MAX}
            onChange={(e) => setSteps(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold">
            {error === "full" ? d.recipes.ownFull : d.recipes.ownInvalid}
          </p>
        )}
        <Button className="min-h-11 self-start" onClick={save}>
          {d.recipes.ownSave}
        </Button>
      </div>
    </section>
  );
}
