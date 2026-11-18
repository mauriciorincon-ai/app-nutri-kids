import { describe, expect, it } from "vitest";

import { dayToDayText } from "@/i18n/day-to-day";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import { RECIPES } from "@/lib/recipes/book";
import { LUNCH_STATES } from "@/lib/wellbeing/values";
import { TRAVEL_MODES } from "@/lib/travel/engine";

function strings(o: unknown, path = ""): [string, string][] {
  if (typeof o === "string") return [[path, o]];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, path ? `${path}.${k}` : k),
  );
}
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("textos de lonchera, recetas y viaje (es/en)", () => {
  const es = strings(dayToDayText.es);
  const en = strings(dayToDayText.en);

  it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
    expect(en.map(([k]) => k)).toEqual(es.map(([k]) => k));
    const enMap = Object.fromEntries(en);
    for (const [k, v] of es) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(enMap[k].trim().length, k).toBeGreaterThan(0);
      expect(placeholders(enMap[k]), k).toEqual(placeholders(v));
    }
  });

  it("cada opción que se puede elegir tiene su palabra en los dos idiomas", () => {
    for (const t of Object.values(dayToDayText)) {
      for (const s of LUNCH_STATES) expect(t.lunch.states[s]).toBeTruthy();
      for (const m of TRAVEL_MODES) expect(t.travel.modes[m]).toBeTruthy();
      for (const c of new Set(RECIPES.map((r) => r.cost)))
        expect(t.recipes.cost[c]).toBeTruthy();
    }
  });

  it("ninguna frase suena a consejo médico (los títulos del documento nombran lo que el plan escribió)", () => {
    // La guarda mira PEDIDOS de consejo; los rótulos «Alergias», «Medicamentos» del documento
    // y de la lista del viaje son sustantivos sobre datos que escribió el plan, no consejos.
    const HEADINGS = /^travel\.(doc\.|medsTitle$|medsNone$)/;
    for (const [k, v] of [...es, ...en])
      if (!HEADINGS.test(k))
        expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
  });

  it("ninguna frase culpa, califica de «cumplimiento» ni urge con alarma", () => {
    const BAD =
      /\b(culpa\w*|fall[óo]\w*|incumpl\w*|no cumpli\w*|urgente\w*|peligr\w*|grave\w*|alarm\w*|malo|mala|failed|fail|guilt\w*|urgent\w*|danger\w*|serious\w*|bad)\b/i;
    for (const [k, v] of [...es, ...en])
      expect(BAD.test(v), `${k}: ${v}`).toBe(false);
  });

  it("sin calorías, peso, IMC ni percentiles, y sin cifras escritas en el copy", () => {
    const NO =
      /\b(calor[ií]as?|calories?|kcal|peso|weight|imc|bmi|percentil\w*|percentile\w*)\b/i;
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
