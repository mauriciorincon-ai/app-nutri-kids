import type { LocalizedText } from "@/lib/diet/schema";

/**
 * Los ingredientes de las recetas (S11 · ADR-017). Cada uno se cotejará con el plan cargado POR
 * NOMBRE (en los dos idiomas, más sus otras formas de decirlo): los ids de un plan leído de un PDF
 * se generan al cargarlo, así que una receta no puede depender de ellos. Los «básicos» (agua,
 * aceite…) no cuentan como faltantes en «con lo que tengo», pero si el plan los prohíbe, mandan.
 */
export type Ingredient = LocalizedText & {
  /** Otras formas de decirlo (ya normalizadas por el cotejo): «yogur» por «yogurt». */
  alt?: readonly string[];
  /** Básico de despensa: se da por sabido en «con lo que tengo». */
  staple?: true;
};

const i = (es: string, en: string, alt?: string[]): Ingredient => ({
  es,
  en,
  ...(alt ? { alt } : {}),
});
const staple = (es: string, en: string, alt?: string[]): Ingredient => ({
  ...i(es, en, alt),
  staple: true,
});

export const INGREDIENTS = {
  // Proteínas
  pollo: i("pollo", "chicken"),
  pescado: i("pescado blanco", "white fish"),
  huevos: i("huevos", "eggs", ["huevo", "egg"]),
  lentejas: i("lentejas", "lentils"),
  garbanzos: i("garbanzos", "chickpeas"),
  frijoles: i("frijoles", "beans", ["fríjoles", "bean"]),
  // Verduras
  zanahoria: i("zanahoria", "carrot"),
  brocoli: i("brócoli", "broccoli"),
  calabacin: i("calabacín", "zucchini", ["calabacin", "courgette"]),
  tomate: i("tomate", "tomato"),
  espinaca: i("espinaca", "spinach"),
  papa: i("papa", "potato", ["patata"]),
  batata: i("batata", "sweet potato", ["camote", "boniato"]),
  // Frutas
  pera: i("pera", "pear"),
  kiwi: i("kiwi", "kiwi"),
  uvas: i("uvas", "grapes"),
  fresas: i("fresas", "strawberries", ["fresa", "strawberry"]),
  banano: i("banano", "banana", ["plátano maduro", "platano maduro"]),
  aguacate: i("aguacate", "avocado", ["palta"]),
  // Cereales
  arroz: i("arroz", "rice"),
  avena: i("avena", "oats", ["oat"]),
  pasta: i("pasta", "pasta"),
  pan: i("pan", "bread"),
  arepa: i("arepa", "arepa"),
  tostadas: i("tostadas de arroz", "rice cakes", ["rice cake"]),
  // Lácteos
  yogurt: i("yogurt", "yogurt", ["yogur"]),
  queso: i("queso fresco", "fresh cheese"),
  // Básicos de despensa
  agua: staple("agua", "water"),
  aceite: staple("aceite de oliva", "olive oil", ["aceite"]),
  canela: staple("canela", "cinnamon"),
  limon: staple("limón", "lemon", ["limon"]),
} as const satisfies Record<string, Ingredient>;

export type IngredientId = keyof typeof INGREDIENTS;
export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];
