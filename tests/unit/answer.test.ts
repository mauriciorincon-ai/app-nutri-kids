import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  INTENT_PATTERNS,
  answerOpen,
  answerQuestion,
  detectIntent,
  matchMeal,
  type OpenAnswer,
  type OpenIntent,
} from "@/lib/diet/answer";
import { composeAnswer } from "@/lib/diet/answer-text";
import { dietPlanSchema } from "@/lib/diet/schema";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";

// Solo la demo inventada del repo (regla dura 1).
const diet = dietPlanSchema.parse(
  JSON.parse(readFileSync(resolve("data/demo-diet.json"), "utf8")),
);
// Fechas SIEMPRE fijas: lunes con la restricción demo vigente.
const at = (hhmm: string) => new Date(`2026-07-06T${hhmm}:00`);
const T10 = at("10:15"); // durante «Media mañana»

function open(q: string, lang: "es" | "en", now = T10): OpenAnswer {
  const a = answerOpen(q, diet, now, lang);
  if (!a) throw new Error(`sin respuesta abierta para «${q}»`);
  return a;
}

const names = (
  items: { name: { es: string; en: string } }[],
  l: "es" | "en",
) => items.map((i) => i.name[l]);

describe("tabla de patrones: cada intención nace {es, en}", () => {
  it.each(Object.keys(INTENT_PATTERNS) as OpenIntent[])(
    "%s tiene ES y EN",
    (intent) => {
      expect(INTENT_PATTERNS[intent].es.length).toBeGreaterThan(0);
      expect(INTENT_PATTERNS[intent].en.length).toBeGreaterThan(0);
    },
  );

  // Una prueba por CADA frase de la tabla (no solo un ejemplo por intención).
  const PHRASES = (Object.keys(INTENT_PATTERNS) as OpenIntent[]).flatMap((i) =>
    (["es", "en"] as const).flatMap((l) =>
      INTENT_PATTERNS[i][l].map((p) => [i, l, p] as const),
    ),
  );
  it.each(PHRASES)(
    "%s · %s · «%s» dispara su intención",
    (intent, lang, pattern) => {
      // «~» = una palabra cualquiera; «*» = cualquier terminación.
      const q = pattern.replace(/~/g, "algo").replace(/\*$/, "o");
      expect(detectIntent(q, lang)).toBe(intent);
    },
  );

  const PAIRS: [OpenIntent, string, string][] = [
    ["replacement", "no tengo pollo", "I don't have chicken"],
    ["replacement", "se acabó la manzana", "we ran out of apples"],
    [
      "replacement",
      "¿con qué reemplazo la manzana?",
      "what can I replace apples with?",
    ],
    ["replacement", "en vez de manzana", "instead of apples"],
    ["refused", "no quiso el brócoli", "he didn't want the broccoli"],
    ["refused", "no le gustó la pera", "she didn't like the pear"],
    ["refused", "rechazó el desayuno", "he refused breakfast"],
    ["meal", "¿qué le doy ahora?", "what can I give now?"],
    [
      "meal",
      "¿qué le doy de merienda?",
      "what should I give for the afternoon snack?",
    ],
    ["meal", "¿qué toca?", "what's next?"],
    ["hydration", "¿cuánta agua le doy?", "how much water should he drink?"],
    ["hydration", "¿cuántos vasos al día?", "how many glasses a day?"],
  ];
  it.each(PAIRS)("%s · «%s» / «%s»", (intent, qEs, qEn) => {
    expect(detectIntent(qEs, "es")).toBe(intent);
    expect(detectIntent(qEn, "en")).toBe(intent);
  });

  it("precedencia: el rechazo gana a la pregunta de menú, el reemplazo también", () => {
    expect(detectIntent("no quiso desayunar, ¿qué hago?", "es")).toBe(
      "refused",
    );
    expect(detectIntent("no tengo pollo, ¿qué le doy?", "es")).toBe(
      "replacement",
    );
  });

  it("«aguacate» no es agua (tokens, no subcadenas)", () => {
    expect(detectIntent("aguacate untado", "es")).toBeNull();
  });

  it("un lookup no trae intención abierta", () => {
    expect(detectIntent("¿la manzana se puede?", "es")).toBeNull();
    expect(detectIntent("can he have apples?", "en")).toBeNull();
  });
});

describe("«no tengo X» → reemplazos del plan", () => {
  it("con equivalencia explícita (manzana → pera, kiwi…) ES/EN", () => {
    const a = open("se acabó la manzana", "es");
    expect(a.kind).toBe("replacement");
    if (a.kind !== "replacement") return;
    expect(a.options.source).toBe("equivalence");
    expect(names(a.options.items, "es")).toEqual([
      "pera",
      "kiwi",
      "uvas",
      "fresas",
    ]);
    const b = open("we ran out of apples", "en");
    expect(b.kind === "replacement" && b.options.items.length).toBe(4);
  });

  it("sin equivalencia, un verde usa su mismo grupo (pollo → otras proteínas)", () => {
    const a = open("no tengo pollo, ¿qué le doy?", "es");
    if (a.kind !== "replacement") throw new Error(a.kind);
    expect(a.options.source).toBe("group");
    const list = names(a.options.items, "es").map((n) => n.toLowerCase());
    expect(list).not.toContain("pollo");
    expect(list.length).toBe(3);
    const b = open("I don't have chicken, what can I give?", "en");
    expect(b.kind).toBe("replacement");
  });

  it("negativo: un alimento que el plan no trae → «no lo dice», sin inventar", () => {
    expect(open("no tengo mandarina", "es")).toEqual({
      kind: "not-in-plan",
      reason: "unknown-food",
    });
    expect(open("I don't have tangerines", "en").kind).toBe("not-in-plan");
  });

  it("negativo: un amarillo sin equivalencia → «no trae reemplazos»", () => {
    const a = open("no tengo yogurt", "es");
    expect(a).toMatchObject({ kind: "not-in-plan", reason: "no-options" });
  });
});

describe("«no quiso X» → otras opciones y lo que sigue, sin culpa", () => {
  it("un alimento: opciones de su grupo + la próxima comida desde la hora", () => {
    const a = open("no quiso el brócoli", "es", at("12:45"));
    if (a.kind !== "refused") throw new Error(a.kind);
    expect(a.food?.es.toLowerCase()).toContain("br");
    expect(a.options?.source).toBe("group");
    expect(a.next?.id).toBe("merienda");
    const b = open("he didn't want the broccoli", "en", at("12:45"));
    expect(b.kind === "refused" && b.next?.id).toBe("merienda");
  });

  it("una comida nombrada: lo que sigue es la comida después de esa", () => {
    const a = open("no quiso desayunar, ¿qué hago?", "es", at("08:10"));
    if (a.kind !== "refused") throw new Error(a.kind);
    expect(a.meal?.id).toBe("desayuno");
    expect(a.next?.id).toBe("media-manana");
    const b = open("he didn't eat breakfast", "en", at("08:10"));
    expect(b.kind === "refused" && b.meal?.id).toBe("desayuno");
  });

  it("después de la última comida no hay «lo que sigue» de hoy", () => {
    const a = open("no quiso cenar", "es", at("20:00"));
    expect(a.kind === "refused" && a.meal?.id).toBe("cena");
    expect(a.kind === "refused" && a.next).toBeNull();
  });

  it("el texto no culpa ni califica (ES/EN)", () => {
    for (const [t, l] of [
      [es, "es"],
      [en, "en"],
    ] as const) {
      const c = composeAnswer(
        open(
          l === "es" ? "no quiso el brócoli" : "he didn't want the broccoli",
          l,
        ),
        t.answer,
        l,
      );
      expect(c.lead.toLowerCase()).not.toMatch(
        /culpa|mal|castigo|premio|guilt|bad|punish|reward/,
      );
    }
  });
});

describe("«¿qué le doy ahora?» → el menú de la hora", () => {
  it.each([
    ["06:30", "next", "desayuno"],
    ["07:30", "now", "desayuno"],
    ["09:00", "next", "media-manana"],
    ["10:15", "now", "media-manana"],
    ["16:10", "now", "merienda"],
    ["21:00", "tomorrow", "desayuno"],
  ] as const)("a las %s → %s %s", (hhmm, timing, id) => {
    const a = open("¿qué le doy ahora?", "es", at(hhmm));
    expect(a).toMatchObject({ kind: "meal", timing, meal: { id } });
    const b = open("what can I give now?", "en", at(hhmm));
    expect(b).toMatchObject({ kind: "meal", timing, meal: { id } });
  });

  it("la comida nombrada manda sobre la hora", () => {
    expect(open("¿qué le doy de merienda?", "es", at("07:30"))).toMatchObject({
      kind: "meal",
      timing: "named",
      meal: { id: "merienda" },
    });
    expect(
      open("what should I give for dinner?", "en", at("07:30")),
    ).toMatchObject({
      meal: { id: "cena" },
    });
  });

  it("matchMeal: «media» sola no es «Media mañana»; tronco «desayunar» sí es desayuno", () => {
    expect(matchMeal(diet, "media taza", "es")).toBeNull();
    expect(matchMeal(diet, "media mañana", "es")?.id).toBe("media-manana");
    expect(matchMeal(diet, "no quiso desayunar", "es")?.id).toBe("desayuno");
    expect(matchMeal(diet, "mid-morning", "en")?.id).toBe("media-manana");
  });
});

describe("«¿cuánta agua?» → hidratación del plan", () => {
  it("ES/EN con la meta y el hábito del plan", () => {
    const a = open("¿cuánta agua le doy?", "es");
    expect(a).toMatchObject({
      kind: "hydration",
      litersMin: 1.2,
      litersMax: 1.5,
      glasses: 4,
    });
    const c = composeAnswer(a, es.answer, "es");
    expect(c.lead).toContain("1,2");
    expect(c.lead).toContain(diet.hydration.habit.es);
    const ce = composeAnswer(open("how much water?", "en"), en.answer, "en");
    expect(ce.lead).toContain("1.2");
  });
});

describe("answerQuestion: la única puerta del chat", () => {
  it("médico → rechazo antes que cualquier respuesta", () => {
    expect(
      answerQuestion("¿le subo la dosis de la B12?", diet, T10, "es"),
    ).toEqual({
      kind: "rejection",
      reason: "medical",
    });
  });
  it("off-topic → rechazo", () => {
    expect(
      answerQuestion("¿quién ganó el partido?", diet, T10, "es").kind,
    ).toBe("rejection");
  });
  it("lookup → veredicto", () => {
    expect(answerQuestion("¿la manzana se puede?", diet, T10, "es").kind).toBe(
      "verdict",
    );
  });
  it("lo que el plan no dice → «no lo dice», jamás inventado (ES/EN)", () => {
    for (const [q, l] of [
      ["¿puede comer mandarina?", "es"],
      ["y el pastel de cumpleaños del colegio", "es"],
      ["can he have tangerines?", "en"],
    ] as const) {
      expect(answerQuestion(q, diet, T10, l)).toEqual({
        kind: "open",
        answer: { kind: "not-in-plan", reason: "unknown" },
      });
    }
  });
});

describe("composeAnswer: todo sale del plan + plantillas i18n", () => {
  it.each([
    ["se acabó la manzana", "we ran out of apples"],
    ["no tengo pollo", "I don't have chicken"],
    ["no quiso el brócoli", "he didn't want the broccoli"],
    ["no quiso desayunar", "he didn't eat breakfast"],
    ["¿qué le doy ahora?", "what can I give now?"],
    ["¿cuánta agua?", "how much water?"],
    ["no tengo mandarina", "I don't have tangerines"],
    ["no tengo yogurt", "I don't have yogurt"],
  ])("«%s» / «%s» sin placeholders sueltos", (qEs, qEn) => {
    for (const [q, l, t] of [
      [qEs, "es", es],
      [qEn, "en", en],
    ] as const) {
      const c = composeAnswer(open(q, l, at("16:10")), t.answer, l);
      expect(c.lead).not.toMatch(/\{\w+\}/);
      expect(c.next?.text ?? "").not.toMatch(/\{\w+\}/);
      for (const r of c.required)
        expect(c.lead.toLowerCase()).toContain(r.toLowerCase());
    }
  });

  it("«no lo dice» dice que lo pregunte a su profesional", () => {
    const c = composeAnswer(
      { kind: "not-in-plan", reason: "unknown" },
      es.answer,
      "es",
    );
    expect(c.notInPlan).toBe(true);
    expect(c.lead).toMatch(/no lo dice/);
    expect(
      composeAnswer({ kind: "not-in-plan", reason: "unknown" }, en.answer, "en")
        .lead,
    ).toMatch(/doesn't say/);
  });

  it("después de la cena, el rechazo dice que mañana empieza como siempre", () => {
    const c = composeAnswer(
      open("no quiso cenar", "es", at("20:00")),
      es.answer,
      "es",
    );
    expect(c.next?.text).toBe(es.answer.refusedNoNext);
  });

  it("mañana: tras la última comida el menú apunta al desayuno de mañana", () => {
    const c = composeAnswer(
      open("¿qué toca?", "es", at("21:00")),
      es.answer,
      "es",
    );
    expect(c.lead).toMatch(/Mañana/);
  });
});

describe("auditoría S4: casos de borde del motor", () => {
  it("las 4 sugerencias del chat contestan algo del plan, en ES y EN", () => {
    for (const [lang, dict] of [
      ["es", es],
      ["en", en],
    ] as const) {
      for (const q of [
        dict.chat.sugg1,
        dict.chat.sugg2,
        dict.chat.sugg3,
        dict.chat.sugg4,
      ]) {
        const a = answerQuestion(q, diet, T10, lang);
        const unknown = a.kind === "open" && a.answer.kind === "not-in-plan";
        expect(unknown, `«${q}» (${lang}) cayó en «el plan no lo dice»`).toBe(
          false,
        );
      }
    }
  });

  it("«qué desayuno le preparo / qué almuerzo le doy» se entienden", () => {
    expect(detectIntent("¿Qué desayuno le preparo?", "es")).toBe("meal");
    expect(detectIntent("¿Qué almuerzo le doy?", "es")).toBe("meal");
    expect(detectIntent("What dinner can I give?", "en")).toBe("meal");
  });

  it("nombrar un alimento gana sobre «ahora», «agua» o «qué hago»: es una consulta", () => {
    for (const [q, lang] of [
      ["¿puede comer pollo ahora?", "es"],
      ["can he eat chicken right now?", "en"],
    ] as const) {
      const a = answerQuestion(q, diet, T10, lang);
      expect(a.kind, q).toBe("verdict");
    }
  });

  it("«¿qué hago con el yogurt?» ya no se confunde con el menú de ahora", () => {
    const a = answerQuestion("¿qué hago con el yogurt?", diet, T10, "es");
    expect(a.kind === "open" ? a.answer.kind : a.kind).not.toBe("meal");
  });

  it("«¿no hay problema si come queso?» es una consulta, no un «no tengo»", () => {
    expect(detectIntent("¿no hay problema si come queso?", "es")).not.toBe(
      "replacement",
    );
    const a = answerQuestion(
      "¿no hay problema si come queso?",
      diet,
      T10,
      "es",
    );
    // Nunca un reemplazo inventado: o veredicto, o «tu plan no lo dice».
    expect(a.kind === "open" ? a.answer.kind : a.kind).not.toBe("replacement");
  });

  it("«receta» ya no dispara el guardrail médico: pregunta de comida → «el plan no lo dice», ES y EN", () => {
    for (const [q, lang] of [
      ["¿tienes una receta con pollo?", "es"],
      ["any recipe with chicken?", "en"],
    ] as const) {
      const a = answerQuestion(q, diet, T10, lang);
      expect(a.kind, q).not.toBe("rejection");
    }
    // …y recetar medicina sigue siendo médico.
    expect(
      answerQuestion("¿le recetaron algo para dormir?", diet, T10, "es").kind,
    ).toBe("rejection");
  });

  it("plurales y conjugaciones: «no le gustan las verduras», «no quieren»", () => {
    expect(detectIntent("no le gustan las verduras", "es")).toBe("refused");
    expect(detectIntent("no quieren comer", "es")).toBe("refused");
    expect(detectIntent("he doesn't like vegetables", "en")).toBe("refused");
  });

  it("«¿qué le doy mañana?» responde con el primer menú de mañana, no con el de ahora", () => {
    const a = open("¿qué le doy mañana?", "es");
    expect(a.kind).toBe("meal");
    if (a.kind === "meal") expect(a.timing).toBe("tomorrow");
    const e = open("what can I give tomorrow?", "en");
    if (e.kind === "meal") expect(e.timing).toBe("tomorrow");
  });

  it("jamás propone un alimento restringido hoy, ni de su grupo ni de las equivalencias", () => {
    const sintetica = structuredClone(diet);
    sintetica.restrictions.foods.push({
      id: "pera",
      name: { es: "Pera", en: "Pear" },
    });
    const a = answerOpen("no tengo kiwi", sintetica, T10, "es");
    expect(a?.kind).toBe("replacement");
    if (a?.kind === "replacement") {
      const dadas = a.options.items.map((i) => i.name.es);
      expect(dadas).not.toContain("Pera");
      expect(dadas.length).toBeGreaterThan(0);
    }
  });
});
