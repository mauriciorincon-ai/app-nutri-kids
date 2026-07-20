import { describe, expect, it } from "vitest";

import demoRaw from "../../data/demo-diet.json";
import {
  getDoneIds,
  getDayRecord,
  getMarkTime,
  getNote,
  listRecordedDays,
  markDone,
  setNote,
  toggleDone,
  unmark,
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

describe("day-log v2: hora real de cada marca", () => {
  it("records the real time when marking and reads it back", () => {
    markDone(day1, "meal:almuerzo", "12:35");
    expect(getDoneIds(day1)).toEqual(["meal:almuerzo"]);
    expect(getMarkTime(day1, "meal:almuerzo")).toBe("12:35");
  });

  it("toggleDone with explicit time stays deterministic; unmark clears it", () => {
    toggleDone(day1, "meal:desayuno", "07:10");
    expect(getMarkTime(day1, "meal:desayuno")).toBe("07:10");
    unmark(day1, "meal:desayuno");
    expect(getMarkTime(day1, "meal:desayuno")).toBeNull();
    expect(getDoneIds(day1)).toEqual([]);
  });

  it("null time is honest about an unknown hour", () => {
    markDone(day1, "water:1", null);
    expect(getMarkTime(day1, "water:1")).toBeNull();
    expect(getDoneIds(day1)).toEqual(["water:1"]);
  });
});

describe("day-log v2: nota corta por comida (chips + texto, sin culpa)", () => {
  it("stores chips and short text, and reads them back", () => {
    setNote(day1, "meal:almuerzo", { chips: ["rejected"], text: "no quiso" });
    expect(getNote(day1, "meal:almuerzo")).toEqual({
      chips: ["rejected"],
      text: "no quiso",
    });
  });

  it("drops unknown chips and caps the text length", () => {
    setNote(day1, "meal:cena", {
      // @ts-expect-error probamos que un chip inválido se descarta
      chips: ["rejected", "bogus"],
      text: "x".repeat(200),
    });
    const note = getNote(day1, "meal:cena");
    expect(note?.chips).toEqual(["rejected"]);
    expect(note?.text.length).toBe(140);
  });

  it("an empty note clears the entry", () => {
    setNote(day1, "meal:merienda", { chips: ["pain"], text: "" });
    expect(getNote(day1, "meal:merienda")).not.toBeNull();
    setNote(day1, "meal:merienda", { chips: [], text: "   " });
    expect(getNote(day1, "meal:merienda")).toBeNull();
  });

  it("a note survives unmarking the meal (not an accidental delete)", () => {
    toggleDone(day1, "meal:almuerzo", "12:00");
    setNote(day1, "meal:almuerzo", { chips: ["craving"], text: "" });
    unmark(day1, "meal:almuerzo");
    expect(getDoneIds(day1)).toEqual([]);
    expect(getNote(day1, "meal:almuerzo")).toEqual({
      chips: ["craving"],
      text: "",
    });
  });
});

describe("day-log v2: historial de días", () => {
  it("lists days with any activity, most recent first", () => {
    markDone(day1, "meal:desayuno", "07:00");
    markDone(day2, "meal:cena", "18:40");
    setNote(new Date("2026-07-05T09:00:00"), "meal:almuerzo", {
      chips: ["pain"],
      text: "",
    });
    expect(listRecordedDays()).toEqual([
      "2026-07-07",
      "2026-07-06",
      "2026-07-05",
    ]);
  });

  it("ignores days that ended up empty", () => {
    toggleDone(day1, "meal:desayuno", "07:00");
    unmark(day1, "meal:desayuno");
    expect(listRecordedDays()).toEqual([]);
  });
});

describe("day-log v2: migración desde el estado real de un usuario S1/S2", () => {
  it("migrates the v1 store (Record<fecha, string[]>) without losing checks", () => {
    // Estado REAL como lo dejó el S1/S2: clave v1 con marcas sin hora.
    window.localStorage.setItem(
      "nutrikids.daylog.v1",
      JSON.stringify({
        "2026-07-06": ["meal:desayuno", "supplement:multivitaminico-demo"],
        "2026-07-07": ["water:1"],
      }),
    );
    // Primera lectura v2: migra, conserva las marcas con hora desconocida.
    expect(getDoneIds(day1).sort()).toEqual([
      "meal:desayuno",
      "supplement:multivitaminico-demo",
    ]);
    expect(getMarkTime(day1, "meal:desayuno")).toBeNull(); // hora desconocida, honesto
    expect(getDoneIds(day2)).toEqual(["water:1"]);
    // La v1 se elimina (una sola fuente de verdad); la v2 queda escrita.
    expect(window.localStorage.getItem("nutrikids.daylog.v1")).toBeNull();
    expect(window.localStorage.getItem(DAY_LOG_KEY)).not.toBeNull();
  });

  it("keeps the migrated history readable and extensible", () => {
    window.localStorage.setItem(
      "nutrikids.daylog.v1",
      JSON.stringify({ "2026-07-06": ["meal:desayuno"] }),
    );
    // Al leer migra; luego marcar con hora nueva convive con lo migrado.
    markDone(day1, "meal:almuerzo", "12:30");
    expect(getDoneIds(day1).sort()).toEqual(["meal:almuerzo", "meal:desayuno"]);
    expect(getMarkTime(day1, "meal:almuerzo")).toBe("12:30");
    expect(getMarkTime(day1, "meal:desayuno")).toBeNull();
  });

  it("a corrupt v1 store degrades to a fresh v2 (fail-safe)", () => {
    window.localStorage.setItem("nutrikids.daylog.v1", "{roto");
    expect(getDayRecord(day1)).toEqual({ marks: {}, notes: {} });
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
