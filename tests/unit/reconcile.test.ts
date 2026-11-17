import { describe, expect, it } from "vitest";

import { resolveItemStatus } from "@/lib/diet/logic";
import {
  reconcile,
  relaxesRed,
  switchLine,
  switchableLines,
  type Choices,
} from "@/lib/diet/reconcile";
import {
  dietPlanSchema,
  parseDietJson,
  type DietPlan,
} from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";

// Plan inventado del repo (la ÚNICA dieta del repo); su restricción vigente cubre este día.
const NOW = new Date("2026-08-10T12:40:00");
const A = (): DietPlan => structuredClone(getDemoDiet());

const lt = (es: string, en = es) => ({ es, en });

function removeFrom(d: DietPlan, id: string) {
  const tl = d.trafficLight;
  tl.red.items = tl.red.items.filter((i) => i.id !== id);
  tl.yellow.items = tl.yellow.items.filter((i) => i.id !== id);
  for (const g of tl.green.groups) g.items = g.items.filter((i) => i.id !== id);
  d.restrictions.foods = d.restrictions.foods.filter((f) => f.id !== id);
}
const group = (d: DietPlan, id: string) =>
  d.trafficLight.green.groups.find((g) => g.id === id)!;

/** El segundo plan, inventado: un choque de cada tipo contra la demo. */
function B(): DietPlan {
  const d = A();
  d.meta.id = "plan-b";
  d.meta.title = lt("Segundo plan", "Second plan");
  d.meta.source = lt("Profesional B (inventado)", "Professional B (made up)");
  // rojo contra verde: lo que A prohíbe, B lo permite
  removeFrom(d, "gaseosas");
  group(d, "cereales").items.push({
    id: "gaseosas",
    name: d.trafficLight.red.items[0].name,
  });
  // y al revés: lo que A permite, B lo prohíbe
  removeFrom(d, "pera");
  d.trafficLight.red.items.push({
    id: "pera",
    name: lt("pera", "pear"),
    why: lt("Motivo del plan B", "Plan B reason"),
  });
  // amarillo contra verde
  removeFrom(d, "banano");
  group(d, "frutas").items.push({ id: "banano", name: lt("banano", "banana") });
  // dos medidas
  d.trafficLight.yellow.items.find((i) => i.id === "yogurt")!.limit = lt(
    "Medida de B",
    "B limit",
  );
  // dos dosis y dos horarios
  d.supplements[0].dose = lt("2 masticables", "2 chewables");
  d.supplements[1].days = ["mon", "thu"];
  d.dailyMenu[0].start = "07:30";
  d.dailyMenu[0].end = "08:30";
  d.dailyMenu[1].content = lt("Fruta distinta de B", "B different fruit");
  // dos texturas
  d.equivalences[0].use[1].texture = "crunchy"; // kiwi: A dice «soft»
  // una porción distinta
  group(d, "cereales").portion = lt("Porción de B", "B portion");
  // perfil: alergia nueva, medicamento con otra dosis, otra condición
  d.profile!.allergies!.push({ id: "sesamo", name: lt("Sésamo", "Sesame") });
  d.profile!.medications![0].dose = lt(
    "Otra dosis (ejemplo)",
    "Another dose (sample)",
  );
  d.profile!.condition = lt(
    "Otra condición de ejemplo",
    "Another sample condition",
  );
  d.hydration.targetLitersMax = 2;
  // restricción con ventana más ancha
  d.restrictions.validFrom = "2026-06-01";
  d.restrictions.validUntil = "2026-12-31";
  // cosas solo de B
  group(d, "proteinas").items.push({ id: "quinoa", name: lt("quinoa") });
  d.trafficLight.red.additives.push({
    code: "E996",
    name: lt("Aditivo B"),
    foundIn: lt("Algo de B"),
  });
  d.supplements.push({
    id: "hierro-b",
    name: lt("Suplemento B"),
    days: ["sun"],
    dose: lt("1"),
    when: lt("Con la cena", "With dinner"),
  });
  d.dailyMenu.push({
    id: "snack-noche",
    name: lt("Snack de noche", "Night snack"),
    start: "20:00",
    end: "20:30",
    content: lt("Algo de B"),
  });
  return d;
}

const pickAll = (keys: string[], side: "a" | "b"): Choices =>
  Object.fromEntries(keys.map((k) => [k, side]));

describe("reconcile · dos planes iguales", () => {
  it("sin choques, válido y con el origen de cada línea", () => {
    const b = A();
    b.meta.id = "copia";
    const r = reconcile(A(), b);
    expect(r.conflicts).toEqual([]);
    expect(r.pending).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.plan.merged?.from[1].id).toBe("copia");
    expect(r.plan.merged?.lines["food:gaseosas"]).toMatchObject({
      from: "both",
      rule: "same",
    });
  });
});

describe("reconcile · lo prohibido gana solo", () => {
  it("rojo en A y verde en B: queda rojo, marcado con su origen A y la cara de B guardada", () => {
    const r = reconcile(A(), B());
    expect(resolveItemStatus(r.plan, "gaseosas", NOW)?.kind).toBe("red");
    expect(r.plan.merged!.lines["food:gaseosas"]).toMatchObject({
      from: "a",
      rule: "red",
      alt: { t: "place", place: { color: "green" } },
    });
    expect(r.conflicts.find((c) => c.key === "food:gaseosas")).toBeUndefined();
  });

  it("verde en A y rojo en B: queda rojo, con origen B", () => {
    const r = reconcile(A(), B());
    expect(resolveItemStatus(r.plan, "pera", NOW)?.kind).toBe("red");
    expect(r.plan.merged!.lines["food:pera"]).toMatchObject({
      from: "b",
      rule: "red",
    });
  });

  it("lo mismo al unir en el otro orden (B primero)", () => {
    const r = reconcile(B(), A());
    expect(resolveItemStatus(r.plan, "gaseosas", NOW)?.kind).toBe("red");
    expect(resolveItemStatus(r.plan, "pera", NOW)?.kind).toBe("red");
  });

  it("restricción de B contra verde de A: queda restringido, y la ventana es la más ancha", () => {
    const a = A();
    const b = A();
    removeFrom(a, "manzana");
    group(a, "frutas").items.push({
      id: "manzana",
      name: lt("manzana", "apple"),
    });
    b.restrictions.validUntil = "2026-12-31";
    const r = reconcile(a, b);
    expect(resolveItemStatus(r.plan, "manzana", NOW)).toMatchObject({
      kind: "restricted",
      restrictionActive: true,
    });
    expect(r.plan.restrictions.validUntil).toBe("2026-12-31");
    expect(r.plan.merged!.lines.restrictions).toMatchObject({ rule: "red" });
  });

  it("alergias e intolerancias se suman, sin perder ninguna", () => {
    const r = reconcile(A(), B());
    expect(r.plan.profile!.allergies!.map((x) => x.id).sort()).toEqual([
      "mariscos",
      "sesamo",
    ]);
    expect(r.plan.merged!.lines["allergy:sesamo"]).toMatchObject({
      from: "b",
      rule: "only",
    });
  });

  it("aditivos y «además evitar» de los dos quedan", () => {
    const r = reconcile(A(), B());
    expect(r.plan.trafficLight.red.additives.map((x) => x.code)).toContain(
      "E996",
    );
    expect(r.plan.trafficLight.red.alsoAvoid.length).toBe(2);
  });

  it.each([["a"], ["b"]] as const)(
    "invariante: con cada elección «%s» en todo, jamás es menos estricto en lo rojo",
    (side) => {
      const a = A();
      const b = B();
      const first = reconcile(a, b);
      const r = reconcile(
        a,
        b,
        pickAll(
          first.conflicts.map((c) => c.key),
          side,
        ),
      );
      const red = (p: DietPlan) => [
        ...p.restrictions.foods.map((f) => f.id),
        ...p.trafficLight.red.items.map((f) => f.id),
        ...p.trafficLight.red.alsoAvoid.map((f) => f.id),
      ];
      for (const id of [...red(a), ...red(b)]) {
        const k = resolveItemStatus(r.plan, id, NOW)?.kind;
        expect(["red", "restricted"], id).toContain(k);
      }
      for (const x of [
        ...(a.profile?.allergies ?? []),
        ...(b.profile?.allergies ?? []),
      ])
        expect(r.plan.profile!.allergies!.map((y) => y.id)).toContain(x.id);
      expect(r.valid).toBe(true);
    },
  );
});

describe("reconcile · lo demás lo elige un padre, uno por uno", () => {
  const conflict = (kind: string, key: string) => {
    const r = reconcile(A(), B());
    const c = r.conflicts.find((x) => x.kind === kind && x.key.startsWith(key));
    expect(c, `${kind} ${key}`).toBeDefined();
    return { r, c: c! };
  };

  it("amarillo contra verde (color)", () => {
    const { r, c } = conflict("color", "food:banano");
    expect(r.pending).toContain(c.key);
    expect(resolveItemStatus(r.plan, "banano", NOW)?.kind).toBe("yellow"); // A por defecto
    const pickB = reconcile(A(), B(), { [c.key]: "b" });
    expect(resolveItemStatus(pickB.plan, "banano", NOW)?.kind).toBe("green");
    expect(pickB.plan.merged!.lines[c.key]).toMatchObject({
      from: "b",
      rule: "picked",
    });
    expect(pickB.pending).not.toContain(c.key);
  });

  it("dos medidas del amarillo (limit)", () => {
    const { c } = conflict("limit", "food:yogurt");
    const r = reconcile(A(), B(), { [c.key]: "b" });
    expect(
      r.plan.trafficLight.yellow.items.find((i) => i.id === "yogurt")!.limit.es,
    ).toBe("Medida de B");
  });

  it("dos dosis de un suplemento", () => {
    const { c } = conflict("dose", "supplement:multivitaminico-demo");
    expect(reconcile(A(), B()).plan.supplements[0].dose.es).toBe(
      "1 masticable",
    );
    const r = reconcile(A(), B(), { [c.key]: "b" });
    expect(r.plan.supplements[0].dose.es).toBe("2 masticables");
  });

  it("dos horarios: una franja y los días de un suplemento", () => {
    const meal = conflict("schedule", "meal:desayuno");
    const supp = conflict("schedule", "supplement:omega-demo");
    const r = reconcile(A(), B(), { [meal.c.key]: "b", [supp.c.key]: "b" });
    expect(r.plan.dailyMenu[0]).toMatchObject({ start: "07:30", end: "08:30" });
    expect(r.plan.supplements[1].days).toEqual(["mon", "thu"]);
    // la franja conserva su id: lo que el colegio ya tiene firmado sigue apuntando a ella
    expect(r.plan.dailyMenu[0].id).toBe("desayuno");
  });

  it("dos texturas de una misma opción", () => {
    const { c } = conflict("texture", "equivalence:manzana");
    expect(reconcile(A(), B()).plan.equivalences[0].use[1].texture).toBe(
      "soft",
    );
    const r = reconcile(A(), B(), { [c.key]: "b" });
    expect(r.plan.equivalences[0].use[1].texture).toBe("crunchy");
  });

  it("contenido de una franja, porción, hidratación, medicamento y condición", () => {
    for (const [kind, key] of [
      ["content", "meal:media-manana"],
      ["portion", "group:cereales"],
      ["hydration", "hydration"],
      ["dose", "medication:medicamento-demo"],
      ["text", "condition"],
    ] as const) {
      const { c } = conflict(kind, key);
      const r = reconcile(A(), B(), { [c.key]: "b" });
      expect(r.valid).toBe(true);
      expect(r.plan.merged!.lines[c.key].rule).toBe("picked");
    }
    const hb = reconcile(A(), B(), { hydration: "b" }).plan.hydration;
    expect(hb.targetLitersMax).toBe(2);
  });

  it("todo choque queda pendiente hasta que se elige, y la lista es completa", () => {
    const r = reconcile(A(), B());
    expect(r.pending.length).toBe(r.conflicts.length);
    expect(r.conflicts.map((c) => c.kind).sort()).toEqual(
      [
        "color",
        "content",
        "dose",
        "dose",
        "hydration",
        "limit",
        "portion",
        "schedule",
        "schedule",
        "text",
        "texture",
      ].sort(),
    );
    const all = reconcile(A(), B(), pickAll(r.pending, "a"));
    expect(all.pending).toEqual([]);
  });
});

describe("reconcile · lo que solo trae uno se queda, con su origen", () => {
  it("alimento, suplemento, franja y aditivo de B entran marcados «b»", () => {
    const r = reconcile(A(), B());
    expect(resolveItemStatus(r.plan, "quinoa", NOW)?.kind).toBe("green");
    expect(r.plan.merged!.lines["food:quinoa"]).toMatchObject({
      from: "b",
      rule: "only",
    });
    expect(r.plan.merged!.lines["supplement:hierro-b"]).toMatchObject({
      from: "b",
    });
    expect(r.plan.merged!.lines["meal:snack-noche"]).toMatchObject({
      from: "b",
    });
    expect(r.plan.merged!.lines["additive:E996"]).toMatchObject({ from: "b" });
    expect(r.plan.merged!.lines["food:pollo"]).toMatchObject({
      from: "both",
      rule: "same",
    });
  });

  it("centinela: ningún nombre de alimento, suplemento ni franja sale de la nada", () => {
    const a = A();
    const b = B();
    const known = new Set<string>();
    for (const p of [a, b]) {
      for (const g of p.trafficLight.green.groups)
        for (const i of g.items) known.add(i.name.es);
      for (const i of [
        ...p.trafficLight.red.items,
        ...p.trafficLight.yellow.items,
        ...p.trafficLight.red.alsoAvoid,
        ...p.restrictions.foods,
      ])
        known.add(i.name.es);
      for (const s of p.supplements) known.add(s.name.es);
      for (const m of p.dailyMenu) known.add(m.name.es);
    }
    const r = reconcile(a, b);
    const names = [
      ...r.plan.trafficLight.green.groups.flatMap((g) =>
        g.items.map((i) => i.name.es),
      ),
      ...r.plan.trafficLight.red.items.map((i) => i.name.es),
      ...r.plan.trafficLight.yellow.items.map((i) => i.name.es),
      ...r.plan.supplements.map((s) => s.name.es),
      ...r.plan.dailyMenu.map((m) => m.name.es),
      ...r.plan.restrictions.foods.map((f) => f.name.es),
    ];
    for (const n of names) expect(known.has(n), n).toBe(true);
  });

  it("opciones de equivalencia de los dos planes se juntan, sin repetir", () => {
    const b = B();
    b.equivalences[0].use.push({ name: lt("durazno", "peach") });
    b.equivalences[0].use[0].keepsWithoutFridge = true;
    const r = reconcile(A(), b);
    const names = r.plan.equivalences[0].use.map((u) => u.name.es);
    expect(names).toEqual(["pera", "kiwi", "uvas", "fresas", "durazno"]);
    expect(r.plan.equivalences[0].use[0].keepsWithoutFridge).toBe(true);
  });
});

describe("reconcile · el plan unido es un plan del schema", () => {
  it("pasa dietPlanSchema y parseDietJson (con `merged`), sin perder las dos fuentes", () => {
    const r = reconcile(A(), B());
    expect(dietPlanSchema.safeParse(r.plan).success).toBe(true);
    const parsed = parseDietJson(JSON.stringify(r.plan));
    expect(parsed.ok && parsed.diet.merged?.from.map((f) => f.id)).toEqual([
      "demo-diet-v1",
      "plan-b",
    ]);
    expect(r.plan.meta.title.es).toBe(`${A().meta.title.es} + Segundo plan`);
  });

  it("si lo que queda no es un plan válido, lo dice (valid = false) y no se guarda", () => {
    const a = A();
    const b = A();
    a.trafficLight.green.groups = [a.trafficLight.green.groups[0]];
    a.trafficLight.green.groups[0].items = [
      a.trafficLight.green.groups[0].items[0],
    ];
    const only = a.trafficLight.green.groups[0].items[0];
    b.trafficLight.green.groups = structuredClone(a.trafficLight.green.groups);
    b.trafficLight.red.items.push({
      id: only.id,
      name: only.name,
      why: lt("porque sí"),
    });
    const r = reconcile(a, b);
    expect(r.valid).toBe(false);
  });
});

describe("switchLine · un padre cambia una línea, también una roja", () => {
  it("cambia una roja que ganó sola a su otro origen y deja la cara anterior para volver", () => {
    const { plan } = reconcile(A(), B());
    expect(switchableLines(plan)).toContain("food:gaseosas");
    expect(relaxesRed(plan, "food:gaseosas")).toBe(true);
    const next = switchLine(plan, "food:gaseosas", 1234)!;
    expect(next).not.toBeNull();
    expect(resolveItemStatus(next, "gaseosas", NOW)?.kind).toBe("green");
    expect(next.merged!.lines["food:gaseosas"]).toMatchObject({
      from: "b",
      rule: "parent",
      alt: { t: "place", place: { color: "red" } },
    });
    expect(next.merged!.last).toEqual({ key: "food:gaseosas", t: 1234 });
    // volver
    const back = switchLine(next, "food:gaseosas", 1300)!;
    expect(resolveItemStatus(back, "gaseosas", NOW)?.kind).toBe("red");
    expect(back.merged!.lines["food:gaseosas"].from).toBe("a");
    // el original no se tocó (puro)
    expect(resolveItemStatus(plan, "gaseosas", NOW)?.kind).toBe("red");
  });

  it("una roja que ganó B sobre verde de A también se puede soltar", () => {
    const { plan } = reconcile(A(), B());
    const next = switchLine(plan, "food:pera", 5)!;
    expect(resolveItemStatus(next, "pera", NOW)?.kind).toBe("green");
    expect(dietPlanSchema.safeParse(next).success).toBe(true);
  });

  it("cambia una dosis ya elegida y puede volver", () => {
    const first = reconcile(A(), B());
    const key = first.conflicts.find(
      (c) => c.kind === "dose" && c.key.startsWith("supplement:"),
    )!.key;
    const { plan } = reconcile(A(), B(), { [key]: "a" });
    const sw = switchLine(plan, key, 9)!;
    expect(sw.supplements[0].dose.es).toBe("2 masticables");
    expect(sw.merged!.lines[key].rule).toBe("parent");
    expect(switchLine(sw, key, 10)!.supplements[0].dose.es).toBe(
      "1 masticable",
    );
  });

  it("una línea sin otra cara, o una clave que no existe, no cambia nada (null)", () => {
    const { plan } = reconcile(A(), B());
    expect(switchLine(plan, "food:pollo", 1)).toBeNull();
    expect(switchLine(plan, "food:no-existe", 1)).toBeNull();
    expect(switchLine(A(), "food:gaseosas", 1)).toBeNull();
  });

  it("relaxesRed es falso para lo que no relaja una prohibición", () => {
    const { plan } = reconcile(A(), B());
    expect(relaxesRed(plan, "food:banano")).toBe(false);
    expect(relaxesRed(plan, "nada")).toBe(false);
  });
});

describe("reconcile · un cuidador con prisa", () => {
  it("«un alimento que el plan no trae» no aparece: nada del plan unido se inventa", () => {
    const r = reconcile(A(), B());
    expect(resolveItemStatus(r.plan, "dragon-fruit", NOW)).toBeNull();
  });

  it("una restricción de un plan no se pierde al unir con un plan sin restricciones", () => {
    const b = A();
    b.restrictions.foods = [];
    const r = reconcile(A(), b);
    expect(r.plan.restrictions.foods.map((f) => f.id)).toEqual([
      "manzana",
      "crema-mani",
    ]);
    const rev = reconcile(b, A());
    expect(rev.plan.restrictions.foods.map((f) => f.id).sort()).toEqual([
      "crema-mani",
      "manzana",
    ]);
    expect(rev.plan.restrictions.validUntil).toBe(A().restrictions.validUntil);
  });
});
