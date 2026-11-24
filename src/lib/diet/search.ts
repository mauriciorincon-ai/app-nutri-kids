/**
 * Motor LOCAL de veredictos — el "Camino A" del chat ("¿X se puede?").
 *
 * Resuelve preguntas de tipo lookup SIN llamar al LLM y SIN red: normaliza el
 * texto (acentos, mayúsculas, plurales simples), detecta la intención de
 * consulta y matchea contra los nombres de la dieta cargada, reusando
 * `resolveItemStatus` de `logic.ts` (este motor lo CONSUME, no lo modifica).
 *
 * Si la pregunta NO es un lookup (p. ej. "no tengo pollo, ¿qué le doy?"),
 * devuelve `null` → el llamador la resuelve con `answerOpen` (answer.ts), también
 * con código y sin red (ADR-008).
 */
import type { DietPlan, LocalizedText } from "./schema";
import { allItemIds, resolveItemStatus, type ItemStatus } from "./logic";

export type Additive = DietPlan["trafficLight"]["red"]["additives"][number];

export type LocalVerdict =
  | { kind: "item"; status: ItemStatus; matched: LocalizedText }
  | { kind: "additive"; additive: Additive; matched: LocalizedText };

export type Locale = "es" | "en";

/** minúsculas + sin acentos + sin puntuación + espacios colapsados. */
export function normalizeText(input: string, locale: Locale = "es"): string {
  return input
    .toLocaleLowerCase(locale)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas combinantes
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // signos (¿ ? , . etc.) → espacio
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Singular ingenuo ES/EN: quita una "s" final en palabras >3 letras (y las terminaciones «-ies», «-oes»,
 * «-ches/-shes/-xes» y «-ones»).
 * Se aplica IGUAL a ambos lados del match, así que "uvas"↔"uva",
 * "manzanas"↔"manzana", "apples"↔"apple" se emparejan sin tabla de plurales.
 */
/** Dos escrituras de la misma palabra que el plan y las etiquetas mezclan («yogur», «yoghurt»). */
const SPELLING: Record<string, string> = {
  yogur: "yogurt",
  yoghurt: "yogurt",
  yogourt: "yogurt",
};

function singularize(token: string): string {
  const one = singularizeRaw(token);
  return SPELLING[one] ?? one;
}

function singularizeRaw(token: string): string {
  // «cherries» → «cherry», «tomatoes» → «tomato», «peaches» → «peach», «limones» → «limon».
  if (token.length > 4 && token.endsWith("ies"))
    return `${token.slice(0, -3)}y`;
  if (token.length > 5 && /[^aeiou]oes$/.test(token)) return token.slice(0, -2);
  if (token.length > 5 && /(ch|sh|x)es$/.test(token)) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("ones")) return token.slice(0, -2);
  // «industriales» → «industrial», «yogures» → «yogur», «colores» → «color»: el plural de lo que acaba en l o r.
  if (token.length > 5 && /[aeiou][lr]es$/.test(token))
    return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function toTokens(input: string, locale: Locale): string[] {
  return normalizeText(input, locale)
    .split(" ")
    .filter(Boolean)
    .map(singularize);
}

/** ¿aparece la secuencia `needle` de forma contigua dentro de `haystack`? */
/** «Gaseosas y jugos de caja» nombra dos cosas: cada alternativa también cuenta (como parcial). */
export const ALTERNATIVES =
  /\s*(?:,|\/|;|\by\b|\be\b|\band\b|\bor\b|\bo\b|\bu\b)\s*/i;

export function containsPhrase(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Frases que delatan una pregunta ABIERTA: pedir ideas, reemplazos, o describir
 * una falta. Si el mensaje contiene alguna, NO es un lookup: la contesta `answerOpen`.
 */
const OPEN_PATTERNS: string[] = [
  // ES
  "que le doy",
  "que le puedo dar",
  "que le preparo",
  "que le cocino",
  "que hago",
  "que mas",
  "no tengo",
  "no hay",
  "se acabo",
  "no quiso",
  "no quiere",
  "en vez de",
  "en lugar de",
  "reemplaz",
  "sustitu",
  "alguna idea",
  "receta",
  "que cocino",
  "que preparo",
  // EN
  "what can",
  "what should",
  "what do i",
  "what to",
  "dont have",
  "do not have",
  "ran out",
  "instead of",
  "replace",
  "recipe",
  "any idea",
];

/**
 * Marcadores de intención de LOOKUP ("¿esto se puede?"). Si el mensaje trae uno
 * (o es muy corto, básicamente solo el alimento), intentamos resolver local.
 */
const LOOKUP_MARKERS: string[] = [
  // ES
  "se puede",
  "puede comer",
  "puede tomar",
  "puede dar",
  "puedo dar",
  "puedo darle",
  "le doy",
  "le puedo dar",
  "esta permitido",
  "permitido",
  "es rojo",
  "es verde",
  "es amarillo",
  "puede",
  // EN
  "can he",
  "can she",
  "can i give",
  "can he have",
  "is it ok",
  "allowed",
  "can eat",
];

/**
 * El alimento del plan (por id) más específico que aparezca en el texto, sin
 * mirar la intención. Lo usan `matchLookup` y `answerOpen`.
 */
export function matchItem(
  diet: DietPlan,
  message: string,
  locale: Locale,
  date: Date,
): ItemStatus | null {
  const msgTokens = toTokens(message, locale);
  let best: { status: ItemStatus; span: number } | null = null;
  for (const id of allItemIds(diet)) {
    const status = resolveItemStatus(diet, id, date);
    if (!status) continue;
    const needle = toTokens(status.name[locale], locale);
    if (
      containsPhrase(msgTokens, needle) &&
      needle.length > (best?.span ?? 0)
    ) {
      best = { status, span: needle.length };
    }
  }
  return best?.status ?? null;
}

function additiveVerdict(diet: DietPlan): { additive: Additive }[] {
  return diet.trafficLight.red.additives.map((additive) => ({ additive }));
}

/**
 * Intenta resolver el mensaje como un lookup local. Devuelve el veredicto del
 * alimento/aditivo más específico que aparezca en el texto, o `null` si el
 * mensaje es una pregunta abierta o no menciona nada de la dieta.
 */
export function matchLookup(
  diet: DietPlan,
  message: string,
  locale: Locale,
  date: Date,
): LocalVerdict | null {
  const norm = normalizeText(message, locale);
  if (norm.length < 2) return null;
  if (OPEN_PATTERNS.some((p) => norm.includes(p))) return null;

  const msgTokens = toTokens(message, locale);
  const hasMarker = LOOKUP_MARKERS.some((m) => norm.includes(m));
  const isBareFood = msgTokens.length <= 3;
  if (!hasMarker && !isBareFood) return null;

  // Acumulamos los matches y elegimos el de nombre más largo (desambigua
  // "queso maduro" de "queso"). Un array evita el estrechamiento a `never`
  // que TS aplica a una variable mutada solo dentro de closures.
  const matches: { verdict: LocalVerdict; span: number }[] = [];
  const considerNeedle = (verdict: LocalVerdict, needle: string[]) => {
    if (containsPhrase(msgTokens, needle)) {
      matches.push({ verdict, span: needle.length });
    }
  };
  const consider = (verdict: LocalVerdict, name: LocalizedText) =>
    considerNeedle(verdict, toTokens(name[locale], locale));

  // Alimentos con id → reusa el motor S1.
  for (const id of allItemIds(diet)) {
    const status = resolveItemStatus(diet, id, date);
    if (status)
      consider({ kind: "item", status, matched: status.name }, status.name);
  }
  // Aditivos E-* (van por `code`, no por id → no pasan por resolveItemStatus).
  // Se matchean por nombre O por código ("E999"), lo que aparezca en el texto.
  for (const { additive } of additiveVerdict(diet)) {
    const verdict: LocalVerdict = {
      kind: "additive",
      additive,
      matched: additive.name,
    };
    consider(verdict, additive.name);
    considerNeedle(verdict, toTokens(additive.code, locale));
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => b.span - a.span);
  return matches[0].verdict;
}
