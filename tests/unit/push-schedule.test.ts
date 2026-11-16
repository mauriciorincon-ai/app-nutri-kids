// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { dietPlanSchema, type DietPlan } from "@/lib/diet/schema";
import { dueWakes, localParts, validTimeZone } from "@/lib/push/due";
import {
  DEFAULT_TYPES,
  MAX_BODY_CHARS,
  dayMask,
  forTypes,
  planItems,
  serverWakes,
  wakeDone,
  type ScheduleText,
} from "@/lib/push/schedule";

const demo: DietPlan = dietPlanSchema.parse(
  JSON.parse(readFileSync(resolve("data/demo-diet.json"), "utf8")),
);
const TEXT: ScheduleText = {
  supplementTitle: "Suplemento de hoy",
  waterTitle: "Un vaso de agua",
  waterBody: (n, total) => `Vaso ${n} de ${total}`,
};
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

describe("las horas de los avisos salen del plan", () => {
  it("cada comida avisa a su hora de inicio, todos los días, con su nombre y lo que dice el plan", () => {
    const meals = planItems(demo, "es", TEXT).filter((i) => i.kind === "meal");
    expect(meals.map((m) => [m.id, m.minute])).toEqual([
      ["meal:desayuno", at("07:00")],
      ["meal:media-manana", at("10:00")],
      ["meal:almuerzo", at("12:30")],
      ["meal:merienda", at("16:00")],
      ["meal:cena", at("18:30")],
    ]);
    const merienda = meals.find((m) => m.id === "meal:merienda")!;
    expect(merienda.title).toBe("Merienda");
    expect(merienda.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(merienda.body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    expect(planItems(demo, "en", TEXT)[0].title).toBe(
      demo.dailyMenu[0].name.en,
    );
  });

  it("un suplemento avisa SOLO sus días, a la hora de la primera comida", () => {
    const sup = planItems(demo, "es", TEXT).filter(
      (i) => i.kind === "supplement",
    );
    expect(sup.map((s) => [s.id, s.minute, s.days])).toEqual([
      ["supplement:multivitaminico-demo", at("07:00"), [1, 3, 5]],
      ["supplement:omega-demo", at("07:00"), [2, 6]],
    ]);
    expect(sup[0].title).toBe("Suplemento de hoy");
    expect(sup[0].body).toContain("Multivitamínico demo");
  });

  it("sin suplementos en el plan, ningún aviso de suplemento", () => {
    const plan = { ...demo, supplements: [] };
    expect(
      planItems(plan, "es", TEXT).some((i) => i.kind === "supplement"),
    ).toBe(false);
  });

  it("el agua se reparte parejo entre la primera comida y el fin de la última, en la rejilla de 5 min", () => {
    const water = planItems(demo, "es", TEXT).filter((i) => i.kind === "water");
    expect(water.map((w) => w.minute)).toEqual([
      at("09:25"),
      at("11:50"),
      at("14:10"),
      at("16:35"),
    ]);
    expect(water.every((w) => w.minute % 5 === 0)).toBe(true);
    expect(water[1]).toMatchObject({ id: "water:2", body: "Vaso 2 de 4" });
    const one = planItems(
      { ...demo, hydration: { ...demo.hydration, glassesPerDay: 1 } },
      "es",
      TEXT,
    ).filter((i) => i.kind === "water");
    expect(one.map((w) => w.minute)).toEqual([at("13:00")]);
  });

  it("si el plan cambia la hora de una comida, cambia su aviso (y el de los suplementos)", () => {
    const moved = {
      ...demo,
      dailyMenu: demo.dailyMenu.map((m) =>
        m.id === "desayuno" ? { ...m, start: "06:15" } : m,
      ),
    };
    const items = planItems(moved, "es", TEXT);
    expect(items.find((i) => i.id === "meal:desayuno")!.minute).toBe(
      at("06:15"),
    );
    expect(items.find((i) => i.kind === "supplement")!.minute).toBe(
      at("06:15"),
    );
  });

  it("un plan sin comidas no tiene avisos; un texto largo se recorta", () => {
    expect(planItems({ ...demo, dailyMenu: [] }, "es", TEXT)).toEqual([]);
    const long = {
      ...demo,
      dailyMenu: [
        {
          ...demo.dailyMenu[0],
          content: { es: "a ".repeat(200), en: "b ".repeat(200) },
        },
      ],
    };
    const body = planItems(long, "es", TEXT)[0].body;
    expect(body.length).toBe(MAX_BODY_CHARS);
    expect(body.endsWith("…")).toBe(true);
  });

  it("cada tipo se apaga por separado", () => {
    const all = planItems(demo, "es", TEXT);
    const kinds = (types: typeof DEFAULT_TYPES) =>
      new Set(forTypes(all, types).map((i) => i.kind));
    expect(kinds(DEFAULT_TYPES)).toEqual(
      new Set(["meal", "supplement", "water"]),
    );
    expect(kinds({ ...DEFAULT_TYPES, water: false })).toEqual(
      new Set(["meal", "supplement"]),
    );
    expect(
      kinds({ ...DEFAULT_TYPES, meals: false, supplements: false }),
    ).toEqual(new Set(["water"]));
  });
});

describe("lo que ve el servidor: minuto y días, sin etiqueta", () => {
  it("una hora por minuto, días unidos, y NADA de texto ni tipo", () => {
    const wakes = serverWakes(planItems(demo, "es", TEXT));
    expect(wakes[0]).toEqual({ m: at("07:00"), d: 0b1111111 });
    expect(wakes.map((w) => w.m)).toEqual(
      [...wakes.map((w) => w.m)].sort((a, b) => a - b),
    );
    expect(new Set(wakes.map((w) => w.m)).size).toBe(wakes.length);
    for (const w of wakes) expect(Object.keys(w).sort()).toEqual(["d", "m"]);
    const wire = JSON.stringify(wakes);
    for (const word of [
      "Merienda",
      "Multivitamínico",
      "agua",
      "meal",
      "supplement",
      "water",
    ])
      expect(wire).not.toContain(word);
  });

  it("solo suplementos: el despertar lleva solo sus días", () => {
    const only = forTypes(planItems(demo, "es", TEXT), {
      ...DEFAULT_TYPES,
      meals: false,
      water: false,
    });
    expect(serverWakes(only)).toEqual([
      { m: at("07:00"), d: dayMask([1, 2, 3, 5, 6]) },
    ]);
  });

  it("todo lo de un minuto marcado ⇒ ese despertar se salta; con algo pendiente, no", () => {
    const items = planItems(demo, "es", TEXT);
    // Lunes 07:00: desayuno + multivitamínico.
    expect(wakeDone(items, at("07:00"), 1, ["meal:desayuno"])).toBe(false);
    expect(
      wakeDone(items, at("07:00"), 1, [
        "meal:desayuno",
        "supplement:multivitaminico-demo",
      ]),
    ).toBe(true);
    // Domingo no hay suplemento: basta el desayuno.
    expect(wakeDone(items, at("07:00"), 0, ["meal:desayuno"])).toBe(true);
    // Un minuto sin avisos no es «hecho».
    expect(wakeDone(items, at("03:00"), 1, [])).toBe(false);
  });
});

describe("qué venció, en la zona horaria del teléfono", () => {
  const wakes = [
    { m: at("07:00"), d: 0b1111111 },
    { m: at("16:00"), d: dayMask([1]) },
  ];

  it("hora local con Intl, también al otro lado del mundo", () => {
    const t = Date.UTC(2026, 10, 16, 12, 0); // lunes 12:00 UTC
    expect(localParts(t, "America/Bogota")).toEqual({
      date: "2026-11-16",
      dow: 1,
      minute: at("07:00"),
    });
    expect(localParts(t, "Asia/Tokyo")).toEqual({
      date: "2026-11-16",
      dow: 1,
      minute: at("21:00"),
    });
    expect(
      localParts(Date.UTC(2026, 10, 16, 3, 0), "America/Bogota"),
    ).toMatchObject({
      date: "2026-11-15",
      dow: 0,
      minute: at("22:00"),
    });
  });

  it("vence en los últimos 10 min y no antes; después de 10 min ya no", () => {
    const seven = Date.UTC(2026, 10, 16, 12, 0);
    expect(dueWakes(wakes, "America/Bogota", seven - 60_000)).toEqual([]);
    expect(dueWakes(wakes, "America/Bogota", seven)).toEqual([
      { date: "2026-11-16", m: at("07:00") },
    ]);
    expect(dueWakes(wakes, "America/Bogota", seven + 9 * 60_000)).toHaveLength(
      1,
    );
    expect(dueWakes(wakes, "America/Bogota", seven + 10 * 60_000)).toEqual([]);
  });

  it("respeta los días: las 16:00 solo el lunes", () => {
    const monday4 = Date.UTC(2026, 10, 16, 21, 2);
    const tuesday4 = Date.UTC(2026, 10, 17, 21, 2);
    expect(dueWakes(wakes, "America/Bogota", monday4)).toEqual([
      { date: "2026-11-16", m: at("16:00") },
    ]);
    expect(dueWakes(wakes, "America/Bogota", tuesday4)).toEqual([]);
  });

  it("con cambio de horario, las 07:00 locales siguen siendo las 07:00", () => {
    const ny = [{ m: at("07:00"), d: 0b1111111 }];
    // Antes (EDT, UTC−4) y después (EST, UTC−5) del 1 de noviembre de 2026.
    expect(
      dueWakes(ny, "America/New_York", Date.UTC(2026, 9, 30, 11, 0)),
    ).toEqual([{ date: "2026-10-30", m: at("07:00") }]);
    expect(
      dueWakes(ny, "America/New_York", Date.UTC(2026, 10, 2, 12, 0)),
    ).toEqual([{ date: "2026-11-02", m: at("07:00") }]);
    expect(
      dueWakes(ny, "America/New_York", Date.UTC(2026, 10, 2, 11, 0)),
    ).toEqual([]);
  });

  it("cerca de medianoche, la fecha es la del día del despertar", () => {
    const late = [{ m: at("23:55"), d: 0b1111111 }];
    const after = Date.UTC(2026, 10, 17, 5, 2); // 00:02 del martes en Bogotá
    expect(dueWakes(late, "America/Bogota", after)).toEqual([
      { date: "2026-11-16", m: at("23:55") },
    ]);
  });

  it("solo acepta zonas que Intl conoce", () => {
    expect(validTimeZone("America/Bogota")).toBe(true);
    expect(validTimeZone("UTC")).toBe(true);
    expect(validTimeZone("Marte/Olympus")).toBe(false);
    expect(validTimeZone("")).toBe(false);
    expect(validTimeZone("x".repeat(65))).toBe(false);
  });
});
