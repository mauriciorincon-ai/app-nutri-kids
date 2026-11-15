import { describe, expect, it } from "vitest";

import {
  rejectionMessage,
  screenInput,
  MAX_INPUT_CHARS,
} from "@/lib/diet/guardrails";

describe("screenInput — frontera consulta vs. cambio médico", () => {
  it("consultar el plan es legítimo ('¿cuándo toca la B12?') → ok", () => {
    expect(screenInput("¿cuándo toca la B12?")).toBe("ok");
    expect(screenInput("¿qué suplemento toca hoy?")).toBe("ok");
  });

  it("pedir cambio de dosis se rechaza ('¿le subo la dosis de B12?') → medical", () => {
    expect(screenInput("¿le subo la dosis de la B12?")).toBe("medical");
    expect(screenInput("should I increase his omega dose?")).toBe("medical");
  });

  it("diagnóstico/síntomas → medical", () => {
    expect(screenInput("le dio fiebre y vomitó, ¿qué hago?")).toBe("medical");
    expect(screenInput("is this an allergic reaction?")).toBe("medical");
    expect(screenInput("¿es una reacción alérgica?")).toBe("medical");
  });

  it("S5: consultar la alergia o los medicamentos del plan es legítimo → ok", () => {
    expect(screenInput("does he have an allergy?")).toBe("ok");
    expect(screenInput("¿es alérgico al maní?")).toBe("ok");
    expect(screenInput("¿qué medicamentos toma?")).toBe("ok");
  });

  it("preguntas de comida legítimas → ok", () => {
    expect(screenInput("no tengo pollo, ¿qué le doy?")).toBe("ok");
    expect(screenInput("¿qué merienda le preparo?")).toBe("ok");
    expect(screenInput("what can I give instead of rice?")).toBe("ok");
  });

  it("off-topic sin comida → off-topic", () => {
    expect(screenInput("¿quién ganó el partido?")).toBe("off-topic");
    expect(screenInput("what's the weather today?")).toBe("off-topic");
  });

  it("off-topic con palabra de comida NO se marca off-topic", () => {
    // "¿qué película veo mientras cocino la cena?" menciona cena → no off-topic
    expect(screenInput("¿qué preparo de cena viendo una pelicula?")).toBe("ok");
  });
});

describe("rejectionMessage", () => {
  it("bilingüe, sin gastar tokens", () => {
    expect(rejectionMessage("medical", "es")).toMatch(
      /profesional|pediatra|nutricionista/i,
    );
    expect(rejectionMessage("medical", "en")).toMatch(/doctor|nutritionist/i);
    expect(rejectionMessage("off-topic", "es")).toMatch(/plan/i);
    expect(rejectionMessage("off-topic", "en")).toMatch(/plan/i);
  });
});

describe("MAX_INPUT_CHARS", () => {
  it("es un tope razonable", () => {
    expect(MAX_INPUT_CHARS).toBeGreaterThan(200);
    expect(MAX_INPUT_CHARS).toBeLessThanOrEqual(4000);
  });
});

describe("consulta de perfil vs. cambio de medicación (auditoría S5)", () => {
  it.each([
    "¿le cambio el medicamento?",
    "¿le cambio la medicina?",
    "¿puedo suspender la medicina?",
    "¿puedo quitar la pastilla?",
    "¿puedo dejar de darle el jarabe?",
    "¿se puede subir la dosis del jarabe?",
    "¿le doy el doble de medicamento?",
    "¿puedo darle un medicamento para la alergia?",
    "¿le doy medicina para la tos?",
    "¿le puedo dar una pastilla para dormir?",
    "can I stop the medication?",
    "can I stop giving the medicine?",
    "is it ok to skip the pills?",
  ])("«%s» va al profesional", (q) => {
    expect(screenInput(q)).toBe("medical");
  });

  it.each([
    "¿es alérgico al maní?",
    "¿qué medicamentos toma?",
    "¿tiene alguna intolerancia?",
    "is he allergic to peanuts?",
    "what medication does he take?",
    "does he have an allergy?",
  ])("«%s» es una consulta de lectura", (q) => {
    expect(screenInput(q)).toBe("ok");
  });
});
