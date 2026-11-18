import type { Locale } from "./index";
import { commonText } from "./day-to-day/common";
import { lunchText } from "./day-to-day/lunch";
import { recipesText } from "./day-to-day/recipes";
import { travelText } from "./day-to-day/travel";

/**
 * Los textos de la lonchera, el recetario y el modo viaje (S11 · ADR-017), aparte del diccionario
 * compartido y, además, UN módulo por pantalla (`day-to-day/*`): cada pantalla importa solo el
 * suyo. Este archivo los junta SOLO para las pruebas de paridad: ninguna pantalla lo importa.
 */
export const dayToDayText = (locale: Locale) => ({
  common: commonText[locale],
  lunch: lunchText[locale],
  recipes: recipesText[locale],
  travel: travelText[locale],
});
export type DayToDayText = ReturnType<typeof dayToDayText>;
