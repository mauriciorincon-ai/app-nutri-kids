"use client";

import { useI18n } from "@/i18n";
import { wellbeingText, type WellbeingText } from "@/i18n/wellbeing";
import {
  getWellbeing,
  listWellbeingDays,
  type DayWellbeing,
} from "@/lib/diet/day-log";
import { dateKey } from "@/lib/diet/logic";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";

/** Los textos del bienestar en el idioma activo (aparte del diccionario compartido). */
export function useWt(): WellbeingText {
  const { locale } = useI18n();
  return wellbeingText[locale];
}

const EMPTY: DayWellbeing = { moods: {}, food: {}, well: {}, habits: {} };

/** Lo anotado del bienestar de un día (null = aún sin fecha del aparato). */
export function useWellbeing(day: Date | null): DayWellbeing {
  return useLocalStore(
    () => (day ? getWellbeing(day) : EMPTY),
    EMPTY,
    day ? dateKey(day) : "",
  );
}

/** Todos los días con bienestar anotado (para contar exposiciones y para el historial). */
export function useWellbeingDays() {
  return useLocalStore(listWellbeingDays, []);
}

/** Tras guardar algo: avisa a las pantallas que lo leen. */
export const wellbeingChanged = notifyLocalStore;
