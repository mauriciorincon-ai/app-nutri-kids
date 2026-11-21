import { describe, expect, it } from "vitest";

import { cameraText } from "@/i18n/camera";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";

const strings = (o: Record<string, string>) => Object.entries(o);
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("textos de la cámara (es/en)", () => {
  const es = strings(cameraText.es);
  const en = strings(cameraText.en);

  it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
    expect(en.map(([k]) => k)).toEqual(es.map(([k]) => k));
    const enMap = Object.fromEntries(en);
    for (const [k, v] of es) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(enMap[k].trim().length, k).toBeGreaterThan(0);
      expect(placeholders(enMap[k]), k).toEqual(placeholders(v));
    }
  });

  it("todo resultado lleva «verifícalo con un adulto», en los dos idiomas", () => {
    expect(cameraText.es.check).toMatch(/verifícalo con un adulto/i);
    expect(cameraText.en.check).toMatch(/with an adult/i);
  });

  it("la promesa de privacidad se dice: la foto no se guarda ni se envía", () => {
    expect(cameraText.es.lead).toMatch(/no se guarda ni se envía/);
    expect(cameraText.en.lead).toMatch(/not saved or sent/);
  });

  it("ninguna frase suena a consejo médico", () => {
    for (const [k, v] of [...es, ...en])
      expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
  });

  it("ninguna frase culpa ni urge con alarma", () => {
    const BAD =
      /\b(culpa\w*|fall[óo]\w*|incumpl\w*|urgente\w*|peligr\w*|grave\w*|alarm\w*|malo|mala|failed|fail|guilt\w*|urgent\w*|danger\w*|serious\w*|bad)\b/i;
    for (const [k, v] of [...es, ...en])
      expect(BAD.test(v), `${k}: ${v}`).toBe(false);
  });

  it("sin calorías, peso, talla, IMC, percentiles ni cantidades escritas", () => {
    const NO =
      /\b(calor[ií]as?|calories?|kcal|peso|weight|talla|height|imc|bmi|percentil\w*|percentile\w*|gramos?|grams?|porci[oó]n\w*|portions?|servings?)\b/i;
    for (const [k, v] of [...es, ...en]) {
      expect(NO.test(v), `${k}: ${v}`).toBe(false);
      expect(/\d/.test(v.replace(/\{\w+\}/g, "")), `${k}: ${v}`).toBe(false);
    }
  });

  it("ningún enlace ni dirección en los textos", () => {
    for (const [k, v] of [...es, ...en])
      expect(/https?:|www\.|@\w+\.\w+/i.test(v), `${k}: ${v}`).toBe(false);
  });
});
