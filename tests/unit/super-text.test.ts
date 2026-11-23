import { describe, expect, it } from "vitest";

import { cameraText } from "@/i18n/camera";
import { readerSettingsText } from "@/i18n/reader-settings";
import { superText } from "@/i18n/super";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";

/** Textos del súper y de «Lector y catálogo» (S13 · ADR-019), con las mismas guardas que la etiqueta. */
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const BAD =
  /\b(culpa\w*|fall[óo]\w*|incumpl\w*|urgente\w*|peligr\w*|grave\w*|alarm\w*|malo|mala|failed|fail|guilt\w*|urgent\w*|danger\w*|serious\w*|bad)\b/i;
const NO =
  /\b(calor[ií]as?|calories?|kcal|peso|weight|talla|height|imc|bmi|percentil\w*|percentile\w*|gramos?|grams?|porci[oó]n\w*|portions?|servings?)\b/i;

for (const [name, texts] of [
  ["súper", superText],
  ["ajustes del lector y catálogo", readerSettingsText],
] as const) {
  const es = Object.entries(texts.es);
  const en = Object.entries(texts.en);
  describe(`textos de ${name} (es/en)`, () => {
    it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
      expect(en.map(([k]) => k)).toEqual(es.map(([k]) => k));
      const enMap = Object.fromEntries(en);
      for (const [k, v] of es) {
        expect(v.trim().length, k).toBeGreaterThan(0);
        expect(enMap[k].trim().length, k).toBeGreaterThan(0);
        expect(placeholders(enMap[k]), k).toEqual(placeholders(v));
      }
    });

    it("ninguna frase suena a consejo médico, culpa, urge ni da cantidades", () => {
      for (const [k, v] of [...es, ...en]) {
        expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
        expect(BAD.test(v), `${k}: ${v}`).toBe(false);
        expect(NO.test(v), `${k}: ${v}`).toBe(false);
      }
    });
  });
}

describe("el súper dice lo que promete", () => {
  it("lo escaneado no se guarda ni se envía, y el catálogo se baja solo si tocas el botón", () => {
    expect(superText.es.lead).toMatch(/no se guarda ni se envía/);
    expect(superText.en.lead).toMatch(/not saved or sent/);
    expect(superText.es.catalogLead).toMatch(/solo si tocas el botón/);
    expect(superText.en.catalogLead).toMatch(/only downloads if you tap the button/);
  });

  it("la atribución de ODbL está en el súper y en Ajustes, en los dos idiomas", () => {
    for (const t of [superText.es.attribution, readerSettingsText.es.attribution])
      expect(t).toMatch(/Open Food Facts.*ODbL/);
    for (const t of [superText.en.attribution, readerSettingsText.en.attribution])
      expect(t).toMatch(/Open Food Facts.*ODbL/);
  });

  it("lo que ya no va se avisa con calma y con «verifícalo con un adulto»", () => {
    expect(superText.es.boughtWarnNo).toMatch(/Verifícalo con un adulto/);
    expect(superText.en.boughtWarnNo).toMatch(/with an adult/);
    expect(superText.es.boughtWarnCheck).toMatch(/Verifícalo con un adulto/);
  });

  it("no se promete un «apto» sin lista: sin ingredientes dice «no sé qué lleva»", () => {
    expect(superText.es.leadUnreadable).toMatch(/No sé qué lleva/);
    expect(superText.en.leadUnreadable).toMatch(/don't know what it has/);
  });

  it("la cámara enlaza al modo súper en los dos idiomas", () => {
    expect(cameraText.es.superLink).toMatch(/súper/);
    expect(cameraText.en.superLink).toMatch(/[Ss]upermarket/);
  });
});
