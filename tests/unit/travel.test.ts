import { afterEach, describe, expect, it, vi } from "vitest";

import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import type { DietPlan } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";
import {
  clearDayToDay,
  getLunchName,
  getOwnRecipes,
  getPantry,
  getTravelChecks,
  OWN_MAX,
  OWN_RECIPES_SLOT,
  removeOwnRecipe,
  saveOwnRecipe,
  setLunchName,
  togglePantry,
  toggleTravelCheck,
} from "@/lib/day-to-day/store";
import { reviewOwn } from "@/lib/recipes/review";
import {
  buildTravel,
  type MedicalDoc,
  TRAVEL_MODES,
} from "@/lib/travel/engine";

const NOW = new Date("2026-08-10T12:00:00");
const diet = (): DietPlan => structuredClone(getDemoDiet());
const base = (over: Partial<Parameters<typeof buildTravel>[0]> = {}) =>
  buildTravel({
    diet: diet(),
    now: NOW,
    notes: [],
    mode: "road",
    childName: null,
    ...over,
  });
const allText = (v: unknown): string[] => {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(allText);
  if (v && typeof v === "object") return Object.values(v).flatMap(allText);
  return [];
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("modo viaje · motor", () => {
  it("la lista sale del plan: lo que aguanta sin nevera, suplementos, medicamentos y franjas, tal como están escritos", () => {
    const t = base();
    expect(t.foods.length).toBeGreaterThanOrEqual(3);
    expect(t.foods.map((f) => f.es)).toContain("Zanahoria");
    expect(t.supplements.map((s) => s.id)).toEqual(
      diet().supplements.map((s) => s.id),
    );
    expect(t.medications[0].name.es).toBe("Medicamento demo");
    expect(t.slots.map((m) => m.id)).toEqual(
      [...diet().dailyMenu]
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((m) => m.id),
    );
    // Los dos modos comparten lo del plan: cambia solo cómo se presenta.
    for (const m of TRAVEL_MODES) expect(base({ mode: m }).mode).toBe(m);
  });

  it("no inventa: sin marcas de «aguanta sin nevera» la lista de alimentos queda vacía", () => {
    const d = diet();
    for (const g of d.trafficLight.green.groups)
      for (const i of g.items) delete i.keepsWithoutFridge;
    for (const e of d.equivalences)
      for (const u of e.use) delete u.keepsWithoutFridge;
    expect(base({ diet: d }).foods).toEqual([]);
    // …y una marca de quien cuida la devuelve.
    expect(
      base({
        diet: d,
        notes: [{ kind: "fridge", text: "Zanahoria" }],
      }).foods.map((f) => f.es),
    ).toEqual(["Zanahoria"]);
  });

  it("nunca lleva un rojo ni algo que hoy esté restringido, ni una alergia anotada", () => {
    const d = diet();
    d.restrictions.foods.push({
      id: "zan-r",
      name: { es: "Zanahoria", en: "Carrot" },
    });
    const t = base({
      diet: d,
      notes: [{ kind: "allergy", text: "pera" }],
    });
    const foods = t.foods.map((f) => f.es.toLowerCase());
    expect(foods).not.toContain("zanahoria");
    expect(foods).not.toContain("pera");
    expect(t.avoid.map((a) => a.es.toLowerCase())).toContain("zanahoria");
  });

  it("el documento médico lleva ES y EN de lo que el plan y quien cuida escribieron, y nada más", () => {
    const doc: MedicalDoc = base({
      notes: [
        { kind: "allergy", text: "Maní" },
        { kind: "medication", text: "Gotas nocturnas" },
      ],
    }).doc;
    expect(doc.date).toBe("2026-08-10");
    expect(doc.condition?.es).toContain("Condición de ejemplo");
    expect(doc.condition?.en).toContain("Sample condition");
    expect(doc.allergies.map((a) => a.es)).toEqual(["Mariscos", "Maní"]);
    expect(doc.allergies[0].en).toBe("Shellfish");
    expect(doc.intolerances.map((a) => a.en)).toEqual(["Sorbitol"]);
    expect(doc.medications.map((m) => m.name.es)).toEqual([
      "Medicamento demo",
      "Gotas nocturnas",
    ]);
    expect(doc.supplements).toHaveLength(diet().supplements.length);
    expect(doc.source.es).toBe(diet().meta.source.es);
  });

  it("el nombre solo sale si un padre lo escribió; si no, ni una pista", () => {
    expect(base().doc.name).toBeNull();
    expect(base({ childName: "  " }).doc.name).toBeNull();
    expect(base({ childName: "Lía" }).doc.name).toBe("Lía");
    // Sin nombre, ningún texto del documento contiene el alias del plan (no es un nombre real, pero tampoco viaja).
    expect(allText(base().doc)).not.toContain(diet().meta.childAlias.es);
  });

  it("jamás mete un enlace, aunque lo anotado traiga uno", () => {
    const t = base({
      notes: [
        { kind: "allergy", text: "maní https://ejemplo.invalid/x" },
        { kind: "medication", text: "gotas www.ejemplo.invalid" },
      ],
      childName: "Lía http://x.invalid",
    });
    for (const s of allText(t)) expect(s).not.toMatch(/https?:|:\/\/|www\./i);
  });

  it("quita dominios y correos, y no corta una alergia larga", () => {
    const long = `${"alergia de ejemplo ".repeat(11)}fin`.slice(0, 200).trim();
    const t = base({
      notes: [
        { kind: "allergy", text: long },
        {
          kind: "medication",
          text: "gotas bit.ly/abc ejemplo.com/x mailto:a@b.co",
        },
      ],
    });
    const texts = allText(t);
    for (const s of texts)
      expect(s).not.toMatch(/bit\.ly|ejemplo\.com|mailto:/i);
    expect(t.doc.allergies.some((a) => a.es === long)).toBe(true);
  });

  it("la lista de viaje no tiene tope: 15 alimentos marcados salen los 15, los mismos de la lonchera", () => {
    const d = diet();
    const names = Array.from({ length: 15 }, (_, i) => ({
      es: `Fruta de ejemplo ${i}`,
      en: `Sample fruit ${i}`,
    }));
    const group = d.trafficLight.green.groups[0];
    group.items.push(
      ...names.map((name, i) => ({
        id: `ejemplo-${i}`,
        name,
        keepsWithoutFridge: true,
      })),
    );
    const t = buildTravel({
      diet: d,
      now: NOW,
      notes: [],
      mode: "road",
      childName: null,
    });
    for (const n of names)
      expect(t.foods.some((f) => f.es === n.es)).toBe(true);
  });

  it("sin red: generar el documento no abre ninguna petición", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const beacon = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const xhr = vi.fn();
    vi.stubGlobal("XMLHttpRequest", xhr);
    const ws = vi.fn();
    vi.stubGlobal("WebSocket", ws);
    for (const mode of TRAVEL_MODES) base({ mode, childName: "Lía" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(ws).not.toHaveBeenCalled();
  });

  it("nada de indicaciones médicas ni de calorías en lo que genera", () => {
    for (const s of allText(base().doc))
      expect(looksLikeMedicalAdvice(s), s).toBe(false);
  });
});

describe("lo local de S11 · almacén", () => {
  it("nombre, despensa, marcas del viaje y recetas propias se guardan y se leen", () => {
    setLunchName("  Lía  ");
    expect(getLunchName()).toBe("Lía");
    setLunchName("");
    expect(getLunchName()).toBeNull();

    expect(togglePantry("huevos")).toEqual(["huevos"]);
    expect(togglePantry("arroz")).toEqual(["huevos", "arroz"]);
    expect(togglePantry("huevos")).toEqual(["arroz"]);
    expect(getPantry()).toEqual(["arroz"]);

    expect(toggleTravelCheck("med:a")).toEqual(["med:a"]);
    expect(toggleTravelCheck("med:a")).toEqual([]);
    expect(getTravelChecks()).toEqual([]);

    const r = saveOwnRecipe(
      {
        name: "Mi sopa",
        ingredients: ["lentejas", "  ", "papa"],
        steps: "Cocer",
      },
      NOW,
    );
    expect(r?.ingredients).toEqual(["lentejas", "papa"]);
    expect(getOwnRecipes()).toHaveLength(1);
    removeOwnRecipe(r!.id);
    expect(getOwnRecipes()).toEqual([]);
  });

  it("una receta propia sin nombre o sin ingredientes no se guarda; el tope se respeta", () => {
    expect(
      saveOwnRecipe({ name: "", ingredients: ["a"], steps: "" }, NOW),
    ).toBeNull();
    expect(
      saveOwnRecipe({ name: "x", ingredients: [], steps: "" }, NOW),
    ).toBeNull();
    for (let i = 0; i < OWN_MAX; i++)
      expect(
        saveOwnRecipe(
          { id: `r${i}`, name: `R${i}`, ingredients: ["papa"], steps: "" },
          NOW,
        ),
      ).not.toBeNull();
    expect(
      saveOwnRecipe({ name: "otra", ingredients: ["papa"], steps: "" }, NOW),
    ).toBeNull();
  });

  it("un valor roto en el aparato vuelve vacío, sin romper", () => {
    window.localStorage.setItem(OWN_RECIPES_SLOT, "{nope");
    window.localStorage.setItem("nutrikids.pantry.v1", '{"a":1}');
    window.localStorage.setItem("nutrikids.travel.v1", "7");
    expect(getOwnRecipes()).toEqual([]);
    expect(getPantry()).toEqual([]);
    expect(getTravelChecks()).toEqual([]);
  });

  it("«Borrar datos» deja todo vacío, incluido el nombre de la etiqueta", async () => {
    setLunchName("Lía");
    togglePantry("huevos");
    toggleTravelCheck("x");
    saveOwnRecipe({ name: "R", ingredients: ["papa"], steps: "" }, NOW);
    const { clearAllData } = await import("@/lib/diet/storage");
    clearAllData();
    expect(getLunchName()).toBeNull();
    expect(getPantry()).toEqual([]);
    expect(getTravelChecks()).toEqual([]);
    expect(getOwnRecipes()).toEqual([]);
    clearDayToDay();
  });
});

describe("recetas propias · el mismo cotejo con el plan", () => {
  const input = (over: Record<string, unknown> = {}) => ({
    diet: diet(),
    now: NOW,
    notes: [] as { kind: string; text: string }[],
    ...over,
  });

  it("un rojo, una restricción vigente o una alergia anotada la ocultan y dicen cuál", () => {
    const d = diet();
    const red = d.trafficLight.red.items[0].name.es;
    const r = reviewOwn({ ingredients: ["papa", red] }, input());
    expect(r.state).toBe("blocked");
    expect(r.blocked.map((b) => b.why)).toEqual(["red"]);
    const a = reviewOwn(
      { ingredients: ["papa", "maní molido"] },
      input({ notes: [{ kind: "allergy", text: "maní" }] }),
    );
    expect(a.state).toBe("blocked");
    expect(a.blocked[0]).toMatchObject({ text: "maní molido", why: "allergy" });
  });

  it("lo que el plan no nombra queda «no está en tu plan»: jamás verde", () => {
    const r = reviewOwn({ ingredients: ["papa", "ingrediente raro"] }, input());
    expect(r.state).toBe("unknown");
    expect(r.unknown).toEqual(["ingrediente raro"]);
    expect(
      reviewOwn({ ingredients: ["papa", "zanahoria"] }, input()).state,
    ).toBe("ok");
  });
});
