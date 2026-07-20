import { describe, expect, it } from "vitest";

import {
  buildDayChecklist,
  buildReminder,
  checkIdFor,
  clockLabel,
  currentMealSlot,
  dateKey,
  isRestrictionActive,
  parseCheckId,
  resolveCheckTarget,
  resolveItemStatus,
  restrictionDaysRemaining,
  searchItems,
  supplementsForDate,
  waterGlassesTarget,
  weekdayFromDate,
} from "@/lib/diet/logic";
import { getDemoDiet } from "@/lib/diet/storage";

const diet = getDemoDiet();

// Fechas mockeadas SIEMPRE (regla 2 del CLAUDE.md). La demo restringe 2026-07-01 → 2026-09-28.
const monday = new Date("2026-07-06T10:00:00"); // lunes, restricción vigente
const thursday = new Date("2026-07-09T10:00:00"); // jueves: ningún suplemento demo
const afterRestriction = new Date("2026-10-01T10:00:00");

describe("weekday & dateKey", () => {
  it("maps JS days to schema weekdays", () => {
    expect(weekdayFromDate(monday)).toBe("mon");
    expect(weekdayFromDate(new Date("2026-07-12T10:00:00"))).toBe("sun");
  });

  it("builds local YYYY-MM-DD keys", () => {
    expect(dateKey(monday)).toBe("2026-07-06");
  });
});

describe("restriction validity", () => {
  it("is active within the 90-day window (inclusive)", () => {
    expect(isRestrictionActive(diet, monday)).toBe(true);
    expect(isRestrictionActive(diet, new Date("2026-09-28T23:00:00"))).toBe(
      true,
    );
  });

  it("expires after validUntil and before validFrom", () => {
    expect(isRestrictionActive(diet, afterRestriction)).toBe(false);
    expect(isRestrictionActive(diet, new Date("2026-06-30T10:00:00"))).toBe(
      false,
    );
  });

  it("counts remaining days (null when expired)", () => {
    expect(
      restrictionDaysRemaining(diet, new Date("2026-09-27T08:00:00")),
    ).toBe(1);
    expect(
      restrictionDaysRemaining(diet, new Date("2026-09-28T08:00:00")),
    ).toBe(0);
    expect(restrictionDaysRemaining(diet, afterRestriction)).toBeNull();
  });
});

describe("resolveItemStatus (semáforo)", () => {
  it("answers '¿la manzana se puede?' → red, until date, with replacements", () => {
    const status = resolveItemStatus(diet, "manzana", monday);
    expect(status).toMatchObject({
      kind: "restricted",
      color: "red",
      restrictionActive: true,
    });
    if (status?.kind !== "restricted") return;
    expect(status.until).toBe("2026-09-28");
    expect(status.equivalences[0]?.use.map((u) => u.es)).toContain("pera");
  });

  it("marks expired restrictions as no longer active", () => {
    const status = resolveItemStatus(diet, "manzana", afterRestriction);
    expect(status).toMatchObject({
      kind: "restricted",
      restrictionActive: false,
    });
  });

  it("resolves fixed red items with their why", () => {
    const status = resolveItemStatus(diet, "gaseosas", monday);
    expect(status).toMatchObject({ kind: "red", color: "red" });
    if (status?.kind === "red") expect(status.why?.es).toBeTruthy();
  });

  it("resolves alsoAvoid items as red without why", () => {
    const status = resolveItemStatus(diet, "colorantes", monday);
    expect(status).toMatchObject({ kind: "red", color: "red" });
    if (status?.kind === "red") expect(status.why).toBeUndefined();
  });

  it("resolves yellow items with their limit", () => {
    const status = resolveItemStatus(diet, "banano", monday);
    expect(status).toMatchObject({ kind: "yellow", color: "yellow" });
    if (status?.kind === "yellow")
      expect(status.limit.en).toBe("max 1 per day");
  });

  it("resolves green items with their group and portion", () => {
    const status = resolveItemStatus(diet, "zanahoria", monday);
    expect(status).toMatchObject({ kind: "green", color: "green" });
    if (status?.kind === "green") expect(status.group.id).toBe("verduras");
  });

  it("returns null for unknown items (la UI dice 'pregúntale al profesional')", () => {
    expect(resolveItemStatus(diet, "no-existe", monday)).toBeNull();
  });
});

describe("searchItems", () => {
  it("finds by name in the active locale", () => {
    const results = searchItems(diet, "manzana", "es", monday);
    expect(results.some((r) => r.id === "manzana")).toBe(true);
    const enResults = searchItems(diet, "apple", "en", monday);
    expect(enResults.some((r) => r.id === "manzana")).toBe(true);
  });

  it("ignores queries shorter than 2 chars", () => {
    expect(searchItems(diet, "m", "es", monday)).toEqual([]);
  });
});

describe("supplementsForDate (Lun–Dom)", () => {
  it("returns the right supplement per weekday", () => {
    expect(supplementsForDate(diet, monday).map((s) => s.id)).toEqual([
      "multivitaminico-demo",
    ]);
    const saturday = new Date("2026-07-11T10:00:00");
    expect(supplementsForDate(diet, saturday).map((s) => s.id)).toEqual([
      "omega-demo",
    ]);
  });

  it("returns empty when 'hoy no toca'", () => {
    expect(supplementsForDate(diet, thursday)).toEqual([]);
  });
});

describe("buildDayChecklist", () => {
  it("combines meals + today's supplements + water glasses", () => {
    const list = buildDayChecklist(diet, monday, []);
    // 5 comidas + 1 suplemento (lunes) + 4 vasos = 10
    expect(list.totalCount).toBe(10);
    expect(list.doneCount).toBe(0);
    expect(list.items.filter((i) => i.kind === "water")).toHaveLength(
      waterGlassesTarget(diet),
    );
  });

  it("has no supplement entries on 'no toca' days", () => {
    const list = buildDayChecklist(diet, thursday, []);
    expect(list.items.some((i) => i.kind === "supplement")).toBe(false);
    expect(list.totalCount).toBe(9);
  });

  it("reflects done marks instantly (qué ya hice / qué falta)", () => {
    const list = buildDayChecklist(diet, monday, ["meal:desayuno", "water:1"]);
    expect(list.doneCount).toBe(2);
    expect(list.items.find((i) => i.checkId === "meal:desayuno")?.done).toBe(
      true,
    );
    expect(list.items.find((i) => i.checkId === "meal:almuerzo")?.done).toBe(
      false,
    );
  });

  it("ignores stale done ids that no longer exist in the diet", () => {
    const list = buildDayChecklist(diet, monday, ["meal:fantasma"]);
    expect(list.doneCount).toBe(0);
  });
});

// Demo menu slots: desayuno 07:00–08:00 · media-manana 10:00–10:30 ·
// almuerzo 12:30–13:30 · merienda 16:00–16:30 · cena 18:30–19:00.
describe("clockLabel", () => {
  it("formats device local time as HH:MM (zero-padded)", () => {
    expect(clockLabel(new Date("2026-07-06T07:05:00"))).toBe("07:05");
    expect(clockLabel(new Date("2026-07-06T18:30:00"))).toBe("18:30");
    expect(clockLabel(new Date("2026-07-06T00:00:00"))).toBe("00:00");
  });
});

describe("currentMealSlot — franja vigente / siguiente (reloj inyectado)", () => {
  const at = (hhmm: string) => new Date(`2026-07-06T${hhmm}:00`);

  it("before the first meal: points to breakfast as next", () => {
    const slot = currentMealSlot(diet, at("06:00"));
    expect(slot).toMatchObject({ kind: "before-first" });
    if (slot?.kind === "before-first") expect(slot.next.id).toBe("desayuno");
  });

  it("during a slot: current meal + the one that follows (inclusive end)", () => {
    const inside = currentMealSlot(diet, at("07:30"));
    expect(inside).toMatchObject({ kind: "during" });
    if (inside?.kind === "during") {
      expect(inside.meal.id).toBe("desayuno");
      expect(inside.next?.id).toBe("media-manana");
    }
    const atEnd = currentMealSlot(diet, at("08:00"));
    expect(atEnd).toMatchObject({ kind: "during" });
    if (atEnd?.kind === "during") expect(atEnd.meal.id).toBe("desayuno");
  });

  it("in a gap between slots: previous done + next coming", () => {
    const slot = currentMealSlot(diet, at("09:00"));
    expect(slot).toMatchObject({ kind: "between" });
    if (slot?.kind === "between") {
      expect(slot.prev.id).toBe("desayuno");
      expect(slot.next.id).toBe("media-manana");
    }
  });

  it("during the last slot: next is null", () => {
    const slot = currentMealSlot(diet, at("18:45"));
    expect(slot).toMatchObject({ kind: "during" });
    if (slot?.kind === "during") {
      expect(slot.meal.id).toBe("cena");
      expect(slot.next).toBeNull();
    }
  });

  it("after the last meal: only the previous one", () => {
    const slot = currentMealSlot(diet, at("20:00"));
    expect(slot).toMatchObject({ kind: "after-last" });
    if (slot?.kind === "after-last") expect(slot.prev.id).toBe("cena");
  });
});

describe("buildReminder — qué toca ahora (7 días con reloj falso)", () => {
  // Suplementos demo: multivitamínico lun/mié/vie · omega mar/sáb.
  const cases: { date: string; weekday: string; supplement: string | null }[] =
    [
      {
        date: "2026-07-06",
        weekday: "lunes",
        supplement: "multivitaminico-demo",
      },
      { date: "2026-07-07", weekday: "martes", supplement: "omega-demo" },
      {
        date: "2026-07-08",
        weekday: "miércoles",
        supplement: "multivitaminico-demo",
      },
      { date: "2026-07-09", weekday: "jueves", supplement: null },
      {
        date: "2026-07-10",
        weekday: "viernes",
        supplement: "multivitaminico-demo",
      },
      { date: "2026-07-11", weekday: "sábado", supplement: "omega-demo" },
      { date: "2026-07-12", weekday: "domingo", supplement: null },
    ];

  for (const c of cases) {
    it(`${c.weekday}: pending supplement = ${c.supplement ?? "none"}`, () => {
      const reminder = buildReminder(diet, new Date(`${c.date}T07:30:00`), []);
      if (c.supplement) {
        expect(reminder.supplements).toEqual({
          kind: "pending",
          pending: [expect.objectContaining({ id: c.supplement })],
        });
      } else {
        // hoy NO toca ninguno (≠ "ya los tomó todos")
        expect(reminder.supplements).toEqual({ kind: "none-today" });
      }
    });
  }

  it("distingue 'hoy no toca ninguno' de 'ya los tomó todos' (bug del recordatorio)", () => {
    // Jueves: ningún suplemento programado → none-today (NO 'all-done').
    const thursday = buildReminder(diet, new Date("2026-07-09T07:30:00"), []);
    expect(thursday.supplements).toEqual({ kind: "none-today" });

    // Domingo: idem (el otro día sin suplemento del ciclo demo).
    const sunday = buildReminder(diet, new Date("2026-07-12T07:30:00"), []);
    expect(sunday.supplements).toEqual({ kind: "none-today" });

    // Lunes con el suplemento marcado → SÍ tocaba pero ya no queda: all-done.
    const mondayDone = buildReminder(diet, new Date("2026-07-06T07:30:00"), [
      "supplement:multivitaminico-demo",
    ]);
    expect(mondayDone.supplements).toEqual({ kind: "all-done" });
  });

  it("drops a supplement from pending once it is marked done", () => {
    const monday7am = new Date("2026-07-06T07:30:00");
    const before = buildReminder(diet, monday7am, []);
    expect(before.supplements).toMatchObject({
      kind: "pending",
      pending: [expect.objectContaining({ id: "multivitaminico-demo" })],
    });
    const after = buildReminder(diet, monday7am, [
      "supplement:multivitaminico-demo",
    ]);
    expect(after.supplements).toEqual({ kind: "all-done" });
  });

  it("counts water done against the target without moralizing", () => {
    const reminder = buildReminder(diet, new Date("2026-07-06T07:30:00"), [
      "water:1",
      "water:3",
    ]);
    expect(reminder.water).toEqual({ target: 4, done: 2 });
  });

  it("water done never exceeds target even with an out-of-range id", () => {
    // 4 vasos válidos + "water:9" (fuera del objetivo): done cuenta 1..target.
    const reminder = buildReminder(diet, new Date("2026-07-06T07:30:00"), [
      "water:1",
      "water:2",
      "water:3",
      "water:4",
      "water:9",
    ]);
    expect(reminder.water).toEqual({ target: 4, done: 4 });
  });

  it("carries the current meal slot for the injected time", () => {
    const reminder = buildReminder(diet, new Date("2026-07-06T12:45:00"), []);
    expect(reminder.slot).toMatchObject({ kind: "during" });
    if (reminder.slot?.kind === "during")
      expect(reminder.slot.meal.id).toBe("almuerzo");
  });

  it("con dailyMenu vacío el recordatorio no tiene franja (slot null)", () => {
    const empty = { ...diet, dailyMenu: [] };
    const reminder = buildReminder(empty, new Date("2026-07-06T07:30:00"), []);
    expect(reminder.slot).toBeNull();
  });
});

describe("currentMealSlot — casos límite y menús atípicos (7 días de reloj)", () => {
  const at = (hhmm: string) => new Date(`2026-07-06T${hhmm}:00`);

  it("en el inicio EXACTO de una franja: during (start inclusivo)", () => {
    const slot = currentMealSlot(diet, at("07:00"));
    expect(slot).toMatchObject({ kind: "during" });
    if (slot?.kind === "during") expect(slot.meal.id).toBe("desayuno");
  });

  it("en el fin EXACTO de la última franja: during (end inclusivo)", () => {
    const slot = currentMealSlot(diet, at("19:00"));
    expect(slot).toMatchObject({ kind: "during" });
    if (slot?.kind === "during") {
      expect(slot.meal.id).toBe("cena");
      expect(slot.next).toBeNull();
    }
  });

  it("medianoche (00:00): antes de la primera comida", () => {
    expect(currentMealSlot(diet, at("00:00"))).toMatchObject({
      kind: "before-first",
    });
  });

  it("fin del día (23:59): después de la última comida", () => {
    expect(currentMealSlot(diet, at("23:59"))).toMatchObject({
      kind: "after-last",
    });
  });

  it("menú contiguo (una comida empieza donde termina la previa): 'sigue' no la salta", () => {
    const contiguous = {
      ...diet,
      dailyMenu: [
        { ...diet.dailyMenu[0], id: "a", start: "07:00", end: "08:00" },
        { ...diet.dailyMenu[1], id: "b", start: "08:00", end: "09:00" },
      ],
    };
    // Durante la primera, la contigua (start === end previa) ES la siguiente.
    const during = currentMealSlot(contiguous, at("07:30"));
    expect(during).toMatchObject({ kind: "during" });
    if (during?.kind === "during") {
      expect(during.meal.id).toBe("a");
      expect(during.next?.id).toBe("b");
    }
    // En el instante compartido 08:00 resuelve UNA sola franja (during).
    expect(currentMealSlot(contiguous, at("08:00"))).toMatchObject({
      kind: "during",
    });
  });

  it("menú vacío: null", () => {
    expect(currentMealSlot({ ...diet, dailyMenu: [] }, at("07:30"))).toBeNull();
  });
});

describe("codec del checkId + resolveCheckTarget", () => {
  it("checkIdFor/parseCheckId son inversos; parte por el PRIMER ':' (id con ':')", () => {
    expect(checkIdFor("meal", "desayuno")).toBe("meal:desayuno");
    expect(checkIdFor("water", 3)).toBe("water:3");
    expect(parseCheckId("meal:sub:id")).toEqual({ kind: "meal", id: "sub:id" });
    expect(parseCheckId("sinDosPuntos")).toEqual({
      kind: "sinDosPuntos",
      id: "",
    });
  });

  it("resuelve comida/suplemento/agua contra la dieta activa", () => {
    const meal = resolveCheckTarget(diet, "meal:desayuno");
    expect(meal).toMatchObject({ kind: "meal", meal: { id: "desayuno" } });
    const sup = resolveCheckTarget(diet, "supplement:multivitaminico-demo");
    expect(sup).toMatchObject({ kind: "supplement" });
    expect(resolveCheckTarget(diet, "water:2")).toEqual({
      kind: "water",
      index: 2,
    });
  });

  it("id huérfano (de otra dieta) o agua no numérica → null (la UI decide el rótulo)", () => {
    expect(resolveCheckTarget(diet, "meal:no-existe")).toBeNull();
    expect(resolveCheckTarget(diet, "water:x")).toBeNull();
    expect(resolveCheckTarget(diet, "otra:cosa")).toBeNull();
  });
});
