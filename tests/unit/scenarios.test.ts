import { describe, expect, it } from "vitest";

import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { looksLikeMedicalAdvice, screenInput } from "@/lib/diet/guardrails";
import { fridgeKey } from "@/lib/diet/plan-b";
import {
  buildScenario,
  SCENARIO_IDS,
  type ScenarioId,
} from "@/lib/diet/scenarios";
import type { DietPlan } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";

const NOW = new Date("2026-08-10T12:40:00");
const diet = (): DietPlan => structuredClone(getDemoDiet());

function allStrings(o: unknown, out: string[] = []): string[] {
  if (typeof o === "string") out.push(o);
  else if (o && typeof o === "object")
    for (const v of Object.values(o)) allStrings(v, out);
  return out;
}

/** Todo nombre que el plan trae: lo ÚNICO que un escenario puede nombrar como alimento. */
function planNames(d: DietPlan): Set<string> {
  const out = new Set<string>();
  const add = (n: { es: string; en: string }) => {
    out.add(fridgeKey({ es: n.es, en: n.es }));
    out.add(fridgeKey({ es: n.en, en: n.en }));
  };
  for (const g of d.trafficLight.green.groups)
    g.items.forEach((i) => add(i.name));
  d.trafficLight.red.items.forEach((i) => add(i.name));
  d.trafficLight.red.alsoAvoid.forEach((i) => add(i.name));
  d.trafficLight.yellow.items.forEach((i) => add(i.name));
  d.restrictions.foods.forEach((i) => add(i.name));
  return out;
}

describe("looksLikeMedicalAdvice — controles positivos", () => {
  it.each([
    "Dale 5 mg de hierro cada mañana",
    "Suspende el medicamento hoy",
    "Sube la dosis de la vitamina",
    "Give him 2 ml of the syrup",
    "Stop the medication tonight",
    "El diagnóstico es intolerancia",
    "The diagnosis is mild",
    "Tiene 800 calorías al día",
    "His weight is low for his height",
  ])("detecta «%s»", (s) => {
    expect(looksLikeMedicalAdvice(s)).toBe(true);
  });

  it.each([
    "Tu profesional: Equipo de nutrición.",
    "Aquí no hay indicaciones médicas: lo que no dice tu plan, se le pregunta a tu profesional.",
    "There is no medical advice here: whatever your plan doesn't say, ask your professional.",
  ])("deja pasar «%s»", (s) => {
    expect(looksLikeMedicalAdvice(s)).toBe(false);
  });
});

describe("copy de escenarios y plan B", () => {
  it("ninguna frase, en los dos idiomas, suena a indicación médica", () => {
    for (const [name, dict] of [
      ["es", es],
      ["en", en],
    ] as const) {
      for (const s of [
        ...allStrings(dict.scenarios),
        ...allStrings(dict.planB),
      ])
        expect(looksLikeMedicalAdvice(s), `${name}: ${s}`).toBe(false);
    }
  });

  it("las preguntas médicas siguen rechazadas por el chat", () => {
    for (const q of [
      "¿le subo la dosis de B12?",
      "should I increase his iron dose?",
      "¿qué le pasa si tiene fiebre?",
    ])
      expect(screenInput(q)).toBe("medical");
  });
});

describe("buildScenario", () => {
  const build = (id: ScenarioId, d = diet(), notes: never[] = []) =>
    buildScenario(id, d, NOW, notes);

  it("solo nombra alimentos que el plan trae", () => {
    const d = diet();
    const names = planNames(d);
    for (const id of SCENARIO_IDS) {
      const s = build(id, d);
      for (const x of [...s.avoid, ...s.safe, ...s.limits])
        expect(names.has(fridgeKey({ es: x.name.es, en: x.name.es }))).toBe(
          true,
        );
    }
  });

  it("jamás propone un rojo ni una restricción vigente como algo seguro", () => {
    const d = diet();
    const s = build("birthday", d);
    const blocked = new Set(s.avoid.map((a) => fridgeKey(a.name)));
    expect(blocked.size).toBeGreaterThan(0);
    for (const x of s.safe) expect(blocked.has(fridgeKey(x.name))).toBe(false);
  });

  it("lo que aguanta sin nevera va primero (marca del plan o del adulto)", () => {
    const d = diet();
    const item = d.trafficLight.green.groups[0]!.items.at(-1)!;
    item.keepsWithoutFridge = true;
    const s = build("birthday", d);
    expect(s.safe[0]!.keepsWithoutFridge).toBe(true);
    expect(s.safe[0]!.name.es).toBe(item.name.es);

    const d2 = diet();
    const last = d2.trafficLight.green.groups[0]!.items.at(-1)!;
    const s2 = buildScenario("birthday", d2, NOW, [
      {
        kind: "fridge",
        text: last.name.es,
      } as never,
    ]);
    expect(s2.safe[0]!.name.es).toBe(last.name.es);
    expect(s2.safe[0]!.keepsWithoutFridge).toBe(true);
  });

  it("sin restricción vigente, esa restricción no aparece en «lo que no puede»", () => {
    const d = diet();
    const inWindow = buildScenario("offered", d, NOW);
    const out = buildScenario("offered", d, new Date("2030-01-01T12:00:00"));
    expect(inWindow.avoid.some((a) => a.kind === "restricted")).toBe(true);
    expect(out.avoid.some((a) => a.kind === "restricted")).toBe(false);
  });

  it("la ficha solo existe en la emergencia y no inventa nada", () => {
    const d = diet();
    for (const id of SCENARIO_IDS)
      expect(build(id, d).card === null).toBe(id !== "emergency");
    const c = build("emergency", d).card!;
    expect(c.allergies.map((a) => a.es)).toEqual(
      (d.profile?.allergies ?? []).map((a) => a.name.es),
    );
    expect(c.medications.length).toBe((d.profile?.medications ?? []).length);
  });

  it("a quién llamar sale del plan: sin números ni contactos inventados", () => {
    const s = build("emergency");
    expect(s.professional.es).toBe(diet().meta.source.es);
    const text = JSON.stringify(s);
    expect(
      /\b\d{3}[ -]?\d{3,}/.test(text.replace(/\d{4}-\d{2}-\d{2}/g, "")),
    ).toBe(false);
  });

  it("marca la franja que corre o la que sigue", () => {
    const s = build("restaurant");
    expect(s.focusMeal).not.toBeNull();
    expect(s.meals.length).toBeGreaterThan(0);
  });
});
