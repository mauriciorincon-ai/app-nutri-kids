import { describe, expect, it } from "vitest";

import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import type { DietPlan } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";
import {
  INGREDIENTS,
  INGREDIENT_IDS,
  type IngredientId,
} from "@/lib/recipes/catalog";
import type { ReviewInput } from "@/lib/recipes/review";
import {
  TEMPLATE_IDS,
  templateRecipes,
  type TemplateRecipe,
} from "@/lib/recipes/templates";

/**
 * Las plantillas de cocina (S12 · ADR-018). Lo que importa: NINGUNA combinación de la despensa mete
 * un rojo, una alergia o una textura que hoy no se acepta; cada receta sale ya revisada por el plan.
 */
const NOW = new Date("2026-08-10T12:00:00");
const diet = (): DietPlan => structuredClone(getDemoDiet());
const input = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  diet: diet(),
  now: NOW,
  notes: [],
  ...over,
});
const ALL = new Set<IngredientId>(INGREDIENT_IDS);
const ids = (t: TemplateRecipe) =>
  t.reviewed.recipe.ingredients.map((i) => i.id);
/** El plan con ese ingrediente en la lista roja (sin quitarlo de ningún otro lado: gana el peor). */
const redOut = (id: IngredientId): DietPlan => {
  const d = diet();
  d.trafficLight.red.items.push({
    id: `rojo-${id}`,
    name: { es: INGREDIENTS[id].es, en: INGREDIENTS[id].en },
    why: { es: "Rojo de prueba.", en: "Test red." },
  });
  return d;
};

describe("plantillas · lo que se ofrece", () => {
  it("con la despensa del plan de ejemplo salen las seis, con receta revisada y pasos en es y en", () => {
    const out = templateRecipes(ALL, input());
    expect(out.map((t) => t.template).sort()).toEqual([...TEMPLATE_IDS].sort());
    for (const t of out) {
      expect(["ok", "caution"], t.template).toContain(t.reviewed.state);
      expect(t.reviewed.blockers).toEqual([]);
      expect(t.steps.length, t.template).toBeGreaterThanOrEqual(3);
      for (const s of [...t.steps, t.reviewed.recipe.name]) {
        expect(s.es.trim().length).toBeGreaterThan(0);
        expect(s.en.trim().length).toBeGreaterThan(0);
        expect(s.es).not.toBe(s.en);
        // Sin cifras ni indicación médica: «lo que tengas», «un poco», «medio».
        expect(s.es + s.en).not.toMatch(/\d|calor|kcal|\bgram|\bmg\b/i);
        expect(looksLikeMedicalAdvice(s.es)).toBe(false);
        expect(looksLikeMedicalAdvice(s.en)).toBe(false);
      }
      for (const i of t.reviewed.recipe.ingredients)
        expect(i.qty.es + i.qty.en).not.toMatch(/\d/);
    }
  });

  it("con lo mínimo cada plantilla pide lo suyo: nada alcanza con una despensa vacía", () => {
    expect(templateRecipes(new Set(), input())).toEqual([]);
    // Solo huevos: tortilla y nada más (el resto pide verdura, base o proteína de horno).
    expect(
      templateRecipes(new Set<IngredientId>(["huevos"]), input()).map(
        (t) => t.template,
      ),
    ).toEqual(["omelette"]);
    // Solo verdura: sin segunda ranura no hay salteado ni sopa.
    expect(
      templateRecipes(new Set<IngredientId>(["zanahoria"]), input()),
    ).toEqual([]);
  });

  it("solo usa lo que la despensa tiene y lo que el plan nombra: lo desconocido no se cuela", () => {
    // Espinaca y batata no están en el plan de ejemplo: «no se sabe» no entra a ninguna ranura.
    const out = templateRecipes(
      new Set<IngredientId>(["espinaca", "batata", "zanahoria", "pollo"]),
      input(),
    );
    for (const t of out) {
      expect(ids(t)).not.toContain("espinaca");
      expect(ids(t)).not.toContain("batata");
    }
    expect(out.length).toBeGreaterThan(0);
  });

  it("el id de cada receta es único y no choca con el recetario", () => {
    const out = templateRecipes(ALL, input());
    expect(new Set(out.map((t) => t.reviewed.recipe.id)).size).toBe(out.length);
    for (const t of out) expect(t.reviewed.recipe.id).toMatch(/^tpl-/);
  });
});

describe("plantillas · negativos: rojo, alergia, textura", () => {
  it("ningún ingrediente rojo del plan entra a ninguna receta (uno por uno)", () => {
    for (const id of INGREDIENT_IDS) {
      const out = templateRecipes(ALL, input({ diet: redOut(id) }));
      for (const t of out) {
        expect(ids(t), `rojo ${id} → ${t.template}`).not.toContain(id);
        expect(t.reviewed.state).not.toBe("blocked");
      }
    }
  });

  it("ninguna alergia o intolerancia anotada entra (cada ingrediente, en es y en)", () => {
    for (const id of INGREDIENT_IDS) {
      for (const text of [INGREDIENTS[id].es, INGREDIENTS[id].en]) {
        const out = templateRecipes(
          ALL,
          input({ notes: [{ kind: "allergy", text }] }),
        );
        for (const t of out)
          expect(ids(t), `${text} → ${t.template}`).not.toContain(id);
      }
    }
  });

  it("una alergia del propio perfil del plan tampoco entra", () => {
    const d = diet();
    d.profile!.allergies!.push({
      id: "huevo",
      name: { es: "Huevos", en: "Eggs" },
    });
    const out = templateRecipes(ALL, input({ diet: d }));
    expect(out.length).toBeGreaterThan(0);
    for (const t of out) expect(ids(t)).not.toContain("huevos");
    expect(out.map((t) => t.template)).not.toContain("omelette");
  });

  it("un básico que el plan prohíbe (aceite) descarta las plantillas que lo llevan", () => {
    const withOil = templateRecipes(ALL, input()).map((t) => t.template);
    expect(withOil).toContain("saute");
    const out = templateRecipes(ALL, input({ diet: redOut("aceite") }));
    for (const t of out) expect(ids(t)).not.toContain("aceite");
    expect(out.map((t) => t.template)).not.toContain("saute");
    expect(out.map((t) => t.template)).toContain("mash");
  });

  it("una textura que hoy no se acepta no se ofrece (no se marca: se descarta)", () => {
    const soft = templateRecipes(ALL, input({ accepted: ["soft"] }));
    expect(soft.map((t) => t.template).sort()).toEqual(
      ["baked", "omelette", "rice", "soup"].sort(),
    );
    for (const t of soft) expect(t.reviewed.textureNotAccepted).toBe(false);
    expect(templateRecipes(ALL, input({ accepted: ["crunchy"] }))).toEqual([]);
    expect(
      templateRecipes(ALL, input({ accepted: ["mashed"] })).map(
        (t) => t.template,
      ),
    ).toEqual(["mash"]);
  });

  it("sin la hora ni el plan cambiando lo que sale: misma entrada, mismo resultado", () => {
    const a = templateRecipes(ALL, input());
    const b = templateRecipes(ALL, input());
    expect(a.map((t) => t.reviewed.recipe.id)).toEqual(
      b.map((t) => t.reviewed.recipe.id),
    );
  });
});
