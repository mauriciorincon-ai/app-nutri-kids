import type { Locale } from "./index";

/**
 * Textos de «Qué cocinar con lo que tienes» (S12 · ADR-018), aparte de `camera.ts`: esa pantalla trae
 * el recetario y no debe cargar los textos de la cámara (ni al revés). Redactados en cada idioma;
 * paridad por test. Sin cantidades, calorías ni alarma.
 */
const es = {
  check: "Verifícalo con un adulto: el modelo puede equivocarse.",
  roleBlocked: "Con tu rol en la familia, este teléfono no puede usar esto.",
  pantryLine: "Tu despensa: {foods}.",
  pantryEmpty:
    "Tu despensa está vacía. Confirma algo en la cámara o márcalo a mano.",
  backToCamera: "Volver a la cámara",
  resultsTitle: "Qué cocinar con lo que tienes",
  resultReady: "Puedes hacerlas ya",
  resultSwap: "Con un reemplazo de tu plan",
  resultAlmost: "Casi: te falta poco",
  swapLine: "Cambia {from} por {to}, que tu plan propone.",
  missingLine: "Te falta: {foods}.",
  cautionLine: "{food}: {limit}",
  stateOk: "Con lo de tu plan",
  stateCaution: "Con medida",
  minutes: "{n} min",
  seeRecipes: "Ver todas las recetas",
  nothingToCook:
    "Con esto aún no sale ninguna receta. Confirma algo más o márcalo a mano.",
  templateTitle: "Una idea con lo que tienes",
  templateLead:
    "Ninguna receta del recetario sale tal cual. Esta es una forma de cocinar lo que tienes, revisada contra tu plan.",
  templateWith: "Con: {foods}",
  templateStepsTitle: "Cómo se hace",
  kindSaute: "Salteado",
  kindSoup: "Sopa",
  kindOmelette: "Tortilla",
  kindBaked: "Al horno",
  kindMash: "Puré",
  kindRice: "Arroz",
};

const en: typeof es = {
  check: "Double-check it with an adult: the model can get things wrong.",
  roleBlocked: "With your role in the family, this phone can't use this.",
  pantryLine: "Your pantry: {foods}.",
  pantryEmpty:
    "Your pantry is empty. Confirm something in the camera or tick it by hand.",
  backToCamera: "Back to the camera",
  resultsTitle: "What to cook with what you have",
  resultReady: "You can make these now",
  resultSwap: "With a swap from your plan",
  resultAlmost: "Almost: just a little missing",
  swapLine: "Swap {from} for {to}, which your plan suggests.",
  missingLine: "You are missing: {foods}.",
  cautionLine: "{food}: {limit}",
  stateOk: "Fits your plan",
  stateCaution: "With a limit",
  minutes: "{n} min",
  seeRecipes: "See all recipes",
  nothingToCook:
    "Nothing comes out yet with this. Confirm something more or tick it by hand.",
  templateTitle: "An idea with what you have",
  templateLead:
    "No recipe in the book works as is. This is a way to cook what you have, checked against your plan.",
  templateWith: "With: {foods}",
  templateStepsTitle: "How to make it",
  kindSaute: "Stir-fry",
  kindSoup: "Soup",
  kindOmelette: "Omelette",
  kindBaked: "Baked",
  kindMash: "Mash",
  kindRice: "Rice",
};

export type CameraCookText = typeof es;
export const cameraCookText: Record<Locale, CameraCookText> = { es, en };

/** El nombre de cada plantilla de cocina (la clave de texto sale del id de la plantilla). */
export const templateKindKey = {
  saute: "kindSaute",
  soup: "kindSoup",
  omelette: "kindOmelette",
  baked: "kindBaked",
  mash: "kindMash",
  rice: "kindRice",
} as const satisfies Record<string, keyof CameraCookText>;
