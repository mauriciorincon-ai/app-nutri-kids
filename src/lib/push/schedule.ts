import { checkIdFor, waterGlassesTarget } from "@/lib/diet/logic";
import type { DietPlan, Weekday } from "@/lib/diet/schema";

/**
 * Las horas de los avisos, desde el plan (S8 · ADR-012). Puro: sin reloj ni almacenamiento.
 *
 *  - Comidas y meriendas: a la hora de inicio (`start`) de cada una, todos los días.
 *  - Suplementos: el plan dice QUÉ días, no a qué hora; avisan a la hora de la primera
 *    comida de su día (default técnico del S8).
 *  - Agua: los vasos del plan, repartidos parejo entre el inicio de la primera comida y el
 *    fin de la última, en la rejilla de 5 minutos del disparador.
 *
 * Dos salidas: los avisos con su texto (se quedan en el teléfono, para el trabajador) y
 * las horas para el servidor, SIN etiqueta: minuto del día + días de la semana.
 */

export type PushKind = "supplement" | "meal" | "water";
export type PushTypes = {
  supplements: boolean;
  meals: boolean;
  water: boolean;
  family: boolean;
};
export const DEFAULT_TYPES: PushTypes = {
  supplements: true,
  meals: true,
  water: true,
  family: true,
};

/** Días con el número de `Date.getDay()`: 0 = domingo. */
const DAY_INDEX: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export type WakeItem = {
  /** El checkId del día: si está marcado, el aviso ya no toca. */
  id: string;
  kind: PushKind;
  /** Minuto del día (0–1439), hora local del teléfono. */
  minute: number;
  days: number[];
  title: string;
  body: string;
};

/** Lo único que ve el servidor: un minuto y una máscara de días (bit 0 = domingo). */
export type ServerWake = { m: number; d: number };

export type ScheduleText = {
  supplementTitle: string;
  waterTitle: string;
  waterBody: (n: number, total: number) => string;
};

export const MAX_BODY_CHARS = 120;
const GRID = 5;

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_BODY_CHARS
    ? `${flat.slice(0, MAX_BODY_CHARS - 1).trimEnd()}…`
    : flat;
}

/** Todos los avisos posibles del plan, en el idioma dado. */
export function planItems(
  diet: DietPlan,
  locale: "es" | "en",
  text: ScheduleText,
): WakeItem[] {
  const meals = diet.dailyMenu;
  if (meals.length === 0) return [];
  const first = Math.min(...meals.map((m) => minutesOf(m.start)));
  const last = Math.max(...meals.map((m) => minutesOf(m.end)));
  const items: WakeItem[] = [];

  for (const meal of meals) {
    items.push({
      id: checkIdFor("meal", meal.id),
      kind: "meal",
      minute: minutesOf(meal.start),
      days: EVERY_DAY,
      title: meal.name[locale],
      body: clip(meal.content[locale]),
    });
  }
  for (const s of diet.supplements) {
    items.push({
      id: checkIdFor("supplement", s.id),
      kind: "supplement",
      minute: first,
      days: [...new Set(s.days.map((d) => DAY_INDEX[d]))].sort(),
      title: text.supplementTitle,
      body: clip(`${s.name[locale]} · ${s.dose[locale]}`),
    });
  }
  const glasses = waterGlassesTarget(diet);
  const span = Math.max(0, last - first);
  for (let i = 0; i < glasses; i++) {
    const raw = first + ((i + 1) * span) / (glasses + 1);
    const minute = Math.min(1435, Math.round(raw / GRID) * GRID);
    items.push({
      id: checkIdFor("water", i + 1),
      kind: "water",
      minute,
      days: EVERY_DAY,
      title: text.waterTitle,
      body: text.waterBody(i + 1, glasses),
    });
  }
  return items;
}

const KIND_TYPE: Record<PushKind, keyof PushTypes> = {
  supplement: "supplements",
  meal: "meals",
  water: "water",
};

export function forTypes(items: WakeItem[], types: PushTypes): WakeItem[] {
  return items.filter((i) => types[KIND_TYPE[i.kind]]);
}

export function dayMask(days: number[]): number {
  return days.reduce((mask, d) => mask | (1 << d), 0);
}

/** Las horas para el servidor: una por minuto, con los días unidos. Sin texto ni tipo. */
export function serverWakes(items: WakeItem[]): ServerWake[] {
  const byMinute = new Map<number, number>();
  for (const i of items) {
    byMinute.set(i.minute, (byMinute.get(i.minute) ?? 0) | dayMask(i.days));
  }
  return [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, d]) => ({ m, d }));
}

/**
 * ¿Está todo lo de ese minuto ya marcado hoy? Entonces el teléfono le pide al servidor
 * saltar ese despertar: así no llega un aviso de algo ya hecho.
 */
export function wakeDone(
  items: WakeItem[],
  minute: number,
  day: number,
  doneIds: Iterable<string>,
): boolean {
  const done = new Set(doneIds);
  const due = items.filter((i) => i.minute === minute && i.days.includes(day));
  return due.length > 0 && due.every((i) => done.has(i.id));
}
