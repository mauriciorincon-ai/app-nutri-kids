/**
 * El texto de una etiqueta, listo para cotejar (S13 · ADR-019). Puro: no lee storage ni red.
 *  - `foldText`: une las palabras cortadas al final de una línea, pliega tildes y mayúsculas, y deja
 *    «amarillo N° 5» como «amarillo 5».
 *  - `findCodes`: los aditivos escritos con su número en cualquiera de sus formas (E102, E-102, E 102,
 *    INS 102, SIN 102, con sufijo de letra o romano), también con un 0 que el lector leyó como «O».
 *  - `splitSections`: lo que LLEVA (ingredientes) separado de lo que PUEDE llevar (trazas).
 *  - `textQuality`: si el texto se leyó lo bastante bien para decir «no vi nada que choque».
 */

/** Pliega el texto: tildes fuera, minúsculas, líneas unidas, guiones y números de color normalizados. */
export function foldText(input: string): string {
  return String(input ?? "")
    .normalize("NFC")
    .replace(/­/g, "")
    .replace(/(\p{L})[-‐‑]\s*\n\s*(\p{Ll})/gu, "$1$2") // «hari-\nna» → «harina»
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[‐‑‒–—―]/g, "-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /\b(amarillo|rojo|azul|verde|yellow|red|blue|green)\s+(?:n[o°º]?\s*\.?|#|num(?:ero)?\.?)\s*(\d)/g,
      "$1 $2",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export type CodeSeen = {
  /** El código canónico, con su «E» y sin sufijo: es como lo guarda el plan (`^E\d+$`). */
  code: string;
  /** Cómo estaba escrito (se muestra: «E-102»). */
  seen: string;
};

/**
 * E / INS / SIN / «aditivo», un separador opcional, 3 o 4 cifras (un «o» o una «l» leídos por error
 * cuentan como 0 y 1, siempre que haya al menos dos cifras de verdad; un espacio, una coma o un punto
 * entre cifras, como en «E 9 99» o «E,999», no las separa), sufijo de letra y romano opcionales. Un
 * número seguido de «%» o de «g» no es un aditivo («sin 100 %»).
 */
const CODE =
  /\b(e|ins|sin|i\.n\.s\.?|aditivo|additive)\s*[-.:,]?\s*(?:n[o°º]?\s*\.?\s*)?([0-9ol](?:[\s,.]?[0-9ol]){2,3})(?![0-9])(?!\s*(?:%|g\b|mg\b|kg\b|ml\b))\s*([a-j](?![a-z]))?\s*(?:\(\s*(?:i{1,3}|iv|vi?)\s*\))?/g;

export function findCodes(folded: string): CodeSeen[] {
  const out: CodeSeen[] = [];
  const seen = new Set<string>();
  for (const m of folded.matchAll(CODE)) {
    const raw = m[2].replace(/[\s,.]/g, "");
    if ((raw.match(/\d/g) ?? []).length < 2) continue;
    const digits = raw.replace(/o/g, "0").replace(/l/g, "1");
    const n = Number(digits);
    // La numeración internacional de aditivos va de 100 a 1599.
    if (n < 100 || n > 1599) continue;
    const code = `E${n}`;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, seen: m[0].trim().toUpperCase() });
  }
  return out;
}

export type CodeGuess = {
  /** Lo que se leyó tras el prefijo, sin separadores («9s9»): cifras y letras sueltas. */
  pattern: string;
  /** Cómo estaba escrito, para mostrarlo. */
  seen: string;
};

/**
 * Lo que PARECE un código de aditivo pero trae letras donde irían cifras («E9S9», «e-9O9»): el lector
 * confunde S, O, B, Z, G con cifras. No es un código: solo sirve para decir «se parece a …» si
 * coincide, con cada letra como comodín, con un aditivo del plan. Exige al menos dos cifras de verdad.
 */
const GUESS =
  /\b(?:e|ins|sin|aditivo|additive)\s*[-.:,]?\s*([0-9a-z](?:[\s,.]?[0-9a-z]){2,3})(?![0-9a-z])/g;

export function guessCodes(folded: string): CodeGuess[] {
  const out: CodeGuess[] = [];
  for (const m of folded.matchAll(GUESS)) {
    const pattern = m[1].replace(/[\s,.]/g, "");
    const digits = (pattern.match(/\d/g) ?? []).length;
    if (digits < 2 || digits === pattern.length) continue;
    out.push({ pattern, seen: m[0].trim().toUpperCase() });
  }
  return out;
}

/**
 * Lo que abre las trazas: lo que PUEDE llevar, no lo que lleva. Lo que sigue hasta el final de la
 * frase es traza; después vuelve a ser ingrediente («Contiene: leche.» es ingrediente).
 */
const TRACE_MARKER =
  /\b(?:pueden? contener|contiene trazas|puede tener trazas|trazas de|trazas|elaborad[oa] en (?:una |un )?(?:planta|linea|fabrica|instalacion|equipos?)|fabricad[oa] en (?:una |un )?(?:planta|linea|instalacion|equipos?)|procesad[oa] en (?:una |un )?(?:planta|linea|instalacion|equipos?)|may contain|contains traces|traces of|made (?:in|on) (?:a )?(?:facility|plant|line|shared equipment)|manufactured (?:in|on) (?:a )?(?:facility|plant|line|shared equipment)|processed (?:in|on) (?:a )?(?:facility|plant|line|shared equipment)|produced (?:in|on) (?:a )?(?:facility|plant|line|shared equipment)|shared (?:equipment|facility))\b/;

/**
 * Fin de frase: punto (no el de «No.» ni el decimal) o punto y coma seguidos de espacio o fin; o el
 * título de otra sección («Ingredientes:», «Información nutricional»), porque una etiqueta leída sin
 * su punto no debe tragarse lo que sigue como si fuera traza.
 */
const SENTENCE_END =
  /(?<!\bn[o°º]?)(?<!\d)[.;](?=\s|$)|(?=\b(?:ingredientes?|ingredients?|informacion nutricional|nutrition facts)\s*:)/;

export type Sections = { ingredients: string; traces: string };

export function splitSections(folded: string): Sections {
  const ingredients: string[] = [];
  const traces: string[] = [];
  let rest = folded;
  while (rest) {
    const m = TRACE_MARKER.exec(rest);
    if (!m) {
      ingredients.push(rest);
      break;
    }
    ingredients.push(rest.slice(0, m.index));
    const after = rest.slice(m.index);
    const end = SENTENCE_END.exec(after);
    traces.push(end ? after.slice(0, end.index) : after);
    rest = end ? after.slice(end.index + end[0].length) : "";
  }
  const join = (parts: string[]) => parts.join(" ").replace(/\s+/g, " ").trim();
  return { ingredients: join(ingredients), traces: join(traces) };
}

/** Palabras que casi toda etiqueta de ingredientes trae: sin un par de ellas, no se leyó una etiqueta. */
const LABEL_WORDS = new Set(
  (
    "ingrediente contiene contener agua azucar sal harina trigo aceite vegetal leche maiz almidon sabor " +
    "saborizante colorante conservante conservador emulsificante emulsionante estabilizante espesante " +
    "acidulante antioxidante natural artificial vitamina mineral hierro cacao soya soja huevo mantequilla " +
    "grasa proteina fibra extracto jarabe glucosa fructosa lecitina citrico acido sodio potasio calcio " +
    "gluten traza puede arroz avena fruta pulpa jugo concentrado suero levadura cebada maltodextrina " +
    "ingredient contain water sugar salt flour wheat oil milk corn starch flavor flavour flavoring " +
    "color colour coloring preservative emulsifier stabilizer thickener vitamin egg butter fat protein " +
    "fiber fibre extract syrup may soy cocoa rice oat fruit juice whey yeast barley"
  ).split(" "),
);

export type Quality = {
  ok: boolean;
  /** Por qué no (si no): se usa en las pruebas y en el panel de prueba, jamás en un log. */
  why?: "empty" | "low-confidence" | "few-words" | "noise" | "not-a-label";
};

/** Umbrales del «se leyó bien» (medidos con las 10 etiquetas de prueba de ADR-019). */
export const QUALITY = {
  minConfidence: 70,
  minWords: 4,
  minLetterShare: 0.6,
  minLabelWords: 2,
} as const;

/**
 * ¿Se leyó lo bastante bien para decir «no vi nada que choque»? Confianza media del lector (si la
 * hay), al menos 4 palabras de 3 o más letras latinas, al menos 60 % de letras latinas entre lo que
 * no es espacio, y al menos 2 palabras típicas de una lista de ingredientes.
 */
export function textQuality(raw: string, confidence?: number): Quality {
  const folded = foldText(raw);
  if (!folded) return { ok: false, why: "empty" };
  if (confidence != null && !(confidence >= QUALITY.minConfidence))
    return { ok: false, why: "low-confidence" };
  const chars = folded.replace(/\s/g, "");
  const latin = (chars.match(/[a-z]/g) ?? []).length;
  if (latin / chars.length < QUALITY.minLetterShare)
    return { ok: false, why: "noise" };
  const words = folded.split(/[^a-z]+/).filter((w) => w.length >= 3);
  if (words.length < QUALITY.minWords) return { ok: false, why: "few-words" };
  const sing = (w: string) =>
    w.length > 3 && w.endsWith("es") && !LABEL_WORDS.has(w.slice(0, -1))
      ? w.slice(0, -2)
      : w.length > 3 && w.endsWith("s")
        ? w.slice(0, -1)
        : w;
  const hits = new Set(words.map(sing).filter((w) => LABEL_WORDS.has(w)));
  if (hits.size < QUALITY.minLabelWords)
    return { ok: false, why: "not-a-label" };
  return { ok: true };
}
