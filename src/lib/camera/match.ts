/**
 * Lo que el modelo dijo → lo que la app conoce (S12 · ADR-018). Código primero: el modelo solo
 * devuelve TEXTO; aquí se parte en nombres y cada uno se coteja por nombre con el catálogo de
 * ingredientes y con los alimentos del plan cargado. Ningún id nace del texto del modelo: lo que no
 * cuadra queda en `unknown` («vi esto, no está en tu catálogo») y nada entra a ningún lado sin el
 * toque de quien cuida. Puro: no lee storage ni red.
 */
import { allItemIds, resolveItemStatus } from "@/lib/diet/logic";
import { containsPhrase, toTokens } from "@/lib/diet/search";
import type { DietPlan } from "@/lib/diet/schema";
import { INGREDIENTS, type IngredientId } from "@/lib/recipes/catalog";
import { ALTERNATIVES, forms, matchLevel } from "@/lib/recipes/review";

/** Como mucho tantas cosas por foto: un texto desbocado no llena la pantalla. */
export const MAX_SEEN = 12;
/** Un nombre de más de esto no es un alimento: se descarta. */
const MAX_LABEL = 40;
/** Tras quitar el relleno, un nombre de más palabras es una descripción, no un alimento. */
const MAX_WORDS = 4;

/**
 * Palabras que no nombran un alimento: artículos, cantidades, colores, adjetivos de cocina y las
 * frases con que el modelo envuelve la lista («the image shows», «the food items include»). Se
 * QUITAN del nombre; lo que queda es lo que se coteja.
 */
const FILLER = new Set(
  (
    "a an the some few several many piece pieces slice slices of fresh sliced chopped whole raw " +
    "cooked small large big one two three four five six bunch bowl plate other more lot lots " +
    "white red green orange yellow brown black blue purple pink multicolored colored colorful " +
    "image picture photo frame shows show showing see seen visible there is are can be i it its " +
    "this that these those which what food foods item items ingredient ingredients include " +
    "includes appear appears appearing look looks seem seems present here in on at to as also " +
    "each has have topped grilled fried baked roasted boiled steamed mashed mixed served " +
    "garnished stuffed diced local time " +
    "un una unos unas el la los las de del algunos algunas"
  ).split(" "),
);

/**
 * Lo que es escena, no comida («background», «table», «market stall»): un nombre que lo lleva se
 * descarta entero.
 */
const SCENE =
  /\b(background|table|surface|frame|center|centre|top|bottom|side|left|right|market|stall|store|basket|box|carton|tray|rack|fabric|cloth|design|arrangement|pattern|text|logo|kitchen|counter|board|wall|light|shadow|people|person|hand|sale|shop|restaurant|butcher|collage|effect|oval|rim|flower|utc)s?\b/i;

/**
 * Separadores entre alimentos: comas, saltos, viñetas, «and», «with», «including», «like», «or», y
 * las preposiciones de lugar («bananas on a table» → «bananas» · «table», que es escena).
 */
const SEPARATORS =
  /[,;&\n•·:]|\b(?:and|with|including|like|such as|or|along|plus|on|in|at|of|behind|near|inside|over|under|from|for|into|y|con|o|en|sobre)\b|\d+[.)]/i;

/** Solo la primera frase: después el modelo suele describir la escena, no lo que hay. */
function firstSentence(text: string): string {
  const m = /(?<!\b\d)[.!?](?:\s|$)/.exec(text);
  return m ? text.slice(0, m.index) : text;
}

/** El texto del modelo → nombres sueltos, sin relleno ni repetidos. */
export function splitSeen(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of firstSentence(String(text ?? "")).split(SEPARATORS)) {
    if (raw == null) continue;
    let label = raw
      .replace(/[*_"“”.!?()[\]/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!label || label.length > MAX_LABEL * 3 || SCENE.test(label)) continue;
    const words = label
      .split(" ")
      .filter((w) => !FILLER.has(w) && !/^\d+$/.test(w));
    if (words.length > MAX_WORDS || words.some((w) => /\d/.test(w))) continue;
    label = words.join(" ");
    if (label.length > MAX_LABEL) continue;
    if (!label || !/\p{L}{2}/u.test(label)) continue;
    const key = toTokens(label, "en").join(" ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_SEEN) break;
  }
  return out;
}

export type Seen = {
  /** Lo que dijo el modelo, ya limpio (se muestra tal cual en el panel de prueba). */
  label: string;
  /** El ingrediente del catálogo que nombra (si alguno): de aquí salen los chips de la despensa. */
  ingredient: IngredientId | null;
  /** Los alimentos del plan que nombra (ids del plan cargado): de aquí sale el semáforo del plato. */
  planIds: string[];
};

export type SeenResult = {
  /** Lo que cuadró con el catálogo o con el plan. */
  known: Seen[];
  /** Lo que el modelo dijo y la app no conoce: se muestra y no entra a ningún lado. */
  unknown: string[];
};

/** El ingrediente cuya forma completa aparece en el nombre; si hay varios, el de la forma más larga. */
function ingredientFor(tokens: string[]): IngredientId | null {
  let best: { id: IngredientId; len: number } | null = null;
  for (const id of Object.keys(INGREDIENTS) as IngredientId[]) {
    for (const f of forms(INGREDIENTS[id])) {
      if (!containsPhrase(tokens, f)) continue;
      if (!best || f.length > best.len) best = { id, len: f.length };
    }
  }
  return best?.id ?? null;
}

/**
 * Los alimentos del plan que el nombre designa. Exacto si es el mismo nombre; si no, solo cuando el
 * nombre visto CONTIENE el nombre entero del plan o una de sus alternativas («soda» → «Gaseosas y
 * jugos de caja»). Al revés no: una palabra genérica («food», «juice») contenida en un nombre del
 * plan no lo designa.
 */
function planFor(diet: DietPlan, tokens: string[], now: Date): string[] {
  const exact: string[] = [];
  const partial: string[] = [];
  for (const id of allItemIds(diet)) {
    const status = resolveItemStatus(diet, id, now);
    if (!status) continue;
    if (matchLevel([tokens], status.name) === 2) {
      exact.push(id);
      continue;
    }
    const contained = (["es", "en"] as const).some((locale) =>
      [status.name[locale], ...status.name[locale].split(ALTERNATIVES)].some(
        (part) => {
          const p = toTokens(part, locale);
          return p.length > 0 && containsPhrase(tokens, p);
        },
      ),
    );
    if (contained) partial.push(id);
  }
  return exact.length ? exact : partial;
}

/** El plural inglés en «-oes» («potatoes», «tomatoes») que la búsqueda deja en «potatoe». */
function singular(tokens: string[]): string[] {
  return tokens.map((t) => (/[^aeiou]oe$/.test(t) && t.length > 4 ? t.slice(0, -1) : t));
}

export function matchSeen(text: string, diet: DietPlan, now: Date): SeenResult {
  const known: Seen[] = [];
  const unknown: string[] = [];
  const same = new Set<string>();
  for (const label of splitSeen(text)) {
    const tokens = singular(toTokens(label, "en"));
    const ingredient = ingredientFor(tokens);
    const planIds = planFor(diet, tokens, now);
    if (!ingredient && !planIds.length) {
      unknown.push(label);
      continue;
    }
    // «pollo» y «chicken» son la misma cosa: una sola entrada.
    const key = ingredient ?? planIds.join("|");
    if (same.has(key)) continue;
    same.add(key);
    known.push({ label, ingredient, planIds });
  }
  return { known, unknown };
}
