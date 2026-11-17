"use client";

import { useState } from "react";
import { CircleCheck, CircleDot, Info, type LucideIcon } from "lucide-react";

import { useWt } from "@/components/wellbeing/use-wellbeing";
import { Button } from "@/components/ui/button";
import { fmt } from "@/i18n";
import type { WellbeingText } from "@/i18n/wellbeing";
import {
  formatMinutes,
  readHabit,
  type HabitStatus,
} from "@/lib/wellbeing/habits";
import type { Reference } from "@/lib/wellbeing/references";
import {
  HABIT_MAX_MIN,
  type AgeBand,
  type HabitId,
} from "@/lib/wellbeing/values";
import { cn } from "@/lib/utils";

/** Símbolo + texto + tono propio. Jamás rojo, jamás «no cumplió»: «distinto» invita a mirar. */
const STATUS: Record<
  HabitStatus,
  { icon: LucideIcon; tone: string; text: keyof WellbeingText }
> = {
  within: {
    icon: CircleCheck,
    tone: "bg-mood-happy-surface text-mood-happy",
    text: "statusWithin",
  },
  below: {
    icon: CircleDot,
    tone: "bg-mood-tired-surface text-mood-tired",
    text: "statusBelow",
  },
  above: {
    icon: CircleDot,
    tone: "bg-mood-tired-surface text-mood-tired",
    text: "statusAbove",
  },
  "not-recommended": {
    icon: CircleDot,
    tone: "bg-mood-tired-surface text-mood-tired",
    text: "statusNotRecommended",
  },
  "no-figure": {
    icon: Info,
    tone: "bg-mood-other-surface text-mood-other",
    text: "statusNoFigure",
  },
};

/** La frase de la referencia (con sus cifras tal cual del dato) y su fuente. */
export function referenceLines(
  w: WellbeingText,
  habit: HabitId,
  band: AgeBand,
  ref: Reference,
): { text: string; source: string | null } {
  let text = "";
  switch (ref.kind) {
    case "range":
      text = fmt(w.refRange, {
        min: formatMinutes(ref.min),
        max: formatMinutes(ref.max),
      });
      if (habit === "sleep" && band !== "6-12" && band !== "13-17")
        text += w.refSleepNaps;
      break;
    case "min":
      text = fmt(w.refMin, { min: formatMinutes(ref.min) });
      if (ref.mvpa)
        text += fmt(w.refMinMvpa, { mvpa: formatMinutes(ref.mvpa) });
      else if (ref.source.id === "who-2020") text += w.refMinMvpaAvg;
      break;
    case "max":
      text = fmt(w.refMax, { max: formatMinutes(ref.max) });
      break;
    case "not-recommended":
      text = w.refNotRecommended;
      break;
    case "limit-no-figure":
      text = w.refLimit;
      break;
    case "none":
      text = w.refNone;
      break;
  }
  const source =
    ref.kind === "none"
      ? null
      : fmt(w.refSource, {
          source: `${ref.source.cite} (${ref.source.where})`,
        });
  return { text, source };
}

/**
 * Un hábito del día: minutos (con «Guardar» y «Quitar») contra la referencia de su edad, con
 * la fuente a la vista. Sin franja de edad solo se anota. Una referencia no es un veredicto.
 */
export function HabitRow({
  habit,
  band,
  minutes,
  onSave,
  disabled,
  reference,
}: {
  habit: HabitId;
  band: AgeBand | null;
  minutes: number | null;
  onSave: (minutes: number | null) => void;
  disabled: boolean;
  reference: (habit: HabitId, band: AgeBand) => Reference;
}) {
  const w = useWt();
  const [draft, setDraft] = useState(minutes === null ? "" : String(minutes));
  const parsed = draft.trim() === "" ? null : Number(draft);
  const valid =
    parsed !== null &&
    Number.isInteger(parsed) &&
    parsed >= 0 &&
    parsed <= HABIT_MAX_MIN;

  const reading =
    band && minutes !== null ? readHabit(habit, band, minutes) : null;
  const lines = band
    ? referenceLines(w, habit, band, reference(habit, band))
    : null;
  const look = reading ? STATUS[reading.status] : null;
  const inputId = `habit-${habit}`;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
      data-testid={`habit-${habit}`}
    >
      <label htmlFor={inputId} className="font-semibold">
        {w.habits[habit]}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={0}
          max={HABIT_MAX_MIN}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`${w.habits[habit]} · ${w.habitUnit}`}
          className="min-h-11 w-28 rounded-lg border bg-background px-3 text-base"
        />
        <span className="text-sm text-muted-foreground">{w.habitUnit}</span>
        {!disabled && (
          <>
            <Button
              size="sm"
              className="min-h-11"
              disabled={!valid}
              onClick={() => valid && onSave(parsed)}
            >
              {w.habitSave}
            </Button>
            {minutes !== null && (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setDraft("");
                  onSave(null);
                }}
              >
                {w.habitClear}
              </Button>
            )}
          </>
        )}
      </div>

      {look && reading && (
        <p
          className={cn(
            "inline-flex items-start gap-1.5 self-start rounded-lg px-3 py-1.5 text-sm font-semibold",
            look.tone,
          )}
          data-testid={`habit-status-${habit}`}
        >
          <look.icon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {w[look.text] as string}
        </p>
      )}
      {lines && (
        <p className="text-sm leading-snug text-muted-foreground">
          {lines.text}
          {lines.source && (
            <span
              className="mt-0.5 block"
              data-testid={`habit-source-${habit}`}
            >
              {lines.source}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
