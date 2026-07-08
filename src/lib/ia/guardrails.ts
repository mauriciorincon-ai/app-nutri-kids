/**
 * Guardrails de entrada — corren en la route ANTES de gastar tokens.
 *
 * Distinguen tres cosas:
 *  - `ok`: pregunta legítima sobre el plan → pasa al LLM.
 *  - `medical`: pide consejo médico, dosis/medicación nuevas o diagnóstico →
 *    redirección amable al profesional (SIN tokens).
 *  - `off-topic`: nada que ver con la dieta → redirección estática (SIN tokens).
 *
 * Frontera fina (riesgo de falso positivo): CONSULTAR lo que el plan ya dice
 * ("¿cuándo toca la B12?") es legítimo; PEDIR un cambio/dosis nueva
 * ("¿le subo la dosis de B12?") se rechaza. La distinción es por verbo de
 * acción/cambio, no por mención del suplemento.
 */
type Locale = "es" | "en";

export type GuardrailOutcome = "ok" | "medical" | "off-topic";

function normalize(input: string): string {
  return input
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Verbos de CAMBIO/acción médica: subir, bajar, cambiar dosis, recetar… */
const MEDICAL_ACTION_PATTERNS: RegExp[] = [
  // ES — cambios de dosis/medicación
  /\b(sub[oe]|baj[oe]|aument[oa]|reduc|dobl|cambi|quit[oa]|suspend|empiez[oa]|dej[oa] de dar)\b.*\b(dosis|suplement|vitamin|medic|gotas|b12|hierro|omega|zinc|melatonin)/,
  /\b(dosis|medic|receta|diagnos|sintoma|enferm|alergi|reaccion|dolor|fiebre|vomit|diarrea)/,
  // ES — pedir diagnóstico/tratamiento
  /\b(que le pasa|es normal que|deberia llevarl|tiene (algo|autismo|tea)|le dio)/,
  // EN
  /\b(increase|decrease|raise|lower|double|change|stop giving|start giving)\b.*\b(dose|dosage|supplement|vitamin|medicat|b12|iron|omega|zinc|melatonin)/,
  /\b(dose|dosage|prescri|diagnos|symptom|disease|allerg|reaction|fever|vomit|diarrhea)/,
];

/** Temas claramente ajenos a la dieta. */
const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(partido|futbol|pelicula|clima|noticia|politic|chiste|cancion|videojuego|bitcoin|president)/,
  /\b(match|football|soccer|movie|weather|news|politic|joke|song|videogame|bitcoin|stock)/,
];

/** Señales de que SÍ habla de comida/plan (evita falsos off-topic). */
const FOOD_TOPIC_PATTERNS: RegExp[] = [
  /\b(com[ei]|desayun|almuerz|cena|merienda|lonch|snack|fruta|verdura|proteina|receta|plato|dar|dieta|plan|puede|reemplaz|equivalen|porcion|suplement|agua|hidrat)/,
  /\b(eat|breakfast|lunch|dinner|snack|fruit|vegetable|protein|recipe|meal|give|diet|plan|can|replace|equivalent|portion|supplement|water|hydrat)/,
];

export function screenInput(message: string): GuardrailOutcome {
  const norm = normalize(message);

  if (MEDICAL_ACTION_PATTERNS.some((r) => r.test(norm))) return "medical";

  const looksFood = FOOD_TOPIC_PATTERNS.some((r) => r.test(norm));
  if (!looksFood && OFF_TOPIC_PATTERNS.some((r) => r.test(norm))) {
    return "off-topic";
  }
  return "ok";
}

/** Respuestas estáticas de redirección (bilingües), sin gastar tokens. */
export function rejectionMessage(
  outcome: Exclude<GuardrailOutcome, "ok">,
  locale: Locale,
): string {
  if (outcome === "medical") {
    return locale === "en"
      ? "That one is best decided with your child's doctor or nutritionist — I can only help with what the loaded plan already says. Ask me about foods, meals, or replacements and I'll help."
      : "Eso mejor decídelo con el pediatra o nutricionista de tu peque — yo solo puedo ayudarte con lo que ya dice el plan cargado. Pregúntame por alimentos, comidas o reemplazos y con gusto te ayudo.";
  }
  return locale === "en"
    ? "I can only help with the child's food plan — try asking me something like “can he have apples?” or “what snack can I give?”."
    : "Solo puedo ayudarte con el plan de alimentación del peque — prueba con algo como “¿la manzana se puede?” o “¿qué merienda le doy?”.";
}

/** Longitud máxima de input aceptada (anti-abuso, sin gastar tokens). */
export const MAX_INPUT_CHARS = 1000;
