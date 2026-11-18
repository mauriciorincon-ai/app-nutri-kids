"use client";

import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";

import type { RecipeState } from "@/lib/recipes/review";
import { cn } from "@/lib/utils";

import { useRecipesDt } from "./use-dt";

const STATE_STYLE: Record<
  Exclude<RecipeState, "blocked">,
  { chip: string; Icon: typeof CircleCheck }
> = {
  ok: { chip: "bg-tl-green-surface text-tl-green", Icon: CircleCheck },
  caution: { chip: "bg-tl-yellow-surface text-tl-yellow", Icon: TriangleAlert },
  unknown: { chip: "bg-muted text-foreground", Icon: CircleHelp },
};

export function StateChip({
  state,
}: {
  state: Exclude<RecipeState, "blocked">;
}) {
  const d = useRecipesDt();
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
