"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import {
  getOwnRecipes,
  OWN_LINES_MAX,
  OWN_MAX,
  OWN_NAME_MAX,
  OWN_STEPS_MAX,
  removeOwnRecipe,
  saveOwnRecipe,
} from "@/lib/day-to-day/store";
import { notifyLocalStore } from "@/lib/local-store";
import { reviewOwn } from "@/lib/recipes/review";

import { StateChip } from "./state-chip";
import { useRecipesDt, type useReviewInput } from "./use-dt";

/** Recetas propias (S11): se revisan contra el plan igual que las del recetario. */
export default function OwnRecipes({
  own,
  input,
}: {
  own: ReturnType<typeof getOwnRecipes>;
  input: NonNullable<ReturnType<typeof useReviewInput>>;
}) {
  const d = useRecipesDt();
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
