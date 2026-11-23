/**
 * Lo que S11 guarda SOLO en este teléfono (ADR-017): el nombre que un padre escribe para la
 * etiqueta de la lonchera, la despensa de «¿qué cocino con lo que tengo?», lo marcado en la lista
 * del viaje y las recetas propias. Nada de esto viaja ni se sincroniza (la familia comparte la
 * lonchera del día por el mapa `lunch`, no esto); «Borrar datos» lo limpia con `clearDayToDay`.
 * Sin red, sin logs de contenido: cada lectura es defensiva (un valor roto vuelve vacío).
 */
import type { IngredientId } from "@/lib/recipes/catalog";

export const LUNCH_NAME_SLOT = "nutrikids.lunch-name.v1";
export const PANTRY_SLOT = "nutrikids.pantry.v1";
export const TRAVEL_CHECKS_SLOT = "nutrikids.travel.v1";
export const OWN_RECIPES_SLOT = "nutrikids.recipes-own.v1";
/** «Lo que compré» (S13): la lista vive en `src/lib/shopping/store.ts`; aquí solo se borra con lo demás. */
export const BOUGHT_SLOT = "nutrikids.bought.v1";

export const NAME_MAX = 40;
export const OWN_MAX = 20;
export const OWN_NAME_MAX = 60;
export const OWN_LINE_MAX = 80;
export const OWN_LINES_MAX = 15;
export const OWN_STEPS_MAX = 600;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown | null): void {
  try {
    const s = storage();
    if (!s) return;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* sin espacio o bloqueado: no se guarda */
  }
}

// --- El nombre de la etiqueta (lo escribe un padre) --------------------------------------------

export function getLunchName(): string | null {
  const v = readJson(LUNCH_NAME_SLOT);
  return typeof v === "string" && v.trim() ? v.slice(0, NAME_MAX) : null;
}

export function setLunchName(name: string | null): void {
  const t = name?.trim().slice(0, NAME_MAX) ?? "";
  write(LUNCH_NAME_SLOT, t ? t : null);
}

// --- La despensa --------------------------------------------------------------------------------

const PANTRY_MAX = 60;
const idLike = (x: unknown): x is string =>
  typeof x === "string" && /^[a-z0-9-]{1,30}$/.test(x);

/**
 * Los ids guardados (no importa el catálogo aquí: este módulo vive en el bundle compartido por
 * `clearAllData`; la pantalla filtra contra el catálogo y descarta lo que ya no exista).
 */
export function getPantry(): IngredientId[] {
  const v = readJson(PANTRY_SLOT);
  return (Array.isArray(v) ? v.filter(idLike) : []).slice(
    0,
    PANTRY_MAX,
  ) as IngredientId[];
}

export function togglePantry(id: IngredientId): IngredientId[] {
  const now = getPantry();
  const out = now.includes(id)
    ? now.filter((x) => x !== id)
    : [...now, id].slice(0, PANTRY_MAX);
  write(PANTRY_SLOT, out.length ? out : null);
  return out;
}

export function clearPantry(): void {
  write(PANTRY_SLOT, null);
}

// --- Lo marcado en la lista del viaje ----------------------------------------------------------

const CHECK_MAX = 60;

export function getTravelChecks(): string[] {
  const v = readJson(TRAVEL_CHECKS_SLOT);
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").slice(0, CHECK_MAX)
    : [];
}

export function toggleTravelCheck(id: string): string[] {
  const now = getTravelChecks();
  const out = now.includes(id)
    ? now.filter((x) => x !== id)
    : [...now, id.slice(0, 80)].slice(0, CHECK_MAX);
  write(TRAVEL_CHECKS_SLOT, out.length ? out : null);
  return out;
}

export function clearTravelChecks(): void {
  write(TRAVEL_CHECKS_SLOT, null);
}

// --- Recetas propias ---------------------------------------------------------------------------

export type OwnRecipe = {
  id: string;
  name: string;
  /** Una línea por ingrediente, tal como la escribió quien cuida. */
  ingredients: string[];
  steps: string;
};

const line = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

function coerceOwn(v: unknown): OwnRecipe | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const id = line(r.id, 40);
  const name = line(r.name, OWN_NAME_MAX);
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .map((x) => line(x, OWN_LINE_MAX))
    .filter(Boolean)
    .slice(0, OWN_LINES_MAX);
  if (!id || !name || ingredients.length === 0) return null;
  return {
    id,
    name,
    ingredients,
    steps:
      typeof r.steps === "string" ? r.steps.trim().slice(0, OWN_STEPS_MAX) : "",
  };
}

export function getOwnRecipes(): OwnRecipe[] {
  const v = readJson(OWN_RECIPES_SLOT);
  if (!Array.isArray(v)) return [];
  return v
    .map(coerceOwn)
    .filter((r): r is OwnRecipe => r !== null)
    .slice(0, OWN_MAX);
}

/** Guarda una receta propia (nueva o la que tenga el mismo id). null = no cabe o está incompleta. */
export function saveOwnRecipe(
  input: { id?: string; name: string; ingredients: string[]; steps: string },
  now: Date,
): OwnRecipe | null {
  const id = input.id ?? `own-${now.getTime().toString(36)}`;
  const rec = coerceOwn({ ...input, id });
  if (!rec) return null;
  const rest = getOwnRecipes().filter((r) => r.id !== rec.id);
  if (rest.length >= OWN_MAX) return null;
  write(OWN_RECIPES_SLOT, [...rest, rec]);
  return rec;
}

export function removeOwnRecipe(id: string): void {
  const rest = getOwnRecipes().filter((r) => r.id !== id);
  write(OWN_RECIPES_SLOT, rest.length ? rest : null);
}

/** «Borrar datos»: todo lo de este módulo, incluido el nombre de la etiqueta. */
export function clearDayToDay(): void {
  for (const k of [
    LUNCH_NAME_SLOT,
    PANTRY_SLOT,
    TRAVEL_CHECKS_SLOT,
    OWN_RECIPES_SLOT,
    BOUGHT_SLOT,
  ])
    write(k, null);
}
