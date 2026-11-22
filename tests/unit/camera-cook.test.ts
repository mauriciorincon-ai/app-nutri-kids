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

describe("cookFromPantry: lo que la auditoría pidió", () => {
  it("«te falta poco» solo trae recetas que usan algo de lo que hay, las que más comparten primero", () => {
    const out = cookFromPantry(set("pollo", "brocoli"), input());
    for (const r of out.plan.almost) {
      const shared = r.recipe.ingredients.filter(
        (i) => i.id === "pollo" || i.id === "brocoli",
      );
      expect(shared.length).toBeGreaterThan(0);
    }
    const counts = out.plan.almost.map(
      (r) =>
        r.recipe.ingredients.filter(
          (i) => i.id === "pollo" || i.id === "brocoli",
        ).length,
    );
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("un ingrediente que el plan evita se nombra aparte y no entra a ninguna receta ni plantilla", () => {
    const base = input();
    const out = cookFromPantry(set("pollo", "brocoli", "huevos"), {
      ...base,
      notes: [{ kind: "allergy", text: "huevo" }],
    });
    expect(out.avoided.map((a) => a.id)).toContain("huevos");
    expect(out.avoided.find((a) => a.id === "huevos")?.allergy).toBe(true);
    const used = [
      ...out.plan.ready,
      ...out.plan.swap,
      ...out.templates.map((t) => t.reviewed),
    ].flatMap((r) => r.recipe.ingredients.map((i) => i.id));
    expect(used).not.toContain("huevos");
  });

  it("la familia anotada cuenta: «lactosa» deja fuera el queso de la despensa", () => {
    const out = cookFromPantry(set("queso", "pollo"), {
      ...input(),
      notes: [{ kind: "intolerance", text: "lactosa" }],
    });
    expect(out.avoided.map((a) => a.id)).toContain("queso");
  });

  it("sin nada que evitar, `avoided` va vacío", () => {
    expect(cookFromPantry(set("pollo", "arroz"), input()).avoided).toEqual([]);
  });

  it("las plantillas no salen si ya hay una receta lista que hoy se puede comer", () => {
    const out = cookFromPantry(
      set("huevos", "espinaca", "pollo", "arroz", "zanahoria"),
      input(),
    );
    expect(out.plan.ready.some((r) => !r.textureNotAccepted)).toBe(true);
    expect(out.templates).toEqual([]);
  });
});
