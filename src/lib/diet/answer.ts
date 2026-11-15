/**
 * Motor de respuestas ABIERTAS del chat — código primero (ADR-008, regla dura 5).
 *
 * Contesta con datos del plan cargado, sin IA y sin red, las preguntas que el
 * lookup («¿esto se puede?») no cubre:
 *  - «no tengo X / se acabó X»            → `replacement`: reemplazos del plan para X
 *  - «no quiso X / no le gustó X»          → `refused`: otras opciones + lo que toca después
 *  - «¿qué le doy ahora / de merienda?»    → `meal`: el menú de la franja (o la nombrada)
 *  - «¿cuánta agua?»                       → `hydration`: la meta del plan
 *  - lo que el plan no trae                → `not-in-plan`: jamás se inventa
 *
 * Puro: la fecha entra por parámetro y solo se leen datos del `DietPlan`.
 * La redacción vive en i18n (`answer-text.ts` la compone): el motor decide QUÉ.
 */
import {
  currentMealSlot,
  resolveItemStatus,
  waterGlassesTarget,
  type ItemStatus,
} from "./logic";
import type { DietPlan, LocalizedText } from "./schema";
import {
  matchItem,
  matchLookup,
  toTokens,
  type Locale,
  type LocalVerdict,
} from "./search";
import { screenInput } from "./guardrails";

type Meal = DietPlan["dailyMenu"][number];

export type OpenIntent = "refused" | "replacement" | "hydration" | "meal";

/**
 * Tabla de patrones. Cada intención nace {es, en}; una frase es una secuencia de
 * tokens (con el mismo normalizado y singular ingenuo del lookup) y un `*` final
 * acepta cualquier terminación («reemplaz*» → reemplazo, reemplazarlo…).
 * El ORDEN de la tabla es la precedencia: «no quiso desayunar, ¿qué hago?» es un
 * rechazo, no una pregunta de menú; «no tengo pollo, ¿qué le doy?» es un reemplazo.
 */
export const INTENT_PATTERNS: Record<OpenIntent, Record<Locale, string[]>> = {
  refused: {
    es: [
      "no quiso",
      "no quier*",
      "no le gusto",
      "no le gusta*",
      "no se lo comio",
      "no comio",
      "rechaz*",
    ],
    en: [
      "didn t want",
      "didnt want",
      "did not want",
      "doesn t want",
      "doesnt want",
      "won t eat",
      "wont eat",
      "didn t eat",
      "didnt eat",
      "did not eat",
      "didn t like",
      "didnt like",
      "did not like",
      "doesn t like",
      "doesnt like",
      "don t like",
      "dont like",
      "refus*",
    ],
  },
  replacement: {
    es: [
      "no tengo",
      "no hay",
      "se acabo",
      "se me acabo",
      "no me queda",
      "en vez de",
      "en lugar de",
      "reemplaz*",
      "sustitu*",
    ],
    en: [
      "have no",
      "there s no",
      "there is no",
      "don t have",
      "dont have",
      "do not have",
      "ran out",
      "run out",
      "out of",
      "no more",
      "instead of",
      "replac*",
      "substitut*",
    ],
  },
  hydration: {
    es: ["agua", "hidrat*", "liquido*", "cuanto vaso"],
    en: ["water", "hydrat*", "fluid*", "how many glass*"],
  },
  // «~» = exactamente una palabra cualquiera: «qué MERIENDA le doy», «what SNACK can I give».
  meal: {
    es: [
      "que le doy",
      "que ~ le doy",
      "que le puedo dar",
      "que ~ le puedo dar",
      "que le preparo",
      "que ~ le preparo",
      "que le cocino",
      "que ~ le cocino",
      "que le hago",
      "que ~ le hago",
      "que cocino",
      "que preparo",
      "que toca",
      "que sigue",
      "que hago ahora",
      "ahora toca",
      "toca ahora",
    ],
    en: [
      "what can i give",
      "what ~ can i give",
      "what should i give",
      "what ~ should i give",
      "what do i give",
      "what to give",
      "what can he eat",
      "what can she eat",
      "what ~ can he eat",
      "what ~ can she eat",
      "what should i make",
      "what should i cook",
      "what do i make",
      "what s next",
      "whats next",
      "what now",
    ],
  },
};

const INTENT_ORDER: OpenIntent[] = [
  "refused",
  "replacement",
  "hydration",
  "meal",
];

function phraseTokens(pattern: string, locale: Locale): string[] {
  const wildcard = pattern.endsWith("*");
  const words = (wildcard ? pattern.slice(0, -1) : pattern).split(" ");
  const tokens = words.flatMap((w) =>
    w === "~" ? ["~"] : toTokens(w, locale),
  );
  if (wildcard && tokens.length > 0) tokens[tokens.length - 1] += "*";
  return tokens;
}

function tokenEq(msg: string, pat: string): boolean {
  if (pat === "~") return true;
  return pat.endsWith("*") ? msg.startsWith(pat.slice(0, -1)) : msg === pat;
}

function hasPhrase(msg: string[], pattern: string[]): boolean {
  if (pattern.length === 0 || pattern.length > msg.length) return false;
  for (let i = 0; i + pattern.length <= msg.length; i++) {
    if (pattern.every((p, j) => tokenEq(msg[i + j], p))) return true;
  }
  return false;
}

/** La intención abierta del mensaje, o null si no trae ninguna. */
export function detectIntent(
  message: string,
  locale: Locale,
): OpenIntent | null {
  const msg = toTokens(message, locale);
  for (const intent of INTENT_ORDER) {
    // «¿no hay problema si come queso?» es una consulta, no un «no tengo».
    if (intent === "replacement" && msg.some((t) => /^problem/.test(t)))
      continue;
    const patterns = INTENT_PATTERNS[intent][locale];
    if (patterns.some((p) => hasPhrase(msg, phraseTokens(p, locale)))) {
      return intent;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Comidas nombradas («de merienda», «no quiso desayunar»)
// ---------------------------------------------------------------------------

/** Palabras de nombre de comida que solas no identifican a ninguna. */
const GENERIC_MEAL_WORDS = new Set([
  "media",
  "mid",
  "afternoon",
  "morning",
  "manana",
]);

/** «desayunar» ↔ «desayuno», «cenar» ↔ «cena»: mismo tronco de ≥ 4 letras. */
function stemEq(msg: string, name: string): boolean {
  if (msg === name) return true;
  if (name.length < 4 || msg.length < 4) return false;
  const stem = name.slice(0, Math.max(4, name.length - 1));
  return msg.startsWith(stem);
}

export function matchMeal(
  diet: DietPlan,
  message: string,
  locale: Locale,
): Meal | null {
  const msg = toTokens(message, locale);
  let best: { meal: Meal; score: number } | null = null;
  for (const meal of diet.dailyMenu) {
    const name = toTokens(meal.name[locale], locale);
    const hits = name.filter((n) => msg.some((m) => stemEq(m, n)));
    const distinctive = hits.filter((n) => !GENERIC_MEAL_WORDS.has(n));
    const ok =
      distinctive.length > 0 ||
      (hits.length === name.length && name.length > 0);
    if (ok && hits.length > (best?.score ?? 0))
      best = { meal, score: hits.length };
  }
  return best?.meal ?? null;
}

function sortedMeals(diet: DietPlan): Meal[] {
  return [...diet.dailyMenu].sort((a, b) => a.start.localeCompare(b.start));
}

/** La comida que sigue a `meal` en el día (null si es la última). */
function mealAfter(diet: DietPlan, meal: Meal): Meal | null {
  const meals = sortedMeals(diet);
  return meals[meals.findIndex((m) => m.id === meal.id) + 1] ?? null;
}

/** La próxima comida desde un instante (null si ya pasaron todas hoy). */
function nextMealFrom(diet: DietPlan, now: Date): Meal | null {
  const slot = currentMealSlot(diet, now);
  if (!slot) return null;
  switch (slot.kind) {
    case "before-first":
    case "between":
      return slot.next;
    case "during":
      return slot.next;
    case "after-last":
      return null;
  }
}

// ---------------------------------------------------------------------------
// Opciones del plan para un alimento
// ---------------------------------------------------------------------------

export type Options = {
  /** De dónde salen: una equivalencia explícita del plan o su mismo grupo verde. */
  source: "equivalence" | "group";
  items: LocalizedText[];
  note?: LocalizedText;
};

/** ¿Ese nombre es hoy una opción segura (verde, o un nombre que el plan no clasifica)? */
function isSafeOption(diet: DietPlan, name: LocalizedText, now: Date): boolean {
  for (const locale of ["es", "en"] as const) {
    const hit = matchItem(diet, name[locale], locale, now);
    if (hit && hit.kind !== "green") return false;
  }
  return true;
}

/**
 * Reemplazos que el plan da para un alimento; null si no hay ninguno. Nunca se
 * propone algo que HOY esté restringido o en rojo, aunque el plan lo liste o viva
 * en un grupo verde.
 */
export function planOptionsFor(
  status: ItemStatus,
  diet: DietPlan,
  now: Date,
): Options | null {
  const eq = status.equivalences[0];
  if (eq) {
    const items = status.equivalences
      .flatMap((e) => e.use.map((u) => u.name))
      .filter((u) => isSafeOption(diet, u, now));
    if (items.length > 0)
      return {
        source: "equivalence",
        items,
        ...(eq.note ? { note: eq.note } : {}),
      };
  }
  if (status.kind === "green") {
    const items = status.group.items
      .filter((i) => i.id !== status.id)
      .filter((i) => resolveItemStatus(diet, i.id, now)?.kind === "green")
      .map((i) => i.name);
    if (items.length > 0) return { source: "group", items };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Respuesta
// ---------------------------------------------------------------------------

export type OpenAnswer =
  | { kind: "replacement"; food: LocalizedText; options: Options }
  | {
      kind: "refused";
      /** Lo que no quiso: un alimento del plan, una comida, o nada nombrado. */
      food: LocalizedText | null;
      meal: Meal | null;
      options: Options | null;
      /** Lo que toca después (null = ya pasaron las comidas de hoy). */
      next: Meal | null;
    }
  | {
      kind: "meal";
      meal: Meal;
      /** now = la franja vigente · next = la siguiente · named = la que nombró · tomorrow = la primera de mañana */
      timing: "now" | "next" | "named" | "tomorrow";
    }
  | {
      kind: "hydration";
      litersMin: number;
      litersMax: number;
      glasses: number;
      habit: LocalizedText;
    }
  | {
      kind: "not-in-plan";
      /** unknown-food: el alimento no está en el plan · no-options: está, pero el plan no le da reemplazo · unknown: no hay de dónde contestar */
      reason: "unknown-food" | "no-options" | "unknown";
      food?: LocalizedText;
    };

/**
 * Contesta una pregunta abierta con el plan. Devuelve null si el mensaje no
 * trae intención abierta (el llamador prueba el lookup).
 */
export function answerOpen(
  question: string,
  diet: DietPlan,
  now: Date,
  lang: Locale,
): OpenAnswer | null {
  const intent = detectIntent(question, lang);
  if (!intent) return null;

  switch (intent) {
    case "replacement": {
      const item = matchItem(diet, question, lang, now);
      if (!item) return { kind: "not-in-plan", reason: "unknown-food" };
      const options = planOptionsFor(item, diet, now);
      if (!options)
        return { kind: "not-in-plan", reason: "no-options", food: item.name };
      return { kind: "replacement", food: item.name, options };
    }
    case "refused": {
      const item = matchItem(diet, question, lang, now);
      const meal = item ? null : matchMeal(diet, question, lang);
      const next = meal ? mealAfter(diet, meal) : nextMealFrom(diet, now);
      return {
        kind: "refused",
        food: item?.name ?? null,
        meal,
        options: item ? planOptionsFor(item, diet, now) : null,
        next,
      };
    }
    case "hydration":
      // «¿se puede dar agua con limón?»: si nombra un alimento del plan, es una consulta.
      if (matchItem(diet, question, lang, now)) return null;
      return {
        kind: "hydration",
        litersMin: diet.hydration.targetLitersMin,
        litersMax: diet.hydration.targetLitersMax,
        glasses: waterGlassesTarget(diet),
        habit: diet.hydration.habit,
      };
    case "meal": {
      // «¿puede comer pollo ahora?»: si nombra un alimento del plan, es una consulta.
      if (matchItem(diet, question, lang, now)) return null;
      const named = matchMeal(diet, question, lang);
      if (named) return { kind: "meal", meal: named, timing: "named" };
      // «¿qué le doy mañana?»: arranca el día siguiente, no la franja de ahora.
      if (
        toTokens(question, lang).some((t) => t === "manana" || t === "tomorrow")
      )
        return { kind: "meal", meal: sortedMeals(diet)[0], timing: "tomorrow" };
      const slot = currentMealSlot(diet, now);
      if (!slot) return { kind: "not-in-plan", reason: "unknown" };
      switch (slot.kind) {
        case "during":
          return { kind: "meal", meal: slot.meal, timing: "now" };
        case "before-first":
        case "between":
          return { kind: "meal", meal: slot.next, timing: "next" };
        case "after-last":
          return {
            kind: "meal",
            meal: sortedMeals(diet)[0],
            timing: "tomorrow",
          };
      }
    }
  }
}

/** Todo lo que el chat puede contestar, en el orden en que se decide. */
export type ChatAnswer =
  | { kind: "rejection"; reason: "medical" | "off-topic" }
  | { kind: "verdict"; verdict: LocalVerdict }
  | { kind: "open"; answer: OpenAnswer };

/**
 * La única puerta del chat: guardrail → pregunta abierta → lookup → «el plan no
 * lo dice». Siempre contesta; nunca llama a la red.
 */
export function answerQuestion(
  question: string,
  diet: DietPlan,
  now: Date,
  lang: Locale,
): ChatAnswer {
  const screen = screenInput(question);
  if (screen !== "ok") return { kind: "rejection", reason: screen };

  const open = answerOpen(question, diet, now, lang);
  if (open) return { kind: "open", answer: open };

  const verdict = matchLookup(diet, question, lang, now);
  if (verdict) return { kind: "verdict", verdict };

  return { kind: "open", answer: { kind: "not-in-plan", reason: "unknown" } };
}
