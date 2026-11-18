import type { LocalizedText, Texture } from "@/lib/diet/schema";

import type { IngredientId } from "./catalog";

/**
 * El recetario inicial (S11 · ADR-017): recetas infantiles sencillas, escritas para esta app (no
 * copiadas), en español y en inglés redactadas por separado. Sin marcas, sin cifras de nutrientes
 * ni afirmaciones de salud: solo qué lleva, cuánto tiempo toma, cuánto cuesta y cómo se hace. Cada
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
  steps: LocalizedText[];
  tip?: LocalizedText;
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
): RecipeIngredient => ({ id, qty: t(es, en), ...(optional ? { optional: true } : {}) });

export const RECIPES: readonly Recipe[] = [
  {
    id: "huevos-espinaca",
    name: t("Huevos revueltos con espinaca", "Scrambled eggs with spinach"),
    minutes: 10,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("huevos", "2", "2"),
      ing("espinaca", "1 puñado picado fino", "1 small handful, finely chopped"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
    steps: [
      t("Bate los huevos en un plato.", "Beat the eggs in a bowl."),
      t("Calienta el aceite y sofríe la espinaca un minuto.", "Warm the oil and cook the spinach for a minute."),
      t("Agrega los huevos y revuelve a fuego bajo hasta que cuajen.", "Pour in the eggs and stir on low heat until set."),
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
    steps: [
      t("Pon la avena y el agua en una olla.", "Put the oats and water in a pot."),
      t("Cocina a fuego bajo, revolviendo, hasta que espese.", "Cook on low heat, stirring, until thick."),
      t("Sirve tibia con la canela por encima.", "Serve warm with cinnamon on top."),
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
    steps: [
      t("Cocina la avena con el agua a fuego bajo.", "Cook the oats with the water on low heat."),
      t("Cuando espese, mezcla la pera rallada.", "When thick, stir in the grated pear."),
      t("Apaga, deja reposar un minuto y sirve.", "Turn off, let it rest a minute and serve."),
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
    steps: [
      t("Cuece la papa en cubos pequeños hasta que esté blanda.", "Boil the potato in small cubes until soft."),
      t("Mézclala con los huevos batidos.", "Mix it with the beaten eggs."),
      t("Cuaja la mezcla en una sartén con el aceite, por los dos lados.", "Set the mixture in a pan with the oil, on both sides."),
    ],
  },
  {
    id: "pollo-plancha-verduras",
    name: t("Pollo a la plancha con verduras", "Grilled chicken with vegetables"),
    minutes: 25,
    cost: "mid",
    texture: "chopped",
    ingredients: [
      ing("pollo", "1 pechuga", "1 breast"),
      ing("zanahoria", "1", "1"),
      ing("calabacin", "½", "½"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
    steps: [
      t("Corta el pollo y las verduras en trozos pequeños.", "Cut the chicken and vegetables into small pieces."),
      t("Dora el pollo en la plancha con el aceite hasta que esté bien cocido por dentro.", "Brown the chicken on the griddle with the oil until cooked through."),
      t("Saltea las verduras a un lado y sirve todo junto.", "Sauté the vegetables on the side and serve together."),
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
    steps: [
      t("Sofríe el pollo en el aceite hasta que cambie de color.", "Cook the chicken in the oil until it changes color."),
      t("Añade el arroz, la zanahoria y el agua.", "Add the rice, carrot and water."),
      t("Tapa y cocina a fuego bajo hasta que el arroz esté blando.", "Cover and cook on low heat until the rice is soft."),
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
    steps: [
      t("Lava las lentejas y ponlas a cocer con el agua.", "Rinse the lentils and set them to cook in the water."),
      t("Agrega la zanahoria, la papa y el tomate en trozos.", "Add the carrot, potato and tomato in pieces."),
      t("Cocina hasta que todo esté blando y sirve en un plato hondo.", "Cook until everything is soft and serve in a deep bowl."),
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
      ing("agua", "un poco del agua de cocción", "a little of the cooking water"),
    ],
    steps: [
      t("Cuece las papas peladas hasta que se deshagan con el tenedor.", "Boil the peeled potatoes until they fall apart with a fork."),
      t("Macháchalas con el aceite.", "Mash them with the oil."),
      t("Suelta el puré con un poco del agua de cocción hasta que quede suave.", "Loosen with a little cooking water until smooth."),
    ],
  },
  {
    id: "pescado-horno-calabacin",
    name: t("Pescado blanco al horno con calabacín", "Baked white fish with zucchini"),
    minutes: 30,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pescado", "1 filete", "1 fillet"),
      ing("calabacin", "1", "1"),
      ing("limon", "unas gotas", "a few drops", true),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
    steps: [
      t("Pon el filete y el calabacín en rodajas en una bandeja con el aceite.", "Place the fillet and sliced zucchini on a tray with the oil."),
      t("Hornea a temperatura media hasta que el pescado se separe en láminas.", "Bake at medium heat until the fish flakes."),
      t("Revisa que no queden espinas antes de servir.", "Check for bones before serving."),
    ],
    tip: t("Desmenuza el pescado con un tenedor para el más pequeño.", "Flake the fish with a fork for the littlest one."),
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
    steps: [
      t("Desmenuza el pescado y mézclalo con la papa machacada y el huevo.", "Flake the fish and mix with the mashed potato and egg."),
      t("Forma bolitas pequeñas.", "Shape small bites."),
      t("Hornéalas con un toque de aceite hasta que doren.", "Bake with a touch of oil until golden."),
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
    steps: [
      t("Cuece el brócoli al vapor hasta que esté blando.", "Steam the broccoli until soft."),
      t("Machaca el aguacate con un tenedor.", "Mash the avocado with a fork."),
      t("Sirve el brócoli con el aguacate por encima.", "Serve the broccoli with the avocado on top."),
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
    steps: [
      t("Corta las zanahorias en tiras del tamaño de un dedo.", "Cut the carrots into finger-sized sticks."),
      t("Mézclalas con el aceite en una bandeja.", "Toss them with the oil on a tray."),
      t("Hornea hasta que estén blandas y con los bordes dorados.", "Roast until soft with golden edges."),
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
    steps: [
      t("Cuece la zanahoria y la papa en trozos en el agua hasta que estén muy blandas.", "Cook the carrot and potato in pieces in the water until very soft."),
      t("Licúa con parte del caldo hasta que quede lisa.", "Blend with some of the broth until smooth."),
      t("Sirve tibia con un chorrito de aceite.", "Serve warm with a drizzle of oil."),
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
    steps: [
      t("Cuece el calabacín y la papa en trozos en el agua.", "Cook the zucchini and potato in pieces in the water."),
      t("Licúa hasta que quede lisa.", "Blend until smooth."),
      t("Deja entibiar un poco antes de servir.", "Let it cool a little before serving."),
    ],
  },
  {
    id: "arroz-huevo-zanahoria",
    name: t("Arroz salteado con huevo y zanahoria", "Fried rice with egg and carrot"),
    minutes: 20,
    cost: "low",
    texture: "chopped",
    ingredients: [
      ing("arroz", "2 tazas cocido", "2 cups, cooked"),
      ing("huevos", "2", "2"),
      ing("zanahoria", "1 rallada", "1, grated"),
      ing("aceite", "1 cucharada", "1 tablespoon"),
    ],
    steps: [
      t("Sofríe la zanahoria rallada en el aceite.", "Sauté the grated carrot in the oil."),
      t("Agrega los huevos batidos y revuelve hasta que cuajen.", "Add the beaten eggs and stir until set."),
      t("Suma el arroz cocido y mezcla hasta que se caliente.", "Add the cooked rice and stir until warm."),
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
    steps: [
      t("Machaca el banano y mézclalo con la avena y el huevo.", "Mash the banana and mix with the oats and egg."),
      t("Calienta una sartén antiaderente.", "Heat a non-stick pan."),
      t("Cocina cucharadas de masa por ambos lados hasta que doren.", "Cook spoonfuls of batter on both sides until golden."),
    ],
  },
  {
    id: "yogurt-fresas",
    name: t("Yogurt con fresas picadas", "Yogurt with chopped strawberries"),
    minutes: 5,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("yogurt", "1 vaso", "1 cup"),
      ing("fresas", "4", "4"),
    ],
    steps: [
      t("Lava las fresas y pícalas en trozos pequeños.", "Wash the strawberries and chop them small."),
      t("Sírvelas sobre el yogurt.", "Serve them over the yogurt."),
    ],
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
    steps: [
      t("Pela el kiwi y córtalo en cubitos.", "Peel the kiwi and cut it into small cubes."),
      t("Mézclalo con el yogurt y espolvorea la avena.", "Mix it into the yogurt and sprinkle the oats."),
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
    steps: [
      t("Pon todo en la licuadora.", "Put everything in the blender."),
      t("Licúa hasta que quede liso y sirve enseguida.", "Blend until smooth and serve right away."),
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
    steps: [
      t("Pela las peras y córtalas en trozos.", "Peel the pears and cut into pieces."),
      t("Cocínalas tapadas con el agua hasta que estén muy blandas.", "Cook covered with the water until very soft."),
      t("Macháchalas o licúalas y sirve tibia o fría.", "Mash or blend and serve warm or cold."),
    ],
  },
  {
    id: "ensalada-kiwi-uvas",
    name: t("Ensalada de kiwi y uvas partidas", "Kiwi and halved grape salad"),
    minutes: 10,
    cost: "mid",
    texture: "chopped",
    ingredients: [
      ing("kiwi", "2", "2"),
      ing("uvas", "1 taza", "1 cup"),
    ],
    steps: [
      t("Parte cada uva a lo largo, en cuartos si el niño es pequeño.", "Cut each grape lengthwise, into quarters for a small child."),
      t("Pela el kiwi y córtalo en cubitos.", "Peel the kiwi and cut into small cubes."),
      t("Mezcla y sirve fría.", "Mix and serve cold."),
    ],
    tip: t("Las uvas enteras se atragantan fácil: siempre partidas.", "Whole grapes are easy to choke on: always cut."),
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
    steps: [
      t("Cuece las lentejas hasta que estén casi blandas.", "Cook the lentils until almost soft."),
      t("Sofríe el tomate y la zanahoria en el aceite y súmalos.", "Sauté the tomato and carrot in the oil and add them."),
      t("Agrega el arroz y más agua; cocina tapado hasta que todo esté blando.", "Add the rice and more water; cook covered until all is soft."),
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
    steps: [
      t("Rallar o picar fino el tomate y sofreírlo en el aceite.", "Grate or finely chop the tomato and cook it in the oil."),
      t("Añade los garbanzos y cocina diez minutos.", "Add the chickpeas and cook for ten minutes."),
      t("Machaca algunos garbanzos para que la salsa espese.", "Mash a few chickpeas to thicken the sauce."),
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
    steps: [
      t("Cocina el arroz hasta que esté blando.", "Cook the rice until soft."),
      t("Calienta los frijoles, machacando una parte.", "Heat the beans, mashing some of them."),
      t("Sirve juntos, con la zanahoria rallada si hay.", "Serve together, with grated carrot if you have it."),
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
    steps: [
      t("Mezcla el pollo, la zanahoria, el huevo y la avena.", "Mix the chicken, carrot, egg and oats."),
      t("Forma bolitas pequeñas con las manos húmedas.", "Shape small balls with wet hands."),
      t("Hornéalas hasta que estén bien cocidas por dentro.", "Bake until cooked through."),
    ],
  },
  {
    id: "arepa-tomate-queso",
    name: t("Arepa con tomate y queso fresco", "Arepa with tomato and fresh cheese"),
    minutes: 15,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("arepa", "1 pequeña", "1 small"),
      ing("tomate", "½ en rodajas finas", "½, thinly sliced"),
      ing("queso", "1 lonja", "1 slice"),
    ],
    steps: [
      t("Calienta la arepa.", "Warm the arepa."),
      t("Ábrela y pon el queso para que se tibie.", "Open it and add the cheese so it warms."),
      t("Agrega el tomate y sirve en trozos.", "Add the tomato and serve in pieces."),
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
    steps: [
      t("Cuece la pasta y, en los últimos minutos, el brócoli en la misma olla.", "Cook the pasta and, for the last minutes, the broccoli in the same pot."),
      t("Haz una salsa sofriendo el tomate picado en el aceite.", "Make a sauce by cooking the chopped tomato in the oil."),
      t("Mezcla todo y sirve.", "Mix it all and serve."),
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
    steps: [
      t("Machaca el aguacate con un tenedor.", "Mash the avocado with a fork."),
      t("Unta cada tostada con una capa fina.", "Spread a thin layer on each rice cake."),
    ],
    tip: t("Sirve las tostadas justo antes de comer para que sigan crujientes.", "Serve right before eating so they stay crisp."),
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
    steps: [
      t("Sofríe el calabacín y el tomate en el aceite un par de minutos.", "Cook the zucchini and tomato in the oil for a couple of minutes."),
      t("Vierte los huevos batidos encima.", "Pour the beaten eggs over them."),
      t("Cuaja por un lado, dobla y sirve en trozos.", "Set on one side, fold and serve in pieces."),
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
    steps: [
      t("Desmecha el pollo cocido en hebras finas.", "Shred the cooked chicken into fine strands."),
      t("Rellena el pan con el pollo y el tomate.", "Fill the bread with the chicken and tomato."),
      t("Corta en cuadritos para llevar.", "Cut into small squares for the road."),
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
    steps: [
      t("Pela la batata y córtala en cubos.", "Peel the sweet potato and cut into cubes."),
      t("Mézclala con el aceite en una bandeja.", "Toss with the oil on a tray."),
      t("Hornea hasta que esté blanda por dentro.", "Roast until soft inside."),
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
    steps: [
      t("Corta el tomate y el aguacate en cubos pequeños.", "Cut the tomato and avocado into small cubes."),
      t("Mezcla con cuidado y sirve enseguida.", "Mix gently and serve right away."),
    ],
  },
  {
    id: "sopa-pollo-papa",
    name: t("Sopa de pollo con papa y zanahoria", "Chicken soup with potato and carrot"),
    minutes: 45,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pollo", "1 pechuga", "1 breast"),
      ing("papa", "2", "2"),
      ing("zanahoria", "2", "2"),
      ing("agua", "5 tazas", "5 cups"),
    ],
    steps: [
      t("Pon el pollo a cocer en el agua.", "Set the chicken to cook in the water."),
      t("Agrega la papa y la zanahoria en cubos.", "Add the potato and carrot in cubes."),
      t("Cuando todo esté blando, desmecha el pollo y sirve.", "When everything is soft, shred the chicken and serve."),
    ],
  },
  {
    id: "pescado-arroz-brocoli",
    name: t("Pescado blanco con arroz y brócoli", "White fish with rice and broccoli"),
    minutes: 30,
    cost: "mid",
    texture: "soft",
    ingredients: [
      ing("pescado", "1 filete", "1 fillet"),
      ing("arroz", "1 taza cocido", "1 cup, cooked"),
      ing("brocoli", "1 taza", "1 cup"),
    ],
    steps: [
      t("Cuece el pescado al vapor o al horno hasta que se separe en láminas.", "Steam or bake the fish until it flakes."),
      t("Cuece el brócoli hasta que esté blando.", "Cook the broccoli until soft."),
      t("Sirve el pescado desmenuzado sobre el arroz, con el brócoli al lado.", "Serve the flaked fish over the rice, with the broccoli on the side."),
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
    steps: [
      t("Machaca los bananos y mézclalos con la avena.", "Mash the bananas and mix with the oats."),
      t("Extiende la masa en un molde pequeño.", "Spread the mixture in a small pan."),
      t("Hornea hasta que firme y corta en barritas.", "Bake until firm and cut into bars."),
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
    steps: [
      t("Cuece las lentejas y la papa hasta que estén muy blandas.", "Cook the lentils and potato until very soft."),
      t("Macháchalas juntas con el aceite.", "Mash them together with the oil."),
      t("Sirve tibio, solo o como relleno de una arepa.", "Serve warm, alone or as an arepa filling."),
    ],
  },
  {
    id: "calabacin-arroz-queso",
    name: t("Arroz con calabacín y queso fresco", "Rice with zucchini and fresh cheese"),
    minutes: 25,
    cost: "low",
    texture: "soft",
    ingredients: [
      ing("arroz", "1 taza cocido", "1 cup, cooked"),
      ing("calabacin", "1 rallado", "1, grated"),
      ing("queso", "2 cucharadas desmenuzado", "2 tablespoons, crumbled"),
      ing("aceite", "1 cucharadita", "1 teaspoon"),
    ],
    steps: [
      t("Sofríe el calabacín rallado en el aceite.", "Sauté the grated zucchini in the oil."),
      t("Mezcla con el arroz cocido hasta que se caliente.", "Mix in the cooked rice until warm."),
      t("Apaga y añade el queso desmenuzado.", "Turn off and add the crumbled cheese."),
    ],
  },
];
