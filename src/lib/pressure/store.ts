import { coerceEntries, prune, type PressureEntry } from "./values";

/**
 * Dónde vive el registro de presión en ESTE teléfono (S14 · ADR-020): lo que este teléfono anotó
 * (`own`) y, solo en el de madre o padre, lo que anotaron los demás (`others`, por teléfono).
 * Sin familia, `others` siempre está vacío. Lectura defensiva: lo que no encaja se descarta.
 * «Borrar datos» lo limpia (`clearAllData`).
 */

export const PRESSURE_ITEM = "nutrikids.pressure.v1";
const EVENT = "nutrikids:pressure";

export type PressureStore = {
  own: PressureEntry[];
  others: Record<string, PressureEntry[]>;
};

const EMPTY: PressureStore = { own: [], others: {} };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let cache: { raw: string | null; value: PressureStore } | null = null;

export function readPressure(now = Date.now()): PressureStore {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(PRESSURE_ITEM) ?? null;
  } catch {
    raw = null;
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = EMPTY;
  try {
    const v = raw ? (JSON.parse(raw) as Partial<PressureStore>) : null;
    if (v && typeof v === "object") {
      const others: Record<string, PressureEntry[]> = {};
      if (v.others && typeof v.others === "object")
        for (const [id, list] of Object.entries(v.others)) {
          const ev = coerceEntries(list, now).filter((e) => e.by === id);
          if (ev.length) others[id] = ev;
        }
      value = { own: coerceEntries(v.own, now), others };
    }
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function save(next: PressureStore): void {
  try {
    const s = storage();
    if (!s) return;
    if (next.own.length === 0 && Object.keys(next.others).length === 0)
      s.removeItem(PRESSURE_ITEM);
    else s.setItem(PRESSURE_ITEM, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* sin espacio o bloqueado: no se guarda */
  }
}

/** Suma una anotación de este teléfono. */
export function addPressure(entry: PressureEntry, now = Date.now()): void {
  const cur = readPressure(now);
  save({ ...cur, own: prune([...cur.own, entry], now) });
}

/** Quita una anotación propia (quien la anotó puede corregirse). */
export function removePressure(id: string, now = Date.now()): void {
  const cur = readPressure(now);
  save({ ...cur, own: cur.own.filter((e) => e.id !== id) });
}

/** Lo que llegó de otro teléfono (ya comprobado). true si cambió algo. */
export function mergePressureOthers(
  by: string,
  ev: PressureEntry[],
  now = Date.now(),
): boolean {
  const cur = readPressure(now);
  const next = prune(
    ev.filter((e) => e.by === by),
    now,
  );
  const before = JSON.stringify(cur.others[by] ?? []);
  if (before === JSON.stringify(next)) return false;
  const others = { ...cur.others };
  if (next.length) others[by] = next;
  else delete others[by];
  save({ ...cur, others });
  return true;
}

/** Este teléfono dejó de ser de madre o padre (o salió de la familia): olvida lo de los demás. */
export function dropPressureOthers(now = Date.now()): boolean {
  const cur = readPressure(now);
  if (Object.keys(cur.others).length === 0) return false;
  save({ ...cur, others: {} });
  return true;
}

export function clearPressure(): void {
  try {
    storage()?.removeItem(PRESSURE_ITEM);
    cache = null;
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* nada que borrar */
  }
}

export function subscribePressure(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === PRESSURE_ITEM) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
