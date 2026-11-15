import { describe, expect, it } from "vitest";

import v1Raw from "../fixtures/diet-v1.json";
import { migrateV1toV2 } from "@/lib/diet/migrate";
import {
  dietPlanSchema,
  dietPlanV1Schema,
  parseDietJson,
} from "@/lib/diet/schema";

/**
 * Migración v1 → v2 (ADR-009). El fixture es un plan v1 con la forma del real,
 * INVENTADO (la demo del S4): jamás la dieta del niño.
 */
const v1 = dietPlanV1Schema.parse(v1Raw);
const v1Text = JSON.stringify(v1Raw);

describe("migrateV1toV2: nada se pierde", () => {
  const v2 = migrateV1toV2(v1);

  it("el resultado valida como v2", () => {
    expect(() => dietPlanSchema.parse(v2)).not.toThrow();
    expect(v2.schemaVersion).toBe(2);
  });

  it.each([
    "meta",
    "restrictions",
    "trafficLight",
    "supplements",
    "supplementNotes",
    "dailyMenu",
    "hydration",
  ] as const)("el campo %s queda idéntico", (field) => {
    expect(v2[field]).toEqual(v1[field]);
  });

  it("cada equivalencia conserva título, nota y cada opción, en orden", () => {
    expect(v2.equivalences).toHaveLength(v1.equivalences.length);
    v1.equivalences.forEach((eq, i) => {
      const out = v2.equivalences[i];
      expect(out.whenMissing).toBe(eq.whenMissing);
      expect(out.title).toEqual(eq.title);
      expect(out.note).toEqual(eq.note);
      expect(out.use.map((u) => u.name)).toEqual(eq.use);
      // El plan v1 no decía texturas: no se inventan.
      expect(out.use.every((u) => u.texture === undefined)).toBe(true);
    });
  });

  it("perfil y objetivos quedan ausentes (el plan no lo dice), no inventados", () => {
    expect(v2.profile).toBeUndefined();
    expect(v2.goals).toBeUndefined();
  });

  it("no muta el v1 de entrada", () => {
    const before = JSON.stringify(v1);
    migrateV1toV2(v1);
    expect(JSON.stringify(v1)).toBe(before);
  });
});

describe("parseDietJson acepta v1 y v2 y siempre entrega v2", () => {
  it("un v1 válido llega migrado y marcado", () => {
    const r = parseDietJson(v1Text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diet.schemaVersion).toBe(2);
    expect(r.migratedFrom).toBe(1);
  });

  it("un v1 malformado falla con paths, sin contenido", () => {
    const bad = JSON.parse(v1Text) as { equivalences: { use: unknown }[] };
    bad.equivalences[0].use = [{ name: { es: "x", en: "x" } }]; // forma v2 en un v1
    const r = parseDietJson(JSON.stringify(bad));
    expect(r).toMatchObject({ ok: false, error: "invalid-schema" });
    if (!r.ok) expect(r.detail).toContain("equivalences.0.use");
  });

  it("una textura fuera de la lista cerrada se rechaza", () => {
    const r0 = parseDietJson(v1Text);
    if (!r0.ok) throw new Error("fixture");
    const bad = structuredClone(r0.diet) as unknown as {
      equivalences: { use: { texture?: string }[] }[];
    };
    bad.equivalences[0].use[0].texture = "gomosa";
    const r = parseDietJson(JSON.stringify(bad));
    expect(r).toMatchObject({ ok: false, error: "invalid-schema" });
  });
});
