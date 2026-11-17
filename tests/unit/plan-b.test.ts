import { describe, expect, it } from "vitest";

import { es } from "@/i18n/es";
import { answerQuestion, detectIntent } from "@/lib/diet/answer";
import { composeAnswer } from "@/lib/diet/answer-text";
import { avoidTexts } from "@/lib/diet/options";
import {
  fridgeCandidates,
  fridgeMarks,
  planB,
  planBLate,
  planBNoFridge,
  planBOut,
  type PlanB,
} from "@/lib/diet/plan-b";
import { dietPlanSchema, type DietPlan } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";

// Plan inventado del repo; la ventana de la restricción cubre este día.
const NOW = new Date("2026-08-10T12:40:00");
const diet = (): DietPlan => structuredClone(getDemoDiet());

/** Todo nombre que el plan trae (equivalencias y verdes): lo ÚNICO que un plan B puede decir. */
function planNames(d: DietPlan): Set<string> {
  const out = new Set<string>();
  for (const e of d.equivalences)
    for (const u of e.use) {
      out.add(u.name.es);
      out.add(u.name.en);
    }
  for (const g of d.trafficLight.green.groups)
    for (const i of g.items) {
      out.add(i.name.es);
      out.add(i.name.en);
    }
  return out;
}

function namesOf(p: PlanB): string[] {
  if (p.kind === "options" && p.situation === "no-fridge")
    return p.items.flatMap((i) => [i.name.es, i.name.en]);
  if (p.kind === "options") return p.options.items.map((i) => i.name.es);
  return [];
}

describe("plan B · «se acabó X»", () => {
  it("da las equivalencias del plan para un alimento restringido", () => {
    const p = planBOut(diet(), "manzana", NOW);
    expect(p.kind).toBe("options");
    expect(namesOf(p)).toEqual(["pera", "kiwi", "uvas", "fresas"]);
  });

  it("un alimento que el plan no trae → «el plan no lo dice»", () => {
    expect(planBOut(diet(), "dragon-fruit", NOW)).toEqual({
      situation: "out",
      kind: "not-in-plan",
      reason: "unknown-food",
    });
  });

  it("un alimento del plan sin reemplazo → no-options (no se inventa uno)", () => {
    const p = planBOut(diet(), "yogurt", NOW);
    expect(p).toMatchObject({ kind: "not-in-plan", reason: "no-options" });
  });
});

describe("plan B · «no hay nevera»", () => {
  it("sin ninguna marca, el plan no lo dice", () => {
    expect(planBNoFridge(diet(), NOW)).toMatchObject({
      kind: "not-in-plan",
      reason: "no-marks",
    });
  });

  it("una opción que el plan marca sale con su origen, y la que marca un adulto también", () => {
    const d = diet();
    d.equivalences[0].use[0].keepsWithoutFridge = true; // pera
    expect(dietPlanSchema.safeParse(d).success).toBe(true);
    const p = planBNoFridge(d, NOW, ["kiwi"]);
    expect(p.kind).toBe("options");
    if (p.kind !== "options" || p.situation !== "no-fridge") throw new Error();
    expect(p.items.map((i) => [i.name.es, i.marked])).toEqual([
      ["pera", "plan"],
      ["kiwi", "adult"],
    ]);
    expect(p.items[0].origin).toMatchObject({ kind: "equivalence" });
  });

  it("un verde del plan marcado por el plan también cuenta, con su grupo", () => {
    const d = diet();
    d.trafficLight.green.groups[3].items[0].keepsWithoutFridge = true; // arroz
    const p = planBNoFridge(d, NOW);
    if (p.kind !== "options" || p.situation !== "no-fridge") throw new Error();
    expect(p.items[0].origin).toMatchObject({ kind: "group" });
  });

  it("jamás propone algo que hoy esté en rojo o restringido, aunque lo marquen", () => {
    const d = diet();
    // Un reemplazo que el plan listó y que además está en rojo en su propia lista.
    d.equivalences[2].use[0] = {
      name: { es: "gaseosas", en: "soda" },
      keepsWithoutFridge: true,
    };
    const p = planBNoFridge(d, NOW, ["gaseosas", "manzana"]);
    expect(namesOf(p)).not.toContain("gaseosas");
    // «manzana» está restringida hoy y no es opción de nadie: la marca no la crea.
    expect(namesOf(p)).not.toContain("manzana");
  });

  it("centinela: todo nombre devuelto está en el plan, con cualquier marca", () => {
    const d = diet();
    const names = planNames(d);
    const marks = [
      "pera",
      "kiwi",
      "uvas",
      "fresas",
      "pollo",
      "inventado",
      "arroz",
    ];
    const p = planBNoFridge(d, NOW, marks);
    for (const n of namesOf(p)) expect(names.has(n)).toBe(true);
    expect(namesOf(p)).not.toContain("inventado");
  });

  it("fridgeCandidates lista lo que se puede marcar, con quién lo marcó", () => {
    const d = diet();
    d.equivalences[0].use[0].keepsWithoutFridge = true;
    const list = fridgeCandidates(d, NOW, ["kiwi"]);
    expect(list.find((c) => c.name.es === "pera")?.marked).toBe("plan");
    expect(list.find((c) => c.name.es === "kiwi")?.marked).toBe("adult");
    expect(list.find((c) => c.name.es === "fresas")?.marked).toBeNull();
    expect(list.find((c) => c.name.es === "gaseosas")).toBeUndefined();
  });
});

describe("plan B · «llegamos tarde»", () => {
  const at = (hhmm: string) => new Date(`2026-08-10T${hhmm}:00`);

  it("durante una franja: la franja y la que sigue, tal como las escribió el plan", () => {
    const p = planBLate(diet(), at("12:45"));
    expect(p).toMatchObject({ kind: "late" });
    if (p.kind !== "late") throw new Error();
    expect(p.current?.id).toBe("almuerzo");
    expect(p.next?.id).toBe("merienda");
  });

  it("entre dos franjas, antes de la primera y después de la última", () => {
    const between = planBLate(diet(), at("15:00"));
    const before = planBLate(diet(), at("05:00"));
    const after = planBLate(diet(), at("21:00"));
    if (
      between.kind !== "late" ||
      before.kind !== "late" ||
      after.kind !== "late"
    )
      throw new Error();
    expect([between.prev?.id, between.next?.id]).toEqual([
      "almuerzo",
      "merienda",
    ]);
    expect([before.prev, before.next?.id]).toEqual([null, "desayuno"]);
    expect([after.prev?.id, after.next]).toEqual(["cena", null]);
  });

  it("jamás trae un alimento fuera del menú: solo las franjas del plan", () => {
    const d = diet();
    const p = planBLate(d, NOW);
    if (p.kind !== "late") throw new Error();
    const ids = new Set(d.dailyMenu.map((m) => m.id));
    for (const m of [p.current, p.prev, p.next])
      if (m) expect(ids.has(m.id)).toBe(true);
  });

  it("planB() es la puerta única de no-fridge y late", () => {
    expect(planB("late", diet(), NOW).situation).toBe("late");
    expect(planB("no-fridge", diet(), NOW).situation).toBe("no-fridge");
  });
});

describe("plan B en el chat", () => {
  const ask = (
    q: string,
    lang: "es" | "en" = "es",
    notes: { kind: string; text: string }[] = [],
  ) => answerQuestion(q, diet(), NOW, lang, [], notes);

  it.each([
    ["no hay nevera", "es"],
    ["no tengo nevera, qué le doy", "es"],
    ["estamos sin nevera", "es"],
    ["there's no fridge", "en"],
    ["we are without a fridge", "en"],
  ] as const)("«%s» es plan B de nevera, no un «no hay X»", (q, lang) => {
    expect(detectIntent(q, lang)).toBe("nofridge");
    const a = ask(q, lang);
    expect(a).toMatchObject({ kind: "open", answer: { kind: "plan-b" } });
  });

  it.each([
    ["llegamos tarde", "es"],
    ["se nos hizo tarde para la merienda", "es"],
    ["we are running late", "en"],
    ["we got home late", "en"],
  ] as const)("«%s» es plan B de hora", (q, lang) => {
    expect(detectIntent(q, lang)).toBe("late");
  });

  it("«se acabó la manzana» sigue siendo un reemplazo del plan", () => {
    const a = ask("se acabó la manzana");
    expect(a).toMatchObject({ kind: "open", answer: { kind: "replacement" } });
  });

  it("sin marcas, el chat dice «tu plan no lo dice»; con la anotación de un adulto, la opción", () => {
    const none = ask("no hay nevera");
    if (none.kind !== "open" || none.answer.kind !== "plan-b")
      throw new Error();
    const c = composeAnswer(none.answer, es.answer, "es");
    expect(c.notInPlan).toBe(true);
    expect(c.lead).toMatch(/no dice/i);

    const some = ask("no hay nevera", "es", [{ kind: "fridge", text: "Kiwi" }]);
    if (some.kind !== "open" || some.answer.kind !== "plan-b")
      throw new Error();
    const c2 = composeAnswer(some.answer, es.answer, "es");
    expect(c2.items.map((i) => i.text)).toEqual([
      `kiwi · ${es.answer.planBMarkedAdult}`,
    ]);
    expect(c2.notInPlan).toBe(false);
  });

  it("las frases médicas siguen rechazadas, también en una urgencia de comida", () => {
    expect(ask("no hay nevera, ¿le subo la dosis de B12?")).toMatchObject({
      kind: "rejection",
      reason: "medical",
    });
  });
});

describe("plan B · lo que quien cuida anotó como alergia o intolerancia", () => {
  it("avoidTexts toma solo alergias e intolerancias", () => {
    expect(
      avoidTexts([
        { kind: "allergy", text: "kiwi" },
        { kind: "intolerance", text: "fresas" },
        { kind: "other", text: "pera" },
        { kind: "fridge", text: "uvas" },
      ]),
    ).toEqual(["kiwi", "fresas"]);
  });

  it("«se acabó»: la opción que choca con lo anotado no se propone (en ninguno de los dos idiomas)", () => {
    const base = planBOut(diet(), "manzana", NOW);
    expect(names(base)).toContain("kiwi");
    for (const noted of ["kiwi", "Kiwi ", "KIWI"]) {
      const p = planBOut(diet(), "manzana", NOW, [], [noted]);
      expect(names(p)).not.toContain("kiwi");
      expect(names(p)).toContain("pera");
    }
  });

  it("se mira en los dos sentidos: lo anotado puede ser un pedazo del nombre, o el nombre, un pedazo de lo anotado", () => {
    const d = diet();
    d.equivalences[0].use.push({
      name: { es: "crema de almendra", en: "almond butter" },
      texture: "soft",
    });
    expect(names(planBOut(d, "manzana", NOW))).toContain("crema de almendra");
    expect(names(planBOut(d, "manzana", NOW, [], ["almendra"]))).not.toContain(
      "crema de almendra",
    );
    expect(
      names(planBOut(d, "manzana", NOW, [], ["crema de almendra tostada"])),
    ).not.toContain("crema de almendra");
  });

  it("si todas las opciones chocan, no hay opciones: «consúltalo con tu profesional», jamás una a ciegas", () => {
    const all = ["pera", "kiwi", "uvas", "fresas"];
    expect(planBOut(diet(), "manzana", NOW, [], all)).toMatchObject({
      kind: "not-in-plan",
      reason: "no-options",
    });
  });

  it("un verde que se acabó: sus hermanos del grupo también se filtran", () => {
    const p = planBOut(diet(), "pollo", NOW, [], ["huevos"]);
    expect(p.kind).toBe("options");
    expect(names(p)).not.toContain("huevos");
    expect(names(planBOut(diet(), "pollo", NOW))).toContain("huevos");
  });

  it("«no hay nevera»: una opción marcada que choca con lo anotado no sale", () => {
    const d = diet();
    expect(names(planBNoFridge(d, NOW, ["kiwi"]))).toContain("kiwi");
    expect(planBNoFridge(d, NOW, ["kiwi"], [], ["kiwi"])).toMatchObject({
      kind: "not-in-plan",
      reason: "no-marks",
    });
    expect(
      planB("no-fridge", d, NOW, { marks: ["kiwi"], avoid: ["kiwi"] }),
    ).toMatchObject({ reason: "no-marks" });
  });

  it("el chat respeta lo anotado igual que la tarjeta", () => {
    const notes = [{ kind: "allergy", text: "kiwi" }];
    const chat = answerQuestion(
      "se acabó la manzana, ¿qué le doy?",
      diet(),
      NOW,
      "es",
      [],
      notes,
    );
    expect(JSON.stringify(chat).toLowerCase()).not.toContain("kiwi");
  });
});

describe("plan B · marcas «aguanta sin nevera» escritas a mano", () => {
  it("casan sin importar mayúsculas, tildes, signos ni espacios", () => {
    const d = diet();
    d.equivalences[0].use[0].name = {
      es: "Sándwich de pavo",
      en: "Turkey sandwich",
    };
    for (const mark of [
      "sándwich de pavo",
      "  SANDWICH   de pavo ",
      "Sandwich de pavo.",
    ]) {
      const p = planBNoFridge(
        d,
        NOW,
        fridgeMarks([{ kind: "fridge", text: mark }]),
      );
      expect(names(p)).toContain("sándwich de pavo");
    }
    const list = fridgeCandidates(d, NOW, ["SANDWICH de pavo"]);
    expect(list.find((c) => c.name.es === "Sándwich de pavo")?.marked).toBe(
      "adult",
    );
  });

  it("solo cuentan las anotaciones de tipo «aguanta sin nevera»", () => {
    expect(
      fridgeMarks([
        { kind: "fridge", text: "Kiwi" },
        { kind: "other", text: "pera" },
      ]),
    ).toEqual(["kiwi"]);
  });
});

function names(p: PlanB): string[] {
  return namesOf(p).map((n) => n.toLowerCase());
}
