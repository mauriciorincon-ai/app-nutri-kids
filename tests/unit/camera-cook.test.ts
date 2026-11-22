import { describe, expect, it } from "vitest";

import { cookFromPantry } from "@/lib/camera/cook";
import { getDemoDiet } from "@/lib/diet/storage";
import type { IngredientId } from "@/lib/recipes/catalog";
import type { ReviewInput } from "@/lib/recipes/review";

const input = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  diet: structuredClone(getDemoDiet()),
  now: new Date("2026-08-10T12:00:00"),
  notes: [],
  ...over,
});
const set = (...ids: IngredientId[]) => new Set<IngredientId>(ids);

describe("cookFromPantry: el recetario primero, la plantilla solo si nada sale", () => {
  it("con lo del plan sale «hazla ya» del recetario y NO se ofrece ninguna plantilla", () => {
    const out = cookFromPantry(
      set("huevos", "espinaca", "pollo", "arroz", "zanahoria"),
      input(),
    );
    expect(out.plan.ready.length + out.plan.swap.length).toBeGreaterThan(0);
    expect(out.templates).toEqual([]);
  });

  it("si ninguna receta del recetario sale, ofrece las plantillas que el plan deja pasar", () => {
    // Solo pollo y brócoli: el recetario no tiene ninguna lista; la plantilla sí.
    const out = cookFromPantry(set("pollo", "brocoli"), input());
    expect(out.plan.ready).toEqual([]);
    expect(out.plan.swap).toEqual([]);
    expect(out.templates.map((t) => t.template)).toContain("saute");
  });

  it("una alergia anotada saca al ingrediente de las plantillas también aquí", () => {
    const out = cookFromPantry(
      set("pollo", "brocoli"),
      input({ notes: [{ kind: "allergy", text: "brócoli" }] }),
    );
    for (const t of out.templates)
      expect(t.reviewed.recipe.ingredients.map((i) => i.id)).not.toContain(
        "brocoli",
      );
  });

  it("despensa vacía: ni «hazla ya» ni plantillas (la pantalla no llama al motor sin nada confirmado)", () => {
    const out = cookFromPantry(set(), input());
    expect(out.plan.ready).toEqual([]);
    expect(out.plan.swap).toEqual([]);
    expect(out.templates).toEqual([]);
  });
});
