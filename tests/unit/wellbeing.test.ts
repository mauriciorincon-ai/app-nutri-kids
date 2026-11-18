import { beforeEach, describe, expect, it } from "vitest";

import { clearDevice, getDeviceId } from "@/lib/device";
import {
  clearDayLog,
  DAY_LOG_KEY,
  getDayRecord,
  getWellbeing,
  listRecordedEntries,
  listWellbeingDays,
  mergeRemoteDay,
  readDayRegs,
  setFood,
  setHabit,
  setMood,
  setNote,
  setWell,
  toggleDone,
  type DayWellbeing,
} from "@/lib/diet/day-log";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import {
  getAgeBand,
  mergeRemoteProfile,
  readProfileRegs,
  setAgeBand,
} from "@/lib/diet/profile-notes";
import { TEXTURES } from "@/lib/diet/schema";
import { wellbeingText, type WellbeingText } from "@/i18n/wellbeing";
import { foodIdsAnnotated, summarizeFood } from "@/lib/wellbeing/acceptance";
import { AGE_RECHECK_MS, ageRecheckDue } from "@/lib/wellbeing/age";
import { formatMinutes, readHabit } from "@/lib/wellbeing/habits";
import {
  allReferences,
  referenceFor,
  SOURCES,
} from "@/lib/wellbeing/references";
import {
  AGE_BANDS,
  foodKey,
  FOOD_KEY_MAX,
  FOOD_TEXTURES,
  HABITS,
  MAP_CAPS,
  MOODS,
  parseFoodKey,
  SYMPTOMS,
  type FoodValue,
} from "@/lib/wellbeing/values";

/**
 * Bienestar (S10 · ADR-015): el registro, las referencias con su fuente, la aceptación derivada,
 * la franja de edad y los textos (paridad, ninguna frase de consejo médico, ni de culpa o alarma).
 */

const DATE = new Date(2026, 10, 16, 12, 0, 0);
const DAY = "2026-11-16";
const food = (over: Partial<FoodValue> = {}): FoodValue => ({
  stage: "tasted",
  verdict: null,
  texture: null,
  presentation: null,
  isNew: false,
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  clearDevice();
});

// ---------------------------------------------------------------------------
// El registro del día
// ---------------------------------------------------------------------------

describe("registro del día: bienestar", () => {
  it("anota, lee y quita cada cosa; quitar deja lápida y un día sin nada amanece vacío", () => {
    setMood(DATE, "meal:cena", "tired");
    setFood(DATE, foodKey("cena", "brocoli"), food({ verdict: "accepts" }));
    setWell(DATE, "energy", "low");
    setWell(DATE, "note", "  durmió poco  ");
    setHabit(DATE, "sleep", 570);
    const wb = getWellbeing(DATE);
    expect(wb.moods).toEqual({ "meal:cena": "tired" });
    expect(wb.food[foodKey("cena", "brocoli")].verdict).toBe("accepts");
    expect(wb.well).toEqual({ energy: "low", note: "durmió poco" });
    expect(wb.habits).toEqual({ sleep: 570 });

    setMood(DATE, "meal:cena", null);
    expect(getWellbeing(DATE).moods).toEqual({});
    const regs = readDayRegs()[DAY];
    expect(regs.moods?.["meal:cena"].v).toBeNull(); // lápida, para que se mezcle bien
    expect(getWellbeing(new Date(2026, 10, 17)).habits).toEqual({});
  });

  it("lo que no encaja no se guarda: opción inventada, minutos fuera de rango, clave sin sentido", () => {
    setMood(DATE, "meal:cena", "furious" as never);
    setWell(DATE, "pain", "muy-fuerte");
    setWell(DATE, "heart", "low");
    setHabit(DATE, "sleep", -5);
    setHabit(DATE, "sleep", 9999);
    setHabit(DATE, "sleep", 7.5);
    setHabit(DATE, "ritmo-cardiaco", 70);
    setFood(DATE, foodKey("c", "f"), { ...food(), stage: "ate" as never });
    setFood(DATE, "x".repeat(FOOD_KEY_MAX + 1), food());
    expect(listWellbeingDays()).toEqual([]);
  });

  it("cada mapa tiene su tope: el siguiente no entra, pero lo ya anotado se puede cambiar", () => {
    for (let i = 0; i < MAP_CAPS.moods + 3; i++)
      setMood(DATE, `meal:m${i}`, "happy");
    expect(Object.keys(getWellbeing(DATE).moods)).toHaveLength(MAP_CAPS.moods);
    setMood(DATE, "meal:m0", "tired");
    expect(getWellbeing(DATE).moods["meal:m0"]).toBe("tired");
  });

  it("una clave como «constructor» en un día guardado no tira el resto del día", () => {
    const me = getDeviceId();
    window.localStorage.setItem(
      DAY_LOG_KEY,
      JSON.stringify({
        [DAY]: {
          marks: { "meal:desayuno": { t: 5, by: me, v: { at: "07:30" } } },
          notes: {},
          well: {
            constructor: { t: 1, by: me, v: "low" },
            toString: { t: 1, by: me, v: "low" },
            energy: { t: 2, by: me, v: "low" },
          },
        },
      }),
    );
    expect(getDayRecord(DATE).marks["meal:desayuno"].at).toBe("07:30");
    expect(getWellbeing(DATE).well).toEqual({ energy: "low" });
  });

  it("una clave de alimento no canónica no entra (dos formas de la misma comida contarían dos veces)", () => {
    setFood(DATE, "c|f", food());
    setFood(DATE, "%63|f", food());
    expect(Object.keys(getWellbeing(DATE).food)).toEqual(["c|f"]);
  });

  it("al llenarse un mapa, las lápidas se sueltan antes de negar una anotación nueva", () => {
    for (let i = 0; i < MAP_CAPS.moods; i++)
      setMood(DATE, `meal:m${i}`, "happy");
    setMood(DATE, "meal:m0", null);
    setMood(DATE, "meal:nuevo", "tired");
    expect(getWellbeing(DATE).moods["meal:nuevo"]).toBe("tired");
  });

  it("al mezclar dos teléfonos pasados del tope, queda en el tope y no cambia al repetir", () => {
    for (let i = 0; i < MAP_CAPS.moods; i++)
      setMood(DATE, `meal:a${i}`, "happy");
    const remote: Record<string, { t: number; by: string; v: "tired" }> = {};
    for (let i = 0; i < MAP_CAPS.moods; i++)
      remote[`meal:b${i}`] = { t: 1_000_000 + i, by: "otro", v: "tired" };
    expect(mergeRemoteDay(DAY, { marks: {}, notes: {}, moods: remote })).toBe(
      true,
    );
    expect(Object.keys(getWellbeing(DATE).moods)).toHaveLength(MAP_CAPS.moods);
    expect(mergeRemoteDay(DAY, { marks: {}, notes: {}, moods: remote })).toBe(
      false,
    );
  });

  it("los topes y las texturas del bienestar siguen a sus fuentes", () => {
    expect(MAP_CAPS.habits).toBe(HABITS.length);
    expect([...FOOD_TEXTURES]).toEqual([...TEXTURES]);
  });

  it("un día guardado antes del S10 (sin los mapas nuevos) se lee igual y conserva marcas y notas", () => {
    const me = getDeviceId();
    window.localStorage.setItem(
      DAY_LOG_KEY,
      JSON.stringify({
        [DAY]: {
          marks: { "meal:desayuno": { t: 5, by: me, v: { at: "07:30" } } },
          notes: {
            "meal:desayuno": {
              t: 6,
              by: me,
              v: { chips: ["rejected"], text: "no quiso" },
            },
          },
        },
      }),
    );
    expect(getDayRecord(DATE).marks["meal:desayuno"].at).toBe("07:30");
    expect(getDayRecord(DATE).notes["meal:desayuno"].text).toBe("no quiso");
    setMood(DATE, "meal:desayuno", "happy");
    const after = getDayRecord(DATE);
    expect(after.marks["meal:desayuno"].at).toBe("07:30");
    expect(after.notes["meal:desayuno"].chips).toEqual(["rejected"]);
    expect(getWellbeing(DATE).moods["meal:desayuno"]).toBe("happy");
  });

  it("un valor corrupto en el almacén se descarta sin tumbar al resto del día", () => {
    const me = getDeviceId();
    window.localStorage.setItem(
      DAY_LOG_KEY,
      JSON.stringify({
        [DAY]: {
          marks: {},
          notes: {},
          moods: {
            "meal:a": { t: 1, by: me, v: "happy" },
            "meal:b": { t: 1, by: me, v: "furious" },
          },
          habits: { sleep: { t: 1, by: me, v: "mucho" } },
        },
      }),
    );
    expect(getWellbeing(DATE).moods).toEqual({ "meal:a": "happy" });
    expect(getWellbeing(DATE).habits).toEqual({});
  });

  it("el día que solo tiene bienestar aparece en el historial; marcas y notas no cambian de forma", () => {
    setWell(DATE, "energy", "high");
    expect(listRecordedEntries().map((e) => e.day)).toEqual([DAY]);
    expect(getDayRecord(DATE)).toEqual({ marks: {}, notes: {} });
    toggleDone(DATE, "meal:desayuno", "07:30");
    setNote(DATE, "meal:desayuno", { chips: [], text: "bien" });
    expect(Object.keys(getDayRecord(DATE).marks)).toEqual(["meal:desayuno"]);
  });

  it("mezcla con lo de otro teléfono: gana el sello más reciente y no cambia si es lo mismo", () => {
    setMood(DATE, "meal:cena", "happy");
    const local = readDayRegs()[DAY];
    const t = local.moods!["meal:cena"].t;
    const older = {
      marks: {},
      notes: {},
      moods: { "meal:cena": { t: t - 1, by: "OTRO-TEL", v: "tired" as const } },
    };
    expect(mergeRemoteDay(DAY, older)).toBe(false);
    expect(getWellbeing(DATE).moods["meal:cena"]).toBe("happy");
    const newer = {
      marks: {},
      notes: {},
      moods: { "meal:cena": { t: t + 1, by: "OTRO-TEL", v: "tired" as const } },
      habits: { screen: { t: 5, by: "OTRO-TEL", v: 30 } },
    };
    expect(mergeRemoteDay(DAY, newer)).toBe(true);
    expect(getWellbeing(DATE).moods["meal:cena"]).toBe("tired");
    expect(getWellbeing(DATE).habits.screen).toBe(30);
    expect(mergeRemoteDay(DAY, newer)).toBe(false);
  });

  it("«Borrar datos» se lleva también el bienestar", () => {
    setMood(DATE, "meal:cena", "happy");
    clearDayLog();
    expect(listWellbeingDays()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Franja de edad (decisión 1a)
// ---------------------------------------------------------------------------

describe("franja de edad", () => {
  it("se elige entre las seis franjas, se lee y jamás hay una fecha de nacimiento", () => {
    expect(getAgeBand()).toBeNull();
    setAgeBand("3-4", 1_000);
    expect(getAgeBand()).toEqual({ band: "3-4", t: 1_000 });
    setAgeBand("nada" as never, 2_000);
    expect(getAgeBand()?.band).toBe("3-4");
    expect(AGE_BANDS).toEqual(["1", "2", "3-4", "5", "6-12", "13-17"]);
    expect(JSON.stringify(readProfileRegs())).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("confirmar la franja la vuelve a sellar y llega a otro teléfono; la pregunta es anual, con la fecha como perilla", () => {
    setAgeBand("5", 10_000);
    const t0 = getAgeBand()!.t;
    expect(ageRecheckDue(t0, t0 + AGE_RECHECK_MS - 1)).toBe(false);
    expect(ageRecheckDue(t0, t0 + AGE_RECHECK_MS)).toBe(true);
    setAgeBand("5", t0 + AGE_RECHECK_MS);
    expect(getAgeBand()!.t).toBeGreaterThan(t0);
    const regs = readProfileRegs();
    window.localStorage.clear();
    expect(mergeRemoteProfile({ notes: {}, age: regs.age })).toBe(true);
    expect(getAgeBand()?.band).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// Referencias por edad: cada una con su fuente, ninguna otra
// ---------------------------------------------------------------------------

describe("referencias por edad", () => {
  const h = (n: number) => n * 60;
  it("cada referencia con cifra lleva su fuente y la tabla es la del § 2 del sprint", () => {
    for (const r of allReferences()) {
      expect(
        "source" in r &&
          r.source.cite.es.length > 10 &&
          r.source.cite.en.length > 10 &&
          r.source.where.es.length > 3,
      ).toBe(true);
    }
    const sleep = (b: (typeof AGE_BANDS)[number]) => referenceFor("sleep", b);
    expect(sleep("1")).toMatchObject({ min: h(11), max: h(14) });
    expect(sleep("2")).toMatchObject({ min: h(11), max: h(14) });
    expect(sleep("3-4")).toMatchObject({ min: h(10), max: h(13) });
    expect(sleep("5")).toMatchObject({ min: h(10), max: h(13) });
    expect(sleep("6-12")).toMatchObject({ min: h(9), max: h(12) });
    expect(sleep("13-17")).toMatchObject({ min: h(8), max: h(10) });
    for (const b of ["1", "2", "3-4"] as const)
      expect(referenceFor("activity", b)).toMatchObject({
        kind: "min",
        min: 180,
      });
    expect(referenceFor("activity", "3-4")).toMatchObject({ mvpa: 60 });
    expect(referenceFor("activity", "1")).not.toHaveProperty("mvpa");
    for (const b of ["5", "6-12", "13-17"] as const)
      expect(referenceFor("activity", b)).toMatchObject({
        kind: "min",
        min: 60,
      });
    expect(referenceFor("screen", "1").kind).toBe("not-recommended");
    for (const b of ["2", "3-4"] as const)
      expect(referenceFor("screen", b)).toMatchObject({ kind: "max", max: 60 });
    for (const b of ["5", "6-12", "13-17"] as const)
      expect(referenceFor("screen", b).kind).toBe("limit-no-figure");
  });

  it("sol y naturaleza no tienen cifra oficial: se registra y no hay meta", () => {
    for (const b of AGE_BANDS)
      expect(referenceFor("sun", b)).toEqual({ kind: "none" });
    expect(readHabit("sun", "5", 90).status).toBe("no-figure");
    expect(readHabit("screen", "6-12", 300).status).toBe("no-figure");
  });

  it("las fuentes dicen dónde están (la OMS 2020, con sus páginas)", () => {
    expect(SOURCES["who-2020"].where.es).toContain("p. 25");
    expect(SOURCES["who-2020"].where.es).toContain("p. 29");
    expect(SOURCES["who-2020"].where.en).toContain("p. 25");
    expect(SOURCES["aasm-2016"].cite.es).toContain("785-786");
    expect(SOURCES["aasm-2016"].cite.en).toContain("785-786");
  });

  it("en inglés ninguna fuente sale con palabras en español", () => {
    for (const s of Object.values(SOURCES))
      for (const text of [s.cite.en, s.where.en])
        expect(text).not.toMatch(
          /OMS|menores|respaldada|sección|recomendaciones/,
        );
  });

  it("actividad de 5 a 17 años: la referencia es un promedio de la semana, un día suelto no se juzga", () => {
    for (const b of ["5", "6-12", "13-17"] as const)
      expect(readHabit("activity", b, 30).status).toBe("weekly-average");
    // Hasta los 4 años la cifra de la OMS 2019 es diaria: sí se compara.
    expect(readHabit("activity", "2", 30).status).toBe("below");
  });

  it("un hábito contra su referencia: dentro, un poco por debajo o por encima, nunca un veredicto", () => {
    expect(readHabit("sleep", "3-4", h(11)).status).toBe("within");
    expect(readHabit("sleep", "3-4", h(9) + 30).status).toBe("below");
    expect(readHabit("sleep", "3-4", h(14)).status).toBe("above");
    expect(readHabit("activity", "2", 180).status).toBe("within");
    expect(readHabit("activity", "2", 179).status).toBe("below");
    expect(readHabit("screen", "3-4", 60).status).toBe("within");
    expect(readHabit("screen", "3-4", 61).status).toBe("above");
    expect(readHabit("screen", "1", 0).status).toBe("within");
    expect(readHabit("screen", "1", 15).status).toBe("not-recommended");
    for (const habit of HABITS)
      for (const b of AGE_BANDS)
        expect([
          "within",
          "below",
          "above",
          "not-recommended",
          "no-figure",
          "weekly-average",
        ]).toContain(readHabit(habit, b, 60).status);
  });

  it("formatMinutes", () => {
    expect(formatMinutes(570)).toBe("9 h 30 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
  });
});

// ---------------------------------------------------------------------------
// Aceptación: exposiciones derivadas de lo anotado
// ---------------------------------------------------------------------------

describe("aceptación por alimento", () => {
  const days = (): { day: string; wellbeing: DayWellbeing }[] => {
    const mk = (f: Record<string, FoodValue>): DayWellbeing => ({
      moods: {},
      food: f,
      well: {},
      habits: {},
    });
    return [
      {
        day: "2026-11-16",
        wellbeing: mk({
          [foodKey("cena", "brocoli")]: food({
            stage: "tasted",
            verdict: "accepts",
            texture: "soft",
            presentation: "apart",
          }),
          [foodKey("almuerzo", "arroz")]: food({ stage: "looked" }),
        }),
      },
      {
        day: "2026-11-14",
        wellbeing: mk({
          [foodKey("cena", "brocoli")]: food({
            stage: "looked",
            isNew: true,
          }),
          [foodKey("almuerzo", "brocoli")]: food({
            stage: "touched",
            verdict: "refuses",
          }),
        }),
      },
    ];
  };

  it("mirar, tocar y probar cuentan como exposición, en cualquier comida y día", () => {
    const s = summarizeFood(days(), "brocoli");
    expect(s.exposures).toBe(3);
    expect(s.isNew).toBe(true);
    expect(s.lastVerdict).toBe("accepts"); // lo más reciente con veredicto
    expect(s.texturesThatWorked).toEqual(["soft"]);
    expect(s.presentationsThatWorked).toEqual(["apart"]);
    expect(summarizeFood(days(), "arroz").exposures).toBe(1);
    expect(summarizeFood(days(), "kiwi")).toMatchObject({
      exposures: 0,
      lastVerdict: null,
      isNew: false,
    });
    expect(foodIdsAnnotated(days()).sort()).toEqual(["arroz", "brocoli"]);
  });

  it("los ids con «:» o «|» no rompen la clave", () => {
    const k = foodKey("co:mida|1", "ali:mento|x");
    expect(parseFoodKey(k)).toEqual({
      mealId: "co:mida|1",
      foodId: "ali:mento|x",
    });
    expect(parseFoodKey("sin-separador")).toBeNull();
    expect(parseFoodKey("a|b|c")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Los textos
// ---------------------------------------------------------------------------

function strings(o: unknown, path = ""): [string, string][] {
  if (typeof o === "string") return [[path, o]];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, path ? `${path}.${k}` : k),
  );
}
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("textos del bienestar (es/en)", () => {
  const es = strings(wellbeingText.es);
  const en = strings(wellbeingText.en);

  it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
    expect(en.map(([k]) => k)).toEqual(es.map(([k]) => k));
    const enMap = Object.fromEntries(en);
    for (const [k, v] of es) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(enMap[k].trim().length, k).toBeGreaterThan(0);
      expect(placeholders(enMap[k]), k).toEqual(placeholders(v));
    }
  });

  it("cada opción que se puede anotar tiene su palabra en los dos idiomas", () => {
    for (const t of [wellbeingText.es, wellbeingText.en] as WellbeingText[]) {
      for (const m of MOODS) expect(t.moods[m]).toBeTruthy();
      for (const [sym, opts] of Object.entries(SYMPTOMS)) {
        expect(t.symptoms[sym as keyof typeof SYMPTOMS]).toBeTruthy();
        for (const o of opts)
          expect(
            (t.symptomOptions as Record<string, Record<string, string>>)[sym][
              o
            ],
          ).toBeTruthy();
      }
      for (const h of HABITS) expect(t.habits[h]).toBeTruthy();
      for (const b of AGE_BANDS) expect(t.ageBands[b]).toBeTruthy();
    }
  });

  it("ninguna frase suena a consejo médico, a calorías o peso", () => {
    for (const [k, v] of [...es, ...en]) {
      expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
    }
  });

  it("ninguna frase culpa, califica de «cumplimiento» ni urge con alarma", () => {
    const BAD =
      /\b(culpa\w*|fall[óo]\w*|incumpl\w*|no cumpli\w*|urgente\w*|peligr\w*|grave\w*|alarm\w*|malo|mala|failed|fail|guilt\w*|urgent\w*|danger\w*|serious\w*|alarm\w*|bad)\b/i;
    for (const [k, v] of [...es, ...en])
      expect(BAD.test(v), `${k}: ${v}`).toBe(false);
  });

  it("jamás una cifra de referencia escrita en el copy: salen del dato con su fuente", () => {
    // Solo llevan números las franjas de edad, el tope de la nota (140) y «1 vez».
    const ALLOWED = /^(ageBands\.|wellNoteHint$|exposuresOne$|habitSleep24$)/;
    for (const [k, v] of [...es, ...en])
      if (!ALLOWED.test(k))
        expect(/\d/.test(v.replace(/\{\w+\}/g, "")), `${k}: ${v}`).toBe(false);
  });
});
