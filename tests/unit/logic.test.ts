import { describe, expect, it } from "vitest";

import {
  buildDayChecklist,
  dateKey,
  isRestrictionActive,
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
