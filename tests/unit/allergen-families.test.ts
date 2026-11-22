import { describe, expect, it } from "vitest";

import { expandAvoid } from "@/lib/diet/allergen-families";
import { containsPhrase, toTokens } from "@/lib/diet/search";

/**
 * Familias de alérgenos (S12 · auditoría): lo anotado es texto libre y lo mirado puede tener otro
 * nombre u otro idioma. Se AGREGA, nunca se quita: ante la duda se sobra, jamás se falta.
 */
const hits = (avoid: string[], food: string) =>
  expandAvoid(avoid).some((a) => {
    for (const locale of ["es", "en"] as const) {
      const need = toTokens(a, locale);
      if (need.length && containsPhrase(toTokens(food, locale), need))
        return true;
    }
    return false;
  });

describe("expandAvoid", () => {
  it.each([
    [["lactosa"], "queso"],
    [["lactosa"], "yogurt"],
    [["intolerancia a la lactosa"], "cheese"],
    [["mariscos"], "shrimp"],
    [["shellfish"], "camarón"],
    [["frutos secos"], "walnut"],
    [["frutos secos"], "cacahuate"],
    [["nuts"], "almendra"],
    [["huevo"], "mayonesa"],
    [["pescado"], "salmon"],
    [["gluten"], "pasta"],
    [["soya"], "tofu"],
  ])("%j evita %s", (avoid, food) => {
    expect(hits(avoid, food)).toBe(true);
  });

  it("lo anotado se conserva tal cual y va primero", () => {
    expect(expandAvoid(["brócoli", "lactosa"]).slice(0, 2)).toEqual([
      "brócoli",
      "lactosa",
    ]);
  });

  it("sin disparador no agrega nada, y no hay falsos positivos entre familias", () => {
    expect(expandAvoid(["brócoli"])).toEqual(["brócoli"]);
    expect(expandAvoid([])).toEqual([]);
    expect(hits(["lactosa"], "arroz")).toBe(false);
    expect(hits(["mariscos"], "pollo")).toBe(false);
    expect(hits(["huevo"], "queso")).toBe(false);
  });

  it("repetir la llamada da el mismo resultado (caché)", () => {
    expect(expandAvoid(["lactosa"])).toEqual(expandAvoid(["lactosa"]));
  });
});
