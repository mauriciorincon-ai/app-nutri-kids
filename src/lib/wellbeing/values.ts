import type { Reg, RegMap } from "@/lib/family/merge";

/**
 * Lo que se anota del bienestar (S10 · ADR-015): solo ids cerrados y minutos. Este módulo es
 * mínimo A PROPÓSITO: lo importan el registro del día y la familia (que viajan en todas las
 * pantallas); los textos, las referencias y las cuentas viven en sus propios módulos y solo
 * los cargan las pantallas que los muestran.
 *
 * Nada de esto es una escala clínica ni un puntaje: son palabras de casa que quien cuida elige.
 * Aquí jamás se interpretan, suman ni comparan entre sí; lo que se repite lo cuenta `lib/insights` (S15), en conteos y sin causas.
 */

/** Cómo llega a la comida (semáforo emocional). Un toque, junto a la marca de esa comida. */
export const MOODS = [
  "happy",
  "tired",
  "anxious",
  "not-hungry",
  "other",
] as const;
export type MoodId = (typeof MOODS)[number];

/** Qué hizo con el alimento: mirarlo, tocarlo o probarlo. Las tres cuentan como exposición. */
export const STAGES = ["looked", "touched", "tasted"] as const;
export type StageId = (typeof STAGES)[number];
/** Cómo le cayó. `null` = todavía sin decir (solo se anotó que lo vio). */
export const VERDICTS = ["loves", "accepts", "refuses"] as const;
export type VerdictId = (typeof VERDICTS)[number];
/** Con qué presentación funcionó. */
export const PRESENTATIONS = [
  "apart",
  "mixed",
  "bites",
  "with-favorite",
] as const;
export type PresentationId = (typeof PRESENTATIONS)[number];
/** Las texturas son las del plan (`schema.ts`); aquí solo su forma de texto. */
export const FOOD_TEXTURES = [
  "liquid",
  "puree",
  "mashed",
  "soft",
  "chopped",
  "crunchy",
] as const;

export type FoodValue = {
  stage: StageId;
  verdict: VerdictId | null;
  texture: (typeof FOOD_TEXTURES)[number] | null;
  presentation: PresentationId | null;
  /** Alimento nuevo para el niño (el contador de exposiciones se muestra solo en esos). */
  isNew: boolean;
};

/**
 * Cómo está hoy: ocho cosas, cada una con pocas opciones en palabras simples. «Reacción»
 * distinta de «ninguna» ofrece el plan de emergencia de la familia, jamás una indicación.
 */
export const SYMPTOMS = {
  energy: ["high", "usual", "low"],
  sleep: ["well", "so-so", "badly"],
  mood: ["cheerful", "calm", "irritable", "down"],
  stool: ["usual", "different", "none"],
  pain: ["none", "tummy", "head", "other"],
  nausea: ["none", "little", "a-lot"],
  reaction: ["none", "skin", "breathing", "swelling", "other"],
  appetite: ["hungry", "usual", "not-hungry", "fills-fast"],
} as const;
export type SymptomId = keyof typeof SYMPTOMS;
export const SYMPTOM_IDS = Object.keys(SYMPTOMS) as SymptomId[];
/** La nota corta del día va en la misma tabla, bajo esta clave. */
export const WELL_NOTE_KEY = "note";
export const WELL_NOTE_MAX = 140;

/** Hábitos: minutos (el sueño, de anoche). El agua no está aquí: son las marcas de agua. */
export const HABITS = ["sleep", "screen", "activity", "sun"] as const;
export type HabitId = (typeof HABITS)[number];
export const HABIT_MAX_MIN = 24 * 60;

/**
 * La lonchera del día (S11 · ADR-017): qué se puso en ella y qué pasó con cada cosa. Sin
 * medidas ni calificaciones: «volvió» solo dice que regresó en la caja, jamás que algo salió mal.
 */
export const LUNCH_STATES = ["packed", "eaten", "back"] as const;
export type LunchState = (typeof LUNCH_STATES)[number];
/** Largo máximo de la clave de un alimento de la lonchera (lo valida también la familia). */
export const LUNCH_KEY_MAX = 100;

/**
 * El contexto del día (S15 · ADR-021): lo que un adulto sabe de hoy y la app no puede ver. Tres
 * avisos de sí o no, sin texto libre: hay un evento social, hoy está fuera de casa, hay alguien
 * nuevo cuidándolo. «Alguien nuevo» también se calcula de la familia; este es el aviso a mano.
 */
export const CTX_KEYS = ["social", "away", "new"] as const;
export type CtxId = (typeof CTX_KEYS)[number];

export type WellbeingMaps = {
  moods: RegMap<MoodId>;
  food: RegMap<FoodValue>;
  well: RegMap<string>;
  habits: RegMap<number>;
  lunch: RegMap<LunchState>;
  /** Contexto del día: cada clave vale `true` o no está (la lápida la quita). */
  ctx: RegMap<true>;
};
export const WELLBEING_MAPS = [
  "moods",
  "food",
  "well",
  "habits",
  "lunch",
  "ctx",
] as const;
export type WellbeingMap = (typeof WELLBEING_MAPS)[number];

/** Topes por día: un día lleno no pasa de 64 KB cifrados (prueba en family-roles). */
export const MAP_CAPS: Record<WellbeingMap, number> = {
  moods: 16,
  food: 60,
  well: SYMPTOM_IDS.length + 2,
  habits: HABITS.length,
  lunch: 14,
  ctx: CTX_KEYS.length,
};

/** Franja de edad que un padre elige en el perfil (decisión 1a del G-Plan). Jamás una fecha. */
export const AGE_BANDS = ["1", "2", "3-4", "5", "6-12", "13-17"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type AgeReg = Reg<AgeBand>;

// --- Claves de cada mapa --------------------------------------------------------------------

/** La clave de un alimento en una comida; cada parte codificada, para que ningún id la rompa. */
export const foodKey = (mealId: string, foodId: string) =>
  `${encodeURIComponent(mealId)}|${encodeURIComponent(foodId)}`;

/** Largo máximo de una clave de alimento: es el mismo que valida la familia (records.ts). */
export const FOOD_KEY_MAX = 160;

export function parseFoodKey(
  key: string,
): { mealId: string; foodId: string } | null {
  const parts = key.split("|");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    return {
      mealId: decodeURIComponent(parts[0]),
      foodId: decodeURIComponent(parts[1]),
    };
  } catch {
    return null;
  }
}

// --- Validación (lo que se lee del aparato) --------------------------------------------------

const has = (list: readonly string[], v: unknown): boolean =>
  typeof v === "string" && list.includes(v);

const obj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

export const isMood = (v: unknown): v is MoodId => has(MOODS, v);
export const isAgeBand = (v: unknown): v is AgeBand => has(AGE_BANDS, v);

export function coerceFood(raw: unknown): FoodValue | null {
  if (!obj(raw) || !has(STAGES, raw.stage)) return null;
  return {
    stage: raw.stage as StageId,
    verdict: has(VERDICTS, raw.verdict) ? (raw.verdict as VerdictId) : null,
    texture: has(FOOD_TEXTURES, raw.texture)
      ? (raw.texture as FoodValue["texture"])
      : null,
    presentation: has(PRESENTATIONS, raw.presentation)
      ? (raw.presentation as PresentationId)
      : null,
    isNew: raw.isNew === true,
  };
}

/** Una opción de síntoma o la nota; null si no es válida. */
export function coerceWell(key: string, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (key === WELL_NOTE_KEY) {
    const text = raw.trim().slice(0, WELL_NOTE_MAX);
    return text || null;
  }
  if (!Object.hasOwn(SYMPTOMS, key)) return null;
  const options = (SYMPTOMS as Record<string, readonly string[]>)[key];
  return options.includes(raw) ? raw : null;
}

export function coerceHabit(key: string, raw: unknown): number | null {
  if (!has(HABITS, key)) return null;
  return typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= 0 &&
    raw <= HABIT_MAX_MIN
    ? raw
    : null;
}

export const isLunchState = (v: unknown): v is LunchState =>
  has(LUNCH_STATES, v);
/** La clave de un alimento de la lonchera: su id del plan, o `opt:<nombre>` si es una opción de equivalencia. */
export const lunchKeyOk = (k: unknown): k is string =>
  typeof k === "string" && k.length > 0 && k.length <= LUNCH_KEY_MAX;

export const isCtx = (k: unknown): k is CtxId => has(CTX_KEYS, k);
/** El contexto solo dice «sí»: lo demás no se guarda (quitarlo es una lápida). */
export const coerceCtx = (key: string, raw: unknown): true | null =>
  isCtx(key) && raw === true ? true : null;

export const isHabit = (k: string): k is HabitId => has(HABITS, k);
export const isSymptom = (k: string): k is SymptomId =>
  Object.hasOwn(SYMPTOMS, k);
