import { describe, expect, it } from "vitest";

import demoRaw from "../../data/demo-diet.json";
import { dietCounts, dietPlanSchema, parseDietJson } from "@/lib/diet/schema";

const demoText = JSON.stringify(demoRaw);

describe("dietPlanSchema", () => {
  it("accepts the repo demo diet (single source of repo diet data)", () => {
    expect(() => dietPlanSchema.parse(demoRaw)).not.toThrow();
  });

  it("rejects invalid JSON with a typed error that NEVER leaks input content", () => {
    const result = parseDietJson("texto con datos sensibles del niño {");
    expect(result).toMatchObject({ ok: false, error: "invalid-json" });
    // Regla de privacidad: el detail va a logs — no puede contener el texto pegado
    if (!result.ok) {
      expect(result.detail).toBe("unparseable JSON");
      expect(result.detail).not.toContain("sensibles");
    }
  });

  it("rejects a valid JSON that is not a diet", () => {
    const result = parseDietJson(JSON.stringify({ hola: "mundo" }));
    expect(result).toMatchObject({ ok: false, error: "invalid-schema" });
    if (!result.ok) expect(result.detail.length).toBeGreaterThan(0);
  });

  it("rejects an unsupported schemaVersion", () => {
    const tampered = { ...demoRaw, schemaVersion: 2 };
    const result = parseDietJson(JSON.stringify(tampered));
    expect(result).toMatchObject({ ok: false, error: "invalid-schema" });
    if (!result.ok) expect(result.detail).toContain("schemaVersion");
  });

  it("rejects content missing one language (bilingual parity is structural)", () => {
    const tampered = JSON.parse(demoText) as Record<string, unknown>;
    (tampered.meta as { title: Record<string, string> }).title = {
      es: "Solo español",
    };
    const result = parseDietJson(JSON.stringify(tampered));
    expect(result).toMatchObject({ ok: false, error: "invalid-schema" });
  });

  it("computes metadata-only counts for logs and import summary", () => {
    const result = parseDietJson(demoText);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const counts = dietCounts(result.diet);
    expect(counts).toEqual({
      schemaVersion: 1,
      greenGroups: 4,
      greenItems: 15,
      yellowItems: 3,
      redItems: 5,
      additives: 3,
      restrictedFoods: 2,
      equivalences: 3,
      supplements: 2,
      meals: 5,
    });
    // Ningún valor del resumen es texto de la dieta (solo números y versión).
    for (const value of Object.values(counts))
      expect(typeof value).toBe("number");
  });
});

describe("demo diet content rules (producto)", () => {
  const json = demoText.toLowerCase();

  it("contains no calorie/weight/BMI language (regla dura 2)", () => {
    for (const banned of [
      "calor",
      "kcal",
      "imc",
      "percentil",
      "peso corporal",
    ]) {
      expect(json).not.toContain(banned);
    }
  });

  it("exercises optional fields (note, supplementNotes, glassesPerDay)", () => {
    const demo = dietPlanSchema.parse(demoRaw);
    expect(demo.trafficLight.yellow.note).toBeDefined();
    expect(demo.supplementNotes).toBeDefined();
    expect(demo.hydration.glassesPerDay).toBe(4);
  });
});
