"use client";

import { useMemo } from "react";

import { useDiet } from "@/components/diet-provider";
import { useProfileNotes } from "@/components/use-profile-notes";
import { useI18n } from "@/i18n";
import { commonText } from "@/i18n/day-to-day/common";
import { lunchText } from "@/i18n/day-to-day/lunch";
import { recipesText } from "@/i18n/day-to-day/recipes";
import { travelText } from "@/i18n/day-to-day/travel";
import type { ReviewInput } from "@/lib/recipes/review";

/** Los textos de cada pantalla en el idioma activo: cada una importa solo el módulo suyo. */
export function useLunchDt() {
  const { locale } = useI18n();
  return { common: commonText[locale], lunch: lunchText[locale] };
}
export function useRecipesDt() {
  const { locale } = useI18n();
  return { common: commonText[locale], recipes: recipesText[locale] };
}
export function useTravelDt() {
  const { locale } = useI18n();
  return { common: commonText[locale], travel: travelText[locale] };
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
