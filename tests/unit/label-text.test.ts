import { describe, expect, it } from "vitest";

import { cameraText } from "@/i18n/camera";
import { labelText } from "@/i18n/label";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";

/** Textos de «Leer una etiqueta» (S13 · ADR-019), con las mismas guardas que los de la cámara. */
const es = Object.entries(labelText.es);
const en = Object.entries(labelText.en);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("textos de la etiqueta (es/en)", () => {
  it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
    expect(en.map(([k]) => k)).toEqual(es.map(([k]) => k));
    const enMap = Object.fromEntries(en);
    for (const [k, v] of es) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(enMap[k].trim().length, k).toBeGreaterThan(0);
      expect(placeholders(enMap[k]), k).toEqual(placeholders(v));
    }
  });

  it("todo resultado lleva «verifícalo con un adulto» y la foto no se guarda ni se envía", () => {
    expect(labelText.es.check).toMatch(/verifícalo con un adulto/i);
    expect(labelText.en.check).toMatch(/with an adult/i);
    expect(labelText.es.lead).toMatch(/no se guarda ni se envía/);
    expect(labelText.en.lead).toMatch(/not saved or sent/);
  });

  it("los cuatro veredictos tienen nombre propio, distinto entre sí", () => {
    for (const t of [labelText.es, labelText.en]) {
      const v = [t.verdictNo, t.verdictCheck, t.verdictUnreadable, t.verdictOk];
      expect(new Set(v).size).toBe(4);
    }
    expect(labelText.es.verdictOk).toBe("No vi nada que choque");
    expect(labelText.es.verdictUnreadable).toBe("No pude leerla");
  });

  it("ninguna frase suena a consejo médico, culpa, urge ni da cantidades", () => {
    const BAD =
      /\b(culpa\w*|fall[óo]\w*|incumpl\w*|urgente\w*|peligr\w*|grave\w*|alarm\w*|malo|mala|failed|fail|guilt\w*|urgent\w*|danger\w*|serious\w*|bad)\b/i;
    const NO =
      /\b(calor[ií]as?|calories?|kcal|peso|weight|talla|height|imc|bmi|percentil\w*|percentile\w*|gramos?|grams?|porci[oó]n\w*|portions?|servings?)\b/i;
    for (const [k, v] of [...es, ...en]) {
      expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
      expect(BAD.test(v), `${k}: ${v}`).toBe(false);
      expect(NO.test(v), `${k}: ${v}`).toBe(false);
      expect(/\d/.test(v.replace(/\{\w+\}/g, "")), `${k}: ${v}`).toBe(false);
    }
  });

  it("la cámara enlaza a la etiqueta en los dos idiomas", () => {
    expect(cameraText.es.labelLink).toMatch(/etiqueta/);
    expect(cameraText.en.labelLink).toMatch(/label/);
  });
});
