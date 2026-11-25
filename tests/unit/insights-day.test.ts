import { beforeEach, describe, expect, it } from "vitest";

import {
  clearDayLog,
  getWellbeing,
  listRecordedEntries,
  listWellbeingDays,
  mergeRemoteDay,
  readDayRegs,
  setCtx,
  type InsightDay,
} from "@/lib/diet/day-log";
import { buildDayChecklist } from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import { clearAllData, getDemoDiet } from "@/lib/diet/storage";
import { dayKeys, keyToDate } from "@/lib/insights/days";
import { NEWCOMER_DAYS, someoneNewToday } from "@/lib/insights/newcomer";
import { dayRisk, levelOf, PREPARE, type DayFacts } from "@/lib/insights/risk";
import {
  adjustFor,
  twin,
  TWIN_MIN_DAYS,
  type TwinInput,
} from "@/lib/insights/twin";
import {
  clearTwin,
  eraseTwin,
  readTwinSince,
  TWIN_KEY,
} from "@/lib/insights/twin-store";
import { joinedAt, ROLES, type Op, type Role } from "@/lib/family/roster";
import { seesAll } from "@/lib/pressure/pattern";
import { foodKey } from "@/lib/wellbeing/values";

/**
 * El día de hoy, «alguien nuevo» y el gemelo (S15 · ADR-021): días INVENTADOS sobre la dieta demo,
 * reloj fijo (un lunes a las 20:00) y nada leído del almacenamiento salvo el borrado del gemelo.
 */
const NOW = new Date("2026-08-10T20:00:00");
const DAY_MS = 24 * 3600 * 1000;
const diet = (): DietPlan => structuredClone(getDemoDiet());

function planIds(key: string): string[] {
  return buildDayChecklist(diet(), keyToDate(key), [])
    .items.filter((i) => i.kind !== "water")
    .map((i) => i.checkId);
}

type Food = {
  id: string;
  verdict: "loves" | "accepts" | "refuses" | null;
  texture?: "soft" | "crunchy";
};
type DayOpts = {
  /** Se salta la merienda: ese día cuenta como «algo distinto al plan». */
  off?: boolean;
  ctx?: Partial<Record<"social" | "away" | "new", true>>;
  sleep?: number;
  foods?: Food[];
};

function day(key: string, o: DayOpts = {}): InsightDay {
  const marks: InsightDay["record"]["marks"] = {};
  for (const id of planIds(key))
    if (!(o.off && id === "meal:merienda")) marks[id] = { at: "12:00" };
  const food: InsightDay["wellbeing"]["food"] = {};
  for (const f of o.foods ?? [])
    food[foodKey("almuerzo", f.id)] = {
      stage: "tasted",
      verdict: f.verdict,
      texture: f.texture ?? null,
      presentation: null,
      isNew: false,
    };
  return {
    day: key,
    record: { marks, notes: {} },
    wellbeing: {
      moods: {},
      food,
      well: {},
      habits: o.sleep === undefined ? {} : { sleep: o.sleep },
      lunch: {},
      ctx: o.ctx ?? {},
    },
  };
}

const facts = (o: Partial<DayFacts> = {}): DayFacts => ({
  band: "6-12",
  wellbeing: { habits: { sleep: 600 }, ctx: {} },
  record: { marks: {}, notes: {} },
  joiners: [],
  at: NOW.getTime(),
  ...o,
});

// --- «Alguien nuevo» -----------------------------------------------------------------------

describe("alguien nuevo, calculado de la familia", () => {
  const today = {
    marks: { "meal:almuerzo": { at: "13:00", by: "NEW-PHONE" } },
    notes: {},
  };
  const at = NOW.getTime();
  const members = [
    { id: "NEW-PHONE", joined: at - 3 * DAY_MS },
    { id: "OLD-PHONE", joined: at - 30 * DAY_MS },
    { id: "FOUNDER", joined: null },
  ];

  it("cuenta a quien entró hace poco y hoy marcó algo", () => {
    expect(someoneNewToday(members, today, at)).toBe(true);
  });
  it("no cuenta a quien lleva más de 14 días, a los fundadores, ni a quien no marcó hoy", () => {
    const by = (id: string) => ({
      marks: { "meal:almuerzo": { at: "13:00", by: id } },
      notes: {},
    });
    expect(someoneNewToday(members, by("OLD-PHONE"), at)).toBe(false);
    expect(someoneNewToday(members, by("FOUNDER"), at)).toBe(false);
    expect(someoneNewToday(members, { marks: {}, notes: {} }, at)).toBe(false);
    expect(someoneNewToday([], today, at)).toBe(false);
  });
  it("el límite es de 14 días, y una entrada «del futuro» no cuenta", () => {
    const edge = (age: number) =>
      someoneNewToday(
        [{ id: "NEW-PHONE", joined: at - age * DAY_MS }],
        today,
        at,
      );
    expect(edge(NEWCOMER_DAYS)).toBe(true);
    expect(edge(NEWCOMER_DAYS + 1)).toBe(false);
    expect(
      someoneNewToday([{ id: "NEW-PHONE", joined: at + DAY_MS }], today, at),
    ).toBe(false);
  });
  it("una nota de un teléfono nuevo también cuenta", () => {
    const rec = {
      marks: {},
      notes: { "meal:cena": { chips: [], text: "", by: "NEW-PHONE" } },
    };
    expect(someoneNewToday(members, rec as never, at)).toBe(true);
  });

  it("joinedAt: la hora del primer set; los fundadores y los desconocidos, null", () => {
    const op = (t: number, body: unknown) => ({ t, body }) as unknown as Op;
    const m = (id: string) => ({ id, name: id, role: "caregiver", pub: "x" });
    const ops = [
      op(100, { type: "genesis", members: [m("FOUNDER")] }),
      op(1000, { type: "set", member: m("NEW") }),
      op(2000, { type: "set", member: { ...m("NEW"), role: "school" } }),
    ];
    expect(joinedAt(ops, "NEW")).toBe(1000);
    expect(joinedAt(ops, "FOUNDER")).toBeNull();
    expect(joinedAt(ops, "NADIE")).toBeNull();
  });
});

// --- El día de hoy -------------------------------------------------------------------------

describe("el día de hoy y qué preparar", () => {
  it("sin nada especial: mochila ligera y nada que preparar", () => {
    const r = dayRisk(facts());
    expect(r.level).toBe("low");
    expect(r.factors).toEqual([]);
    expect(r.prepare).toEqual([]);
    expect(r.sleep).toBe("ok");
  });

  it("sube y baja con cada factor: 0 → ligera, 1 → con algo más, 2 o más → llena", () => {
    expect(levelOf(0)).toBe("low");
    expect(levelOf(1)).toBe("mid");
    expect(levelOf(2)).toBe("high");
    expect(levelOf(4)).toBe("high");
    const on = (ctx: Record<string, true>, sleep = 600) =>
      dayRisk(facts({ wellbeing: { habits: { sleep }, ctx } })).level;
    expect(on({ social: true })).toBe("mid");
    expect(on({ away: true })).toBe("mid");
    expect(on({ new: true })).toBe("mid");
    expect(on({}, 300)).toBe("mid");
    expect(on({ social: true, away: true })).toBe("high");
    expect(on({ social: true }, 300)).toBe("high");
    expect(on({ social: true, away: true, new: true }, 300)).toBe("high");
  });

  it("explica por qué (los factores) y qué preparar para cada uno, sin repetir", () => {
    const r = dayRisk(
      facts({
        wellbeing: {
          habits: { sleep: 300 },
          ctx: { social: true, away: true },
        },
      }),
    );
    expect(r.factors).toEqual(["sleep", "social", "away"]);
    expect(r.prepare).toEqual([
      "plan-late",
      "accepted",
      "birthday",
      "when-asked",
      "plan-out",
      "lunchbox",
    ]);
    expect(new Set(r.prepare).size).toBe(r.prepare.length);
    for (const p of r.prepare) expect(PREPARE).toContain(p);
  });

  it("alguien nuevo: a mano, o calculado de la familia", () => {
    expect(
      dayRisk(facts({ wellbeing: { habits: {}, ctx: { new: true } } })).factors,
    ).toEqual(["new"]);
    const r = dayRisk(
      facts({
        record: {
          marks: { "meal:cena": { at: "19:00", by: "NEW-PHONE" } },
          notes: {},
        },
        joiners: [{ id: "NEW-PHONE", joined: NOW.getTime() - 2 * DAY_MS }],
      }),
    );
    expect(r.factors).toEqual(["new"]);
    expect(r.prepare).toEqual(["family-yes-no"]);
  });

  it("sin sueño o sin edad, ese factor no suma y se dice por qué", () => {
    const none = dayRisk(facts({ wellbeing: { habits: {}, ctx: {} } }));
    expect(none.sleep).toBe("no-sleep");
    expect(none.level).toBe("low");
    const noBand = dayRisk(
      facts({ band: null, wellbeing: { habits: { sleep: 100 }, ctx: {} } }),
    );
    expect(noBand.sleep).toBe("no-band");
    expect(noBand.factors).toEqual([]);
  });

  it("el sueño se mide contra la franja de su edad, no contra una cifra fija", () => {
    const at = (band: "3-4" | "13-17") =>
      dayRisk(facts({ band, wellbeing: { habits: { sleep: 540 }, ctx: {} } }))
        .sleep;
    expect(at("3-4")).toBe("short");
    expect(at("13-17")).toBe("ok");
  });

  it("el ajuste del gemelo mueve solo factores presentes y nunca baja de «ligera»", () => {
    const social = facts({
      wellbeing: { habits: { sleep: 600 }, ctx: { social: true } },
    });
    expect(dayRisk(social).level).toBe("mid");
    expect(dayRisk(social, { social: 1 }).level).toBe("high");
    expect(dayRisk(social, { social: -1 }).level).toBe("low");
    expect(dayRisk(social, { away: 1 }).level).toBe("mid");
    expect(dayRisk(social, { away: 1 }).adjusted).toEqual({});
    expect(dayRisk(facts(), { social: -1, away: -1 }).level).toBe("low");
    expect(dayRisk(social, { social: -1 }).adjusted).toEqual({ social: -1 });
  });
});

// --- El gemelo -----------------------------------------------------------------------------

describe("el gemelo", () => {
  const keys = (n: number) => dayKeys(NOW, n, 1);
  const input = (
    days: InsightDay[],
    o: Partial<TwinInput> = {},
  ): TwinInput => ({
    diet: diet(),
    days,
    pressure: [],
    since: null,
    band: "6-12",
    joiners: [],
    now: NOW,
    ...o,
  });

  /** 20 días anotados: 5 con evento social (4 con algo distinto) y 15 sin él (2 con algo distinto). */
  const withSocial = () =>
    keys(20).map((k, i) =>
      day(k, {
        ctx: i < 5 ? { social: true } : {},
        off: i < 4 || i === 6 || i === 7,
      }),
    );

  it("con menos de 14 días anotados dice «aún aprendiendo» y no ajusta nada", () => {
    const t = twin(
      input(
        keys(TWIN_MIN_DAYS - 1).map((k) =>
          day(k, { ctx: { social: true }, off: true }),
        ),
      ),
    );
    expect(t.learning).toBe(true);
    expect(t.noted).toBe(TWIN_MIN_DAYS - 1);
    expect(t.needed).toBe(TWIN_MIN_DAYS);
    expect(t.adjust).toEqual({});
    expect(t.accepts).toEqual([]);
    expect(t.tries).toEqual([]);
    expect(twin(input([])).noted).toBe(0);
  });

  it("con 14 días o más aprende: el evento social pesa más y cambia el nivel de hoy", () => {
    const t = twin(input(withSocial()));
    expect(t.learning).toBe(false);
    expect(t.noted).toBe(20);
    const social = t.factors.find((f) => f.factor === "social")!;
    expect(social).toMatchObject({
      withDays: 5,
      withOff: 4,
      withoutDays: 15,
      withoutOff: 2,
      effect: "up",
    });
    expect(t.adjust).toEqual({ social: 1 });
    const today = facts({
      wellbeing: { habits: { sleep: 600 }, ctx: { social: true } },
    });
    expect(dayRisk(today).level).toBe("mid");
    expect(dayRisk(today, t.adjust).level).toBe("high");
  });

  it("un factor que casi nunca coincide con algo distinto pesa menos, y uno visto pocas veces no cuenta", () => {
    const ds = keys(20).map((k, i) =>
      day(k, {
        ctx: i < 4 ? { away: true } : i === 4 || i === 5 ? { new: true } : {},
        off: i >= 4 && i % 2 === 0,
      }),
    );
    const t = twin(input(ds));
    expect(t.factors.find((f) => f.factor === "away")!.effect).toBe("down");
    expect(t.adjust.away).toBe(-1);
    // «alguien nuevo» estuvo solo 2 días: menos de 3, no se compara.
    expect(t.factors.find((f) => f.factor === "new")!.effect).toBe("none");
    expect(t.adjust.new).toBeUndefined();
  });

  it("lo que acepta mejor mira como mucho los últimos 90 días", () => {
    const pear = [
      { id: "pera", verdict: "accepts" as const, texture: "soft" as const },
    ];
    // 120 días anotados; lo aceptado está solo en los más viejos (más de 90 días atrás).
    const ds = keys(120).map((k, i) => day(k, { foods: i >= 95 ? pear : [] }));
    const t = twin(input(ds));
    expect(t.learning).toBe(false);
    expect(t.accepts).toEqual([]);
    // El mismo historial dentro de la ventana sí cuenta.
    const recent = keys(120).map((k, i) =>
      day(k, { foods: i < 20 ? pear : [] }),
    );
    expect(twin(input(recent)).accepts.length).toBeGreaterThan(0);
  });

  it("acepta mejor por grupo del plan y por textura, con su evidencia, y encadena con lo que el plan tiene sin ofrecer", () => {
    const fruit = (
      id: string,
      verdict: Food["verdict"],
      texture: Food["texture"],
    ) => ({ id, verdict, texture });
    const ds = keys(16).map((k, i) =>
      day(k, {
        foods:
          i < 4
            ? [fruit("pera", "accepts", "soft"), fruit("kiwi", "loves", "soft")]
            : i === 4
              ? [fruit("pera", "refuses", "crunchy")]
              : [],
      }),
    );
    const t = twin(input(ds));
    expect(t.accepts).toContainEqual({
      kind: "group",
      id: "frutas",
      hits: 8,
      of: 9,
    });
    expect(t.accepts).toContainEqual({
      kind: "texture",
      id: "soft",
      hits: 8,
      of: 8,
    });
    expect(t.accepts.every((a) => a.hits >= 3 && a.hits / a.of >= 0.6)).toBe(
      true,
    );
    // Sugiere lo del plan, del mismo grupo y aún sin ofrecer; jamás lo que ya vio.
    expect(t.tries.length).toBeGreaterThan(0);
    for (const x of t.tries) {
      expect(x.groupId).toBe("frutas");
      expect(["pera", "kiwi"]).not.toContain(x.foodId);
      const group = diet().trafficLight.green.groups.find(
        (g) => g.id === "frutas",
      )!;
      expect(group.items.map((i) => i.id)).toContain(x.foodId);
    }
  });

  it("lo que se rechaza o se vio pocas veces no se dice como «lo que acepta mejor»", () => {
    const ds = keys(16).map((k, i) =>
      day(k, {
        foods: [{ id: "arroz", verdict: i < 2 ? "accepts" : "refuses" }],
      }),
    );
    expect(twin(input(ds)).accepts.filter((a) => a.kind === "group")).toEqual(
      [],
    );
  });

  it("borrar lo aprendido vuelve a cero sin tocar el registro, y hoy no cuenta", () => {
    const ds = withSocial();
    expect(twin(input(ds)).learning).toBe(false);
    const erased = twin(input(ds, { since: "2026-08-10" }));
    expect(erased.learning).toBe(true);
    expect(erased.noted).toBe(0);
    expect(erased.adjust).toEqual({});
    // Un borrado de hace 10 días solo deja ver lo posterior.
    const k = keys(20);
    const partial = twin(input(ds, { since: k[9] }));
    expect(partial.noted).toBe(9);
    expect(ds).toHaveLength(20);
    // Hoy no es un día terminado: no cuenta aunque esté anotado.
    expect(twin(input([...ds, day("2026-08-10", { off: true })])).noted).toBe(
      20,
    );
  });

  it("quién ve lo aprendido: solo madre o padre (o sin familia); los demás, el día con sus factores base", () => {
    const t = twin(input(withSocial()));
    expect(adjustFor({ inFamily: false, role: null }, t)).toEqual({
      social: 1,
    });
    for (const role of ROLES as readonly Role[]) {
      const viewer = { inFamily: true, role };
      expect(seesAll(viewer), role).toBe(role === "parent");
      expect(adjustFor(viewer, t), role).toEqual(
        role === "parent" ? { social: 1 } : {},
      );
    }
    expect(adjustFor({ inFamily: true, role: null }, t)).toEqual({});
    expect(adjustFor({ inFamily: true, role: "parent" }, null)).toEqual({});
  });
});

describe("lo aprendido vive solo en este teléfono y se va con «Borrar datos»", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("guarda solo desde cuándo cuenta, y se lee igual", () => {
    expect(readTwinSince()).toBeNull();
    eraseTwin("2026-08-10");
    expect(readTwinSince()).toBe("2026-08-10");
    expect(JSON.parse(window.localStorage.getItem(TWIN_KEY)!)).toEqual({
      since: "2026-08-10",
    });
  });

  it("un valor roto no se acepta", () => {
    window.localStorage.setItem(TWIN_KEY, JSON.stringify({ since: "ayer" }));
    expect(readTwinSince()).toBeNull();
    window.localStorage.setItem(TWIN_KEY, "no es json");
    expect(readTwinSince()).toBeNull();
  });

  it("«Borrar datos» (clearAllData) y clearTwin lo quitan", () => {
    eraseTwin("2026-08-10");
    clearTwin();
    expect(window.localStorage.getItem(TWIN_KEY)).toBeNull();
    eraseTwin("2026-08-10");
    clearAllData();
    expect(window.localStorage.getItem(TWIN_KEY)).toBeNull();
  });
});

describe("el contexto del día en el registro local", () => {
  const DAY = new Date("2026-08-10T12:00:00");
  beforeEach(() => {
    window.localStorage.clear();
    clearDayLog();
  });

  it("se anota, se lee de vuelta y se quita con una lápida", () => {
    setCtx(DAY, "social", true);
    setCtx(DAY, "away", true);
    expect(getWellbeing(DAY).ctx).toEqual({ social: true, away: true });
    setCtx(DAY, "social", false);
    expect(getWellbeing(DAY).ctx).toEqual({ away: true });
    // Lo que no es un aviso del día no se guarda.
    setCtx(DAY, "cumpleanos", true);
    expect(Object.keys(readDayRegs()["2026-08-10"].ctx ?? {}).sort()).toEqual([
      "away",
      "social",
    ]);
  });

  it("un día con solo contexto no entra al historial", () => {
    setCtx(DAY, "away", true);
    expect(listWellbeingDays()).toEqual([]);
    expect(listRecordedEntries()).toEqual([]);
  });

  it("lo que llega de otro teléfono se mezcla por sello, y un valor que no es «sí» se descarta", () => {
    const remote = {
      marks: {},
      notes: {},
      ctx: { social: { t: 5, by: "OTHER", v: true } },
    };
    expect(mergeRemoteDay("2026-08-10", remote as never)).toBe(true);
    expect(getWellbeing(DAY).ctx).toEqual({ social: true });
    // La lápida más nueva de otro teléfono lo quita.
    const gone = {
      marks: {},
      notes: {},
      ctx: { social: { t: 9, by: "OTHER", v: null } },
    };
    expect(mergeRemoteDay("2026-08-10", gone as never)).toBe(true);
    expect(getWellbeing(DAY).ctx).toEqual({});
    // Un valor inventado en el almacenamiento no se lee.
    window.localStorage.setItem(
      "nutrikids.daylog.v3",
      JSON.stringify({
        "2026-08-11": {
          marks: {},
          notes: {},
          ctx: {
            social: { t: 1, by: "X", v: "yes" },
            away: { t: 1, by: "X", v: true },
          },
        },
      }),
    );
    expect(getWellbeing(new Date("2026-08-11T12:00:00")).ctx).toEqual({
      away: true,
    });
  });
});
