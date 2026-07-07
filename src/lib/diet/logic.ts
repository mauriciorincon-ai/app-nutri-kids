import type {
  DietPlan,
  Equivalence,
  GreenGroup,
  LocalizedText,
  Meal,
  Supplement,
  Weekday,
} from "./schema";

/**
 * Motor puro del semáforo y del día. Sin acceso a Date.now(), sin storage,
 * sin UI: toda fecha entra por parámetro (regla de tests del CLAUDE.md).
 */

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayFromDate(date: Date): Weekday {
  return WEEKDAYS[date.getDay()];
}

/** Clave local YYYY-MM-DD (día del dispositivo, no UTC — el checklist es del día vivido). */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Restricciones con vigencia
// ---------------------------------------------------------------------------

export function isRestrictionActive(diet: DietPlan, date: Date): boolean {
  const key = dateKey(date);
  return (
    key >= diet.restrictions.validFrom && key <= diet.restrictions.validUntil
  );
}

/** Días que faltan para que termine la restricción (0 si termina hoy; null si ya venció). */
export function restrictionDaysRemaining(
  diet: DietPlan,
  date: Date,
): number | null {
  if (!isRestrictionActive(diet, date)) return null;
  const end = new Date(`${diet.restrictions.validUntil}T00:00:00`);
  const today = new Date(`${dateKey(date)}T00:00:00`);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Semáforo — resolver el estado de un ítem consultando SOLO los datos cargados
// ---------------------------------------------------------------------------

export type TrafficColor = "green" | "yellow" | "red";

export type ItemStatus =
  | {
      kind: "restricted";
      color: "red";
      id: string;
      name: LocalizedText;
      restrictionActive: boolean;
      until: string;
      note: LocalizedText;
      equivalences: Equivalence[];
    }
  | {
      kind: "red";
      color: "red";
      id: string;
      name: LocalizedText;
      why?: LocalizedText;
      equivalences: Equivalence[];
    }
  | {
      kind: "yellow";
      color: "yellow";
      id: string;
      name: LocalizedText;
      limit: LocalizedText;
      equivalences: Equivalence[];
    }
  | {
      kind: "green";
      color: "green";
      id: string;
      name: LocalizedText;
      group: GreenGroup;
      equivalences: Equivalence[];
    };

function equivalencesFor(diet: DietPlan, id: string): Equivalence[] {
  return diet.equivalences.filter((e) => e.whenMissing === id);
}

/**
 * Resuelve el estado semáforo de un ítem por id, en una fecha dada.
 * Precedencia: restricción vigente > rojo fijo > amarillo > verde.
 * Una restricción VENCIDA deja de mandar: el ítem cae a su lista fija si existe.
 */
export function resolveItemStatus(
  diet: DietPlan,
  itemId: string,
  date: Date,
): ItemStatus | null {
  const restricted = diet.restrictions.foods.find((f) => f.id === itemId);
  if (restricted && isRestrictionActive(diet, date)) {
    return {
      kind: "restricted",
      color: "red",
      id: restricted.id,
      name: restricted.name,
      restrictionActive: true,
      until: diet.restrictions.validUntil,
      note: diet.restrictions.note,
      equivalences: equivalencesFor(diet, itemId),
    };
  }

  const redItem = diet.trafficLight.red.items.find((i) => i.id === itemId);
  const alsoAvoid = redItem
    ? undefined
    : diet.trafficLight.red.alsoAvoid.find((i) => i.id === itemId);
  if (redItem || alsoAvoid) {
    const base = redItem ?? alsoAvoid!;
    return {
      kind: "red",
      color: "red",
      id: base.id,
      name: base.name,
      why: redItem?.why,
      equivalences: equivalencesFor(diet, itemId),
    };
  }

  const yellow = diet.trafficLight.yellow.items.find((i) => i.id === itemId);
  if (yellow) {
    return {
      kind: "yellow",
      color: "yellow",
      id: yellow.id,
      name: yellow.name,
      limit: yellow.limit,
      equivalences: equivalencesFor(diet, itemId),
    };
  }

  for (const group of diet.trafficLight.green.groups) {
    const item = group.items.find((i) => i.id === itemId);
    if (item) {
      return {
        kind: "green",
        color: "green",
        id: item.id,
        name: item.name,
        group,
        equivalences: equivalencesFor(diet, itemId),
      };
    }
  }

  // Restricción vencida sin lista fija: se muestra como restringida-vencida.
  if (restricted) {
    return {
      kind: "restricted",
      color: "red",
      id: restricted.id,
      name: restricted.name,
      restrictionActive: false,
      until: diet.restrictions.validUntil,
      note: diet.restrictions.note,
      equivalences: equivalencesFor(diet, itemId),
    };
  }

  return null;
}

/** Todos los ids consultables (para /dieta/[id] y búsqueda). */
export function allItemIds(diet: DietPlan): string[] {
  const ids = new Set<string>();
  for (const f of diet.restrictions.foods) ids.add(f.id);
  for (const i of diet.trafficLight.red.items) ids.add(i.id);
  for (const i of diet.trafficLight.red.alsoAvoid) ids.add(i.id);
  for (const i of diet.trafficLight.yellow.items) ids.add(i.id);
  for (const g of diet.trafficLight.green.groups)
    for (const i of g.items) ids.add(i.id);
  return [...ids];
}

/** Búsqueda simple por nombre ("¿la manzana se puede?") en el idioma activo. */
export function searchItems(
  diet: DietPlan,
  query: string,
  locale: "es" | "en",
  date: Date,
): ItemStatus[] {
  const q = query.trim().toLocaleLowerCase(locale);
  if (q.length < 2) return [];
  return allItemIds(diet)
    .map((id) => resolveItemStatus(diet, id, date))
    .filter((s): s is ItemStatus => s !== null)
    .filter((s) => s.name[locale].toLocaleLowerCase(locale).includes(q));
}

// ---------------------------------------------------------------------------
// El día: suplemento de hoy, comidas, agua, checklist
// ---------------------------------------------------------------------------

export function supplementsForDate(diet: DietPlan, date: Date): Supplement[] {
  const day = weekdayFromDate(date);
  return diet.supplements.filter((s) => s.days.includes(day));
}

/** El menú tipo v1 es igual todos los días; la firma con fecha anticipa menús por día. */
export function mealsForDate(diet: DietPlan, date: Date): Meal[] {
  void date; // reservado para menús por día (v2)
  return diet.dailyMenu;
}

export const DEFAULT_WATER_GLASSES = 4;

export function waterGlassesTarget(diet: DietPlan): number {
  return diet.hydration.glassesPerDay ?? DEFAULT_WATER_GLASSES;
}

export type ChecklistItem =
  | { checkId: string; kind: "meal"; meal: Meal }
  | { checkId: string; kind: "supplement"; supplement: Supplement }
  | { checkId: string; kind: "water"; index: number; total: number };

export type DayChecklist = {
  items: (ChecklistItem & { done: boolean })[];
  doneCount: number;
  totalCount: number;
};

/**
 * Checklist del día: comidas + suplementos del día + vasos de agua.
 * `doneIds` viene del day-log (persistencia); esto es puro.
 * Sin porcentajes con carga moral: solo hecho/faltante.
 */
export function buildDayChecklist(
  diet: DietPlan,
  date: Date,
  doneIds: string[],
): DayChecklist {
  const done = new Set(doneIds);
  const water = waterGlassesTarget(diet);
  const items: ChecklistItem[] = [
    ...mealsForDate(diet, date).map((meal) => ({
      checkId: `meal:${meal.id}`,
      kind: "meal" as const,
      meal,
    })),
    ...supplementsForDate(diet, date).map((supplement) => ({
      checkId: `supplement:${supplement.id}`,
      kind: "supplement" as const,
      supplement,
    })),
    ...Array.from({ length: water }, (_, i) => ({
      checkId: `water:${i + 1}`,
      kind: "water" as const,
      index: i + 1,
      total: water,
    })),
  ];
  const withDone = items.map((item) => ({
    ...item,
    done: done.has(item.checkId),
  }));
  return {
    items: withDone,
    doneCount: withDone.filter((i) => i.done).length,
    totalCount: withDone.length,
  };
}
