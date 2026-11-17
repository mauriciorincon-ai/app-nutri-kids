"use client";

import {
  BatteryLow,
  Ellipsis,
  EyeOff,
  Smile,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { useWt } from "@/components/wellbeing/use-wellbeing";
import { MOODS, type MoodId } from "@/lib/wellbeing/values";
import { cn } from "@/lib/utils";

/** Símbolo + texto + tono propio por ánimo (jamás rojo; el color solo refuerza). */
const LOOK: Record<MoodId, { icon: LucideIcon; tone: string; on: string }> = {
  happy: {
    icon: Smile,
    tone: "text-mood-happy",
    on: "border-mood-happy bg-mood-happy-surface text-mood-happy",
  },
  tired: {
    icon: BatteryLow,
    tone: "text-mood-tired",
    on: "border-mood-tired bg-mood-tired-surface text-mood-tired",
  },
  anxious: {
    icon: Wind,
    tone: "text-mood-anxious",
    on: "border-mood-anxious bg-mood-anxious-surface text-mood-anxious",
  },
  "not-hungry": {
    icon: EyeOff,
    tone: "text-mood-quiet",
    on: "border-mood-quiet bg-mood-quiet-surface text-mood-quiet",
  },
  other: {
    icon: Ellipsis,
    tone: "text-mood-other",
    on: "border-mood-other bg-mood-other-surface text-mood-other",
  },
};

/**
 * Semáforo emocional antes de comer: un toque, junto a la marca de la comida. Tocar el que
 * está elegido lo quita. Solo anota cómo llega; no dice qué hacer con ello.
 */
export function MoodChips({
  mealName,
  value,
  onPick,
  disabled = false,
}: {
  mealName: string;
  value: MoodId | null;
  onPick: (mood: MoodId | null) => void;
  /** Con un rol que no anota esto (S9): se ve, no se cambia. */
  disabled?: boolean;
}) {
  const w = useWt();
  return (
    <div
      className="mt-1 flex flex-col gap-1 pl-9"
      role="group"
      aria-label={`${w.moodQuestion} ${mealName}`}
    >
      <p className="text-sm text-muted-foreground">{w.moodQuestion}</p>
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((mood) => {
          const { icon: Icon, tone, on } = LOOK[mood];
          const active = value === mood;
          return (
            <button
              key={mood}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onPick(active ? null : mood)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-default",
                active
                  ? on
                  : cn(
                      "border-border bg-transparent",
                      !disabled && "hover:bg-accent",
                    ),
              )}
            >
              <Icon aria-hidden className={cn("size-4", !active && tone)} />
              {w.moods[mood]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
