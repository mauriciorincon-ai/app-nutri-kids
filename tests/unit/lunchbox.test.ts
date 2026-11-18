import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { dateKey } from "@/lib/diet/logic";
import { getDemoDiet } from "@/lib/diet/storage";
import type { DietPlan } from "@/lib/diet/schema";
import { buildLabel, plain } from "@/lib/lunchbox/label";
import { lunchOptions, optionKey, refusedFoodIds } from "@/lib/lunchbox/engine";
import { QR_MAX_BYTES, qrModules } from "@/lib/lunchbox/qr";
import { shoppingList } from "@/lib/lunchbox/shopping";
import type { LunchState } from "@/lib/wellbeing/values";
import { dayWellbeing } from "./wellbeing-fixtures";

/** El plan de ejemplo (inventado) y un día dentro de la ventana de la restricción. */
const NOW = new Date("2026-08-10T12:40:00");
const diet = (): DietPlan => structuredClone(getDemoDiet());

const names = (r: ReturnType<typeof lunchOptions>) =>
  r.kind === "options" ? r.items.map((i) => i.name.es.toLowerCase()) : [];

afterEach(() => vi.restoreAllMocks());

describe("lonchera · lo que sí entra", () => {
  it("con el plan de ejemplo: lo que el plan marca, verdes y opciones, sin inventar nada", () => {
    const r = lunchOptions({ diet: diet(), now: NOW, notes: [] });
    expect(r.kind).toBe("options");
    const n = names(r);
    expect(n).toEqual(
      expect.arrayContaining([
        "pera",
        "kiwi",
        "zanahoria",
        "palomitas caseras",
        "tostadas de arroz",
      ]),
    );
    // Cada nombre sale del propio plan (grupos, amarillos o equivalencias): ninguno inventado.
    const d = diet();
    const planNames = new Set<string>();
    for (const g of d.trafficLight.green.groups)
      g.items.forEach((i) => planNames.add(i.name.es.toLowerCase()));
    d.trafficLight.yellow.items.forEach((i) =>
      planNames.add(i.name.es.toLowerCase()),
    );
    for (const e of d.equivalences)
      e.use.forEach((u) => planNames.add(u.name.es.toLowerCase()));
    for (const name of n) expect(planNames.has(name)).toBe(true);
  });

  it("quien cuida puede marcar un amarillo: sale como amarillo, con su medida", () => {
    const r = lunchOptions({
      diet: diet(),
      now: NOW,
      notes: [{ kind: "fridge", text: "Banano" }],
    });
    if (r.kind !== "options") throw new Error();
    const banana = r.items.find((i) => i.name.es === "Banano")!;
    expect(banana).toMatchObject({ color: "yellow", by: "adult" });
    expect(banana.limit?.es).toMatch(/máx/);
  });

  it("sin ninguna marca (ni del plan ni de un adulto), el plan no lo dice", () => {
    const d = diet();
    for (const g of d.trafficLight.green.groups)
      for (const i of g.items) delete i.keepsWithoutFridge;
    for (const e of d.equivalences)
      for (const u of e.use) delete u.keepsWithoutFridge;
    expect(lunchOptions({ diet: d, now: NOW, notes: [] }).kind).toBe(
      "no-marks",
    );
  });

  it("el orden es el del plan; sin texturas marcadas nada se aparta", () => {
    const r = lunchOptions({ diet: diet(), now: NOW, notes: [] });
    if (r.kind !== "options") throw new Error();
    expect(r.held).toEqual([]);
  });
});

describe("lonchera · lo que NUNCA entra", () => {
  it("un rojo, una restricción vigente o un «además evitar» no entra aunque un adulto lo marque", () => {
    const d = diet();
    const blocked = [
      ...d.trafficLight.red.items,
      ...d.trafficLight.red.alsoAvoid,
      ...d.restrictions.foods,
    ];
    expect(blocked.length).toBeGreaterThan(4);
    for (const b of blocked) {
      for (const text of [b.name.es, b.name.en]) {
        const r = lunchOptions({
          diet: d,
          now: NOW,
          notes: [{ kind: "fridge", text }],
        });
        expect(names(r)).not.toContain(b.name.es.toLowerCase());
      }
    }
  });

  it("un rojo que el plan marcó por error como «aguanta sin nevera» tampoco entra", () => {
    const d = diet();
    // Un verde con el mismo nombre que un rojo: el rojo manda (isSafeOption mira los dos sentidos).
    d.trafficLight.green.groups[0].items.push({
      id: "gaseosas-verde",
      name: { es: "Gaseosas", en: "Soda" },
      keepsWithoutFridge: true,
    });
    const r = lunchOptions({ diet: d, now: NOW, notes: [] });
    expect(names(r)).not.toContain("gaseosas");
  });

  it("una restricción ya vencida no vuelve a un alimento a la lonchera por su cuenta", () => {
    const after = new Date("2026-10-15T12:00:00");
    const r = lunchOptions({
      diet: diet(),
      now: after,
      notes: [{ kind: "fridge", text: "Manzana" }],
    });
    // La manzana solo está en la lista de restricciones: sin lista de verdes, no hay de dónde salir.
    expect(names(r)).not.toContain("manzana");
  });

  it("una alergia o intolerancia del plan deja fuera el alimento, aunque el plan lo marque", () => {
    const d = diet();
    d.trafficLight.green.groups[0].items.push(
      {
        id: "mariscos-vapor",
        name: { es: "Mariscos al vapor", en: "Steamed shellfish" },
        keepsWithoutFridge: true,
      },
      {
        id: "chicle-sorbitol",
        name: { es: "Chicle con sorbitol", en: "Sorbitol gum" },
        keepsWithoutFridge: true,
      },
    );
    const n = names(lunchOptions({ diet: d, now: NOW, notes: [] }));
    expect(n).not.toContain("mariscos al vapor");
    expect(n).not.toContain("chicle con sorbitol");
    expect(n).toContain("pera"); // lo demás sigue
  });

  it("una alergia anotada por quien cuida deja fuera el alimento y la opción que lo lleva", () => {
    const r = lunchOptions({
      diet: diet(),
      now: NOW,
      notes: [{ kind: "allergy", text: "kiwi" }],
    });
    expect(names(r)).not.toContain("kiwi");
    const en = lunchOptions({
      diet: diet(),
      now: NOW,
      notes: [{ kind: "intolerance", text: "carrot" }],
    });
    expect(names(en)).not.toContain("zanahoria"); // la anotación en inglés casa con el nombre en español
  });

  it("una textura que hoy no acepta se aparta y se dice por qué (no se oculta en silencio)", () => {
    const r = lunchOptions({
      diet: diet(),
      now: NOW,
      notes: [],
      accepted: ["soft"],
    });
    if (r.kind !== "options") throw new Error();
    const n = names(r);
    expect(n).not.toContain("palomitas caseras"); // crujiente
    expect(n).not.toContain("tostadas de arroz");
    // El plan le da a la pera la textura «en trozos» (en la equivalencia de la manzana): hoy no la acepta.
    expect(n).not.toContain("pera");
    expect(n).toContain("kiwi"); // blanda: la acepta
    expect(n).toContain("zanahoria"); // sin textura en el plan: no se castiga
    expect(r.held.map((h) => [h.name.es, h.reason])).toEqual(
      expect.arrayContaining([
        ["palomitas caseras", "texture"],
        ["Pera", "texture"],
      ]),
    );
  });

  it("lo que rechazó la última vez queda fuera, y se dice", () => {
    const r = lunchOptions({
      diet: diet(),
      now: NOW,
      notes: [],
      refused: new Set(["pera"]),
    });
    if (r.kind !== "options") throw new Error();
    expect(names(r)).not.toContain("pera");
    expect(r.held).toContainEqual({
      key: "pera",
      name: { es: "Pera", en: "Pear" },
      reason: "refused",
    });
  });

  it("si todo lo marcado queda fuera por la textura, no es «sin marcas»: las opciones salen vacías y el motivo, a la vista", () => {
    const d = diet();
    for (const g of d.trafficLight.green.groups)
      for (const i of g.items) delete i.keepsWithoutFridge;
    const r = lunchOptions({
      diet: d,
      now: NOW,
      notes: [],
      accepted: ["soft"],
    });
    if (r.kind !== "options") throw new Error();
    expect(r.items).toEqual([]);
    expect(r.held.length).toBe(2); // palomitas y tostadas (crujientes)
  });

  it("el veredicto «lo rechazó» sale de lo anotado en los días (último gana)", () => {
    const days = [
      dayWellbeing("2026-08-01", { pera: "accepts" }),
      dayWellbeing("2026-08-05", { pera: "refuses", kiwi: "loves" }),
    ];
    expect([...refusedFoodIds(days)]).toEqual(["pera"]);
    const later = [...days, dayWellbeing("2026-08-09", { pera: "accepts" })];
    expect([...refusedFoodIds(later)]).toEqual([]);
  });

  it("la clave de una opción es estable y cabe en lo que valida la familia", () => {
    const k = optionKey({ es: "Palomitas Caseras", en: "x" });
    expect(k).toBe("opt:palomitas caseras");
    expect(
      optionKey({ es: "x".repeat(300), en: "x" }).length,
    ).toBeLessThanOrEqual(100);
  });
});

describe("lista de compras de la semana", () => {
  const nm = new Map([
    ["pera", { es: "Pera", en: "Pear" }],
    ["kiwi", { es: "Kiwi", en: "Kiwi" }],
  ]);
  it("cuenta los días que lleva cada alimento, solo lo puesto y solo nombres del plan", () => {
    const week: { day: string; lunch: Record<string, LunchState> }[] = [
      { day: "2026-08-10", lunch: { pera: "packed", kiwi: "eaten" } },
      { day: "2026-08-11", lunch: { pera: "packed", ghost: "packed" } },
      { day: "2026-08-12", lunch: { kiwi: "packed" } },
    ];
    const list = shoppingList(week, nm);
    expect(list.map((l) => [l.key, l.days])).toEqual([
      ["pera", 2],
      ["kiwi", 1],
    ]);
  });
});

describe("etiqueta y QR · texto, nunca un enlace", () => {
  const hosts: string[] = JSON.parse(
    readFileSync("cero-enlaces.json", "utf8"),
  ).dominios;
  const items = [
    { name: { es: "Pera", en: "Pear" } },
    { name: { es: "Zanahoria", en: "Carrot" } },
  ];

  it("lleva alergias, intolerancias y lo de hoy en los dos idiomas, sin nombre si nadie lo escribió", () => {
    const l = buildLabel({
      diet: diet(),
      now: NOW,
      notes: [{ kind: "allergy", text: "kiwi" }],
      items,
      childName: null,
    });
    expect(l.text).toContain("Mariscos / Shellfish");
    expect(l.text).toContain("kiwi");
    expect(l.text).toContain("Sorbitol");
    expect(l.text).toContain("Pera / Pear; Zanahoria / Carrot");
    expect(l.text).toContain(dateKey(NOW));
    expect(l.lines).toHaveLength(4); // título, alergias, intolerancias, hoy: ni una línea de nombre
    expect(l.cut).toBe(false);
  });

  it("el nombre sale solo si un padre lo escribió", () => {
    const l = buildLabel({
      diet: diet(),
      now: NOW,
      notes: [],
      items,
      childName: "Luna de Ejemplo",
    });
    expect(l.lines[1]).toBe("Luna de Ejemplo");
  });

  it("jamás lleva un enlace ni un dominio, ni aunque lo escriban en el nombre o en una nota", () => {
    const l = buildLabel({
      diet: diet(),
      now: NOW,
      notes: [{ kind: "allergy", text: "ver https://ejemplo.vercel.app/x" }],
      items,
      childName: "www.ejemplo.dev y https://a.b/c",
    });
    expect(l.text).not.toMatch(/https?|:\/\/|www\./i);
    for (const h of hosts) expect(l.text).not.toContain(h);
    expect(plain("a http://x.y/z b")).toBe("a b");
  });

  it("cabe en el QR: si hay demasiado, se acorta lo de hoy y las alergias no se sueltan", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      name: { es: `Alimento de ejemplo ${i}`, en: `Sample food ${i}` },
    }));
    const l = buildLabel({
      diet: diet(),
      now: NOW,
      notes: [],
      items: many,
      childName: null,
    });
    expect(new TextEncoder().encode(l.text).length).toBeLessThanOrEqual(
      QR_MAX_BYTES,
    );
    expect(l.cut).toBe(true);
    expect(l.text).toContain("Mariscos / Shellfish");
    expect(l.text).toContain("; …");
  });

  it("el QR se dibuja sin red: matriz cuadrada con los tres cuadros de posición", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const beacon = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const l = buildLabel({
      diet: diet(),
      now: NOW,
      notes: [],
      items,
      childName: null,
    });
    const m = await qrModules(l.text);
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === n)).toBe(true);
    // Cuadro de posición: borde exterior de 7×7 oscuro en las tres esquinas.
    for (const [r0, c0] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ])
      for (let i = 0; i < 7; i++) {
        expect(m[r0][c0 + i]).toBe(true);
        expect(m[r0 + 6][c0 + i]).toBe(true);
        expect(m[r0 + i][c0]).toBe(true);
        expect(m[r0 + i][c0 + 6]).toBe(true);
      }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("un texto demasiado largo no se codifica en silencio", async () => {
    await expect(qrModules("x".repeat(QR_MAX_BYTES + 1))).rejects.toThrow(
      "qr-too-long",
    );
  });

  it("la misma etiqueta da el mismo QR (determinista)", async () => {
    const a = await qrModules("NUTRIKIDS · ñandú");
    const b = await qrModules("NUTRIKIDS · ñandú");
    expect(a).toEqual(b);
  });
});
