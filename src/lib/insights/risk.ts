import type { DayRecord, DayWellbeing } from "@/lib/diet/day-log";
import { readHabit } from "@/lib/wellbeing/habits";
import type { AgeBand } from "@/lib/wellbeing/values";

import { someoneNewToday, type Joiner } from "./newcomer";

/**
 * El día de hoy y qué preparar (S15 · ADR-021 · G-Plan 2a). Cuenta lo que se sabe del día —un
 * evento social, estar fuera de casa, alguien nuevo, la noche corta— y dice cuánto conviene
 * preparar, con el porqué en palabras. Es una pista para organizarse, no una predicción: jamás
 * dice qué va a pasar, ni culpa a nadie, ni cambia el plan.
 */

export const RISK_FACTORS = ["sleep", "social", "away", "new"] as const;
export type RiskFactor = (typeof RISK_FACTORS)[number];

/** Tres niveles de preparación. Sin rojo: lo que sube es cuánto conviene tener a mano. */
export type RiskLevel = "low" | "mid" | "high";

/** Qué se puede preparar; cada uno es un enlace del propio plan, jamás un consejo nuevo. */
export const PREPARE = [
  "birthday",
  "when-asked",
  "plan-out",
  "lunchbox",
  "family-yes-no",
  "plan-late",
  "accepted",
] as const;
export type Prepare = (typeof PREPARE)[number];

/** Adónde lleva cada cosa que preparar (rutas de la propia app). */
export const PREPARE_HREF: Record<Prepare, string> = {
  birthday: "/escenarios?e=birthday",
  "when-asked": "/familia",
  "plan-out": "/#plan-b",
  lunchbox: "/lonchera",
  "family-yes-no": "/familia",
  "plan-late": "/#plan-b",
  accepted: "/bienestar",
};

const PREPARE_BY_FACTOR: Record<RiskFactor, Prepare[]> = {
  social: ["birthday", "when-asked"],
  away: ["plan-out", "lunchbox"],
  new: ["family-yes-no"],
  sleep: ["plan-late", "accepted"],
};

/** Qué se supo del sueño de anoche: corto, dentro, o por qué no se pudo mirar. */
export type SleepRead = "short" | "ok" | "no-band" | "no-sleep";

export type DayFacts = {
  band: AgeBand | null;
  wellbeing: Pick<DayWellbeing, "habits" | "ctx"> | undefined;
  record: DayRecord | undefined;
  joiners: readonly Joiner[];
  /** Un instante del día (ms): decide quién cuenta como «nuevo» ese día. */
  at: number;
};

export function sleepOf(f: DayFacts): SleepRead {
  const minutes = f.wellbeing?.habits.sleep;
  if (f.band === null) return "no-band";
  if (typeof minutes !== "number") return "no-sleep";
  return readHabit("sleep", f.band, minutes).status === "below"
    ? "short"
    : "ok";
}

/** Los factores que están presentes en un día. */
export function factorsOfDay(f: DayFacts): {
  factors: RiskFactor[];
  sleep: SleepRead;
} {
  const sleep = sleepOf(f);
  const ctx = f.wellbeing?.ctx ?? {};
  const factors: RiskFactor[] = [];
  if (sleep === "short") factors.push("sleep");
  if (ctx.social) factors.push("social");
  if (ctx.away) factors.push("away");
  if (
    ctx.new ||
    (f.record !== undefined && someoneNewToday(f.joiners, f.record, f.at))
  )
    factors.push("new");
  return { factors, sleep };
}

export type Risk = {
  level: RiskLevel;
  /** Los factores del día, en orden fijo. */
  factors: RiskFactor[];
  sleep: SleepRead;
  /** Qué preparar, sin repetir. */
  prepare: Prepare[];
  /** Lo que el gemelo movió: solo en teléfonos que ven lo aprendido (madre o padre). */
  adjusted: Partial<Record<RiskFactor, 1 | -1>>;
};

/** 0 puntos = bajo · 1 = medio · 2 o más = alto. */
export function levelOf(points: number): RiskLevel {
  return points <= 0 ? "low" : points === 1 ? "mid" : "high";
}

/**
 * El nivel del día. `adjust` es lo que aprendió el gemelo por factor (+1 o −1): solo mueve
 * factores que están hoy presentes, y nunca baja de «bajo».
 */
export function dayRisk(
  f: DayFacts,
  adjust: Partial<Record<RiskFactor, 1 | -1>> = {},
): Risk {
  const { factors, sleep } = factorsOfDay(f);
  const moved = Object.fromEntries(
    factors.filter((x) => adjust[x] !== undefined).map((x) => [x, adjust[x]]),
  ) as Risk["adjusted"];
  const points = Math.max(
    0,
    factors.length + factors.reduce((sum, x) => sum + (moved[x] ?? 0), 0),
  );
  const prepare: Prepare[] = [];
  for (const x of RISK_FACTORS)
    if (factors.includes(x))
      for (const p of PREPARE_BY_FACTOR[x])
        if (!prepare.includes(p)) prepare.push(p);
  return { level: levelOf(points), factors, sleep, prepare, adjusted: moved };
}
