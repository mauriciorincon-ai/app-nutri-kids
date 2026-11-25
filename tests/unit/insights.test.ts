import { describe, expect, it } from "vitest";

import { fill, learnText } from "@/i18n/learn";
import type { InsightDay } from "@/lib/diet/day-log";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import { buildDayChecklist } from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import { getDemoDiet } from "@/lib/diet/storage";
import { adherence, HARDEST_MIN } from "@/lib/insights/adherence";
import { dayKeys, judgeDay, keyToDate } from "@/lib/insights/days";
import {
  radar,
  RADAR_MIN_DAYS,
  RADAR_MIN_HITS,
  type RadarPattern,
} from "@/lib/insights/radar";
import type { Place, PressureEntry } from "@/lib/pressure/values";
import { foodKey } from "@/lib/wellbeing/values";

/**
 * «Lo que aprende» (S15 · ADR-021): adherencia y radar con días INVENTADOS sobre la dieta demo y
 * el reloj fijo. Un lunes a las 20:00, cuando ya pasaron todas las comidas del día.
 */
const NOW = new Date("2026-08-10T20:00:00");
const diet = (): DietPlan => structuredClone(getDemoDiet());

/** Lo que el plan espera un día (comidas y suplementos, sin agua). */
function planIds(key: string): string[] {
  return buildDayChecklist(diet(), keyToDate(key), [])
    .items.filter((i) => i.kind !== "water")
    .map((i) => i.checkId);
}

type DayOpts = {
  skip?: string[];
  rejected?: string[];
  foods?: string[];
  well?: Record<string, string>;
  onlyWellbeing?: boolean;
};

function day(key: string, o: DayOpts = {}): InsightDay {
  const marks: InsightDay["record"]["marks"] = {};
  if (!o.onlyWellbeing)
    for (const id of planIds(key))
      if (!o.skip?.includes(id)) marks[id] = { at: "12:00" };
  const notes: InsightDay["record"]["notes"] = {};
  for (const id of o.rejected ?? [])
    notes[id] = { chips: ["rejected"], text: "" };
  const food: InsightDay["wellbeing"]["food"] = {};
  for (const f of o.foods ?? [])
    food[foodKey("meal:almuerzo", f)] = {
      stage: "tasted",
      verdict: null,
      texture: null,
      presentation: null,
      isNew: false,
    };
  return {
    day: key,
    record: { marks, notes },
    wellbeing: {
      moods: {},
      food,
      well: o.well ?? {},
      habits: {},
      lunch: {},
    },
  };
}

let seq = 0;
function offer(
  date: string,
  place: Place,
  answer: PressureEntry["answer"],
): PressureEntry {
  seq++;
  return {
    id: `entry${String(seq).padStart(4, "0")}`,
    t: keyToDate(date).getTime(),
    date,
    by: "phone-a",
    who: "other",
    what: "outside",
    place,
    answer,
  };
}

const MERIENDA = "meal:merienda";

describe("qué cuenta como algo distinto al plan", () => {
  const key = "2026-08-08";
  it("un día sin anotar es «sin anotar», jamás una falta", () => {
    expect(judgeDay(diet(), key, undefined, 0, NOW).status).toBe("none");
  });
  it("un día con solo bienestar (sin marcas ni notas) tampoco se juzga", () => {
    const d = day(key, { onlyWellbeing: true, well: { pain: "tummy" } });
    expect(judgeDay(diet(), key, d, 0, NOW).status).toBe("none");
  });
  it("todo marcado: dentro del plan", () => {
    expect(judgeDay(diet(), key, day(key), 0, NOW).status).toBe("in");
  });
  it("una comida sin marcar, una nota «no lo quiso» o una oferta aceptada: algo distinto", () => {
    expect(
      judgeDay(diet(), key, day(key, { skip: [MERIENDA] }), 0, NOW).missed,
    ).toEqual([MERIENDA]);
    const r = judgeDay(diet(), key, day(key, { rejected: [MERIENDA] }), 0, NOW);
    expect(r.status).toBe("off");
    expect(r.rejected).toEqual([MERIENDA]);
    expect(judgeDay(diet(), key, undefined, 1, NOW).status).toBe("off");
  });
  it("el agua no cuenta: es una cantidad", () => {
    expect(planIds(key).some((id) => id.startsWith("water:"))).toBe(false);
    expect(judgeDay(diet(), key, day(key), 0, NOW).expected.join()).not.toMatch(
      /water/,
    );
  });
  it("hoy solo se miran las comidas cuya franja ya terminó; los suplementos aún están a tiempo", () => {
    const noon = new Date("2026-08-10T12:00:00");
    const d = day("2026-08-10", { skip: ["meal:almuerzo", "meal:cena"] });
    const r = judgeDay(diet(), "2026-08-10", d, 0, noon);
    expect(r.expected).toEqual(["meal:desayuno", "meal:media-manana"]);
    expect(r.status).toBe("in");
  });
});

describe("la adherencia, en palabras y conteos (G-Plan 1a)", () => {
  // Esta semana (2026-08-04 … 08-10): cinco dentro, uno sin merienda, uno sin anotar (el jueves).
  const week = dayKeys(NOW, 7);
  const days = week
    .filter((k) => k !== "2026-08-06")
    .map((k) => (k === "2026-08-08" ? day(k, { skip: [MERIENDA] }) : day(k)));

  it("cuenta la semana y deja aparte los días sin anotar", () => {
    const a = adherence(diet(), days, [], NOW);
    expect(a.week).toMatchObject({ inPlan: 5, recorded: 6, unrecorded: 1 });
    expect(a.week.days.map((d) => d.day)).toEqual([...week].reverse());
    expect(a.week.days.find((d) => d.day === "2026-08-06")?.status).toBe(
      "none",
    );
  });

  it("la semana anterior, aparte; sin anotar no es una falta", () => {
    const prev = dayKeys(NOW, 7, 7)
      .slice(0, 3)
      .map((k) => day(k));
    const a = adherence(diet(), [...days, ...prev], [], NOW);
    expect(a.prev).toMatchObject({ inPlan: 3, recorded: 3, unrecorded: 4 });
  });

  it("hoy: lo marcado de lo que toca hoy", () => {
    const a = adherence(
      diet(),
      [day("2026-08-10", { skip: [MERIENDA] })],
      [],
      NOW,
    );
    expect(a.today).toEqual({ done: a.today.total - 1, total: a.today.total });
  });

  it("lo más difícil: lo que más veces quedó sin marcar, desde la segunda vez", () => {
    const keys = dayKeys(NOW, 10, 1);
    const three = keys.map((k, i) =>
      i < 3
        ? day(k, { skip: [MERIENDA] })
        : i === 3
          ? day(k, { rejected: ["meal:cena"] })
          : day(k),
    );
    expect(adherence(diet(), three, [], NOW).hardest).toEqual({
      checkId: MERIENDA,
      misses: 3,
      of: 10,
    });
    const once = keys.map((k, i) =>
      i === 0 ? day(k, { skip: [MERIENDA] }) : day(k),
    );
    expect(HARDEST_MIN).toBe(2);
    expect(adherence(diet(), once, [], NOW).hardest).toBeNull();
  });

  it("nunca hay un porcentaje en lo que devuelve", () => {
    const a = adherence(diet(), days, [], NOW);
    const nums = JSON.stringify(a).match(/\d+\.\d+/g);
    expect(nums).toBeNull();
  });
});

describe("el radar de lo que se repite", () => {
  const window = dayKeys(NOW, 28, 1);
  const kinds = (ps: RadarPattern[]) => ps.map((p) => p.kind);

  it(`calla con menos de ${RADAR_MIN_DAYS} días anotados, aunque todo coincida`, () => {
    const few = window
      .slice(0, RADAR_MIN_DAYS - 1)
      .map((k) =>
        day(k, { skip: [MERIENDA], foods: ["kiwi"], well: { pain: "tummy" } }),
      );
    const r = radar(diet(), few, [], NOW);
    expect(r).toEqual({
      recorded: RADAR_MIN_DAYS - 1,
      quiet: true,
      patterns: [],
    });
  });

  it("no dice nada bajo el umbral: dos coincidencias no son un patrón", () => {
    const days = window.slice(0, 10).map((k, i) =>
      day(k, {
        skip: i < 2 ? [MERIENDA] : [],
        foods: i < 2 ? ["kiwi"] : [],
        well: i < 2 ? { pain: "tummy" } : {},
      }),
    );
    const r = radar(diet(), days, [], NOW);
    expect(r.quiet).toBe(false);
    expect(r.patterns).toEqual([]);
    expect(RADAR_MIN_HITS).toBe(3);
  });

  it("una comida que se queda sin marcar 7 de 10 días es un patrón; 4 de 10 no", () => {
    const mk = (n: number) =>
      window
        .slice(0, 10)
        .map((k, i) => day(k, { skip: i < n ? [MERIENDA] : [] }));
    const seven = radar(diet(), mk(7), [], NOW).patterns;
    expect(seven).toContainEqual({
      kind: "slot",
      checkId: MERIENDA,
      hits: 7,
      of: 10,
    });
    expect(
      radar(diet(), mk(4), [], NOW).patterns.filter((p) => p.kind === "slot"),
    ).toEqual([]);
  });

  it("los sábados: 3 de 4 con algo distinto", () => {
    const sats = window.filter((k) => keyToDate(k).getDay() === 6);
    expect(sats).toHaveLength(4);
    const days = window.map((k) =>
      sats.slice(0, 3).includes(k)
        ? day(k, { rejected: ["meal:cena"] })
        : day(k),
    );
    const r = radar(diet(), days, [], NOW);
    expect(r.patterns).toContainEqual({
      kind: "weekday",
      weekday: "sat",
      hits: 3,
      of: 4,
    });
  });

  it("el lugar donde lo ofrecido se aceptó 3 de 4 veces", () => {
    const days = window.slice(0, 8).map((k) => day(k));
    const p = [
      offer(window[1], "relatives", "accepted"),
      offer(window[5], "relatives", "accepted"),
      offer(window[9], "relatives", "accepted"),
      offer(window[12], "relatives", "calm-no"),
      offer(window[2], "school", "calm-no"),
    ];
    const r = radar(diet(), days, p, NOW);
    expect(r.patterns).toContainEqual({
      kind: "place",
      place: "relatives",
      hits: 3,
      of: 4,
    });
    expect(kinds(r.patterns)).not.toContain("weekday");
  });

  it("una señal que coincide con un alimento 3 de 4 veces, y nunca sin él", () => {
    const days = window.slice(0, 12).map((k, i) =>
      day(k, {
        foods: i < 4 ? ["kiwi", "arroz"] : ["arroz"],
        well: i < 3 ? { pain: "tummy" } : { pain: "none" },
      }),
    );
    const r = radar(diet(), days, [], NOW);
    expect(r.patterns).toContainEqual({
      kind: "signal",
      signal: "tummy",
      foodId: "kiwi",
      hits: 3,
      of: 4,
    });
    // El arroz se anotó todos los días: coincidir con todo no dice nada.
    expect(
      r.patterns.filter((p) => p.kind === "signal" && p.foodId === "arroz"),
    ).toEqual([]);
  });

  it("si la señal aparece casi todos los días, no se pega a ningún alimento", () => {
    const days = window
      .slice(0, 12)
      .map((k, i) =>
        day(k, { foods: i < 4 ? ["kiwi"] : [], well: { pain: "tummy" } }),
      );
    expect(
      radar(diet(), days, [], NOW).patterns.filter((p) => p.kind === "signal"),
    ).toEqual([]);
  });

  it("hoy no entra: el día aún no termina", () => {
    const days = [
      day("2026-08-10", { skip: [MERIENDA] }),
      ...window.slice(0, 7).map((k) => day(k)),
    ];
    expect(radar(diet(), days, [], NOW).recorded).toBe(7);
  });
});

// --- Los textos ---------------------------------------------------------------------------

function strings(o: unknown, path: string, out: [string, string][] = []) {
  if (typeof o === "string") out.push([path, o]);
  else if (o && typeof o === "object")
    for (const [k, v] of Object.entries(o)) strings(v, `${path}.${k}`, out);
  return out;
}
const ES = strings(learnText.es, "learn");
const EN = strings(learnText.en, "learn");
const ALL = [...ES, ...EN];
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("textos de «Lo que aprende» (es/en)", () => {
  it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
    expect(EN.map(([k]) => k)).toEqual(ES.map(([k]) => k));
    const en = Object.fromEntries(EN);
    for (const [k, v] of ES) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(placeholders(en[k]), k).toEqual(placeholders(v));
    }
  });

  it("frases vetadas en cero: causa, alergia, indicación, culpa, alarma, predicción, porcentaje", () => {
    const BAD = [
      /\bcaus|provoc|\btrigger|desencaden/i,
      /al[eé]rg|intoleran/i,
      /deja de dar|dejar de dar|stop (giving|feeding)|quita(le)?\b|remove it/i,
      /culpa|guilt|fault|no cumpli|failed|incumpl|\bmal(o|a)s?\b|\bbad\b/i,
      /urgent|peligr|danger|alarm|alert|riesgo alto|grave\b|serious/i,
      /predic|pronostic|forecast/i,
      /%|por ciento|percent/i,
      /diagnostica |diagnoses /i,
    ];
    for (const rx of BAD)
      expect(
        ALL.filter(([, v]) => rx.test(v)),
        String(rx),
      ).toEqual([]);
  });

  it("sin calorías, peso, IMC, percentiles ni cifras fuera de los {marcadores}; sin enlaces", () => {
    const NO =
      /\b(calor[ií]as?|calories?|kcal|peso|weight|imc|bmi|percentil\w*|percentile\w*|talla|height)\b/i;
    for (const [k, v] of ALL) {
      expect(NO.test(v), `${k}: ${v}`).toBe(false);
      expect(/\d/.test(v.replace(/\{\w+\}/g, "")), `${k}: ${v}`).toBe(false);
      expect(/https?:|www\./i.test(v), `${k}: ${v}`).toBe(false);
    }
  });

  it("nada suena a indicación médica, tampoco ya rellenado", () => {
    for (const [k, v] of ALL)
      expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
    for (const t of [learnText.es, learnText.en]) {
      const s = fill(t.signal, {
        signal: t.signals.reaction,
        food: "kiwi",
        hits: 3,
        of: 4,
      });
      expect(looksLikeMedicalAdvice(s), s).toBe(false);
    }
  });

  it("todo lo que coincide se comenta con el nutricionista", () => {
    expect(learnText.es.signalNote).toMatch(/nutricionista/);
    expect(learnText.en.signalNote).toMatch(/nutritionist/);
  });

  it("fill deja intacto un marcador sin valor", () => {
    expect(fill("{a} y {b}", { a: 1 })).toBe("1 y {b}");
  });
});
