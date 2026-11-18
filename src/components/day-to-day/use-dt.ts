"use client";

import { useMemo } from "react";

import { useDiet } from "@/components/diet-provider";
import { useProfileNotes } from "@/components/use-profile-notes";
import { useI18n } from "@/i18n";
import { dayToDayText, type DayToDayText } from "@/i18n/day-to-day";
import type { ReviewInput } from "@/lib/recipes/review";

/** Los textos de lonchera, recetas y viaje en el idioma activo (aparte del diccionario compartido). */
export function useDt(): DayToDayText {
  const { locale } = useI18n();
  return dayToDayText[locale];
}

/** El plan cargado + lo anotado por quien cuida + la fecha: lo que todos los motores piden. */
export function useReviewInput(date: Date | null): ReviewInput | null {
  const { diet } = useDiet();
  const notes = useProfileNotes();
  return useMemo(
    () =>
      date
        ? {
            diet,
            now: date,
            notes: notes.notes,
            accepted: notes.acceptedTextures,
          }
        : null,
    [diet, notes, date],
  );
}
