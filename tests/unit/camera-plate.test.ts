import { describe, expect, it } from "vitest";

import { matchSeen } from "@/lib/camera/match";
import { mealGroups, plateMeal, readPlate } from "@/lib/camera/plate";
import type { DietPlan } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";

/**
 * Mirar el plato (S12 · ADR-018): lo que el modelo vio se lee contra el plan CARGADO. El reloj es
 * siempre una fecha fija. Salidas adversas: un rojo, una alergia (del perfil y anotada), un alimento
 * inventado, una comida cuyo texto no nombra ningún grupo.
 */
const diet = (): DietPlan => structuredClone(getDemoDiet());
// El plan de ejemplo: restricción de la manzana hasta el 2026-09-28; almuerzo 12:30–13:30.
const LUNCH = new Date("2026-07-06T12:45:00");
const plate = (
  text: string,
  over: {
    d?: DietPlan;
    now?: Date;
    notes?: { kind: string; text: string }[];
    meal?: string;
  } = {},
) => {
  const d = over.d ?? diet();
  const now = over.now ?? LUNCH;
  return readPlate(
    d,
    matchSeen(text, d, now),
    now,
    over.notes ?? [],
    over.meal,
  );
};
const stateOf = (p: ReturnType<typeof plate>, label: string) =>
  p.foods.find((f) => f.label === label)?.state;

describe("plateMeal: la comida que se mira (reloj inyectado)", () => {
  const d = diet();
  const at = (hhmm: string) =>
    plateMeal(d, new Date(`2026-07-06T${hhmm}:00`))?.id;
  it("en la franja: esa comida; antes de la primera y entre franjas: la que sigue; tras la última: la última", () => {
    expect(at("07:30")).toBe("desayuno");
    expect(at("12:45")).toBe("almuerzo");
    expect(at("05:00")).toBe("desayuno");
    expect(at("14:30")).toBe("merienda");
    expect(at("22:00")).toBe("cena");
  });
  it("una comida elegida manda; un id que no existe cae a la de la hora", () => {
    expect(plateMeal(d, LUNCH, "cena")?.id).toBe("cena");
    expect(plateMeal(d, LUNCH, "no-existe")?.id).toBe("almuerzo");
  });
});

describe("mealGroups: qué grupos nombra el texto de la comida", () => {
  const d = diet();
  const groups = (id: string) =>
    mealGroups(
      d,
      d.dailyMenu.find((m) => m.id === id)!,
    ).map((g) => g.id);
  it("por el grupo («2 verduras») o por uno de sus alimentos (pollo, arroz)", () => {
    expect(groups("almuerzo").sort()).toEqual([
      "cereales",
      "proteinas",
      "verduras",
    ]);
    expect(groups("desayuno").sort()).toEqual(["cereales", "proteinas"]);
    expect(groups("cena").sort()).toEqual([
      "cereales",
      "proteinas",
      "verduras",
    ]);
  });
  it("si el texto no nombra ningún grupo, no se inventa ninguno", () => {
    const x = diet();
    x.dailyMenu[0].content = {
      es: "Lo que haya en casa.",
      en: "Whatever is at home.",
    };
    expect(mealGroups(x, x.dailyMenu[0])).toEqual([]);
  });
});

describe("readPlate: semáforo de lo visto", () => {
  it("verde, amarillo y rojo salen del plan cargado, cada uno con su nombre del plan", () => {
    const p = plate("chicken, banana, apple");
    expect(stateOf(p, "chicken")).toBe("green");
    expect(stateOf(p, "banana")).toBe("yellow");
    expect(p.foods.find((f) => f.label === "banana")?.limit?.es).toMatch(/máx/);
    expect(stateOf(p, "apple")).toBe("red");
    expect(p.foods.find((f) => f.label === "apple")?.planName?.es).toBe(
      "Manzana",
    );
  });

  it("un rojo no se pierde aunque venga con verdes (el peor manda y se nombra)", () => {
    const p = plate("chicken, rice, soda, carrot");
    expect(stateOf(p, "soda")).toBe("red");
    expect(
      p.foods.filter((f) => f.state === "red").map((f) => f.label),
    ).toEqual(["soda"]);
  });

  it("la restricción vencida deja de ser roja: el día manda, no el reloj", () => {
    const after = new Date("2026-10-15T12:45:00");
    expect(stateOf(plate("apple", { now: LUNCH }), "apple")).toBe("red");
    expect(stateOf(plate("apple", { now: after }), "apple")).not.toBe("red");
  });

  it("lo que el plan no nombra nunca sale verde", () => {
    const p = plate("pasta, bread");
    for (const f of p.foods) expect(f.state, f.label).not.toBe("green");
  });

  it("un alimento inventado no entra: queda fuera y no suma ningún grupo", () => {
    const p = plate("unicorn steak, dragon fruit");
    expect(p.foods).toEqual([]);
    expect(p.missing.map((g) => g.id).sort()).toEqual(
      p.expected.map((g) => g.id).sort(),
    );
  });

  it("un texto vacío o basura no rompe nada", () => {
    for (const t of ["", "   ", "!!!", "\u0000"]) {
      const p = plate(t);
      expect(p.foods).toEqual([]);
      expect(p.allergyUnknown).toEqual([]);
    }
  });
});

describe("readPlate: alergias e intolerancias", () => {
  it("una alergia anotada choca aunque el alimento esté en el catálogo y en verde", () => {
    const p = plate("chicken, kiwi", {
      notes: [{ kind: "allergy", text: "kiwi" }],
    });
    expect(stateOf(p, "kiwi")).toBe("allergy");
    expect(stateOf(p, "chicken")).toBe("green");
  });

  it("la anotada en inglés y la del perfil del plan también (mariscos / shellfish)", () => {
    const p = plate("shellfish, chicken");
    expect(p.allergyUnknown).toEqual(["shellfish"]);
    const q = plate("peanuts", {
      notes: [{ kind: "intolerance", text: "peanuts" }],
    });
    expect(q.allergyUnknown).toEqual(["peanuts"]);
  });

  it("una alergia del plan sobre un alimento conocido manda sobre el verde", () => {
    const d = diet();
    d.profile!.allergies!.push({
      id: "huevo",
      name: { es: "Huevos", en: "Eggs" },
    });
    expect(stateOf(plate("eggs", { d }), "eggs")).toBe("allergy");
  });

  it("lo anotado como «no le gusta» o de otra clase no cuenta como alergia", () => {
    const p = plate("kiwi", { notes: [{ kind: "dislike", text: "kiwi" }] });
    expect(stateOf(p, "kiwi")).toBe("green");
  });
});

describe("readPlate: grupos que faltan", () => {
  it("lo que el texto de la comida nombra y la foto no trae se dice, sin culpa", () => {
    const p = plate("chicken, rice");
    expect(p.meal?.id).toBe("almuerzo");
    expect(p.expected.map((g) => g.id).sort()).toEqual([
      "cereales",
      "proteinas",
      "verduras",
    ]);
    expect(p.missing.map((g) => g.id)).toEqual(["verduras"]);
  });

  it("con todo lo esperado no falta nada", () => {
    expect(plate("chicken, rice, carrot").missing).toEqual([]);
  });

  it("un alimento en amarillo o rojo no cuenta como el grupo verde que falta", () => {
    expect(plate("chicken, rice, apple").missing.map((g) => g.id)).toEqual([
      "verduras",
    ]);
  });

  it("si el texto de la comida no nombra grupos, expected queda vacío (la pantalla lo dice)", () => {
    const d = diet();
    d.dailyMenu.find((m) => m.id === "almuerzo")!.content = {
      es: "Lo que haya.",
      en: "Whatever there is.",
    };
    const p = plate("chicken", { d });
    expect(p.expected).toEqual([]);
    expect(p.missing).toEqual([]);
  });

  it("la comida elegida a mano cambia lo esperado", () => {
    const p = plate("chicken", { meal: "desayuno" });
    expect(p.meal?.id).toBe("desayuno");
    expect(p.expected.map((g) => g.id).sort()).toEqual([
      "cereales",
      "proteinas",
    ]);
  });
});
