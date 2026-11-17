/**
 * Guardrails de entrada — corren en el teléfono ANTES de contestar (ADR-008).
 *
 * Distinguen tres cosas:
 *  - `ok`: pregunta legítima sobre el plan → la contesta el motor (answer.ts).
 *  - `medical`: pide consejo médico, dosis/medicación nuevas o diagnóstico →
 *    redirección amable al profesional.
 *  - `off-topic`: nada que ver con la dieta → redirección estática.
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
  /\b(sub\w*|baj\w*|aument\w*|reduc\w*|dobl\w*|cambi\w*|quit\w*|suspend\w*|empiez\w*|dej\w* de dar)\b.*\b(dosis|suplement|vitamin|medic|gotas|b12|hierro|omega|zinc|melatonin)/,
  /\b(dosis|medic|recetar|recetaron|receto|recetado|diagnos|sintoma|enferm|alergi|reaccion|dolor|fiebre|vomit|diarrea)/,
  // ES — pedir diagnóstico/tratamiento
  /\b(que le pasa|es normal que|deberia llevarl|tiene (algo|autismo|tea)|le dio)/,
  // EN
  /\b(increase|decrease|raise|lower|double|change|stop giving|start giving)\b.*\b(dose|dosage|supplement|vitamin|medicat|b12|iron|omega|zinc|melatonin)/,
  /\b(dose|dosage|prescri|diagnos|symptom|disease|allerg|reaction|fever|vomit|diarrhea)/,
];

/**
 * CONSULTAR lo que el plan ya trae del perfil («¿es alérgico al maní?», «¿qué
 * medicamentos toma?») es legítimo y lo contesta el motor con el plan o con «tu
 * plan no lo dice». PEDIR un cambio, un diagnóstico o hablar de síntomas sigue
 * siendo del profesional: eso lo decide CHANGE_OR_DIAGNOSIS, que gana siempre.
 */
const PROFILE_QUERY_PATTERNS: RegExp[] = [
  /\b(alergia|alergic|alergen|intoleran|medicament|medicina|pastilla|jarabe)/,
  /\b(allerg|intoleran|medication|medicine)|\b(pill|pills|meds)\b/,
];

/** Una consulta de LECTURA pregunta qué ES o qué TIENE: el verbo lo delata. */
const READ_SIGNAL =
  /\b(es|son|ser|tiene|tienen|toma|toman|take|takes|taking|has|have|is|are|does|do)\b/;

/**
 * Cualquier señal de ACCIÓN (cambiar, subir, quitar, dar, parar…), diagnóstico o
 * síntoma anula la consulta: va al profesional. Lista blanca por diseño: solo pasa
 * lo que es lectura Y no trae ninguna de estas señales.
 */
const ACTION_OR_DIAGNOSIS_PATTERNS: RegExp[] = [
  /\b(cambi\w*|sub(ir|o|e|a|amos)|baj\w*|aument\w*|reduc\w*|dobl\w*|quit\w*|suspend\w*|dej\w*|par(ar|o|e)|omit\w*|salt\w*|dar|dar(le|se)|doy|dale|dan|damos|otro|otra|extra|empiez\w*|empez\w*|inici\w*|agreg\w*|sum\w*|para (la|el|que|dormir|bajar|subir))\b/,
  /\b(stop\w*|skip\w*|increase|decrease|raise|lower|double|change|give|giving|start\w*|add|more|instead|replace)\b/,
  /\b(dosis|dose|dosage|mg|ml|recet\w*|prescri\w*|diagnos\w*|sintoma\w*|enferm\w*|reaccion\w*|dolor|fiebre|vomit\w*|diarrea|tos|symptom\w*|disease|reaction\w*|fever|cough)\b/,
  MEDICAL_ACTION_PATTERNS[2],
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

  const mentionsProfile = PROFILE_QUERY_PATTERNS.some((r) => r.test(norm));
  const readOnly =
    mentionsProfile &&
    READ_SIGNAL.test(norm) &&
    !ACTION_OR_DIAGNOSIS_PATTERNS.some((r) => r.test(norm));
  // Hablar del perfil sin ser una consulta de lectura = pedir un cambio: profesional.
  if (mentionsProfile && !readOnly) return "medical";
  if (!readOnly && MEDICAL_ACTION_PATTERNS.some((r) => r.test(norm)))
    return "medical";

  const looksFood = FOOD_TOPIC_PATTERNS.some((r) => r.test(norm));
  if (!looksFood && OFF_TOPIC_PATTERNS.some((r) => r.test(norm))) {
    return "off-topic";
  }
  return "ok";
}

/** Respuestas estáticas de redirección (bilingües). */
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

/** Longitud máxima de la pregunta (el campo de texto la corta aquí). */
export const MAX_INPUT_CHARS = 1000;

/**
 * Salida: ¿este TEXTO que la app escribe suena a indicación médica? Pensado para el copy de los
 * escenarios y el plan B (ADR-014), que organizan el plan pero jamás recetan, dosifican,
 * diagnostican ni cuentan calorías (reglas duras 2 y 3). Es una red de seguridad barata: la
 * garantía de fondo es que el motor solo repite lo que el plan dice. Se prueba con controles
 * positivos (tests/unit/scenarios.test.ts).
 */
const ADVICE_PATTERNS: RegExp[] = [
  // Dar, quitar o cambiar un medicamento o una dosis
  /\b(dale|dales|darle|administr\w*|toma|tomar|suspend\w*|aument\w*|reduc\w*|sube|subir|baja|bajar|dobla\w*|receto|recet\w*)\b.*\b(dosis|medicament\w*|medicina|pastilla\w*|jarabe|gotas|mg|ml)\b/,
  /\b(give|gives|giving|take|stop|increase|decrease|raise|lower|double|prescribe\w*)\b.*\b(dose|dosage|medicat\w*|medicine|pill\w*|syrup|drops|mg|ml)\b/,
  // Cantidades de dosis
  /\b\d+([.,]\d+)?\s?(mg|ml|mcg|ui|iu)\b/,
  // Diagnóstico o pronóstico
  /\b(el diagnostico es|tiene (autismo|tea|diabetes)|es (alergico|intolerante) a|the diagnosis is|has (autism|diabetes))\b/,
  // Calorías, peso, talla, IMC, percentiles (regla dura 2)
  /\b(calori\w*|kcal|imc|bmi|percentil\w*|percentile\w*|peso|talla|weight|height)\b/,
];

export function looksLikeMedicalAdvice(text: string): boolean {
  const norm = normalize(text);
  return ADVICE_PATTERNS.some((r) => r.test(norm));
}
