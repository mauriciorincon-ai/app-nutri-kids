import { describe, expect, it } from "vitest";

import demoRaw from "../../data/demo-diet.json";
import {
  getDoneIds,
  toggleDone,
  clearDayLog,
  DAY_LOG_KEY,
} from "@/lib/diet/day-log";
import {
  STORAGE_KEYS,
  clearAllData,
  hasStoredRealDiet,
  importDiet,
  loadActiveDiet,
  loadPrefs,
  savePrefs,
  switchToDemo,
  switchToReal,
} from "@/lib/diet/storage";

// La "dieta real" de los tests es una variación de la demo — JAMÁS la dieta del niño.
const fakeRealDiet = JSON.stringify({
  ...demoRaw,
  meta: { ...demoRaw.meta, id: "familia-test-v1" },
});

const day1 = new Date("2026-07-06T09:00:00");
const day2 = new Date("2026-07-07T09:00:00");

describe("storage: demo↔real", () => {
  it("falls back to demo when nothing is stored", () => {
    const active = loadActiveDiet();
    expect(active.source).toBe("demo");
    expect(active.diet.meta.id).toBe("demo-diet-v1");
  });

  it("imports a valid diet and returns metadata-only counts", () => {
    const result = importDiet(fakeRealDiet);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.counts.supplements).toBe(2);
    expect(loadActiveDiet()).toMatchObject({ source: "real" });
    expect(hasStoredRealDiet()).toBe(true);
  });

  it("rejects invalid input without touching the stored diet", () => {
    importDiet(fakeRealDiet);
    const bad = importDiet("{no json");
    expect(bad).toMatchObject({ ok: false, error: "invalid-json" });
    expect(loadActiveDiet().source).toBe("real");
  });

  it("switches demo↔real keeping the stored diet", () => {
    importDiet(fakeRealDiet);
    switchToDemo();
    expect(loadActiveDiet().source).toBe("demo");
    expect(switchToReal()).toBe(true);
    expect(loadActiveDiet().source).toBe("real");
  });

  it("cannot switch to real when nothing was imported", () => {
    expect(switchToReal()).toBe(false);
  });

  it("discards a corrupted stored diet and falls back to demo (fail-safe)", () => {
    importDiet(fakeRealDiet);
    window.localStorage.setItem(STORAGE_KEYS.diet, "{corrupto");
    const active = loadActiveDiet();
    expect(active.source).toBe("demo");
    expect(window.localStorage.getItem(STORAGE_KEYS.diet)).toBeNull();
  });
});

describe("day-log: checklist por fecha", () => {
  it("starts empty and toggles marks per day", () => {
    expect(getDoneIds(day1)).toEqual([]);
    toggleDone(day1, "meal:desayuno");
    toggleDone(day1, "water:1");
    expect(getDoneIds(day1).sort()).toEqual(["meal:desayuno", "water:1"]);
    toggleDone(day1, "water:1");
    expect(getDoneIds(day1)).toEqual(["meal:desayuno"]);
  });

  it("amanece vacío al día siguiente SIN perder el historial", () => {
    toggleDone(day1, "meal:desayuno");
    expect(getDoneIds(day2)).toEqual([]); // día nuevo, fresco
    expect(getDoneIds(day1)).toEqual(["meal:desayuno"]); // historial intacto
  });

  it("recovers from a corrupted store", () => {
    window.localStorage.setItem(DAY_LOG_KEY, "no-json");
    expect(getDoneIds(day1)).toEqual([]);
    toggleDone(day1, "meal:cena");
    expect(getDoneIds(day1)).toEqual(["meal:cena"]);
  });
});

describe("clearAllData ('borrar datos')", () => {
  it("removes imported diet AND day-log, keeps locale pref, returns to demo", () => {
    importDiet(fakeRealDiet);
    toggleDone(day1, "meal:desayuno");
    savePrefs({ locale: "en", disclaimerSeen: true, chatIntroSeen: false });

    clearAllData();

    expect(loadActiveDiet().source).toBe("demo");
    expect(hasStoredRealDiet()).toBe(false);
    expect(getDoneIds(day1)).toEqual([]);
    expect(loadPrefs().locale).toBe("en"); // el idioma no es dato del niño
  });
});

describe("prefs", () => {
  it("defaults to es + flags not seen, and survives corrupt data", () => {
    expect(loadPrefs()).toEqual({
      locale: "es",
      disclaimerSeen: false,
      chatIntroSeen: false,
    });
    window.localStorage.setItem(STORAGE_KEYS.prefs, "###");
    expect(loadPrefs()).toEqual({
      locale: "es",
      disclaimerSeen: false,
      chatIntroSeen: false,
    });
  });

  it("persists locale, disclaimer and chat-intro flags", () => {
    savePrefs({ locale: "en", disclaimerSeen: true, chatIntroSeen: true });
    expect(loadPrefs()).toEqual({
      locale: "en",
      disclaimerSeen: true,
      chatIntroSeen: true,
    });
  });
});

describe("clearDayLog", () => {
  it("clears all days", () => {
    toggleDone(day1, "a");
    toggleDone(day2, "b");
    clearDayLog();
    expect(getDoneIds(day1)).toEqual([]);
    expect(getDoneIds(day2)).toEqual([]);
  });
});
