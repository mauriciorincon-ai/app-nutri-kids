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

/** Hora local "HH:MM" del dispositivo (la hora real a la que se marca una comida). */
export function clockLabel(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
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

// ---------------------------------------------------------------------------
// Codec del checkId — "<kind>:<id>". Contrato del motor: se construye y parsea
// SOLO aquí (la UI no decodifica ids a mano). El id puede contener ":".
// ---------------------------------------------------------------------------

export type CheckKind = "meal" | "supplement" | "water";

/** Construye un checkId ("meal:desayuno", "water:1"). */
export function checkIdFor(kind: CheckKind, id: string | number): string {
  return `${kind}:${id}`;
}

/** Parte un checkId por el PRIMER ":" (un id de comida puede contener ":"). */
export function parseCheckId(checkId: string): { kind: string; id: string } {
  const i = checkId.indexOf(":");
  if (i < 0) return { kind: checkId, id: "" };
  return { kind: checkId.slice(0, i), id: checkId.slice(i + 1) };
}

export type CheckTarget =
  | { kind: "meal"; meal: Meal }
  | { kind: "supplement"; supplement: Supplement }
  | { kind: "water"; index: number };

/**
 * Resuelve un checkId contra la dieta ACTIVA. `null` si el id no existe en ella
 * (p.ej. el historial guarda ids de una dieta anterior a la cargada) — la UI
 * decide el rótulo de reemplazo; jamás muestra el id crudo.
 */
export function resolveCheckTarget(
  diet: DietPlan,
  checkId: string,
): CheckTarget | null {
  const { kind, id } = parseCheckId(checkId);
  if (kind === "meal") {
    const meal = diet.dailyMenu.find((m) => m.id === id);
    return meal ? { kind: "meal", meal } : null;
  }
  if (kind === "supplement") {
    const supplement = diet.supplements.find((s) => s.id === id);
    return supplement ? { kind: "supplement", supplement } : null;
  }
  if (kind === "water") {
    const index = Number(id);
    return Number.isInteger(index) && index > 0
      ? { kind: "water", index }
      : null;
  }
  return null;
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
      checkId: checkIdFor("meal", meal.id),
      kind: "meal" as const,
      meal,
    })),
    ...supplementsForDate(diet, date).map((supplement) => ({
      checkId: checkIdFor("supplement", supplement.id),
      kind: "supplement" as const,
      supplement,
    })),
    ...Array.from({ length: water }, (_, i) => ({
      checkId: checkIdFor("water", i + 1),
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

// ---------------------------------------------------------------------------
// Recordatorio determinista — "qué toca AHORA y qué sigue"
// ---------------------------------------------------------------------------

/** Minutos desde medianoche de una hora "HH:MM". */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos desde medianoche de un instante local (la hora real del dispositivo). */
function minutesNow(at: Date): number {
  return at.getHours() * 60 + at.getMinutes();
}

/**
 * La franja de comida respecto a un instante. 100% determinista desde los
 * horarios `start`/`end` del menú (sin `Date.now()`): la hora entra por parámetro.
 * Cubre los cuatro casos, incluidos los HUECOS entre franjas.
 */
export type MealSlot =
  | { kind: "before-first"; next: Meal }
  | { kind: "during"; meal: Meal; next: Meal | null }
  | { kind: "between"; prev: Meal; next: Meal }
  | { kind: "after-last"; prev: Meal };

export function currentMealSlot(diet: DietPlan, at: Date): MealSlot | null {
  const meals = [...diet.dailyMenu].sort(
    (a, b) => minutesOf(a.start) - minutesOf(b.start),
  );
  if (meals.length === 0) return null;
  const now = minutesNow(at);

  const during = meals.find(
    (m) => now >= minutesOf(m.start) && now <= minutesOf(m.end),
  );
  if (during) {
    // "Sigue" = la próxima comida EN EL ORDEN por `start`, no la primera que
    // empieza tras el `end` de la actual — así una comida contigua o solapada
    // (start === end previa) no se salta.
    const next = meals[meals.indexOf(during) + 1] ?? null;
    return { kind: "during", meal: during, next };
  }

  const first = meals[0];
  if (now < minutesOf(first.start))
    return { kind: "before-first", next: first };

  const last = meals[meals.length - 1];
  if (now > minutesOf(last.end)) return { kind: "after-last", prev: last };

  // Hueco entre dos franjas: prev = última terminada, next = próxima por empezar.
  // Con datos bien formados ambas existen (los guards previos lo garantizan);
  // ante datos corruptos degradamos a null en vez de asertar (typing honesto).
  const prev = [...meals].reverse().find((m) => minutesOf(m.end) < now);
  const next = meals.find((m) => minutesOf(m.start) > now);
  if (!prev || !next) return null;
  return { kind: "between", prev, next };
}

/**
 * Estado de los suplementos del día como UNIÓN DISCRIMINADA — el motor CLASIFICA
 * el estado del dominio; la UI solo elige la cadena por rama (un `switch`
 * exhaustivo). Antes la UI lo infería de dos conteos y el orden de los ternarios
 * mintió (BUG-S3-1: afirmó "ya está" un día sin suplemento). Ahora es imposible.
 */
export type SupplementStatus =
  | { kind: "none-today" } // hoy NO toca ninguno (≠ "ya los tomó todos")
  | { kind: "pending"; pending: Supplement[] } // tocan hoy y faltan
  | { kind: "all-done" }; // tocaban hoy y ya están todos

export type Reminder = {
  slot: MealSlot | null;
  supplements: SupplementStatus;
  water: { target: number; done: number };
};

/**
 * El recordatorio del momento: franja vigente/siguiente + estado de los
 * suplementos del día + hidratación. Puro y con hora inyectada. La UI redacta el
 * copy (sin culpa); el motor resuelve QUÉ mostrar y en qué estado.
 */
export function buildReminder(
  diet: DietPlan,
  at: Date,
  doneIds: string[],
): Reminder {
  const done = new Set(doneIds);
  const todays = supplementsForDate(diet, at);
  const pending = todays.filter(
    (s) => !done.has(checkIdFor("supplement", s.id)),
  );
  const supplements: SupplementStatus =
    todays.length === 0
      ? { kind: "none-today" }
      : pending.length > 0
        ? { kind: "pending", pending }
        : { kind: "all-done" };

  const target = waterGlassesTarget(diet);
  const waterDone = Array.from({ length: target }, (_, i) =>
    checkIdFor("water", i + 1),
  ).filter((id) => done.has(id)).length;

  return {
    slot: currentMealSlot(diet, at),
    supplements,
    water: { target, done: waterDone },
  };
}
