import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";

import demoRaw from "../../data/demo-diet.json";
import { dietPlanSchema } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";

/**
 * La demo no pasa por el schema en cada arranque (TBT de Hoy, S12): se usa el JSON tal cual.
 * Eso solo es correcto si el schema la acepta y la devuelve IDÉNTICA (sin defaults ni
 * transformaciones que la app esperara). Este test es la garantía; si un cambio del schema o
 * de la demo la rompe, falla aquí y no en el teléfono.
 */
describe("la demo en runtime es la demo validada", () => {
  it("el schema la acepta y devuelve exactamente el mismo JSON", () => {
    const parsed = dietPlanSchema.parse(demoRaw);
    expect(isDeepStrictEqual(parsed, demoRaw)).toBe(true);
  });

  it("getDemoDiet entrega ese mismo contenido, en una copia propia", () => {
    const demo = getDemoDiet();
    expect(demo).toEqual(dietPlanSchema.parse(demoRaw));
    expect(demo).not.toBe(demoRaw);
  });
});
