import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { dietPlanSchema } from "@/lib/diet/schema";
import {
  matchLookup,
  normalizeText,
  type LocalVerdict,
} from "@/lib/diet/search";

const diet = dietPlanSchema.parse(
  JSON.parse(readFileSync(resolve("data/demo-diet.json"), "utf8")),
);

// Restricción demo vigente hasta 2026-09-28 → fecha dentro de la ventana.
const inWindow = new Date("2026-08-01T12:00:00");
const afterWindow = new Date("2026-10-01T12:00:00");

function itemVerdict(v: LocalVerdict | null) {
  if (!v || v.kind !== "item") throw new Error("expected item verdict");
  return v.status;
}

describe("normalizeText", () => {
  it("quita acentos, mayúsculas y signos", () => {
    expect(normalizeText("¿La MANZÁNA se puede?")).toBe("la manzana se puede");
  });
  it("colapsa espacios", () => {
    expect(normalizeText("  pollo   asado ")).toBe("pollo asado");
  });
});

describe("matchLookup — lookups locales (Camino A)", () => {
  it("'¿la manzana se puede?' → restricción roja vigente con reemplazos", () => {
    const status = itemVerdict(
      matchLookup(diet, "¿la manzana se puede?", "es", inWindow),
    );
    expect(status.color).toBe("red");
    expect(status.kind).toBe("restricted");
    if (status.kind === "restricted") {
      expect(status.restrictionActive).toBe(true);
      expect(status.until).toBe("2026-09-28");
    }
    expect(status.equivalences.length).toBeGreaterThan(0);
  });

  it("resuelve con acentos y mayúsculas ('MANZÁNA')", () => {
    expect(matchLookup(diet, "¿la MANZÁNA?", "es", inWindow)).not.toBeNull();
  });

  it("resuelve plurales simples ('manzanas', 'uvas')", () => {
    expect(
      itemVerdict(matchLookup(diet, "manzanas", "es", inWindow)).color,
    ).toBe("red");
    // 'uvas' es verde (el item ya viene plural en la dieta)
    expect(
      itemVerdict(matchLookup(diet, "puedo dar uvas?", "es", inWindow)).color,
    ).toBe("green");
  });

  it("nombre suelto (bare food) sin marcador también resuelve", () => {
    expect(itemVerdict(matchLookup(diet, "banano", "es", inWindow)).color).toBe(
      "yellow",
    );
  });

  it("desambigua por el nombre más largo ('queso maduro' no 'queso')", () => {
    const status = itemVerdict(
      matchLookup(diet, "¿puede comer queso maduro?", "es", inWindow),
    );
    expect(status.id).toBe("queso-maduro");
    expect(status.color).toBe("yellow");
  });

  it("funciona en inglés ('can he have apples?')", () => {
    expect(
      itemVerdict(matchLookup(diet, "can he have apples?", "en", inWindow))
        .color,
    ).toBe("red");
  });

  it("aditivo E-* → veredicto de aditivo", () => {
    const v = matchLookup(diet, "¿tiene el E999?", "es", inWindow);
    // El código lleva dígitos; normalizeText conserva letras y números.
    expect(v?.kind).toBe("additive");
  });

  it("restricción VENCIDA sigue marcando rojo (restringida-vencida)", () => {
    const status = itemVerdict(matchLookup(diet, "manzana", "es", afterWindow));
    expect(status.color).toBe("red");
    if (status.kind === "restricted")
      expect(status.restrictionActive).toBe(false);
  });
});

describe("matchLookup — NO es lookup (va al LLM, Camino B)", () => {
  it("pregunta abierta con alimento ('no tengo pollo, ¿qué le doy?') → null", () => {
    expect(
      matchLookup(diet, "no tengo pollo, ¿qué le doy?", "es", inWindow),
    ).toBeNull();
  });
  it("'¿qué merienda le doy?' → null", () => {
    expect(
      matchLookup(diet, "¿qué merienda le doy?", "es", inWindow),
    ).toBeNull();
  });
  it("'instead of chicken, what can I give?' → null", () => {
    expect(
      matchLookup(diet, "instead of chicken, what can I give?", "en", inWindow),
    ).toBeNull();
  });
  it("alimento inexistente en el plan → null", () => {
    expect(
      matchLookup(diet, "¿la sandía se puede?", "es", inWindow),
    ).toBeNull();
  });
  it("off-topic sin alimento → null", () => {
    expect(
      matchLookup(diet, "¿quién ganó el partido?", "es", inWindow),
    ).toBeNull();
  });
  it("cadena vacía o muy corta → null", () => {
    expect(matchLookup(diet, "", "es", inWindow)).toBeNull();
    expect(matchLookup(diet, "a", "es", inWindow)).toBeNull();
  });
});
