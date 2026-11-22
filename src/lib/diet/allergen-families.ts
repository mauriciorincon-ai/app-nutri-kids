/**
 * Familias de alérgenos (S12 · auditoría). Lo que quien cuida anota es texto libre («lactosa»,
 * «mariscos», «frutos secos») y lo que se mira puede ser un alimento con otro nombre u otro idioma
 * («queso», «shrimp», «walnut»). Cada familia dice qué palabras la activan y qué alimentos entran en
 * ella; todo en los dos idiomas. Ante la duda no se propone: se sobra, nunca se falta. No es un
 * consejo médico ni un diagnóstico: solo evita que la app ofrezca algo que choca con lo anotado.
 */
import { containsPhrase, toTokens } from "./search";

type Family = {
  /** Si lo anotado contiene alguna de estas palabras, la familia entera aplica. */
  triggers: readonly string[];
  /** Lo que la familia deja fuera (incluye los disparadores). */
  members: readonly string[];
};

const dairy = [
  "leche",
  "lácteo",
  "lacteo",
  "lactosa",
  "milk",
  "dairy",
  "lactose",
  "queso",
  "cheese",
  "yogur",
  "yogurt",
  "yoghurt",
  "kumis",
  "kéfir",
  "kefir",
  "mantequilla",
  "butter",
  "crema de leche",
  "cream",
  "nata",
  "requesón",
  "requeson",
  "helado",
  "ice cream",
  "suero",
  "whey",
  "caseína",
  "casein",
] as const;

const shellfish = [
  "marisco",
  "mariscos",
  "shellfish",
  "crustáceo",
  "crustaceo",
  "crustacean",
  "seafood",
  "camarón",
  "camaron",
  "langostino",
  "cangrejo",
  "langosta",
  "jaiba",
  "almeja",
  "mejillón",
  "mejillon",
  "ostra",
  "calamar",
  "pulpo",
  "vieira",
  "shrimp",
  "prawn",
  "crab",
  "lobster",
  "clam",
  "mussel",
  "oyster",
  "squid",
  "octopus",
  "crayfish",
  "scallop",
] as const;

const treeNuts = [
  "frutos secos",
  "nueces",
  "nuez",
  "nuts",
  "tree nuts",
  "nut",
  "almendra",
  "almond",
  "avellana",
  "hazelnut",
  "pistacho",
  "pistachio",
  "marañón",
  "maranon",
  "cashew",
  "pecana",
  "pecan",
  "macadamia",
  "walnut",
  "castaña",
  "chestnut",
  // En muchos hogares «frutos secos» incluye el maní: ante la duda, también.
  "maní",
  "mani",
  "cacahuate",
  "cacahuete",
  "peanut",
] as const;

const FAMILIES: readonly Family[] = [
  {
    triggers: [
      "leche",
      "lácteo",
      "lacteo",
      "lactosa",
      "milk",
      "dairy",
      "lactose",
    ],
    members: dairy,
  },
  {
    triggers: [
      "marisco",
      "mariscos",
      "shellfish",
      "crustáceo",
      "crustaceo",
      "crustacean",
      "seafood",
    ],
    members: shellfish,
  },
  {
    triggers: ["frutos secos", "nueces", "tree nuts", "nuts"],
    members: treeNuts,
  },
  {
    triggers: ["maní", "mani", "cacahuate", "cacahuete", "peanut"],
    members: ["maní", "mani", "cacahuate", "cacahuete", "peanut", "peanuts"],
  },
  {
    triggers: ["huevo", "egg"],
    members: ["huevo", "huevos", "egg", "eggs", "mayonesa", "mayonnaise"],
  },
  {
    triggers: ["pescado", "fish"],
    members: [
      "pescado",
      "fish",
      "salmón",
      "salmon",
      "atún",
      "atun",
      "tuna",
      "tilapia",
      "trucha",
      "trout",
      "bacalao",
      "cod",
      "sardina",
      "sardine",
      "merluza",
      "hake",
      "anchoa",
      "anchovy",
    ],
  },
  {
    triggers: ["gluten", "trigo", "wheat", "celiaquía", "celiaquia", "celiac"],
    members: [
      "gluten",
      "trigo",
      "wheat",
      "pan",
      "bread",
      "pasta",
      "harina",
      "flour",
      "cebada",
      "barley",
      "centeno",
      "rye",
      "galleta",
      "cookie",
      "tostada",
      "toast",
      "fideo",
      "noodle",
    ],
  },
  {
    triggers: ["soya", "soja", "soy"],
    members: ["soya", "soja", "soy", "tofu", "edamame"],
  },
];

const norm = (w: string) => ({
  es: toTokens(w, "es"),
  en: toTokens(w, "en"),
});

/** Cuántas veces se calcula una expansión distinta (se guarda: se llama por cada alimento mirado). */
const cache = new Map<string, string[]>();

/**
 * Lo anotado, más los miembros de cada familia que algo anotado active. Lo que ya estaba se conserva
 * tal cual: esto solo AGREGA nombres que evitar.
 */
export function expandAvoid(avoid: readonly string[]): string[] {
  const key = avoid.join("\u0001");
  const hit = cache.get(key);
  if (hit) return hit;
  const out = [...avoid];
  for (const family of FAMILIES) {
    const triggered = avoid.some((text) =>
      family.triggers.some((t) => {
        const need = norm(t);
        return (["es", "en"] as const).some((locale) => {
          const hay = toTokens(text, locale);
          return need[locale].length > 0 && containsPhrase(hay, need[locale]);
        });
      }),
    );
    if (triggered) out.push(...family.members);
  }
  if (cache.size > 50) cache.clear();
  cache.set(key, out);
  return out;
}
