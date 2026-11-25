import type { InsightDay } from "@/lib/diet/day-log";
import { resolveItemStatus } from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import type { PressureEntry } from "@/lib/pressure/values";
import {
  parseFoodKey,
  type AgeBand,
  type PresentationId,
} from "@/lib/wellbeing/values";

import { seesAll, type Viewer } from "@/lib/pressure/pattern";

import { acceptedByDay, byDay, dayKeys, judgeDay } from "./days";
import type { Joiner } from "./newcomer";
import { factorsOfDay, RISK_FACTORS, type RiskFactor } from "./risk";

/**
 * El gemelo (S15 · ADR-021): lo que la app aprende de lo que esta familia anota, con estadística
 * propia y explicable, en el teléfono y sin ningún modelo. No predice: cuenta. Con menos de 14
 * días anotados no dice nada. Cada cosa que dice trae sus cuentas («3 de 4»), y borrarlo vuelve
 * todo a cero sin tocar el registro.
 */

export const TWIN_MIN_DAYS = 14;
/** Un factor se compara solo si estuvo presente al menos tres días anotados. */
export const TWIN_MIN_WITH = 3;
/** Cuánto más (o menos) se sale del plan con el factor que sin él para mover el nivel. */
export const TWIN_LIFT_UP = 1.5;
export const TWIN_LIFT_DOWN = 0.67;
/** Lo que acepta: al menos tres veces y la mayoría de las veces que se anotó una opinión. */
export const TWIN_ACCEPT_HITS = 3;
export const TWIN_ACCEPT_SHARE = 0.6;
export const TWIN_MAX_ACCEPTS = 4;
export const TWIN_MAX_TRIES = 3;
/** El gemelo mira hasta tres meses atrás (y nunca antes del último «Borrar lo aprendido»). */
export const TWIN_WINDOW = 90;

export type TwinFactor = {
  factor: RiskFactor;
  /** Días anotados con el factor, y de ellos los de algo distinto al plan. */
  withDays: number;
  withOff: number;
  /** Días anotados sin el factor, y de ellos los de algo distinto al plan. */
  withoutDays: number;
  withoutOff: number;
  effect: "up" | "down" | "none";
};

export type TwinAccept = {
  kind: "group" | "texture" | "presentation";
  /** Id del grupo del plan, o la textura, o la presentación. */
  id: string;
  hits: number;
  of: number;
};

export type TwinTry = { groupId: string; foodId: string };

export type Twin = {
  /** Días anotados que ha visto desde que empezó (o desde el último borrado). */
  noted: number;
  needed: number;
  learning: boolean;
  factors: TwinFactor[];
  adjust: Partial<Record<RiskFactor, 1 | -1>>;
  accepts: TwinAccept[];
  tries: TwinTry[];
};

export type TwinInput = {
  diet: DietPlan;
  days: readonly InsightDay[];
  pressure: readonly PressureEntry[];
  /** Clave `YYYY-MM-DD` del último borrado; solo cuentan los días DESPUÉS de ella. */
  since: string | null;
  band: AgeBand | null;
  joiners: readonly Joiner[];
  now: Date;
};

const LEARNING: Twin = {
  noted: 0,
  needed: TWIN_MIN_DAYS,
  learning: true,
  factors: [],
  adjust: {},
  accepts: [],
  tries: [],
};

/** Suavizado de Laplace: con pocos días una tasa no se dispara a 0 ni a 1. */
const smooth = (hits: number, of: number) => (hits + 1) / (of + 2);

function effectOf(f: Omit<TwinFactor, "effect">): TwinFactor["effect"] {
  if (f.withDays < TWIN_MIN_WITH) return "none";
  const lift =
    smooth(f.withOff, f.withDays) / smooth(f.withoutOff, f.withoutDays);
  return lift >= TWIN_LIFT_UP ? "up" : lift <= TWIN_LIFT_DOWN ? "down" : "none";
}

export function twin(i: TwinInput): Twin {
  const keys = dayKeys(i.now, TWIN_WINDOW, 1).filter(
    (k) => i.since === null || k > i.since,
  );
  const inWindow = new Set(keys);
  const map = byDay(i.days);
  const accepted = acceptedByDay(i.pressure);
  const checks = keys
    .map((k) => judgeDay(i.diet, k, map.get(k), accepted.get(k) ?? 0, i.now))
    .filter((c) => c.status !== "none");
  const noted = checks.length;
  if (noted < TWIN_MIN_DAYS) return { ...LEARNING, noted };

  // 1 · Qué factores acompañan a los días con algo distinto al plan.
  const present = new Map(
    checks.map((c) => {
      const d = map.get(c.day);
      const { factors } = factorsOfDay({
        band: i.band,
        wellbeing: d?.wellbeing,
        record: d?.record,
        joiners: i.joiners,
        at: new Date(c.day + "T12:00:00").getTime(),
      });
      return [c.day, new Set(factors)] as const;
    }),
  );
  const factors: TwinFactor[] = RISK_FACTORS.map((factor) => {
    const withDays = checks.filter((c) => present.get(c.day)!.has(factor));
    const without = checks.filter((c) => !present.get(c.day)!.has(factor));
    const base = {
      factor,
      withDays: withDays.length,
      withOff: withDays.filter((c) => c.status === "off").length,
      withoutDays: without.length,
      withoutOff: without.filter((c) => c.status === "off").length,
    };
    return { ...base, effect: effectOf(base) };
  });
  const adjust: Twin["adjust"] = {};
  for (const f of factors)
    if (f.effect !== "none") adjust[f.factor] = f.effect === "up" ? 1 : -1;

  // 2 · Qué acepta mejor: por grupo del plan, por textura y por presentación.
  const groupOf = new Map<string, string>();
  for (const g of i.diet.trafficLight.green.groups)
    for (const item of g.items) groupOf.set(item.id, g.id);
  const tally = new Map<string, { hits: number; of: number }>();
  const bump = (key: string, ok: boolean) => {
    const t = tally.get(key) ?? { hits: 0, of: 0 };
    t.of++;
    if (ok) t.hits++;
    tally.set(key, t);
  };
  const seen = new Set<string>();
  for (const d of i.days) {
    for (const key of Object.keys(d.wellbeing.food)) {
      const f = parseFoodKey(key);
      if (f) seen.add(f.foodId);
    }
    if (!inWindow.has(d.day)) continue;
    for (const [key, v] of Object.entries(d.wellbeing.food)) {
      const f = parseFoodKey(key);
      if (!f || v.verdict === null) continue;
      const ok = v.verdict === "loves" || v.verdict === "accepts";
      const g = groupOf.get(f.foodId);
      if (g) bump(`group|${g}`, ok);
      if (v.texture) bump(`texture|${v.texture}`, ok);
      if (v.presentation)
        bump(`presentation|${v.presentation as PresentationId}`, ok);
    }
  }
  const accepts: TwinAccept[] = [...tally]
    .map(([k, t]) => {
      const [kind, id] = k.split("|");
      return { kind: kind as TwinAccept["kind"], id, ...t };
    })
    .filter(
      (a) => a.hits >= TWIN_ACCEPT_HITS && a.hits / a.of >= TWIN_ACCEPT_SHARE,
    )
    .sort((a, b) => b.hits - a.hits || b.hits / b.of - a.hits / a.of)
    .slice(0, TWIN_MAX_ACCEPTS);

  // 3 · Encadenar: de los grupos que acepta, alimentos DEL PLAN aún sin ofrecer.
  const tries: TwinTry[] = [];
  for (const a of accepts)
    if (a.kind === "group") {
      const group = i.diet.trafficLight.green.groups.find((g) => g.id === a.id);
      for (const item of group?.items ?? []) {
        if (tries.length >= TWIN_MAX_TRIES) break;
        if (seen.has(item.id)) continue;
        if (resolveItemStatus(i.diet, item.id, i.now)?.color !== "green")
          continue;
        tries.push({ groupId: a.id, foodId: item.id });
      }
    }

  return {
    noted,
    needed: TWIN_MIN_DAYS,
    learning: false,
    factors,
    adjust,
    accepts,
    tries,
  };
}

/**
 * G-Plan 2a: lo aprendido lo ve solo madre o padre (o un teléfono sin familia). Quien cuida ese
 * día ve el día de hoy con sus factores base, sin el ajuste ni la evidencia del gemelo.
 */
export function adjustFor(
  viewer: Viewer,
  learned: Pick<Twin, "adjust"> | null,
): Twin["adjust"] {
  return seesAll(viewer) && learned ? learned.adjust : {};
}
