import type { Role } from "@/lib/family/roster";

import type { Place, PressureEntry } from "./values";
import type { PressureStore } from "./store";

/**
 * Quién ve qué y el patrón (S14 · ADR-020 · G-Plan 1a). Puro: la pantalla y la sincronía usan la
 * MISMA regla. Sin familia, este teléfono es el único y lo ve todo. En una familia, madre y padre
 * ven el registro completo y el patrón; cualquier otro rol ve solo lo que anotó su teléfono.
 */

export type Viewer = { inFamily: boolean; role: Role | null };

export function seesAll(v: Viewer): boolean {
  return !v.inFamily || v.role === "parent";
}

export function visibleEntries(
  store: PressureStore,
  v: Viewer,
): PressureEntry[] {
  const all = seesAll(v)
    ? [...store.own, ...Object.values(store.others).flat()]
    : store.own;
  return [...all].sort((a, b) => b.t - a.t);
}

/** El patrón mira el último mes. */
export const PATTERN_DAYS = 30;
/** Una repetición empieza a ser un patrón desde la segunda vez. */
export const PATTERN_MIN = 2;

export type Pattern = {
  /** Cuántas en el último mes. */
  total: number;
  byPlace: { place: Place; count: number }[];
  byWhat: { what: string; count: number }[];
  /** Lo que más se repite: el mismo alimento en el mismo lugar. Null si nada se repite. */
  top: { what: string; place: Place; count: number } | null;
};

const sortDesc = <T extends { count: number }>(xs: T[]) =>
  xs.sort((a, b) => b.count - a.count);

/**
 * Cuenta por lugar, por alimento y por la pareja alimento-lugar. Jamás por persona: el patrón
 * dice dónde y qué, nunca quién, para que nadie quede señalado.
 */
export function pressurePattern(
  entries: readonly PressureEntry[],
  now: number,
): Pattern {
  const floor = now - PATTERN_DAYS * 24 * 3600 * 1000;
  const recent = entries.filter((e) => e.t >= floor && e.t <= now + 60_000);
  const place = new Map<Place, number>();
  const what = new Map<string, number>();
  const pair = new Map<string, { what: string; place: Place; count: number }>();
  for (const e of recent) {
    place.set(e.place, (place.get(e.place) ?? 0) + 1);
    what.set(e.what, (what.get(e.what) ?? 0) + 1);
    const k = `${e.what}\u0000${e.place}`;
    const p = pair.get(k) ?? { what: e.what, place: e.place, count: 0 };
    p.count++;
    pair.set(k, p);
  }
  const top = sortDesc([...pair.values()])[0];
  return {
    total: recent.length,
    byPlace: sortDesc([...place].map(([p, count]) => ({ place: p, count }))),
    byWhat: sortDesc([...what].map(([w, count]) => ({ what: w, count }))),
    top: top && top.count >= PATTERN_MIN ? top : null,
  };
}
