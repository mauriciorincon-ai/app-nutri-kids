import { dateKey } from "./logic";

/**
 * Checklist del día por fecha (clave YYYY-MM-DD, día local del dispositivo).
 * Amanece vacío cada día SIN borrar el historial de días anteriores.
 * Ids de marca: "meal:<id>" · "supplement:<id>" · "water:<n>" (ver logic.buildDayChecklist).
 */

export const DAY_LOG_KEY = "nutrikids.daylog.v1";

type DayLogStore = Record<string, string[]>;

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function readStore(): DayLogStore {
  const raw = storage()?.getItem(DAY_LOG_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const store: DayLogStore = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value))
        store[key] = value.filter((v): v is string => typeof v === "string");
    }
    return store;
  } catch {
    return {}; // corrupto ⇒ checklist fresco (fail-safe, el historial no es crítico)
  }
}

function writeStore(store: DayLogStore): void {
  storage()?.setItem(DAY_LOG_KEY, JSON.stringify(store));
}

/** Marcas hechas del día indicado (vacío si el día no tiene registro — amanece fresco). */
export function getDoneIds(date: Date): string[] {
  return readStore()[dateKey(date)] ?? [];
}

/** Marca/desmarca un ítem del día. Devuelve las marcas resultantes. */
export function toggleDone(date: Date, checkId: string): string[] {
  const store = readStore();
  const key = dateKey(date);
  const current = new Set(store[key] ?? []);
  if (current.has(checkId)) {
    current.delete(checkId);
  } else {
    current.add(checkId);
  }
  store[key] = [...current];
  writeStore(store);
  return store[key];
}

/** Limpieza total (la usa "borrar datos"). */
export function clearDayLog(): void {
  storage()?.removeItem(DAY_LOG_KEY);
}
