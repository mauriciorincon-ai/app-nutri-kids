import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { dietPlanSchema } from "@/lib/diet/schema";
import {
  buildGroundedSystem,
  buildSystemPrompt,
  serializeDiet,
} from "@/lib/ia/grounding";

const diet = dietPlanSchema.parse(
  JSON.parse(readFileSync(resolve("data/demo-diet.json"), "utf8")),
);
const monday = new Date("2026-08-03T09:00:00"); // lunes dentro de la vigencia

describe("serializeDiet", () => {
  it("mono-idioma: en ES no filtra texto en inglés", () => {
    const es = serializeDiet(diet, "es", monday);
    expect(es).toContain("Manzana");
    expect(es).not.toContain("Apple");
    expect(es).toContain("ROJO");
  });

  it("mono-idioma: en EN no filtra texto en español", () => {
    const en = serializeDiet(diet, "en", monday);
    expect(en).toContain("Apple");
    expect(en).not.toContain("Manzana");
    expect(en).toContain("RED");
  });

  it("incluye vigencia, verdes, equivalencias y suplementos", () => {
    const es = serializeDiet(diet, "es", monday);
    expect(es).toContain("2026-09-28"); // validUntil
    expect(es).toContain("VERDE");
    expect(es).toContain("EQUIVALENCIAS");
    expect(es).toContain("SUPLEMENTOS");
  });
});

describe("buildSystemPrompt", () => {
  it("prohíbe consejo médico, calorías y responde en el idioma", () => {
    const es = buildSystemPrompt("es");
    expect(es).toMatch(/no eres médico/i);
    expect(es).toMatch(/calorías|peso/i);
    expect(es).toMatch(/español/i);
    const en = buildSystemPrompt("en");
    expect(en).toMatch(/not a doctor/i);
    expect(en).toMatch(/english/i);
  });
});

describe("buildGroundedSystem", () => {
  it("combina instrucciones + plan + contexto del día (suplemento del lunes)", () => {
    const sys = buildGroundedSystem(diet, "es", monday);
    expect(sys).toContain("PLAN CARGADO");
    expect(sys).toContain("HOY");
    expect(sys).toContain("lunes");
    // El multivitamínico demo toca lun/mié/vie → debe aparecer en HOY
    expect(sys).toMatch(/Multivitamínico demo/);
  });
});
