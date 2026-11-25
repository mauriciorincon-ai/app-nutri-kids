import type { InsightDay } from "@/lib/diet/day-log";
import { weekdayFromDate } from "@/lib/diet/logic";
import type { DietPlan, Weekday } from "@/lib/diet/schema";
import type { Place, PressureEntry } from "@/lib/pressure/values";
import { parseFoodKey } from "@/lib/wellbeing/values";

import { acceptedByDay, byDay, dayKeys, judgeDay, keyToDate } from "./days";

/**
 * El radar de lo que se repite (S15 · ADR-021). Cuenta coincidencias en lo anotado y las dice con
 * su conteo («coincidió 3 de 4 veces»); jamás dice por qué pasa, jamás nombra una alergia y jamás
 * cambia el plan. Calla con pocos días: menos de siete anotados no son un patrón, son una semana.
 */

export const RADAR_DAYS = 28;
export const RADAR_MIN_DAYS = 7;
export const RADAR_MIN_HITS = 3;
export const RADAR_MIN_SHARE = 0.6;
export const RADAR_MAX = 6;

/** Lo que se anotó de cómo está, reducido a señales (nunca a un diagnóstico). */
export const SIGNALS = [
  "tummy",
  "head",
  "pain",
  "nausea",
  "reaction",
  "stool",
] as const;
export type Signal = (typeof SIGNALS)[number];

export type RadarPattern =
  | { kind: "slot"; checkId: string; hits: number; of: number }
  | { kind: "weekday"; weekday: Weekday; hits: number; of: number }
  | { kind: "place"; place: Place; hits: number; of: number }
  | {
      kind: "signal";
      signal: Signal;
      foodId: string;
      hits: number;
      of: number;
    };

export type Radar = {
  /** Días anotados en la ventana. */
  recorded: number;
  /** Con menos de RADAR_MIN_DAYS anotados el radar no dice nada. */
  quiet: boolean;
  patterns: RadarPattern[];
};

/** Las señales de un día: lo de «cómo está» y la nota «le dolió». */
export function signalsOf(day: InsightDay): Set<Signal> {
  const w = day.wellbeing.well;
  const out = new Set<Signal>();
  if (w.pain === "tummy") out.add("tummy");
  else if (w.pain === "head") out.add("head");
  else if (w.pain === "other") out.add("pain");
  if (w.nausea === "little" || w.nausea === "a-lot") out.add("nausea");
  if (w.reaction && w.reaction !== "none") out.add("reaction");
  if (w.stool === "different") out.add("stool");
  for (const n of Object.values(day.record.notes))
    if (n.chips.includes("pain") && !out.has("tummy") && !out.has("head"))
      out.add("pain");
  return out;
}

/** Los alimentos anotados un día (vistos, tocados o probados). */
export function foodsOf(day: InsightDay): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(day.wellbeing.food)) {
    const f = parseFoodKey(key);
    if (f) out.add(f.foodId);
  }
  return out;
}

const passes = (hits: number, of: number) =>
  hits >= RADAR_MIN_HITS && of > 0 && hits / of >= RADAR_MIN_SHARE;

/**
 * Hoy no entra: el día aún no termina. La ventana son los 28 días anteriores.
 */
export function radar(
  diet: DietPlan,
  days: readonly InsightDay[],
  pressure: readonly PressureEntry[],
  now: Date,
): Radar {
  const keys = dayKeys(now, RADAR_DAYS, 1);
  const inWindow = new Set(keys);
  const map = byDay(days);
  const accepted = acceptedByDay(pressure);
  const checks = keys
    .map((k) => judgeDay(diet, k, map.get(k), accepted.get(k) ?? 0, now))
    .filter((c) => c.status !== "none");
  const recorded = checks.length;
  if (recorded < RADAR_MIN_DAYS) return { recorded, quiet: true, patterns: [] };

  const out: RadarPattern[] = [];

  // 1 · La comida o el suplemento que más se queda sin marcar.
  const slotOf = new Map<string, number>();
  const slotHit = new Map<string, number>();
  for (const c of checks)
    for (const id of c.expected) {
      slotOf.set(id, (slotOf.get(id) ?? 0) + 1);
      if (c.missed.includes(id) || c.rejected.includes(id))
        slotHit.set(id, (slotHit.get(id) ?? 0) + 1);
    }
  for (const [checkId, hits] of slotHit)
    if (passes(hits, slotOf.get(checkId) ?? 0))
      out.push({ kind: "slot", checkId, hits, of: slotOf.get(checkId)! });

  // 2 · El día de la semana en que más se sale del plan.
  const wdOf = new Map<Weekday, number>();
  const wdHit = new Map<Weekday, number>();
  for (const c of checks) {
    const wd = weekdayFromDate(keyToDate(c.day));
    wdOf.set(wd, (wdOf.get(wd) ?? 0) + 1);
    if (c.status === "off") wdHit.set(wd, (wdHit.get(wd) ?? 0) + 1);
  }
  for (const [weekday, hits] of wdHit)
    if (passes(hits, wdOf.get(weekday) ?? 0))
      out.push({ kind: "weekday", weekday, hits, of: wdOf.get(weekday)! });

  // 3 · El lugar donde, cuando le ofrecen algo, más se acepta.
  const plOf = new Map<Place, number>();
  const plHit = new Map<Place, number>();
  for (const e of pressure) {
    if (!inWindow.has(e.date)) continue;
    plOf.set(e.place, (plOf.get(e.place) ?? 0) + 1);
    if (e.answer === "accepted")
      plHit.set(e.place, (plHit.get(e.place) ?? 0) + 1);
  }
  for (const [place, hits] of plHit)
    if (passes(hits, plOf.get(place) ?? 0))
      out.push({ kind: "place", place, hits, of: plOf.get(place)! });

  // 4 · Una señal anotada que coincide con un alimento anotado el mismo día. Solo cuenta si con
  //     ese alimento la señal aparece MÁS que en el resto de los días: si aparece casi siempre,
  //     coincidir con todo no dice nada.
  const anyDays = keys
    .map((k) => map.get(k))
    .filter((d): d is InsightDay => d !== undefined);
  const sig = new Map(anyDays.map((d) => [d.day, signalsOf(d)]));
  const foods = new Map(anyDays.map((d) => [d.day, foodsOf(d)]));
  const foodIds = new Set([...foods.values()].flatMap((s) => [...s]));
  for (const foodId of foodIds) {
    const withFood = anyDays.filter((d) => foods.get(d.day)!.has(foodId));
    const without = anyDays.filter((d) => !foods.get(d.day)!.has(foodId));
    for (const signal of SIGNALS) {
      const hits = withFood.filter((d) => sig.get(d.day)!.has(signal)).length;
      if (!passes(hits, withFood.length)) continue;
      // Un alimento que casi todos los días está anotado no distingue nada: sin días «sin él» que
      // comparar, cualquier señal frecuente se le pegaría (ADR-021 §3).
      if (without.length < RADAR_MIN_HITS) continue;
      const base = without.length
        ? without.filter((d) => sig.get(d.day)!.has(signal)).length /
          without.length
        : 0;
      if (hits / withFood.length <= base) continue;
      out.push({ kind: "signal", signal, foodId, hits, of: withFood.length });
    }
  }

  out.sort((a, b) => b.hits - a.hits || b.hits / b.of - a.hits / a.of);
  return { recorded, quiet: false, patterns: out.slice(0, RADAR_MAX) };
}
