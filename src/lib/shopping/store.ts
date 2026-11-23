/**
 * «Lo que compré» (S13 · ADR-019): una lista que vive SOLO en este teléfono, como la despensa. No
 * se sincroniza con la familia. Guarda el código, el nombre y la marca que el catálogo público
 * trae y el día en que se anotó; JAMÁS el veredicto: ese se recalcula con el plan de hoy cada vez
 * que se muestra. «Borrar datos» la limpia (`clearDayToDay`). Cada lectura es defensiva.
 */
import { BOUGHT_SLOT } from "@/lib/day-to-day/store";

export const BOUGHT_MAX = 200;

export type Bought = {
  code: string;
  name: string;
  brand: string;
  /** `YYYY-MM-DD`: el día en que se anotó. */
  date: string;
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const line = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

function coerce(v: unknown): Bought | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const code = line(r.code, 13);
  const date = line(r.date, 10);
  const name = line(r.name, 160);
  if (!/^(?:\d{8}|\d{12}|\d{13})$/.test(code) || !name) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { code, name, brand: line(r.brand, 80), date };
}

export function getBought(): Bought[] {
  try {
    const raw = storage()?.getItem(BOUGHT_SLOT);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(v)) return [];
    return v
      .map(coerce)
      .filter((b): b is Bought => b !== null)
      .slice(0, BOUGHT_MAX);
  } catch {
    return [];
  }
}

function save(list: Bought[]): void {
  try {
    const s = storage();
    if (!s) return;
    if (list.length === 0) s.removeItem(BOUGHT_SLOT);
    else s.setItem(BOUGHT_SLOT, JSON.stringify(list));
  } catch {
    /* sin espacio o bloqueado: no se guarda */
  }
}

/** Anota (o vuelve a anotar, con el día de hoy) un producto: lo más nuevo, primero. */
export function addBought(
  item: { code: string; name: string; brand: string },
  today: string,
): Bought[] {
  const entry = coerce({ ...item, date: today });
  if (!entry) return getBought();
  const out = [entry, ...getBought().filter((b) => b.code !== entry.code)].slice(
    0,
    BOUGHT_MAX,
  );
  save(out);
  return out;
}

export function removeBought(code: string): Bought[] {
  const out = getBought().filter((b) => b.code !== code);
  save(out);
  return out;
}
