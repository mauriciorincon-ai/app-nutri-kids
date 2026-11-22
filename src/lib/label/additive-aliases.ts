/**
 * Nombres públicos de aditivos (S13 · ADR-019): cómo aparece un código en una etiqueta cuando no se
 * escribe con su número («tartrazina», «amarillo 5»). Es conocimiento público de la numeración
 * internacional (SIN/INS del Codex, la misma que la «E» europea), no dato de ningún plan:
 *  - un alias SOLO cuenta si su código está en el plan cargado, o si su clase («colorante
 *    artificial», «endulzante artificial») nombra un alimento rojo del plan;
 *  - jamás inventa un rojo: lo que el plan no evita, no se vuelve «no va» por estar aquí.
 * Los nombres van sin tildes ni mayúsculas: se cotejan contra el texto ya plegado.
 */

/** Clase del aditivo que un plan puede nombrar como alimento a evitar. */
export type AdditiveClass = "artificial-dye" | "artificial-sweetener";

export type AdditiveAlias = {
  /** Nombres con que la etiqueta lo escribe, en español y en inglés. */
  names: readonly string[];
  class?: AdditiveClass;
};

/** Código (con su «E», sin sufijo) → nombres y clase. */
export const ADDITIVE_ALIASES: Readonly<Record<string, AdditiveAlias>> = {
  E102: {
    names: ["tartrazina", "amarillo 5", "yellow 5", "tartrazine"],
    class: "artificial-dye",
  },
  E104: {
    names: [
      "amarillo de quinoleina",
      "amarillo quinoleina",
      "quinoline yellow",
    ],
    class: "artificial-dye",
  },
  E110: {
    names: ["amarillo ocaso", "amarillo 6", "sunset yellow", "yellow 6"],
    class: "artificial-dye",
  },
  E122: {
    names: ["azorrubina", "carmoisina", "azorubine", "carmoisine"],
    class: "artificial-dye",
  },
  E123: { names: ["amaranto", "amaranth red"], class: "artificial-dye" },
  E124: {
    names: ["ponceau 4r", "rojo cochinilla a", "ponceau"],
    class: "artificial-dye",
  },
  E127: {
    names: ["eritrosina", "rojo 3", "erythrosine", "red 3"],
    class: "artificial-dye",
  },
  E129: {
    names: ["rojo allura", "rojo 40", "allura red", "red 40"],
    class: "artificial-dye",
  },
  E131: { names: ["azul patente", "patent blue"], class: "artificial-dye" },
  E132: {
    names: ["indigotina", "azul 2", "indigo carmine", "blue 2"],
    class: "artificial-dye",
  },
  E133: {
    names: ["azul brillante", "azul 1", "brilliant blue", "blue 1"],
    class: "artificial-dye",
  },
  E143: {
    names: ["verde rapido", "verde 3", "fast green", "green 3"],
    class: "artificial-dye",
  },
  E151: {
    names: ["negro brillante", "brilliant black"],
    class: "artificial-dye",
  },
  E150: { names: ["color caramelo", "caramelo iv", "caramel color"] },
  E200: { names: ["acido sorbico", "sorbic acid"] },
  E202: { names: ["sorbato de potasio", "potassium sorbate"] },
  E211: { names: ["benzoato de sodio", "sodium benzoate"] },
  E220: { names: ["dioxido de azufre", "sulphur dioxide", "sulfur dioxide"] },
  E223: { names: ["metabisulfito de sodio", "sodium metabisulfite"] },
  E250: { names: ["nitrito de sodio", "sodium nitrite"] },
  E251: { names: ["nitrato de sodio", "sodium nitrate"] },
  E320: { names: ["butilhidroxianisol", "bha"] },
  E321: { names: ["butilhidroxitolueno", "bht"] },
  E407: { names: ["carragenina", "carragenano", "carrageenan"] },
  E420: { names: ["sorbitol"] },
  E421: { names: ["manitol", "mannitol"] },
  E621: {
    names: [
      "glutamato monosodico",
      "glutamato de sodio",
      "monosodium glutamate",
      "msg",
    ],
  },
  E950: {
    names: [
      "acesulfame k",
      "acesulfame de potasio",
      "acesulfame",
      "acesulfame potassium",
    ],
    class: "artificial-sweetener",
  },
  E951: { names: ["aspartame", "aspartamo"], class: "artificial-sweetener" },
  E952: { names: ["ciclamato", "cyclamate"], class: "artificial-sweetener" },
  E954: { names: ["sacarina", "saccharin"], class: "artificial-sweetener" },
  E955: { names: ["sucralosa", "sucralose"], class: "artificial-sweetener" },
  E961: { names: ["neotame"], class: "artificial-sweetener" },
  E962: {
    names: ["sal de aspartame acesulfame", "aspartame acesulfame salt"],
    class: "artificial-sweetener",
  },
  E965: { names: ["maltitol"] },
  E967: { names: ["xilitol", "xylitol"] },
};

/**
 * Cómo un plan nombra cada clase como alimento rojo: si un rojo del plan contiene alguna de estas
 * frases («Colorantes artificiales», «Artificial food dyes»), un aditivo de esa clase lo designa.
 */
export const CLASS_PHRASES: Readonly<Record<AdditiveClass, readonly string[]>> =
  {
    "artificial-dye": [
      "colorante artificial",
      "colorante sintetico",
      "artificial food dye",
      "artificial dye",
      "artificial color",
      "artificial colour",
    ],
    "artificial-sweetener": [
      "endulzante artificial",
      "edulcorante artificial",
      "artificial sweetener",
    ],
  };
