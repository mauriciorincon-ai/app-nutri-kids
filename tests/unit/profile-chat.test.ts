import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { answerQuestion, type OpenAnswer } from "@/lib/diet/answer";
import { composeAnswer } from "@/lib/diet/answer-text";
import { screenInput } from "@/lib/diet/guardrails";
import { dietPlanSchema, type DietPlan } from "@/lib/diet/schema";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";

// Solo la demo inventada del repo (regla dura 1).
const diet = dietPlanSchema.parse(
  JSON.parse(readFileSync(resolve("data/demo-diet.json"), "utf8")),
);
const NOW = new Date("2026-07-06T10:15:00");
const TEXT = { es: es.answer, en: en.answer } as const;

function open(
  q: string,
  lang: "es" | "en",
  plan: DietPlan = diet,
  accepted: Parameters<typeof answerQuestion>[4] = [],
): OpenAnswer {
  const a = answerQuestion(q, plan, NOW, lang, accepted);
  if (a.kind !== "open") throw new Error(`«${q}» no llegó al motor: ${a.kind}`);
  return a.answer;
}
const text = (a: OpenAnswer, lang: "es" | "en") =>
  composeAnswer(a, TEXT[lang], lang);

// Plan SIN perfil ni objetivos: lo que no trae se dice, no se inventa.
const bare: DietPlan = { ...diet, profile: undefined, goals: undefined };

describe("sueño y actividad salen del plan, en los dos idiomas", () => {
  it.each([
    ["¿Cuántas horas debe dormir?", "es", "sleep", "10 y 11 horas"],
    ["¿A qué hora se acuesta?", "es", "sleep", "10 y 11 horas"],
    ["How many hours should he sleep?", "en", "sleep", "10 to 11 hours"],
    ["¿Qué actividad física tiene?", "es", "activity", "Juego activo"],
    ["¿Puede hacer ejercicio?", "es", "activity", "Juego activo"],
    ["What activity does he need?", "en", "activity", "Active play"],
  ] as const)("%s", (q, lang, kind, expected) => {
    const a = open(q, lang);
    expect(a.kind).toBe(kind);
    expect(text(a, lang).lead).toContain(expected);
    expect(text(a, lang).notInPlan).toBe(false);
  });

  it("sin dato en el plan: «tu plan no lo dice»", () => {
    for (const [q, lang] of [
      ["¿Cuántas horas duerme?", "es"],
      ["¿Qué actividad hace?", "es"],
      ["How much does he sleep?", "en"],
    ] as const) {
      const a = open(q, lang, bare);
      expect(a.kind).toBe("not-in-plan");
      expect(text(a, lang).notInPlan).toBe(true);
    }
  });

  it("«jugo» (bebida) no es «jugar»: sigue siendo una consulta de alimento", () => {
    const a = answerQuestion("¿puede tomar jugo?", diet, NOW, "es");
    expect(a.kind === "open" && a.answer.kind === "activity").toBe(false);
  });
});

describe("«¿es alérgico a X?» contesta con el perfil del plan", () => {
  it("ES: alergia listada → sí, el plan la anota", () => {
    const a = open("¿Es alérgico a los mariscos?", "es");
    expect(a.kind === "allergy" && a.match?.as).toBe("allergy");
    expect(text(a, "es").lead).toContain("tu plan anota mariscos como alergia");
  });

  it("EN: allergy listed → yes, the plan lists it", () => {
    const a = open("Is he allergic to shellfish?", "en");
    expect(a.kind === "allergy" && a.match?.as).toBe("allergy");
    expect(text(a, "en").lead).toContain(
      "your plan lists shellfish as an allergy",
    );
  });

  it("intolerancia listada se dice como intolerancia, no como alergia", () => {
    const a = open("¿Tiene intolerancia al sorbitol?", "es");
    expect(a.kind === "allergy" && a.match?.as).toBe("intolerance");
    expect(text(a, "es").lead).toContain("intolerancia");
  });

  it("algo que el plan no lista: lista lo que SÍ trae y dice que lo otro «no lo dice»", () => {
    const a = open("¿Es alérgico a las nueces?", "es");
    expect(a.kind === "allergy" && a.match).toBeNull();
    const c = text(a, "es");
    expect(c.lead).toContain("Mariscos");
    expect(c.lead).toContain("tu plan no lo dice");
    expect(c.lead).not.toMatch(/no es alérgico/i);
  });

  it("los nombres del plan sobreviven a una re-redacción del aparato", () => {
    const c = text(open("¿Es alérgico a las nueces?", "es"), "es");
    expect(c.required).toEqual(
      expect.arrayContaining(["mariscos", "sorbitol"]),
    );
  });

  it("el plan sin alergias → «tu plan no lo dice»", () => {
    const a = open("¿Es alérgico a algo?", "es", bare);
    expect(a.kind).toBe("not-in-plan");
  });
});

describe("medicamentos: lo que el plan dice, o «tu plan no lo dice»", () => {
  it("ES y EN listan nombre, dosis y momento tal cual el plan", () => {
    const es1 = text(open("¿Qué medicamentos toma?", "es"), "es");
    expect(es1.items[0].text).toBe(
      "Medicamento demo · la que indica el profesional (ejemplo) · en la mañana",
    );
    const en1 = text(open("What medication does he take?", "en"), "en");
    expect(en1.items[0].text).toContain("Demo medicine");
    expect(en1.items[0].text).toContain("in the morning");
  });

  it("nombre, dosis y momento son términos obligatorios del acento", () => {
    const c = text(open("¿Qué medicamentos toma?", "es"), "es");
    expect(c.required).toEqual(
      expect.arrayContaining(["Medicamento demo", "en la mañana"]),
    );
  });

  it("un plan sin medicamentos: «tu plan no lo dice»", () => {
    expect(open("¿Toma alguna medicina?", "es", bare).kind).toBe("not-in-plan");
  });

  it("cambiar dosis o pedir diagnóstico SIGUE yendo al profesional", () => {
    for (const q of [
      "¿le subo la dosis del medicamento?",
      "¿le quito el medicamento?",
      "Should I increase the dose of the medication?",
      "¿Qué le pasa? Le dio una reacción alérgica",
      "Did he have an allergic reaction? It looks like a symptom",
    ])
      expect(screenInput(q), q).toBe("medical");
  });

  it("consultar el perfil ya no se rechaza", () => {
    for (const q of [
      "¿Es alérgico a los mariscos?",
      "¿Qué medicamentos toma?",
      "Is he allergic to shellfish?",
      "What medicine does he take?",
    ])
      expect(screenInput(q), q).toBe("ok");
  });
});

describe("el chat ordena por textura y marca lo que hoy no acepta", () => {
  it("sin texturas marcadas: orden del plan, sin marcas", () => {
    const c = text(open("No tengo manzana", "es"), "es");
    expect(c.items.map((i) => i.text)).toEqual([
      "pera",
      "kiwi",
      "uvas",
      "fresas",
    ]);
    expect(c.items.some((i) => i.marked)).toBe(false);
  });

  it("con «blanda» aceptada: kiwi y fresas primero; pera y uvas al final, marcadas", () => {
    const c = text(open("No tengo manzana", "es", diet, ["soft"]), "es");
    expect(c.items).toEqual([
      { text: "kiwi", marked: false },
      { text: "fresas", marked: false },
      { text: "pera", marked: true },
      { text: "uvas", marked: true },
    ]);
  });

  it("si ninguna textura del plan se acepta, la lista sigue completa", () => {
    const c = text(open("No tengo manzana", "es", diet, ["liquid"]), "es");
    expect(c.items).toHaveLength(4);
    expect(c.items.every((i) => i.marked)).toBe(true);
  });

  it("«no quiso X» también ordena", () => {
    const a = open("No quiso la manzana", "es", diet, ["chopped"]);
    const c = text(a, "es");
    expect(c.items.map((i) => i.text).slice(0, 2)).toEqual(["pera", "uvas"]);
    expect(c.items.slice(2).every((i) => i.marked)).toBe(true);
  });
});

describe("auditoría S5: anotaciones de quien cuida y nombres de varias palabras", () => {
  const withProfile = (allergies: string[]): DietPlan => ({
    ...diet,
    profile: {
      ...diet.profile,
      allergies: allergies.map((n, i) => ({
        id: `a${i}`,
        name: { es: n, en: n },
      })),
    },
  });

  it("una alergia anotada por quien cuida se dice como «anotada por ti», no como del plan", () => {
    const a = answerQuestion(
      "¿Es alérgico al kiwi?",
      diet,
      NOW,
      "es",
      [],
      [{ kind: "allergy", text: "Kiwi" }],
    );
    if (a.kind !== "open" || a.answer.kind !== "allergy") throw new Error();
    const c = composeAnswer(a.answer, TEXT.es, "es");
    expect(c.lead).toContain("Anotaste kiwi como alergia");
    expect(c.lead).toContain("no viene de tu plan");
  });

  it("sin coincidencia, las notas se listan aparte y el resto sigue sin decirse", () => {
    const a = answerQuestion(
      "¿Es alérgico a las nueces?",
      diet,
      NOW,
      "es",
      [],
      [{ kind: "allergy", text: "Kiwi" }],
    );
    if (a.kind !== "open" || a.answer.kind !== "allergy") throw new Error();
    const c = composeAnswer(a.answer, TEXT.es, "es");
    expect(c.lead).toContain("Tú anotaste: Kiwi");
    expect(c.lead).toContain("tu plan no lo dice");
    expect(c.required).toContain("kiwi");
  });

  it("medicamentos anotados por quien cuida se muestran marcados", () => {
    const a = answerQuestion(
      "¿Qué medicamentos toma?",
      diet,
      NOW,
      "es",
      [],
      [{ kind: "medication", text: "Gotas de ejemplo" }],
    );
    if (a.kind !== "open" || a.answer.kind !== "medication") throw new Error();
    const c = composeAnswer(a.answer, TEXT.es, "es");
    expect(c.items.map((i) => i.text)).toContain(
      "Anotado por ti: Gotas de ejemplo",
    );
  });

  it("«frutos secos» no responde por «frutos rojos»", () => {
    const plan = withProfile(["Frutos secos"]);
    const rojo = answerQuestion(
      "¿Es alérgico a los frutos rojos?",
      plan,
      NOW,
      "es",
    );
    if (rojo.kind !== "open" || rojo.answer.kind !== "allergy")
      throw new Error();
    expect(rojo.answer.match).toBeNull();
    const secos = answerQuestion(
      "¿Es alérgico a los frutos secos?",
      plan,
      NOW,
      "es",
    );
    if (secos.kind !== "open" || secos.answer.kind !== "allergy")
      throw new Error();
    expect(secos.answer.match?.as).toBe("allergy");
  });
});
