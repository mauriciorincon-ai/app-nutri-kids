/**
 * Plantillas de cocina (S12 · ADR-018): seis maneras de cocinar con lo que hay —salteado, sopa,
 * tortilla, al horno, puré y arroz— para cuando NINGUNA receta del recetario sale con la despensa.
 * Código primero, sin IA: cada ranura se llena SOLO con ingredientes de la despensa que el plan deja
 * pasar (`ok` o `caution` según `resolveIngredient`), la receta resultante vuelve a pasar por
 * `reviewRecipe` y se descarta si sale bloqueada o con una textura que hoy no se acepta. Un rojo, una
 * alergia o una textura no aceptada no llegan jamás. Sin cantidades: «lo que tengas». Puro: la fecha
 * y todo lo anotado entran por parámetro.
 */
import type { LocalizedText, Texture } from "@/lib/diet/schema";
import { avoidList } from "@/lib/lunchbox/engine";

import type { Recipe, RecipeIngredient } from "./book";
import { INGREDIENTS, type IngredientId } from "./catalog";
import {
  resolveIngredient,
  reviewRecipe,
  type ReviewedRecipe,
  type ReviewInput,
} from "./review";

export const TEMPLATE_IDS = [
  "saute",
  "soup",
  "omelette",
  "baked",
  "mash",
  "rice",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

type Slot = {
  /** Qué ingredientes pueden llenarla, en orden de preferencia. */
  from: readonly IngredientId[];
  /** Cuántos ingredientes admite como mucho. */
  max: number;
  required: boolean;
};

const PROTEIN: IngredientId[] = [
  "pollo",
  "pescado",
  "huevos",
  "garbanzos",
  "frijoles",
  "lentejas",
];
const VEG: IngredientId[] = [
  "zanahoria",
  "brocoli",
  "calabacin",
  "espinaca",
  "tomate",
];

type Def = {
  id: TemplateId;
  minutes: number;
  texture: Texture;
  slots: { veg?: Slot; protein?: Slot; base?: Slot };
  /** Básicos de despensa que la receta lleva (también se revisan contra el plan). */
  staples: readonly IngredientId[];
  /** Cuántas ranuras tienen que llenarse como mínimo para que valga la pena. */
  minFilled: number;
  name: (n: Names) => LocalizedText;
  steps: (n: Names) => LocalizedText[];
};

/** Los nombres de lo que llenó cada ranura, ya unidos en cada idioma. */
type Names = {
  veg: LocalizedText;
  protein: LocalizedText;
  base: LocalizedText;
  all: LocalizedText;
  /** Lo que llenó proteína y verdura (sin la base). */
  rest: LocalizedText;
  has: { veg: boolean; protein: boolean; base: boolean };
};

const t = (es: string, en: string): LocalizedText => ({ es, en });

const DEFS: readonly Def[] = [
  {
    id: "saute",
    minutes: 15,
    texture: "chopped",
    slots: {
      veg: { from: VEG, max: 2, required: true },
      protein: {
        from: ["pollo", "pescado", "huevos", "garbanzos", "frijoles"],
        max: 1,
        required: false,
      },
      base: { from: ["arroz", "pasta"], max: 1, required: false },
    },
    staples: ["aceite"],
    minFilled: 2,
    name: (n) => t(`Salteado de ${n.all.es}`, `Stir-fry of ${n.all.en}`),
    steps: (n) => [
      t(
        `Lava y corta ${n.veg.es} en trozos pequeños${n.has.protein ? ` y ${n.protein.es} en tiras finas` : ""}.`,
        `Wash and cut ${n.veg.en} into small pieces${n.has.protein ? ` and ${n.protein.en} into thin strips` : ""}.`,
      ),
      t(
        "Calienta un poco de aceite en una sartén a fuego medio.",
        "Warm a little oil in a pan over medium heat.",
      ),
      t(
        n.has.protein
          ? "Cocina primero lo que lleva más tiempo y luego las verduras, moviendo seguido, hasta que todo esté tierno y bien cocido."
          : "Cocina las verduras moviendo seguido, hasta que estén tiernas.",
        n.has.protein
          ? "Cook the slower-cooking food first, then the vegetables, stirring often, until everything is tender and fully cooked."
          : "Cook the vegetables, stirring often, until they are tender.",
      ),
      ...(n.has.base
        ? [
            t(
              `Sirve sobre ${n.base.es} cocido aparte.`,
              `Serve over ${n.base.en} cooked separately.`,
            ),
          ]
        : []),
    ],
  },
  {
    id: "soup",
    minutes: 30,
    texture: "soft",
    slots: {
      veg: { from: VEG, max: 2, required: true },
      protein: {
        from: ["lentejas", "garbanzos", "frijoles", "pollo"],
        max: 1,
        required: false,
      },
      base: {
        from: ["papa", "batata", "arroz", "pasta"],
        max: 1,
        required: false,
      },
    },
    staples: ["agua"],
    minFilled: 2,
    name: (n) => t(`Sopa de ${n.all.es}`, `${cap(n.all.en)} soup`),
    steps: (n) => [
      t(
        `Lava y corta ${n.veg.es}${n.has.base ? ` y ${n.base.es}` : ""} en trozos pequeños.`,
        `Wash and cut ${n.veg.en}${n.has.base ? ` and ${n.base.en}` : ""} into small pieces.`,
      ),
      t(
        `Ponlos en una olla con agua${n.has.protein ? ` junto con ${n.protein.es} ya cocido` : ""} y cocina a fuego bajo hasta que todo esté blando.`,
        `Put them in a pot with water${n.has.protein ? ` together with ${n.protein.en} already cooked` : ""} and simmer until everything is soft.`,
      ),
      t(
        "Deja entibiar un poco antes de servir.",
        "Let it cool a little before serving.",
      ),
    ],
  },
  {
    id: "omelette",
    minutes: 10,
    texture: "soft",
    slots: {
      protein: { from: ["huevos"], max: 1, required: true },
      veg: { from: VEG, max: 2, required: false },
      base: { from: ["queso"], max: 1, required: false },
    },
    staples: ["aceite"],
    minFilled: 1,
    name: (n) =>
      n.has.veg
        ? t(`Tortilla de huevo con ${n.veg.es}`, `Omelette with ${n.veg.en}`)
        : t("Tortilla de huevo", "Plain omelette"),
    steps: (n) => [
      t("Bate los huevos en un plato.", "Beat the eggs in a bowl."),
      ...(n.has.veg
        ? [
            t(
              `Pica ${n.veg.es} bien fino y sofríelo un minuto en un poco de aceite.`,
              `Chop ${n.veg.en} very fine and cook it for a minute in a little oil.`,
            ),
          ]
        : [
            t(
              "Calienta un poco de aceite en la sartén.",
              "Warm a little oil in the pan.",
            ),
          ]),
      t(
        `Vierte los huevos${n.has.base ? `, agrega ${n.base.es} en trocitos` : ""} y cocina a fuego bajo hasta que cuajen por completo.`,
        `Pour in the eggs${n.has.base ? `, add ${n.base.en} in small pieces` : ""} and cook on low heat until fully set.`,
      ),
    ],
  },
  {
    id: "baked",
    minutes: 35,
    texture: "soft",
    slots: {
      protein: { from: ["pollo", "pescado"], max: 1, required: true },
      veg: {
        from: ["papa", "batata", "zanahoria", "brocoli", "calabacin", "tomate"],
        max: 2,
        required: true,
      },
    },
    staples: ["aceite"],
    minFilled: 2,
    name: (n) =>
      t(
        `${cap(n.protein.es)} al horno con ${n.veg.es}`,
        `Baked ${n.protein.en} with ${n.veg.en}`,
      ),
    steps: (n) => [
      t("Calienta el horno a temperatura media.", "Heat the oven to medium."),
      t(
        `Corta ${n.veg.es} en trozos del mismo tamaño y ponlos en una bandeja con un poco de aceite.`,
        `Cut ${n.veg.en} into equal pieces and put them on a tray with a little oil.`,
      ),
      t(
        `Agrega ${n.protein.es} y hornea hasta que todo esté tierno y ${n.protein.es} bien cocido por dentro.`,
        `Add ${n.protein.en} and bake until everything is tender and the ${n.protein.en} is fully cooked inside.`,
      ),
    ],
  },
  {
    id: "mash",
    minutes: 25,
    texture: "mashed",
    slots: {
      base: { from: ["papa", "batata"], max: 1, required: true },
      veg: {
        from: ["zanahoria", "brocoli", "calabacin", "espinaca"],
        max: 1,
        required: false,
      },
    },
    staples: ["agua"],
    minFilled: 1,
    name: (n) =>
      n.has.veg
        ? t(
            `Puré de ${n.base.es} con ${n.veg.es}`,
            `${cap(n.base.en)} and ${n.veg.en} mash`,
          )
        : t(`Puré de ${n.base.es}`, `${cap(n.base.en)} mash`),
    steps: (n) => [
      t(
        `Pela y corta ${n.base.es}${n.has.veg ? ` y ${n.veg.es}` : ""} en trozos.`,
        `Peel and cut ${n.base.en}${n.has.veg ? ` and ${n.veg.en}` : ""} into pieces.`,
      ),
      t(
        "Cocínalos en agua hasta que se deshagan al pincharlos con un tenedor.",
        "Cook them in water until they fall apart when pierced with a fork.",
      ),
      t(
        "Escurre y machaca con un tenedor hasta que quede suave; si hace falta, agrega un poco del agua de la cocción.",
        "Drain and mash with a fork until smooth; if needed, add a little of the cooking water.",
      ),
    ],
  },
  {
    id: "rice",
    minutes: 30,
    texture: "soft",
    slots: {
      base: { from: ["arroz"], max: 1, required: true },
      protein: { from: PROTEIN, max: 1, required: false },
      veg: { from: VEG, max: 2, required: false },
    },
    staples: ["aceite", "agua"],
    minFilled: 2,
    name: (n) => t(`Arroz con ${n.rest.es}`, `Rice with ${n.rest.en}`),
    steps: (n) => [
      t(
        `Pica ${n.rest.es} en trozos pequeños.`,
        `Chop ${n.rest.en} into small pieces.`,
      ),
      t(
        "Sofríe un poco en aceite, agrega el arroz y revuelve un minuto.",
        "Cook it briefly in a little oil, add the rice and stir for a minute.",
      ),
      t(
        "Cubre con agua y cocina tapado a fuego bajo hasta que el arroz esté blando y todo bien cocido.",
        "Cover with water and cook, lidded, on low heat until the rice is soft and everything is fully cooked.",
      ),
    ],
  },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function join(list: string[], and: string): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} ${and} ${list[list.length - 1]}`;
}

function namesOf(picked: {
  veg: IngredientId[];
  protein: IngredientId[];
  base: IngredientId[];
}): Names {
  const mk = (ids: IngredientId[]) =>
    t(
      join(
        ids.map((i) => INGREDIENTS[i].es),
        "y",
      ),
      join(
        ids.map((i) => INGREDIENTS[i].en),
        "and",
      ),
    );
  const all = [...picked.protein, ...picked.veg, ...picked.base];
  return {
    veg: mk(picked.veg),
    protein: mk(picked.protein),
    base: mk(picked.base),
    all: mk(all),
    rest: mk([...picked.protein, ...picked.veg]),
    has: {
      veg: picked.veg.length > 0,
      protein: picked.protein.length > 0,
      base: picked.base.length > 0,
    },
  };
}

export type TemplateRecipe = {
  template: TemplateId;
  reviewed: ReviewedRecipe;
  steps: LocalizedText[];
};

/**
 * Una receta por plantilla posible con lo que la despensa trae y el plan deja pasar. Vacío si nada
 * alcanza. Cada resultado ya fue revisado: jamás sale bloqueado ni con una textura que hoy no se
 * acepta (no se «marca»: se descarta, porque aquí no hay nada que el plan no haya validado antes).
 */
export function templateRecipes(
  pantry: ReadonlySet<IngredientId>,
  input: ReviewInput,
): TemplateRecipe[] {
  const avoid = avoidList(input.diet, input.notes);
  const usable = new Map<IngredientId, boolean>();
  const canUse = (id: IngredientId): boolean => {
    let ok = usable.get(id);
    if (ok === undefined) {
      const s = resolveIngredient(
        input.diet,
        INGREDIENTS[id],
        input.now,
        avoid,
      );
      ok = s.kind === "ok" || s.kind === "caution";
      usable.set(id, ok);
    }
    return ok;
  };
  const accepted = input.accepted ?? [];
  const out: TemplateRecipe[] = [];

  for (const def of DEFS) {
    if (accepted.length > 0 && !accepted.includes(def.texture)) continue;
    const picked = { veg: [], protein: [], base: [] } as Record<
      "veg" | "protein" | "base",
      IngredientId[]
    >;
    const taken = new Set<IngredientId>();
    let missingRequired = false;
    let filled = 0;
    for (const key of ["protein", "base", "veg"] as const) {
      const slot = def.slots[key];
      if (!slot) continue;
      for (const id of slot.from) {
        if (picked[key].length >= slot.max) break;
        if (!pantry.has(id) || taken.has(id) || !canUse(id)) continue;
        picked[key].push(id);
        taken.add(id);
      }
      if (picked[key].length > 0) filled++;
      else if (slot.required) missingRequired = true;
    }
    if (missingRequired || filled < def.minFilled) continue;
    if (!def.staples.every((id) => canUse(id))) continue;

    const names = namesOf(picked);
    const ids = [...picked.protein, ...picked.base, ...picked.veg];
    const ingredients: RecipeIngredient[] = [
      ...ids.map((id) => ({ id, qty: t("lo que tengas", "what you have") })),
      ...def.staples.map((id) => ({ id, qty: t("un poco", "a little") })),
    ];
    const recipe: Recipe = {
      id: `tpl-${def.id}-${ids.join("-")}`,
      name: def.name(names),
      minutes: def.minutes,
      cost: "low",
      texture: def.texture,
      ingredients,
    };
    const reviewed = reviewRecipe(recipe, input);
    if (reviewed.state === "blocked" || reviewed.state === "unknown") continue;
    if (reviewed.textureNotAccepted) continue;
    out.push({ template: def.id, reviewed, steps: def.steps(names) });
  }
  return out;
}
