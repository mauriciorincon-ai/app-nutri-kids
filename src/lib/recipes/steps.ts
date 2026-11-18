import type { LocalizedText } from "@/lib/diet/schema";

/**
 * Los pasos y el consejo de cada receta del recetario (S11 · ADR-017), aparte de `book.ts` a
 * propósito: la lista de recetas no los necesita y se piden solo al abrir una receta, para que la
 * pantalla no cargue lo que nadie ha abierto. Escritos en español y en inglés por separado.
 */
export type RecipeSteps = { steps: LocalizedText[]; tip?: LocalizedText };

export const STEPS: Readonly<Record<string, RecipeSteps>> = {
  "huevos-espinaca": {
    steps: [
      {
        es: "Bate los huevos en un plato.",
        en: "Beat the eggs in a bowl.",
      },
      {
        es: "Calienta el aceite y sofríe la espinaca un minuto.",
        en: "Warm the oil and cook the spinach for a minute.",
      },
      {
        es: "Agrega los huevos y revuelve a fuego bajo hasta que cuajen.",
        en: "Pour in the eggs and stir on low heat until set.",
      },
    ],
  },
  "avena-canela": {
    steps: [
      {
        es: "Pon la avena y el agua en una olla.",
        en: "Put the oats and water in a pot.",
      },
      {
        es: "Cocina a fuego bajo, revolviendo, hasta que espese.",
        en: "Cook on low heat, stirring, until thick.",
      },
      {
        es: "Sirve tibia con la canela por encima.",
        en: "Serve warm with cinnamon on top.",
      },
    ],
  },
  "avena-pera": {
    steps: [
      {
        es: "Cocina la avena con el agua a fuego bajo.",
        en: "Cook the oats with the water on low heat.",
      },
      {
        es: "Cuando espese, mezcla la pera rallada.",
        en: "When thick, stir in the grated pear.",
      },
      {
        es: "Apaga, deja reposar un minuto y sirve.",
        en: "Turn off, let it rest a minute and serve.",
      },
    ],
  },
  "tortilla-papa": {
    steps: [
      {
        es: "Cuece la papa en cubos pequeños hasta que esté blanda.",
        en: "Boil the potato in small cubes until soft.",
      },
      {
        es: "Mézclala con los huevos batidos.",
        en: "Mix it with the beaten eggs.",
      },
      {
        es: "Cuaja la mezcla en una sartén con el aceite, por los dos lados.",
        en: "Set the mixture in a pan with the oil, on both sides.",
      },
    ],
  },
  "pollo-plancha-verduras": {
    steps: [
      {
        es: "Corta el pollo y las verduras en trozos pequeños.",
        en: "Cut the chicken and vegetables into small pieces.",
      },
      {
        es: "Dora el pollo en la plancha con el aceite hasta que esté bien cocido por dentro.",
        en: "Brown the chicken on the griddle with the oil until cooked through.",
      },
      {
        es: "Saltea las verduras a un lado y sirve todo junto.",
        en: "Sauté the vegetables on the side and serve together.",
      },
    ],
  },
  "arroz-pollo": {
    steps: [
      {
        es: "Sofríe el pollo en el aceite hasta que cambie de color.",
        en: "Cook the chicken in the oil until it changes color.",
      },
      {
        es: "Añade el arroz, la zanahoria y el agua.",
        en: "Add the rice, carrot and water.",
      },
      {
        es: "Tapa y cocina a fuego bajo hasta que el arroz esté blando.",
        en: "Cover and cook on low heat until the rice is soft.",
      },
    ],
  },
  "sopa-lentejas": {
    steps: [
      {
        es: "Lava las lentejas y ponlas a cocer con el agua.",
        en: "Rinse the lentils and set them to cook in the water.",
      },
      {
        es: "Agrega la zanahoria, la papa y el tomate en trozos.",
        en: "Add the carrot, potato and tomato in pieces.",
      },
      {
        es: "Cocina hasta que todo esté blando y sirve en un plato hondo.",
        en: "Cook until everything is soft and serve in a deep bowl.",
      },
    ],
  },
  "pure-papa": {
    steps: [
      {
        es: "Cuece las papas peladas hasta que se deshagan con el tenedor.",
        en: "Boil the peeled potatoes until they fall apart with a fork.",
      },
      {
        es: "Macháchalas con el aceite.",
        en: "Mash them with the oil.",
      },
      {
        es: "Suelta el puré con un poco del agua de cocción hasta que quede suave.",
        en: "Loosen with a little cooking water until smooth.",
      },
    ],
  },
  "pescado-horno-calabacin": {
    steps: [
      {
        es: "Pon el filete y el calabacín en rodajas en una bandeja con el aceite.",
        en: "Place the fillet and sliced zucchini on a tray with the oil.",
      },
      {
        es: "Hornea a temperatura media hasta que el pescado se separe en láminas.",
        en: "Bake at medium heat until the fish flakes.",
      },
      {
        es: "Revisa que no queden espinas antes de servir.",
        en: "Check for bones before serving.",
      },
    ],
    tip: {
      es: "Desmenuza el pescado con un tenedor para el más pequeño.",
      en: "Flake the fish with a fork for the littlest one.",
    },
  },
  "bolitas-pescado-papa": {
    steps: [
      {
        es: "Desmenuza el pescado y mézclalo con la papa machacada y el huevo.",
        en: "Flake the fish and mix with the mashed potato and egg.",
      },
      {
        es: "Forma bolitas pequeñas.",
        en: "Shape small bites.",
      },
      {
        es: "Hornéalas con un toque de aceite hasta que doren.",
        en: "Bake with a touch of oil until golden.",
      },
    ],
  },
  "brocoli-aguacate": {
    steps: [
      {
        es: "Cuece el brócoli al vapor hasta que esté blando.",
        en: "Steam the broccoli until soft.",
      },
      {
        es: "Machaca el aguacate con un tenedor.",
        en: "Mash the avocado with a fork.",
      },
      {
        es: "Sirve el brócoli con el aguacate por encima.",
        en: "Serve the broccoli with the avocado on top.",
      },
    ],
  },
  "zanahoria-asada": {
    steps: [
      {
        es: "Corta las zanahorias en tiras del tamaño de un dedo.",
        en: "Cut the carrots into finger-sized sticks.",
      },
      {
        es: "Mézclalas con el aceite en una bandeja.",
        en: "Toss them with the oil on a tray.",
      },
      {
        es: "Hornea hasta que estén blandas y con los bordes dorados.",
        en: "Roast until soft with golden edges.",
      },
    ],
  },
  "crema-zanahoria": {
    steps: [
      {
        es: "Cuece la zanahoria y la papa en trozos en el agua hasta que estén muy blandas.",
        en: "Cook the carrot and potato in pieces in the water until very soft.",
      },
      {
        es: "Licúa con parte del caldo hasta que quede lisa.",
        en: "Blend with some of the broth until smooth.",
      },
      {
        es: "Sirve tibia con un chorrito de aceite.",
        en: "Serve warm with a drizzle of oil.",
      },
    ],
  },
  "crema-calabacin": {
    steps: [
      {
        es: "Cuece el calabacín y la papa en trozos en el agua.",
        en: "Cook the zucchini and potato in pieces in the water.",
      },
      {
        es: "Licúa hasta que quede lisa.",
        en: "Blend until smooth.",
      },
      {
        es: "Deja entibiar un poco antes de servir.",
        en: "Let it cool a little before serving.",
      },
    ],
  },
  "arroz-huevo-zanahoria": {
    steps: [
      {
        es: "Sofríe la zanahoria rallada en el aceite.",
        en: "Sauté the grated carrot in the oil.",
      },
      {
        es: "Agrega los huevos batidos y revuelve hasta que cuajen.",
        en: "Add the beaten eggs and stir until set.",
      },
      {
        es: "Suma el arroz cocido y mezcla hasta que se caliente.",
        en: "Add the cooked rice and stir until warm.",
      },
    ],
  },
  "tortitas-banano-avena": {
    steps: [
      {
        es: "Machaca el banano y mézclalo con la avena y el huevo.",
        en: "Mash the banana and mix with the oats and egg.",
      },
      {
        es: "Calienta una sartén antiaderente.",
        en: "Heat a non-stick pan.",
      },
      {
        es: "Cocina cucharadas de masa por ambos lados hasta que doren.",
        en: "Cook spoonfuls of batter on both sides until golden.",
      },
    ],
  },
  "yogurt-fresas": {
    steps: [
      {
        es: "Lava las fresas y pícalas en trozos pequeños.",
        en: "Wash the strawberries and chop them small.",
      },
      {
        es: "Sírvelas sobre el yogurt.",
        en: "Serve them over the yogurt.",
      },
    ],
  },
  "yogurt-kiwi-avena": {
    steps: [
      {
        es: "Pela el kiwi y córtalo en cubitos.",
        en: "Peel the kiwi and cut it into small cubes.",
      },
      {
        es: "Mézclalo con el yogurt y espolvorea la avena.",
        en: "Mix it into the yogurt and sprinkle the oats.",
      },
    ],
  },
  "batido-fresa-banano": {
    steps: [
      {
        es: "Pon todo en la licuadora.",
        en: "Put everything in the blender.",
      },
      {
        es: "Licúa hasta que quede liso y sirve enseguida.",
        en: "Blend until smooth and serve right away.",
      },
    ],
  },
  "compota-pera": {
    steps: [
      {
        es: "Pela las peras y córtalas en trozos.",
        en: "Peel the pears and cut into pieces.",
      },
      {
        es: "Cocínalas tapadas con el agua hasta que estén muy blandas.",
        en: "Cook covered with the water until very soft.",
      },
      {
        es: "Macháchalas o licúalas y sirve tibia o fría.",
        en: "Mash or blend and serve warm or cold.",
      },
    ],
  },
  "ensalada-kiwi-uvas": {
    steps: [
      {
        es: "Parte cada uva a lo largo, en cuartos si el niño es pequeño.",
        en: "Cut each grape lengthwise, into quarters for a small child.",
      },
      {
        es: "Pela el kiwi y córtalo en cubitos.",
        en: "Peel the kiwi and cut into small cubes.",
      },
      {
        es: "Mezcla y sirve fría.",
        en: "Mix and serve cold.",
      },
    ],
    tip: {
      es: "Las uvas enteras se atragantan fácil: siempre partidas.",
      en: "Whole grapes are easy to choke on: always cut.",
    },
  },
  "arroz-lentejas": {
    steps: [
      {
        es: "Cuece las lentejas hasta que estén casi blandas.",
        en: "Cook the lentils until almost soft.",
      },
      {
        es: "Sofríe el tomate y la zanahoria en el aceite y súmalos.",
        en: "Sauté the tomato and carrot in the oil and add them.",
      },
      {
        es: "Agrega el arroz y más agua; cocina tapado hasta que todo esté blando.",
        en: "Add the rice and more water; cook covered until all is soft.",
      },
    ],
  },
  "garbanzos-tomate": {
    steps: [
      {
        es: "Rallar o picar fino el tomate y sofreírlo en el aceite.",
        en: "Grate or finely chop the tomato and cook it in the oil.",
      },
      {
        es: "Añade los garbanzos y cocina diez minutos.",
        en: "Add the chickpeas and cook for ten minutes.",
      },
      {
        es: "Machaca algunos garbanzos para que la salsa espese.",
        en: "Mash a few chickpeas to thicken the sauce.",
      },
    ],
  },
  "frijoles-arroz": {
    steps: [
      {
        es: "Cocina el arroz hasta que esté blando.",
        en: "Cook the rice until soft.",
      },
      {
        es: "Calienta los frijoles, machacando una parte.",
        en: "Heat the beans, mashing some of them.",
      },
      {
        es: "Sirve juntos, con la zanahoria rallada si hay.",
        en: "Serve together, with grated carrot if you have it.",
      },
    ],
  },
  "albondigas-pollo": {
    steps: [
      {
        es: "Mezcla el pollo, la zanahoria, el huevo y la avena.",
        en: "Mix the chicken, carrot, egg and oats.",
      },
      {
        es: "Forma bolitas pequeñas con las manos húmedas.",
        en: "Shape small balls with wet hands.",
      },
      {
        es: "Hornéalas hasta que estén bien cocidas por dentro.",
        en: "Bake until cooked through.",
      },
    ],
  },
  "arepa-tomate-queso": {
    steps: [
      {
        es: "Calienta la arepa.",
        en: "Warm the arepa.",
      },
      {
        es: "Ábrela y pon el queso para que se tibie.",
        en: "Open it and add the cheese so it warms.",
      },
      {
        es: "Agrega el tomate y sirve en trozos.",
        en: "Add the tomato and serve in pieces.",
      },
    ],
  },
  "pasta-tomate-brocoli": {
    steps: [
      {
        es: "Cuece la pasta y, en los últimos minutos, el brócoli en la misma olla.",
        en: "Cook the pasta and, for the last minutes, the broccoli in the same pot.",
      },
      {
        es: "Haz una salsa sofriendo el tomate picado en el aceite.",
        en: "Make a sauce by cooking the chopped tomato in the oil.",
      },
      {
        es: "Mezcla todo y sirve.",
        en: "Mix it all and serve.",
      },
    ],
  },
  "tostadas-aguacate": {
    steps: [
      {
        es: "Machaca el aguacate con un tenedor.",
        en: "Mash the avocado with a fork.",
      },
      {
        es: "Unta cada tostada con una capa fina.",
        en: "Spread a thin layer on each rice cake.",
      },
    ],
    tip: {
      es: "Sirve las tostadas justo antes de comer para que sigan crujientes.",
      en: "Serve right before eating so they stay crisp.",
    },
  },
  "omelette-tomate-calabacin": {
    steps: [
      {
        es: "Sofríe el calabacín y el tomate en el aceite un par de minutos.",
        en: "Cook the zucchini and tomato in the oil for a couple of minutes.",
      },
      {
        es: "Vierte los huevos batidos encima.",
        en: "Pour the beaten eggs over them.",
      },
      {
        es: "Cuaja por un lado, dobla y sirve en trozos.",
        en: "Set on one side, fold and serve in pieces.",
      },
    ],
  },
  "pan-pollo": {
    steps: [
      {
        es: "Desmecha el pollo cocido en hebras finas.",
        en: "Shred the cooked chicken into fine strands.",
      },
      {
        es: "Rellena el pan con el pollo y el tomate.",
        en: "Fill the bread with the chicken and tomato.",
      },
      {
        es: "Corta en cuadritos para llevar.",
        en: "Cut into small squares for the road.",
      },
    ],
  },
  "batata-asada": {
    steps: [
      {
        es: "Pela la batata y córtala en cubos.",
        en: "Peel the sweet potato and cut into cubes.",
      },
      {
        es: "Mézclala con el aceite en una bandeja.",
        en: "Toss with the oil on a tray.",
      },
      {
        es: "Hornea hasta que esté blanda por dentro.",
        en: "Roast until soft inside.",
      },
    ],
  },
  "ensalada-tomate-aguacate": {
    steps: [
      {
        es: "Corta el tomate y el aguacate en cubos pequeños.",
        en: "Cut the tomato and avocado into small cubes.",
      },
      {
        es: "Mezcla con cuidado y sirve enseguida.",
        en: "Mix gently and serve right away.",
      },
    ],
  },
  "sopa-pollo-papa": {
    steps: [
      {
        es: "Pon el pollo a cocer en el agua.",
        en: "Set the chicken to cook in the water.",
      },
      {
        es: "Agrega la papa y la zanahoria en cubos.",
        en: "Add the potato and carrot in cubes.",
      },
      {
        es: "Cuando todo esté blando, desmecha el pollo y sirve.",
        en: "When everything is soft, shred the chicken and serve.",
      },
    ],
  },
  "pescado-arroz-brocoli": {
    steps: [
      {
        es: "Cuece el pescado al vapor o al horno hasta que se separe en láminas.",
        en: "Steam or bake the fish until it flakes.",
      },
      {
        es: "Cuece el brócoli hasta que esté blando.",
        en: "Cook the broccoli until soft.",
      },
      {
        es: "Sirve el pescado desmenuzado sobre el arroz, con el brócoli al lado.",
        en: "Serve the flaked fish over the rice, with the broccoli on the side.",
      },
    ],
  },
  "barritas-avena-banano": {
    steps: [
      {
        es: "Machaca los bananos y mézclalos con la avena.",
        en: "Mash the bananas and mix with the oats.",
      },
      {
        es: "Extiende la masa en un molde pequeño.",
        en: "Spread the mixture in a small pan.",
      },
      {
        es: "Hornea hasta que firme y corta en barritas.",
        en: "Bake until firm and cut into bars.",
      },
    ],
  },
  "lentejas-papa-pure": {
    steps: [
      {
        es: "Cuece las lentejas y la papa hasta que estén muy blandas.",
        en: "Cook the lentils and potato until very soft.",
      },
      {
        es: "Macháchalas juntas con el aceite.",
        en: "Mash them together with the oil.",
      },
      {
        es: "Sirve tibio, solo o como relleno de una arepa.",
        en: "Serve warm, alone or as an arepa filling.",
      },
    ],
  },
  "calabacin-arroz-queso": {
    steps: [
      {
        es: "Sofríe el calabacín rallado en el aceite.",
        en: "Sauté the grated zucchini in the oil.",
      },
      {
        es: "Mezcla con el arroz cocido hasta que se caliente.",
        en: "Mix in the cooked rice until warm.",
      },
      {
        es: "Apaga y añade el queso desmenuzado.",
        en: "Turn off and add the crumbled cheese.",
      },
    ],
  },
};
