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
    "un una unos unas el la los las algunos algunas"
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

/** Lo que viene después de la primera frase (la descripción de la escena). */
function afterFirstSentence(text: string): string {
  const m = /(?<!\b\d)[.!?](?:\s|$)/.exec(text);
  return m ? text.slice(m.index + 1) : "";
}

/** Cuántos nombres como mucho se piden al cortar el texto: el tope de lo que se muestra más lo que se cuenta. */
const SPLIT_LIMIT = 200;

/** El texto del modelo → nombres sueltos, sin relleno ni repetidos. */
export function splitSeen(text: string): string[] {
  return splitAll(firstSentence(String(text ?? "")), MAX_SEEN);
}

function splitAll(text: string, limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.replace(/\p{C}+/gu, " ").split(SEPARATORS)) {
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
    if (out.length >= limit) break;
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
  /** Cuántos nombres más dijo el modelo y no se muestran (el tope por foto). */
  more?: number;
};

/** El ingrediente cuya forma completa aparece en el nombre; si hay varios, el de la forma más larga. */
function ingredientFor(
  tokens: string[],
): { id: IngredientId; form: string[] } | null {
  let best: { id: IngredientId; form: string[] } | null = null;
  for (const id of Object.keys(INGREDIENTS) as IngredientId[]) {
    for (const f of forms(INGREDIENTS[id])) {
      if (!containsPhrase(tokens, f)) continue;
      if (!best || f.length > best.form.length) best = { id, form: f };
    }
  }
  return best;
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

/**
 * Palabras que vuelven un alimento en algo procesado («potato chips», «chicken nuggets», «tomato
 * ketchup», «carrot cake»): el alimento de dentro NO designa esto, así que ninguna coincidencia con
 * el catálogo ni con un verde del plan vale. Sí valen un rojo, una restricción o un amarillo: ante la
 * duda manda el peor. Va en singular, como salen los nombres de `toTokens`.
 */
const PROCESSED = new Set(
  (
    "chip crisp nugget ketchup catsup sauce dressing juice smoothie milkshake candy sweet chocolate cake " +
    "cookie biscuit cracker pudding pie pastry donut doughnut muffin soda cola fry syrup jam jelly " +
    "sausage hotdog bacon ham burger pizza snack bar icecream " +
    "papita chito salsa jugo gaseosa dulce torta galleta pudin helado embutido salchicha jamon tocino " +
    "hamburguesa mermelada jarabe chocolatina bombon"
  ).split(" "),
);
/** ¿Lleva una palabra de lo procesado que NO es parte del nombre del ingrediente («rice cake» es tostadas)? */
const isProcessed = (tokens: string[], own: readonly string[] = []) =>
  tokens.some((t) => PROCESSED.has(t) && !own.includes(t)) ||
  (containsPhrase(tokens, ["ice", "cream"]) && !own.includes("cream"));

export function matchSeen(text: string, diet: DietPlan, now: Date): SeenResult {
  const known: Seen[] = [];
  const unknown: string[] = [];
  const same = new Set<string>();
  const raw = String(text ?? "");

  const take = (label: string, onlyKnown: boolean): boolean => {
    const tokens = toTokens(label, "en");
    const found = ingredientFor(tokens);
    let ingredient = found?.id ?? null;
    let planIds = planFor(diet, tokens, now);
    if (isProcessed(tokens, found?.form)) {
      // Lo procesado no es el alimento de dentro: solo cuentan los avisos (rojo, restricción, medida).
      ingredient = null;
      planIds = planIds.filter(
        (id) => resolveItemStatus(diet, id, now)?.kind !== "green",
      );
    }
    if (!ingredient && !planIds.length) {
      if (!onlyKnown) unknown.push(label);
      return false;
    }
    // «pollo» y «chicken» son la misma cosa: una sola entrada.
    const key = ingredient ?? planIds.join("|");
    if (!same.has(key)) {
      same.add(key);
      known.push({ label, ingredient, planIds });
    }
    return true;
  };

  // La primera frase es la lista; lo que no cuadra sale de ahí. Las frases siguientes (la escena) solo
  // aportan lo que SÍ cuadra: un rojo dicho después no se pierde, y el ruido no se muestra.
  const all = splitAll(firstSentence(raw), SPLIT_LIMIT);
  let shown = 0;
  let more = 0;
  for (const label of all) {
    if (shown >= MAX_SEEN) {
      more += 1;
      continue;
    }
    take(label, false);
    shown += 1;
  }
  for (const label of splitAll(afterFirstSentence(raw), SPLIT_LIMIT))
    take(label, true);
  return more > 0 ? { known, unknown, more } : { known, unknown };
}
