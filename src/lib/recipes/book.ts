import type { LocalizedText, Texture } from "@/lib/diet/schema";

import type { IngredientId } from "./catalog";

/**
 * El recetario inicial (S11 · ADR-017): recetas infantiles sencillas, escritas para esta app (no
 * copiadas), en español y en inglés redactadas por separado. Sin marcas, sin cifras de nutrientes
 * ni afirmaciones de salud: solo qué lleva, cuánto tiempo toma y cuánto cuesta (cómo se hace vive en
 * `steps.ts`, que se pide al abrir una receta). Cada
 * ingrediente es del catálogo y se coteja con el plan cargado (`review.ts`): una receta es una
 * sugerencia, nunca una indicación, y el plan siempre manda.
 */
export type Cost = "low" | "mid" | "high";
export type TimeLevel = "quick" | "medium" | "long";

export type RecipeIngredient = {
  id: IngredientId;
  /** Medida casera («1 taza»), no una cifra de nutrientes. */
  qty: LocalizedText;
  optional?: true;
};

export type Recipe = {
  id: string;
  name: LocalizedText;
  /** Minutos de principio a fin (de ahí sale el nivel de tiempo). */
  minutes: number;
  cost: Cost;
  /** La textura con la que queda servida, si es una sola. */
  texture?: Texture;
  ingredients: RecipeIngredient[];
};

/** Los tres niveles de tiempo: hasta 15 min, hasta 30 y más. */
export function timeLevel(minutes: number): TimeLevel {
  return minutes <= 15 ? "quick" : minutes <= 30 ? "medium" : "long";
}

const t = (es: string, en: string): LocalizedText => ({ es, en });
const ing = (
  id: IngredientId,
  es: string,
  en: string,
  optional = false,
): RecipeIngredient => ({
  id,
  qty: t(es, en),
  ...(optional ? { optional: true } : {}),
});

export const RECIPES: readonly Recipe[] = [
  {
    id: "huevos-espinaca",
    name: t("Huevos revueltos con espinaca", "Scrambled eggs with spinach"),
    minutes: 10,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("huevos", "2", "2"),
      ing(
        "espinaca",
        "1 puñado picado fino",
        "1 small handful, finely chopped",
      ),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
  {
    id: "avena-canela",
    name: t("Avena cocida con canela", "Cooked oats with cinnamon"),
    minutes: 10,
    cost: "low",
    texture: "mashed",
    ingredients: [
      ing("avena", "½ taza", "½ cup"),
      ing("agua", "1 taza", "1 cup"),
      ing("canela", "una pizca", "a pinch"),
    ],
  },
  {
    id: "avena-pera",
    name: t("Avena con pera rallada", "Oats with grated pear"),
    minutes: 15,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("avena", "½ taza", "½ cup"),
      ing("pera", "1 mediana, rallada", "1 medium, grated"),
      ing("agua", "1 taza", "1 cup"),
      ing("canela", "una pizca", "a pinch", true),
    ],
  },
  {
    id: "tortilla-papa",
    name: t("Tortilla de papa y huevo", "Potato and egg omelette"),
    minutes: 30,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("papa", "2 medianas", "2 medium"),
      ing("huevos", "3", "3"),
      ing("aceite", "1 cucharada", "1 tablespoon"),
    ],
  },
  {
    id: "pollo-plancha-verduras",
    name: t(
      "Pollo a la plancha con verduras",
      "Grilled chicken with vegetables",
    ),
    minutes: 25,
    cost: "mid",
    texture: "chopped",
    ingredients: [
      ing("pollo", "1 pechuga", "1 breast"),
      ing("zanahoria", "1", "1"),
      ing("calabacin", "½", "½"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
  {
    id: "arroz-pollo",
    name: t("Arroz con pollo y zanahoria", "Rice with chicken and carrot"),
    minutes: 35,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("arroz", "1 taza", "1 cup"),
      ing("pollo", "1 pechuga en cubos", "1 breast, cubed"),
      ing("zanahoria", "1 rallada", "1, grated"),
      ing("aceite", "1 cucharada", "1 tablespoon"),
      ing("agua", "2 tazas", "2 cups"),
    ],
  },
  {
    id: "sopa-lentejas",
    name: t("Sopa de lentejas con zanahoria", "Lentil soup with carrot"),
    minutes: 40,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("lentejas", "1 taza", "1 cup"),
      ing("zanahoria", "2", "2"),
      ing("papa", "1", "1"),
      ing("tomate", "1", "1"),
      ing("agua", "4 tazas", "4 cups"),
    ],
  },
  {
    id: "pure-papa",
    name: t("Puré de papa suave", "Smooth mashed potato"),
    minutes: 25,
    cost: "low",
    texture: "puree",
    ingredients: [
      ing("papa", "3 medianas", "3 medium"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
      ing(
        "agua",
        "un poco del agua de cocción",
        "a little of the cooking water",
      ),
    ],
  },
  {
    id: "pescado-horno-calabacin",
    name: t(
      "Pescado blanco al horno con calabacín",
      "Baked white fish with zucchini",
    ),
    minutes: 30,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pescado", "1 filete", "1 fillet"),
      ing("calabacin", "1", "1"),
      ing("limon", "unas gotas", "a few drops", true),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
  {
    id: "bolitas-pescado-papa",
    name: t("Bolitas de pescado y papa", "Fish and potato bites"),
    minutes: 35,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pescado", "1 filete cocido", "1 cooked fillet"),
      ing("papa", "2 cocidas", "2, cooked"),
      ing("huevos", "1", "1"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
  {
    id: "brocoli-aguacate",
    name: t("Brócoli al vapor con aguacate", "Steamed broccoli with avocado"),
    minutes: 15,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("brocoli", "1 taza de ramitos", "1 cup of florets"),
      ing("aguacate", "½", "½"),
    ],
  },
  {
    id: "zanahoria-asada",
    name: t("Tiras de zanahoria asada", "Roasted carrot sticks"),
    minutes: 30,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("zanahoria", "3", "3"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
      ing("canela", "una pizca", "a pinch", true),
    ],
  },
  {
    id: "crema-zanahoria",
    name: t("Crema de zanahoria", "Cream of carrot soup"),
    minutes: 30,
    cost: "low",
    texture: "puree",
    ingredients: [
      ing("zanahoria", "4", "4"),
      ing("papa", "1", "1"),
      ing("agua", "3 tazas", "3 cups"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
  {
    id: "crema-calabacin",
    name: t("Crema de calabacín", "Cream of zucchini soup"),
    minutes: 25,
    cost: "low",
    texture: "puree",
    ingredients: [
      ing("calabacin", "2", "2"),
      ing("papa", "1", "1"),
      ing("agua", "3 tazas", "3 cups"),
    ],
  },
  {
    id: "arroz-huevo-zanahoria",
    name: t(
      "Arroz salteado con huevo y zanahoria",
      "Fried rice with egg and carrot",
    ),
    minutes: 20,
    cost: "low",
    texture: "chopped",
    ingredients: [
      ing("arroz", "2 tazas cocido", "2 cups, cooked"),
      ing("huevos", "2", "2"),
      ing("zanahoria", "1 rallada", "1, grated"),
      ing("aceite", "1 cucharada", "1 tablespoon"),
    ],
  },
  {
    id: "tortitas-banano-avena",
    name: t("Tortitas de banano y avena", "Banana and oat pancakes"),
    minutes: 20,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("banano", "1 maduro", "1 ripe"),
      ing("avena", "½ taza", "½ cup"),
      ing("huevos", "1", "1"),
      ing("canela", "una pizca", "a pinch", true),
    ],
  },
  {
    id: "yogurt-fresas",
    name: t("Yogurt con fresas picadas", "Yogurt with chopped strawberries"),
    minutes: 5,
    cost: "mid",
    texture: "soft",
    ingredients: [ing("yogurt", "1 vaso", "1 cup"), ing("fresas", "4", "4")],
  },
  {
    id: "yogurt-kiwi-avena",
    name: t("Yogurt con kiwi y avena", "Yogurt with kiwi and oats"),
    minutes: 5,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("yogurt", "1 vaso", "1 cup"),
      ing("kiwi", "1", "1"),
      ing("avena", "2 cucharadas", "2 tablespoons"),
    ],
  },
  {
    id: "batido-fresa-banano",
    name: t("Batido de fresa y banano", "Strawberry banana smoothie"),
    minutes: 5,
    cost: "low",
    texture: "liquid",
    ingredients: [
      ing("fresas", "6", "6"),
      ing("banano", "1", "1"),
      ing("yogurt", "½ vaso", "½ cup"),
      ing("agua", "un chorrito", "a splash"),
    ],
  },
  {
    id: "compota-pera",
    name: t("Compota de pera", "Pear compote"),
    minutes: 20,
    cost: "low",
    texture: "puree",
    ingredients: [
      ing("pera", "3", "3"),
      ing("agua", "un chorrito", "a splash"),
      ing("canela", "una pizca", "a pinch", true),
    ],
  },
  {
    id: "ensalada-kiwi-uvas",
    name: t("Ensalada de kiwi y uvas partidas", "Kiwi and halved grape salad"),
    minutes: 10,
    cost: "mid",
    texture: "chopped",
    ingredients: [ing("kiwi", "2", "2"), ing("uvas", "1 taza", "1 cup")],
  },
  {
    id: "arroz-lentejas",
    name: t("Arroz con lentejas", "Rice with lentils"),
    minutes: 40,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("arroz", "1 taza", "1 cup"),
      ing("lentejas", "½ taza", "½ cup"),
      ing("zanahoria", "1 rallada", "1, grated"),
      ing("tomate", "1", "1"),
      ing("aceite", "1 cucharada", "1 tablespoon"),
    ],
  },
  {
    id: "garbanzos-tomate",
    name: t("Garbanzos con tomate", "Chickpeas in tomato"),
    minutes: 30,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("garbanzos", "1 taza cocidos", "1 cup, cooked"),
      ing("tomate", "2", "2"),
      ing("aceite", "1 cucharada", "1 tablespoon"),
    ],
  },
  {
    id: "frijoles-arroz",
    name: t("Frijoles con arroz", "Beans and rice"),
    minutes: 45,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("frijoles", "1 taza cocidos", "1 cup, cooked"),
      ing("arroz", "1 taza", "1 cup"),
      ing("zanahoria", "1 rallada", "1, grated", true),
    ],
  },
  {
    id: "albondigas-pollo",
    name: t("Albóndigas de pollo y zanahoria", "Chicken and carrot meatballs"),
    minutes: 35,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pollo", "1 pechuga molida", "1 breast, ground"),
      ing("zanahoria", "1 rallada fina", "1, finely grated"),
      ing("huevos", "1", "1"),
      ing("avena", "2 cucharadas", "2 tablespoons"),
    ],
  },
  {
    id: "arepa-tomate-queso",
    name: t(
      "Arepa con tomate y queso fresco",
      "Arepa with tomato and fresh cheese",
    ),
    minutes: 15,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("arepa", "1 pequeña", "1 small"),
      ing("tomate", "½ en rodajas finas", "½, thinly sliced"),
      ing("queso", "1 lonja", "1 slice"),
    ],
  },
  {
    id: "pasta-tomate-brocoli",
    name: t("Pasta con tomate y brócoli", "Pasta with tomato and broccoli"),
    minutes: 25,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("pasta", "1 taza", "1 cup"),
      ing("tomate", "2", "2"),
      ing("brocoli", "1 taza de ramitos pequeños", "1 cup of small florets"),
      ing("aceite", "1 cucharada", "1 tablespoon"),
    ],
  },
  {
    id: "tostadas-aguacate",
    name: t("Tostadas de arroz con aguacate", "Rice cakes with avocado"),
    minutes: 5,
    cost: "mid",
    texture: "crunchy",
    ingredients: [
      ing("tostadas", "3", "3"),
      ing("aguacate", "½", "½"),
      ing("limon", "unas gotas", "a few drops", true),
    ],
  },
  {
    id: "omelette-tomate-calabacin",
    name: t("Omelette de tomate y calabacín", "Tomato and zucchini omelette"),
    minutes: 15,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("huevos", "2", "2"),
      ing("tomate", "½ picado", "½, chopped"),
      ing("calabacin", "¼ rallado", "¼, grated"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
  {
    id: "pan-pollo",
    name: t("Pan con pollo desmechado", "Shredded chicken sandwich"),
    minutes: 20,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pan", "2 rebanadas", "2 slices"),
      ing("pollo", "½ pechuga cocida", "½ breast, cooked"),
      ing("tomate", "unas rodajas", "a few slices", true),
    ],
  },
  {
    id: "batata-asada",
    name: t("Batata asada en cubos", "Roasted sweet potato cubes"),
    minutes: 35,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("batata", "2", "2"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
      ing("canela", "una pizca", "a pinch", true),
    ],
  },
  {
    id: "ensalada-tomate-aguacate",
    name: t("Ensalada de tomate y aguacate", "Tomato and avocado salad"),
    minutes: 10,
    cost: "mid",
    texture: "chopped",
    ingredients: [
      ing("tomate", "2", "2"),
      ing("aguacate", "1", "1"),
      ing("limon", "unas gotas", "a few drops", true),
    ],
  },
  {
    id: "sopa-pollo-papa",
    name: t(
      "Sopa de pollo con papa y zanahoria",
      "Chicken soup with potato and carrot",
    ),
    minutes: 45,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pollo", "1 pechuga", "1 breast"),
      ing("papa", "2", "2"),
      ing("zanahoria", "2", "2"),
      ing("agua", "5 tazas", "5 cups"),
    ],
  },
  {
    id: "pescado-arroz-brocoli",
    name: t(
      "Pescado blanco con arroz y brócoli",
      "White fish with rice and broccoli",
    ),
    minutes: 30,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pescado", "1 filete", "1 fillet"),
      ing("arroz", "1 taza cocido", "1 cup, cooked"),
      ing("brocoli", "1 taza", "1 cup"),
    ],
  },
  {
    id: "barritas-avena-banano",
    name: t("Barritas de avena y banano al horno", "Baked oat and banana bars"),
    minutes: 30,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("avena", "1 taza", "1 cup"),
      ing("banano", "2 maduros", "2 ripe"),
      ing("canela", "una pizca", "a pinch", true),
    ],
  },
  {
    id: "lentejas-papa-pure",
    name: t("Puré de lentejas y papa", "Lentil and potato mash"),
    minutes: 35,
    cost: "low",
    texture: "mashed",
    ingredients: [
      ing("lentejas", "½ taza", "½ cup"),
      ing("papa", "2", "2"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
  {
    id: "calabacin-arroz-queso",
    name: t(
      "Arroz con calabacín y queso fresco",
      "Rice with zucchini and fresh cheese",
    ),
    minutes: 25,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("arroz", "1 taza cocido", "1 cup, cooked"),
      ing("calabacin", "1 rallado", "1, grated"),
      ing("queso", "2 cucharadas desmenuzado", "2 tablespoons, crumbled"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
  },
];
