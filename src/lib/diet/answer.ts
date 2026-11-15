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
import type { DietPlan, LocalizedText, Texture } from "./schema";
import { orderByTexture, type OrderedOption } from "./texture";
import {
  matchItem,
  matchLookup,
  toTokens,
  type Locale,
  type LocalVerdict,
} from "./search";
import { screenInput } from "./guardrails";

type Meal = DietPlan["dailyMenu"][number];

export type OpenIntent =
  | "refused"
  | "replacement"
  | "allergy"
  | "medication"
  | "sleep"
  | "activity"
  | "hydration"
  | "meal";

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
  // Perfil del plan (S5): se contesta con lo que el profesional escribió, o «no lo dice».
  allergy: {
    es: ["alergi*", "alergic*", "intoleran*", "intolerante*"],
    en: ["allerg*", "intoleran*"],
  },
  medication: {
    es: ["medicament*", "medicina*", "pastilla*", "jarabe*"],
    en: ["medication*", "medicine*", "pill*", "meds"],
  },
  sleep: {
    es: [
      "dormir",
      "duerm*",
      "sueno",
      "acuest*",
      "acostar*",
      "hora de dormir",
      "descans*",
    ],
    en: ["sleep*", "bedtime", "bed time", "go to bed", "nap*"],
  },
  // «jugo» (bebida) NO es «jugar»: por eso no hay «jug*».
  activity: {
    es: ["actividad*", "ejercicio*", "deporte*", "jugar", "juego*"],
    en: ["activit*", "exercise*", "sport*", "play", "playing"],
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
  "allergy",
  "medication",
  "sleep",
  "activity",
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

/** Una opción del plan, con su textura y si hoy cae en una que no acepta. */
export type OptionItem = OrderedOption;

export type Options = {
  /** De dónde salen: una equivalencia explícita del plan o su mismo grupo verde. */
  source: "equivalence" | "group";
  /** Ya ordenadas por textura (las que hoy no acepta, al final y marcadas). */
  items: OptionItem[];
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
  /** Texturas que quien cuida marcó como aceptadas hoy (vacío = orden del plan). */
  accepted: readonly Texture[] = [],
): Options | null {
  const eq = status.equivalences[0];
  if (eq) {
    const items = status.equivalences
      .flatMap((e) => e.use)
      .filter((u) => isSafeOption(diet, u.name, now));
    if (items.length > 0)
      return {
        source: "equivalence",
        items: orderByTexture(items, accepted),
        ...(eq.note ? { note: eq.note } : {}),
      };
  }
  if (status.kind === "green") {
    const items = status.group.items
      .filter((i) => i.id !== status.id)
      .filter((i) => resolveItemStatus(diet, i.id, now)?.kind === "green")
      .map((i) => ({ name: i.name }));
    if (items.length > 0)
      return { source: "group", items: orderByTexture(items, accepted) };
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
  | { kind: "sleep"; text: LocalizedText }
  | { kind: "activity"; text: LocalizedText }
  | {
      kind: "allergy";
      /** Lo que el mensaje nombra y el plan lista (null = nombra algo que no está, o nada). */
      match: {
        name: LocalizedText;
        as: "allergy" | "intolerance";
        /** true = lo anotó quien cuida en el teléfono, no el plan. */
        fromNote: boolean;
      } | null;
      allergies: LocalizedText[];
      intolerances: LocalizedText[];
      /** Anotado por quien cuida («anotado por ti»), aparte de lo que dice el plan. */
      notedAllergies: LocalizedText[];
      notedIntolerances: LocalizedText[];
    }
  | {
      kind: "medication";
      items: {
        name: LocalizedText;
        dose?: LocalizedText;
        when?: LocalizedText;
      }[];
      /** Medicamentos que anotó quien cuida. */
      noted: LocalizedText[];
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
/** Lo mínimo que el chat necesita de una anotación de quien cuida. */
export type CaregiverNote = { kind: string; text: string };

const notedTexts = (
  notes: readonly CaregiverNote[],
  kind: string,
): LocalizedText[] =>
  notes.filter((n) => n.kind === kind).map((n) => ({ es: n.text, en: n.text }));

export function answerOpen(
  question: string,
  diet: DietPlan,
  now: Date,
  lang: Locale,
  accepted: readonly Texture[] = [],
  notes: readonly CaregiverNote[] = [],
): OpenAnswer | null {
  const intent = detectIntent(question, lang);
  if (!intent) return null;

  switch (intent) {
    case "replacement": {
      const item = matchItem(diet, question, lang, now);
      if (!item) return { kind: "not-in-plan", reason: "unknown-food" };
      const options = planOptionsFor(item, diet, now, accepted);
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
        options: item ? planOptionsFor(item, diet, now, accepted) : null,
        next,
      };
    }
    case "allergy": {
      const allergies = (diet.profile?.allergies ?? []).map((a) => a.name);
      const intolerances = (diet.profile?.intolerances ?? []).map(
        (a) => a.name,
      );
      const notedAllergies = notedTexts(notes, "allergy");
      const notedIntolerances = notedTexts(notes, "intolerance");
      if (
        allergies.length +
          intolerances.length +
          notedAllergies.length +
          notedIntolerances.length ===
        0
      )
        return { kind: "not-in-plan", reason: "unknown" };
      const msg = toTokens(question, lang);
      // TODOS los términos del nombre deben estar en la pregunta: «frutos secos»
      // no responde por «frutos rojos».
      const named = (name: LocalizedText) => {
        const own = toTokens(name[lang], lang).filter((n) => n.length >= 3);
        return (
          own.length > 0 && own.every((n) => msg.some((m) => stemEq(m, n)))
        );
      };
      const a = allergies.find(named);
      const i = intolerances.find(named);
      const na = notedAllergies.find(named);
      const ni = notedIntolerances.find(named);
      const match = a
        ? { name: a, as: "allergy" as const, fromNote: false }
        : i
          ? { name: i, as: "intolerance" as const, fromNote: false }
          : na
            ? { name: na, as: "allergy" as const, fromNote: true }
            : ni
              ? { name: ni, as: "intolerance" as const, fromNote: true }
              : null;
      return {
        kind: "allergy",
        match,
        allergies,
        intolerances,
        notedAllergies,
        notedIntolerances,
      };
    }
    case "medication": {
      const items = diet.profile?.medications ?? [];
      const noted = notedTexts(notes, "medication");
      if (items.length + noted.length === 0)
        return { kind: "not-in-plan", reason: "unknown" };
      return {
        kind: "medication",
        items: items.map(({ name, dose, when }) => ({
          name: name,
          ...(dose ? { dose } : {}),
          ...(when ? { when } : {}),
        })),
        noted,
      };
    }
    case "sleep":
    case "activity": {
      // «¿el jugo le quita el sueño?»: si nombra un alimento del plan, es una consulta.
      if (matchItem(diet, question, lang, now)) return null;
      const text = diet.goals?.[intent];
      if (!text) return { kind: "not-in-plan", reason: "unknown" };
      return { kind: intent, text };
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
  accepted: readonly Texture[] = [],
  notes: readonly CaregiverNote[] = [],
): ChatAnswer {
  const screen = screenInput(question);
  if (screen !== "ok") return { kind: "rejection", reason: screen };

  const open = answerOpen(question, diet, now, lang, accepted, notes);
  if (open) return { kind: "open", answer: open };

  const verdict = matchLookup(diet, question, lang, now);
  if (verdict) return { kind: "verdict", verdict };

  return { kind: "open", answer: { kind: "not-in-plan", reason: "unknown" } };
}
