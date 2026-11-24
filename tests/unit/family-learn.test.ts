import { afterEach, beforeEach, describe, expect, it } from "vitest";

import demo from "../../data/demo-diet.json";
import { familyText } from "@/i18n/family";
import { pressureText } from "@/i18n/pressure";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import { dietPlanSchema } from "@/lib/diet/schema";
import {
  LESSON_IDS,
  LESSON_MAX_WORDS,
  LESSON_SOURCE_IDS,
  LESSON_SOURCES,
  LESSONS,
  lessonText,
} from "@/lib/family-learn/lessons";
import { familyYesNo } from "@/lib/family-learn/yes-no";
import { ROLES, type Role } from "@/lib/family/roster";
import { offerables, offeredName } from "@/lib/pressure/offer";
import {
  PATTERN_MIN,
  pressurePattern,
  seesAll,
  visibleEntries,
} from "@/lib/pressure/pattern";
import {
  addPressure,
  clearPressure,
  dropPressureOthers,
  mergePressureOthers,
  PRESSURE_ITEM,
  readPressure,
  removePressure,
} from "@/lib/pressure/store";
import { STRATEGIES } from "@/lib/pressure/strategies";
import {
  ANSWERS,
  coerceEntries,
  newEntryId,
  OUTSIDE_PLAN,
  PLACES,
  PRESSURE_KEEP_DAYS,
  PRESSURE_MAX,
  pressureEntrySchema,
  prune,
  type PressureEntry,
} from "@/lib/pressure/values";

const diet = dietPlanSchema.parse(demo);
/** Lunes 2026-08-03 07:30, dentro de la restricción inventada de la demo. */
const NOW = new Date(2026, 7, 3, 7, 30);
const DAY_MS = 24 * 3600 * 1000;

type Pair = [string, string];
function strings(o: unknown, path = ""): Pair[] {
  if (typeof o === "string") return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => strings(v, `${path}.${i}`));
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, path ? `${path}.${k}` : k),
  );
}

/** Todo el texto nuevo de S14, por idioma: lecciones, estrategias y pantallas. */
function allText(locale: "es" | "en"): Pair[] {
  const lessons = LESSONS.flatMap((l) =>
    strings(
      {
        title: l.title[locale],
        gist: l.gist[locale],
        points: l.points.map((p) => p[locale]),
        say: l.say.map((s) => s[locale]),
      },
      `lesson.${l.id}`,
    ),
  );
  const strat = PLACES.flatMap((p) =>
    strings(
      {
        title: STRATEGIES[p].title[locale],
        steps: STRATEGIES[p].steps.map((s) => s[locale]),
        say: STRATEGIES[p].sayAdult[locale],
      },
      `strategy.${p}`,
    ),
  );
  const dict = locale === "es" ? es : en;
  const today = strings(
    {
      familyLabel: dict.today.familyLabel,
      familyLearn: dict.today.familyLearn,
      familyPressure: dict.today.familyPressure,
      noteIt: dict.scenarios.noteIt,
    },
    "dict",
  );
  return [...lessons, ...strat, ...strings(familyText[locale], "ui"),
    ...strings(pressureText[locale], "uiPressure"), ...today];
}

const ALL = [...allText("es"), ...allText("en")];
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("textos de «Para la familia» (S14 · es/en)", () => {
  it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
    const a = allText("es");
    const b = allText("en");
    expect(b.map(([k]) => k)).toEqual(a.map(([k]) => k));
    const bm = Object.fromEntries(b);
    for (const [k, v] of a) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(bm[k].trim().length, k).toBeGreaterThan(0);
      expect(placeholders(bm[k]), k).toEqual(placeholders(v));
    }
  });

  it("frases vetadas en cero: culpa, «portarse bien», comida como premio, negociar bocados, alarma", () => {
    const BAD = [
      /culpa|guilt/i,
      /\bmal(o|a)s?\b|\bbad\b|naughty|travies/i,
      /p[oó]rtate bien|portarse bien|se port[óo] bien|be good|behave/i,
      /si te (lo )?comes|if you eat|cuando termines|when you finish|limpi[ao] el plato|clean (your|the) plate/i,
      /solo un poquito|just a little|un bocado más|one more bite|dos bocados|two bites|tres bocados/i,
      /te lo (ganaste|mereces)|you (earned|deserve)/i,
      /urgent|peligr|danger|alarm|grave\b|serious|emergenc/i,
      /castig\w* con|olvidaste|you forgot|deber[íi]as|you should have/i,
    ];
    for (const rx of BAD)
      expect(
        ALL.filter(([, v]) => rx.test(v)),
        String(rx),
      ).toEqual([]);
  });

  it("la comida nunca es premio: lo que se nombra como premio no es comida", () => {
    const prize = /premi|reward|prize|celebr/i;
    const food =
      /dulce|postre|helado|chocolate|galleta|treat|sweet|dessert|candy|ice cream|cookie/i;
    for (const [k, v] of ALL)
      if (prize.test(v) && food.test(v))
        // Solo se permite cuando la frase NIEGA que la comida sea premio.
        expect(
          /\bno\b|not|isn't|jamás|never|se vuelve|becomes/i.test(v),
          `${k}: ${v}`,
        ).toBe(true);
  });

  it("sin calorías, peso, IMC, percentiles ni cifras; sin enlaces", () => {
    const NO =
      /\b(calor[ií]as?|calories?|kcal|peso|weight|imc|bmi|percentil\w*|percentile\w*|talla|height)\b/i;
    for (const [k, v] of ALL) {
      expect(NO.test(v), `${k}: ${v}`).toBe(false);
      expect(/\d/.test(v.replace(/\{\w+\}/g, "")), `${k}: ${v}`).toBe(false);
      expect(/https?:|www\./i.test(v), `${k}: ${v}`).toBe(false);
    }
  });

  it("nada suena a indicación médica", () => {
    for (const [k, v] of ALL)
      expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
  });
});

describe("las lecciones", () => {
  it("son las cinco, en orden, cada una con su fuente del catálogo", () => {
    expect(LESSONS.map((l) => l.id)).toEqual([...LESSON_IDS]);
    for (const l of LESSONS) {
      expect(l.sources.length, l.id).toBeGreaterThan(0);
      for (const s of l.sources) expect(LESSON_SOURCE_IDS).toContain(s);
      expect(l.points.length, l.id).toBeGreaterThan(0);
      expect(l.say.length, l.id).toBeGreaterThan(0);
    }
    // Todas las fuentes del catálogo se usan y se citan en los dos idiomas.
    const used = new Set(LESSONS.flatMap((l) => l.sources));
    expect([...used].sort()).toEqual([...LESSON_SOURCE_IDS].sort());
    for (const id of LESSON_SOURCE_IDS) {
      expect(LESSON_SOURCES[id].cite.es.length).toBeGreaterThan(10);
      expect(LESSON_SOURCES[id].cite.en.length).toBeGreaterThan(10);
    }
  });

  it("cada una se lee en menos de dos minutos (tope de palabras en los dos idiomas)", () => {
    for (const l of LESSONS)
      for (const loc of ["es", "en"] as const) {
        const words = lessonText(l, loc).split(/\s+/).filter(Boolean).length;
        expect(words, `${l.id}.${loc}`).toBeLessThanOrEqual(LESSON_MAX_WORDS);
        expect(words, `${l.id}.${loc}`).toBeGreaterThan(40);
      }
  });

  it("en inglés no se asume el género del niño", () => {
    for (const [k, v] of allText("en"))
      expect(/\b(he|him|his|she|her)\b/i.test(v), `${k}: ${v}`).toBe(false);
  });
});

describe("«Qué sí y qué no» desde el plan inventado", () => {
  const sheet = familyYesNo(diet, NOW);
  const texts = [
    ...sheet.no.map((n) => n.name),
    ...sheet.ask,
    ...sheet.yes.flatMap((g) => [g.group, ...g.items]),
  ];

  it("sale entera: lo que no (con la restricción vigente), lo con condición y lo que sí", () => {
    const red = diet.trafficLight.red.items.map((i) => i.name.es);
    for (const r of red) expect(sheet.no.map((n) => n.name.es)).toContain(r);
    for (const f of diet.restrictions.foods)
      expect(sheet.no.find((n) => n.name.es === f.name.es)?.kind).toBe(
        "restricted",
      );
    expect(sheet.ask.map((a) => a.es)).toEqual(
      diet.trafficLight.yellow.items
        .map((i) => i.name.es)
        .filter((n) => !sheet.no.some((x) => x.name.es === n)),
    );
    expect(sheet.yes.length).toBeGreaterThan(0);
    expect(sheet.additives.map((a) => a.code)).toEqual(
      diet.trafficLight.red.additives.map((a) => a.code),
    );
  });

  it("no inventa nada: cada nombre está en el plan", () => {
    const planNames = new Set(
      strings(diet)
        .map(([, v]) => v)
        .filter(Boolean),
    );
    for (const t of texts) {
      expect(planNames.has(t.es), t.es).toBe(true);
      expect(planNames.has(t.en), t.en).toBe(true);
    }
  });

  it("no lleva cifras (la medida de lo con condición la da quien cuida)", () => {
    for (const t of texts) {
      expect(/\d/.test(t.es), t.es).toBe(false);
      expect(/\d/.test(t.en), t.en).toBe(false);
    }
  });

  it("fuera de las fechas de la restricción, lo restringido deja de salir como restringido", () => {
    const later = familyYesNo(diet, new Date(2026, 10, 24, 9));
    expect(later.no.some((n) => n.kind === "restricted")).toBe(false);
  });

  it("lo que quien cuida anotó como alergia se suma y sale de lo que sí", () => {
    const green = diet.trafficLight.green.groups[0].items[0].name.es;
    const s = familyYesNo(diet, NOW, [
      { id: "n1", kind: "allergy", text: green } as never,
    ]);
    expect(s.no.find((n) => n.name.es === green)?.kind).toBe("noted");
    expect(s.yes.flatMap((g) => g.items.map((i) => i.es))).not.toContain(green);
  });
});

describe("cuando le ofrecen algo: estrategias y lo que se puede anotar", () => {
  it("cada lugar tiene su estrategia con pasos y una frase para el adulto", () => {
    for (const p of PLACES) {
      expect(STRATEGIES[p].steps.length, p).toBeGreaterThanOrEqual(2);
      expect(STRATEGIES[p].sayAdult.es.length).toBeGreaterThan(0);
    }
    expect(Object.keys(STRATEGIES).sort()).toEqual([...PLACES].sort());
  });

  it("cada lugar y cada respuesta tienen su palabra en los dos idiomas", () => {
    for (const t of [pressureText.es, pressureText.en]) {
      for (const p of PLACES) expect(t.places[p]).toBeTruthy();
      for (const a of ANSWERS) expect(t.answers[a]).toBeTruthy();
    }
  });

  it("lo que se puede anotar sale del plan, por id, sin repetir", () => {
    const o = offerables(diet);
    const ids = o.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of diet.trafficLight.red.items) expect(ids).toContain(i.id);
    for (const i of diet.trafficLight.yellow.items) expect(ids).toContain(i.id);
    expect(ids).not.toContain(OUTSIDE_PLAN);
    expect(offeredName(diet, OUTSIDE_PLAN)).toBeNull();
    expect(offeredName(diet, "no-existe")).toBeNull();
    expect(offeredName(diet, ids[0])).toEqual(o[0].name);
  });
});

const entry = (over: Partial<PressureEntry> = {}): PressureEntry => ({
  id: newEntryId(),
  t: NOW.getTime(),
  date: "2026-08-03",
  by: "PHONEA000001",
  who: "other",
  what: "banano",
  place: "relatives",
  answer: "calm-no",
  ...over,
});

describe("la anotación: sin texto libre y con tope", () => {
  it("rechaza campos de más, lugares o respuestas que no existen y ids raros", () => {
    expect(pressureEntrySchema.safeParse(entry()).success).toBe(true);
    for (const bad of [
      { ...entry(), note: "SENTINEL-NAME" },
      entry({ place: "home" as never }),
      entry({ answer: "yelled" as never }),
      entry({ who: "Abuela Rosa" }),
      entry({ id: "X" }),
      entry({ date: "3/8/2026" }),
      entry({ what: "" }),
    ])
      expect(pressureEntrySchema.safeParse(bad).success).toBe(false);
  });

  it("poda: sin repetidos, nada más viejo que el tope de días y como mucho el tope de anotaciones", () => {
    const now = NOW.getTime();
    const old = entry({ t: now - (PRESSURE_KEEP_DAYS + 1) * DAY_MS });
    const e = entry();
    expect(prune([e, e, old], now)).toEqual([e]);
    const many = Array.from({ length: PRESSURE_MAX + 5 }, (_, i) =>
      entry({ t: now - i * 1000 }),
    );
    const kept = prune(many, now);
    expect(kept).toHaveLength(PRESSURE_MAX);
    expect(kept.at(-1)!.t).toBe(now);
    expect(coerceEntries("nada", now)).toEqual([]);
    expect(coerceEntries([e, { x: 1 }], now)).toEqual([e]);
  });

  it("los ids son nuevos cada vez", () => {
    const ids = new Set(Array.from({ length: 50 }, newEntryId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(/^[0-9a-z]{10}$/.test(id)).toBe(true);
  });
});

describe("quién ve qué (G-Plan 1a)", () => {
  const store = {
    own: [entry({ id: "ownentry01" })],
    others: { PHONEB000002: [entry({ id: "otherent01", by: "PHONEB000002" })] },
  };

  it("sin familia, este teléfono lo ve todo", () => {
    expect(seesAll({ inFamily: false, role: null })).toBe(true);
  });

  it.each(ROLES)("en una familia, %s", (role: Role) => {
    const v = { inFamily: true, role };
    const ids = visibleEntries(store, v).map((e) => e.id);
    if (role === "parent") {
      expect(seesAll(v)).toBe(true);
      expect(ids.sort()).toEqual(["otherent01", "ownentry01"]);
    } else {
      expect(seesAll(v)).toBe(false);
      expect(ids).toEqual(["ownentry01"]);
    }
  });

  it("sin rol todavía, solo lo propio", () => {
    expect(
      visibleEntries(store, { inFamily: true, role: null }).map((e) => e.id),
    ).toEqual(["ownentry01"]);
  });
});

describe("lo que se repite (último mes, por lugar y alimento, nunca por persona)", () => {
  const now = NOW.getTime();

  it("cuenta el mismo alimento en el mismo lugar desde la segunda vez", () => {
    const list = [
      entry({ who: "PHONEB000002" }),
      entry({ who: "other", t: now - DAY_MS }),
      entry({ what: "otro", place: "school", t: now - 2 * DAY_MS }),
      entry({ t: now - 40 * DAY_MS }),
    ];
    const p = pressurePattern(list, now);
    expect(p.total).toBe(3);
    expect(p.top).toEqual({ what: "banano", place: "relatives", count: 2 });
    expect(p.byPlace[0]).toEqual({ place: "relatives", count: 2 });
    expect(JSON.stringify(p)).not.toContain("PHONEB000002");
  });

  it(`con menos de ${PATTERN_MIN} iguales no hay patrón`, () => {
    const p = pressurePattern(
      [entry(), entry({ what: "otro" }), entry({ place: "school" })],
      now,
    );
    expect(p.top).toBeNull();
    expect(p.total).toBe(3);
  });
});

describe("el registro en este teléfono", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  const now = NOW.getTime();

  it("suma, quita lo propio, guarda lo de otros comprobado y lo olvida al salir", () => {
    const e = entry({ id: "ownentry02" });
    addPressure(e, now);
    expect(readPressure(now).own).toEqual([e]);
    const o = entry({ id: "otherent02", by: "PHONEB000002" });
    expect(mergePressureOthers("PHONEB000002", [o], now)).toBe(true);
    expect(mergePressureOthers("PHONEB000002", [o], now)).toBe(false);
    // Una anotación que dice ser de otro teléfono no entra en la lista de este.
    mergePressureOthers("PHONEC000003", [o], now);
    expect(readPressure(now).others.PHONEC000003).toBeUndefined();
    expect(dropPressureOthers(now)).toBe(true);
    expect(readPressure(now).others).toEqual({});
    expect(dropPressureOthers(now)).toBe(false);
    removePressure("ownentry02", now);
    expect(localStorage.getItem(PRESSURE_ITEM)).toBeNull();
  });

  it("lectura defensiva y «Borrar datos»", () => {
    localStorage.setItem(PRESSURE_ITEM, "{no es json");
    expect(readPressure(now)).toEqual({ own: [], others: {} });
    localStorage.setItem(
      PRESSURE_ITEM,
      JSON.stringify({
        own: [entry({ id: "ownentry03" }), { x: 1 }],
        others: { Z: [entry()] },
      }),
    );
    const r = readPressure(now);
    expect(r.own.map((e) => e.id)).toEqual(["ownentry03"]);
    expect(r.others).toEqual({});
    clearPressure();
    expect(localStorage.getItem(PRESSURE_ITEM)).toBeNull();
  });
});
