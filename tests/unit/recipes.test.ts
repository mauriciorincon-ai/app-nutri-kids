import { describe, expect, it } from "vitest";

import { dayWellbeing } from "./wellbeing-fixtures";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import { TEXTURES, type DietPlan } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";
import { RECIPES, timeLevel, type Recipe } from "@/lib/recipes/book";
import { STEPS } from "@/lib/recipes/steps";
import {
  INGREDIENTS,
  INGREDIENT_IDS,
  type IngredientId,
} from "@/lib/recipes/catalog";
import {
  filterRecipes,
  likedFoodIds,
  pantryPlan,
  resolveIngredient,
  reviewAll,
  reviewRecipe,
  type ReviewInput,
} from "@/lib/recipes/review";

/** El plan de ejemplo (inventado); la restricción de la manzana corre hasta el 2026-09-28. */
const NOW = new Date("2026-08-10T12:00:00");
const AFTER = new Date("2026-10-15T12:00:00");
const diet = (): DietPlan => structuredClone(getDemoDiet());
const input = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  diet: diet(),
  now: NOW,
  notes: [],
  ...over,
});
const withIngredient = (id: IngredientId) =>
  RECIPES.filter((r) => r.ingredients.some((i) => i.id === id));
const textOf = (r: Recipe) =>
  [
    r.name,
    ...STEPS[r.id].steps,
    ...(STEPS[r.id].tip ? [STEPS[r.id].tip!] : []),
    ...r.ingredients.map((i) => i.qty),
  ].flatMap((t) => [t.es, t.en]);

describe("recetario inicial · contenido", () => {
  it("trae al menos 30 recetas, con id único y los tres niveles de tiempo y de costo", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(RECIPES.map((r) => timeLevel(r.minutes)))).toEqual(
      new Set(["quick", "medium", "long"]),
    );
    expect(new Set(RECIPES.map((r) => r.cost))).toEqual(
      new Set(["low", "mid"]),
    );
  });

  it("el nivel de tiempo sale de los minutos: hasta 15, hasta 30, más", () => {
    expect(timeLevel(15)).toBe("quick");
    expect(timeLevel(16)).toBe("medium");
    expect(timeLevel(30)).toBe("medium");
    expect(timeLevel(31)).toBe("long");
  });

  it("cada receta tiene sus pasos, y ningún paso queda huérfano de receta", () => {
    expect(Object.keys(STEPS).sort()).toEqual(RECIPES.map((r) => r.id).sort());
  });

  it("cada receta está redactada en español y en inglés, con ingredientes del catálogo y pasos", () => {
    for (const r of RECIPES) {
      for (const t of textOf(r))
        expect(t.trim().length, r.id).toBeGreaterThan(0);
      expect(STEPS[r.id].steps.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.ingredients.length, r.id).toBeGreaterThanOrEqual(2);
      for (const i of r.ingredients)
        expect(INGREDIENT_IDS, `${r.id}:${i.id}`).toContain(i.id);
      if (r.texture) expect(TEXTURES).toContain(r.texture);
      // El inglés no es el español pegado: cada nombre difiere, salvo los que se escriben igual.
      if (r.name.es.toLowerCase() === r.name.en.toLowerCase())
        throw new Error(`${r.id}: name not written in both languages`);
    }
  });

  it("sin marcas, cifras de nutrientes, calorías ni indicaciones médicas (es y en)", () => {
    for (const r of RECIPES)
      for (const t of textOf(r)) {
        expect(looksLikeMedicalAdvice(t), `${r.id}: ${t}`).toBe(false);
        expect(t, r.id).not.toMatch(
          /\b\d+([.,]\d+)?\s?(kcal|cal|calor\w*|gramos?|grams?|g|mg|mcg|ml|%)\b/i,
        );
        expect(t, r.id).not.toMatch(
          /\b(proteína|protein|vitamina|vitamin|hierro|iron|calcio|calcium|defensas|immune|saludable|healthy|cura|cure)\b/i,
        );
        expect(t, r.id).not.toMatch(/https?:|www\./i);
      }
  });

  it("nada que sea un peligro conocido para un niño pequeño: sin miel, sin frutos secos enteros ni palomitas", () => {
    const all = RECIPES.flatMap(textOf).join(" ").toLowerCase();
    expect(all).not.toMatch(
      /\bmiel\b|\bhoney\b|nueces|\bnuts?\b|palomitas|popcorn|maní|peanut/,
    );
    // Y la uva siempre va partida.
    for (const r of withIngredient("uvas"))
      expect(
        STEPS[r.id].steps.some((s) => /parte|cut/i.test(s.es + s.en)),
        r.id,
      ).toBe(true);
  });
});

describe("revisión contra el plan de prueba · cada receta", () => {
  it("con el plan de ejemplo ninguna receta queda oculta y muchas salen verdes", () => {
    const { shown, hidden } = reviewAll(RECIPES, input());
    expect(hidden).toEqual([]);
    expect(shown).toHaveLength(RECIPES.length);
    expect(shown.filter((r) => r.state === "ok").length).toBeGreaterThanOrEqual(
      12,
    );
  });

  it("lo que el plan no trae queda «no está en tu plan»: jamás verde", () => {
    const { shown } = reviewAll(RECIPES, input());
    const by = (id: string) => shown.find((r) => r.recipe.id === id)!;
    // El plan de ejemplo no trae frijoles, garbanzos, pasta, pan, arepa ni batata.
    for (const [id, missing] of [
      ["frijoles-arroz", "frijoles"],
      ["garbanzos-tomate", "garbanzos"],
      ["pasta-tomate-brocoli", "pasta"],
      ["pan-pollo", "pan"],
      ["arepa-tomate-queso", "arepa"],
      ["batata-asada", "batata"],
    ] as const) {
      expect(by(id).state, id).toBe("unknown");
      expect(by(id).unknown, id).toContain(missing);
    }
  });

  it("un amarillo marca la receta con la medida que escribió el plan", () => {
    const { shown } = reviewAll(RECIPES, input());
    const r = shown.find((x) => x.recipe.id === "tortitas-banano-avena")!;
    expect(r.state).toBe("caution");
    expect(r.cautions[0]).toMatchObject({ ingredient: "banano" });
    expect(r.cautions[0].limit.es).toMatch(/máx/);
  });

  it("un rojo oculta la receta y dice cuál: probado con CADA ingrediente del catálogo como rojo", () => {
    for (const id of INGREDIENT_IDS) {
      const d = diet();
      d.trafficLight.red.items.push({
        id: `rojo-${id}`,
        name: { es: INGREDIENTS[id].es, en: INGREDIENTS[id].en },
        why: { es: "ejemplo", en: "example" },
      });
      const { shown, hidden } = reviewAll(RECIPES, input({ diet: d }));
      const using = withIngredient(id).map((r) => r.id);
      // Todas las recetas que lo llevan quedan ocultas, nombrando ese ingrediente…
      for (const rid of using) {
        const h = hidden.find((x) => x.recipe.id === rid);
        expect(h, `${id} → ${rid}`).toBeDefined();
        expect(h!.blockers.map((b) => b.ingredient)).toContain(id);
        expect(h!.blockers.find((b) => b.ingredient === id)!.why).toBe("red");
      }
      // …y ninguna receta que no lo lleva se oculta por su culpa.
      expect(shown.some((r) => using.includes(r.recipe.id))).toBe(false);
    }
  });

  it("una alergia o intolerancia anotada oculta la receta (cada ingrediente, es y en)", () => {
    for (const id of INGREDIENT_IDS) {
      for (const text of [INGREDIENTS[id].es, INGREDIENTS[id].en]) {
        const { shown, hidden } = reviewAll(
          RECIPES,
          input({ notes: [{ kind: "allergy", text }] }),
        );
        for (const r of withIngredient(id)) {
          expect(
            shown.map((x) => x.recipe.id),
            `${text} → ${r.id}`,
          ).not.toContain(r.id);
          expect(
            hidden
              .find((x) => x.recipe.id === r.id)!
              .blockers.map((b) => b.why),
          ).toContain("allergy");
        }
      }
    }
  });

  it("una alergia del propio plan también oculta (mariscos, sorbitol)", () => {
    const d = diet();
    d.profile!.allergies!.push({
      id: "huevo",
      name: { es: "Huevos", en: "Eggs" },
    });
    const { hidden } = reviewAll(RECIPES, input({ diet: d }));
    expect(hidden.map((h) => h.recipe.id)).toEqual(
      expect.arrayContaining(withIngredient("huevos").map((r) => r.id)),
    );
  });

  it("una restricción vigente oculta; vencida, deja de mandar", () => {
    const d = diet();
    d.restrictions.foods.push({
      id: "banano-r",
      name: { es: "Banano", en: "Banana" },
    });
    // La demo trae el banano en amarillo: la restricción vigente manda sobre él.
    const now = reviewAll(RECIPES, input({ diet: d }));
    expect(now.hidden.map((h) => h.recipe.id)).toEqual(
      expect.arrayContaining(withIngredient("banano").map((r) => r.id)),
    );
    expect(
      now.hidden.find((h) => h.recipe.id === "tortitas-banano-avena")!
        .blockers[0].why,
    ).toBe("restricted");
    const later = reviewAll(RECIPES, input({ diet: d, now: AFTER }));
    expect(later.hidden).toEqual([]);
  });

  it("una restricción sobre un alimento solo oculta las recetas que lo llevan", () => {
    const d = diet();
    d.restrictions.foods.push({
      id: "pera-r",
      name: { es: "Pera", en: "Pear" },
    });
    const { hidden } = reviewAll(RECIPES, input({ diet: d }));
    expect(hidden.map((h) => h.recipe.id).sort()).toEqual(
      withIngredient("pera")
        .map((r) => r.id)
        .sort(),
    );
  });

  it("el cotejo es por nombre, sin ids: un plan leído de un PDF (ids generados) da lo mismo", () => {
    const d = diet();
    for (const g of d.trafficLight.green.groups)
      for (const i of g.items) i.id = `pdf-${i.id}-x`;
    const a = reviewAll(RECIPES, input());
    const b = reviewAll(RECIPES, input({ diet: d }));
    expect(b.shown.map((r) => [r.recipe.id, r.state])).toEqual(
      a.shown.map((r) => [r.recipe.id, r.state]),
    );
  });

  it("una receta se marca por la textura que hoy no acepta, sin ocultarla", () => {
    const { shown } = reviewAll(RECIPES, input({ accepted: ["soft"] }));
    const crunchy = shown.find((r) => r.recipe.id === "tostadas-aguacate")!;
    expect(crunchy.textureNotAccepted).toBe(true);
    expect(
      shown.find((r) => r.recipe.id === "yogurt-fresas")!.textureNotAccepted,
    ).toBe(false);
    // Sin texturas marcadas no hay nada que marcar.
    expect(
      reviewAll(RECIPES, input()).shown.some((r) => r.textureNotAccepted),
    ).toBe(false);
  });
});

describe("filtros: tiempo, costo y lo que le gusta", () => {
  const { shown } = reviewAll(RECIPES, input());
  it("por tiempo y por costo", () => {
    const quick = filterRecipes(shown, { time: "quick" });
    expect(quick.length).toBeGreaterThan(3);
    expect(quick.every((r) => r.recipe.minutes <= 15)).toBe(true);
    const cheap = filterRecipes(shown, { cost: "low" });
    expect(cheap.every((r) => r.recipe.cost === "low")).toBe(true);
    expect(
      filterRecipes(shown, { time: "long", cost: "mid" }).every(
        (r) => r.recipe.minutes > 30 && r.recipe.cost === "mid",
      ),
    ).toBe(true);
  });

  it("«lo que le gusta» deja solo las que llevan algo que le gustó o aceptó", () => {
    const liked = filterRecipes(shown, { liked: true }, new Set(["lentejas"]));
    expect(liked.length).toBeGreaterThan(0);
    expect(
      liked.every((r) => Object.values(r.planIds).includes("lentejas")),
    ).toBe(true);
    expect(filterRecipes(shown, { liked: true })).toEqual([]);
  });
});

describe("«¿Qué cocino con lo que tengo?»", () => {
  const have = (...ids: IngredientId[]) => new Set<IngredientId>(ids);

  it("lo que se puede hacer ya, con lo que hay (los básicos se dan por sabidos)", () => {
    const { shown } = reviewAll(RECIPES, input());
    const r = pantryPlan(shown, have("huevos", "espinaca"), input());
    expect(r.ready.map((x) => x.recipe.id)).toContain("huevos-espinaca");
    expect(
      r.ready.find((x) => x.recipe.id === "huevos-espinaca")!.missing,
    ).toEqual([]);
  });

  it("sin pollo pero con huevos: sale con el reemplazo que el plan escribió, nunca otro", () => {
    const { shown } = reviewAll(RECIPES, input());
    const pantry = have("arroz", "zanahoria", "huevos");
    const r = pantryPlan(shown, pantry, input());
    const row = r.swap.find((x) => x.recipe.id === "arroz-pollo")!;
    expect(row).toBeDefined();
    expect(row.swaps).toEqual([
      { from: "pollo", to: "huevos", planName: { es: "huevos", en: "eggs" } },
    ]);
    expect(row.missing).toEqual([]);
  });

  it("el reemplazo SOLO sale de las equivalencias: sin la del plan, es un faltante", () => {
    const d = diet();
    d.equivalences = d.equivalences.filter((e) => e.whenMissing !== "pollo");
    const i = input({ diet: d });
    const { shown } = reviewAll(RECIPES, i);
    const r = pantryPlan(shown, have("arroz", "zanahoria", "huevos"), i);
    expect(r.swap.some((x) => x.recipe.id === "arroz-pollo")).toBe(false);
    expect(
      r.almost.find((x) => x.recipe.id === "arroz-pollo")!.missing,
    ).toEqual(["pollo"]);
  });

  it("el reemplazo respeta alergias y texturas: ni un huevo si hay alergia, ni una textura que hoy no acepta", () => {
    const allergic = input({ notes: [{ kind: "allergy", text: "huevos" }] });
    const a = reviewAll(RECIPES, allergic);
    const ra = pantryPlan(
      a.shown,
      have("arroz", "zanahoria", "huevos"),
      allergic,
    );
    expect(ra.swap.some((x) => x.recipe.id === "arroz-pollo")).toBe(false);

    const crunchyOnly = input({ accepted: ["crunchy"] });
    const b = reviewAll(RECIPES, crunchyOnly);
    const rb = pantryPlan(
      b.shown,
      have("arroz", "zanahoria", "huevos"),
      crunchyOnly,
    );
    expect(rb.swap.some((x) => x.recipe.id === "arroz-pollo")).toBe(false);
  });

  it("jamás ofrece una receta oculta, ni siquiera con todo en la despensa", () => {
    const d = diet();
    d.trafficLight.red.items.push({
      id: "rojo-huevos",
      name: { es: "huevos", en: "eggs" },
      why: { es: "ejemplo", en: "example" },
    });
    const i = input({ diet: d });
    const { shown } = reviewAll(RECIPES, i);
    const r = pantryPlan(shown, new Set(INGREDIENT_IDS), i);
    const all = [...r.ready, ...r.swap, ...r.almost].map((x) => x.recipe.id);
    for (const rec of withIngredient("huevos"))
      expect(all, rec.id).not.toContain(rec.id);
  });

  it("con la despensa llena, las verdes salen antes que las que el plan no trae", () => {
    const { shown } = reviewAll(RECIPES, input());
    const r = pantryPlan(shown, new Set(INGREDIENT_IDS), input());
    const states = r.ready.map((x) => x.state);
    const firstUnknown = states.indexOf("unknown");
    expect(firstUnknown).toBeGreaterThan(0);
    expect(states.slice(0, firstUnknown).every((s) => s !== "unknown")).toBe(
      true,
    );
    expect(states.slice(firstUnknown).every((s) => s === "unknown")).toBe(true);
  });

  it("faltan una o dos cosas: «casi», con lo que falta", () => {
    const { shown } = reviewAll(RECIPES, input());
    const r = pantryPlan(shown, have("lentejas", "zanahoria"), input());
    const soup = r.almost.find((x) => x.recipe.id === "sopa-lentejas")!;
    expect(soup.missing.sort()).toEqual(["papa", "tomate"]);
  });
});

describe("resolveIngredient · el peor cotejo manda", () => {
  it("«papa» casa con «Papa cocida» del plan; «queso fresco» no casa con «Queso maduro»", () => {
    const d = diet();
    expect(resolveIngredient(d, INGREDIENTS.papa, NOW, [])).toMatchObject({
      kind: "ok",
      via: "plan",
      planId: "papa",
    });
    // «queso fresco» lo trae el plan como opción de una equivalencia, no como el amarillo «queso maduro».
    expect(resolveIngredient(d, INGREDIENTS.queso, NOW, [])).toMatchObject({
      kind: "ok",
      via: "equivalence",
    });
    expect(resolveIngredient(d, INGREDIENTS.yogurt, NOW, [])).toMatchObject({
      kind: "caution",
    });
  });

  it("un básico que el plan no menciona no estorba; si el plan lo prohíbe, manda", () => {
    const d = diet();
    expect(resolveIngredient(d, INGREDIENTS.agua, NOW, [])).toMatchObject({
      kind: "ok",
      via: "staple",
    });
    d.trafficLight.red.alsoAvoid.push({
      id: "aceite-r",
      name: { es: "Aceite de oliva", en: "Olive oil" },
    });
    expect(resolveIngredient(d, INGREDIENTS.aceite, NOW, [])).toMatchObject({
      kind: "blocked",
      why: "red",
    });
  });
});

describe("lo que le gusta · último veredicto de la aceptación (S10)", () => {
  it("cuenta «le encantó» y «lo aceptó» del último veredicto; «lo rechazó» y lo sin veredicto, no", () => {
    const days = [
      dayWellbeing("2026-08-03", { lentejas: "refuses", pera: "loves" }),
      dayWellbeing("2026-08-04", {
        lentejas: "accepts",
        pera: "refuses",
        arroz: "accepts",
      }),
    ];
    // listWellbeingDays los entrega del más reciente al más antiguo.
    expect([...likedFoodIds([...days].reverse())].sort()).toEqual([
      "arroz",
      "lentejas",
    ]);
    expect(likedFoodIds([])).toEqual(new Set());
  });
});

describe("revisión de todo el recetario · el cotejo compartido no cambia el resultado", () => {
  it("da lo mismo que revisar cada receta por separado, con el plan y con una alergia anotada", () => {
    for (const notes of [[], [{ kind: "allergy", text: "tomate" }]]) {
      const inp = input({ notes });
      const solo = RECIPES.map((r) => reviewRecipe(r, inp));
      const all = reviewAll(RECIPES, inp);
      expect(
        [...all.shown, ...all.hidden].map((r) => r.recipe.id).sort(),
      ).toEqual(solo.map((r) => r.recipe.id).sort());
      for (const r of [...all.shown, ...all.hidden]) {
        const alone = solo.find((x) => x.recipe.id === r.recipe.id)!;
        expect(r.state).toBe(alone.state);
        expect(r.blockers).toEqual(alone.blockers);
        expect(r.unknown).toEqual(alone.unknown);
        expect(r.cautions).toEqual(alone.cautions);
      }
    }
  });
});
