import { coerceSparks, earnSparks, type Source } from "./energy";
import { ADVENTURE_EVENT, KIDMODE_ITEM } from "./kidmode";

/**
 * Dónde vive la aventura en ESTE teléfono (S14 · ADR-020, parte 2). Es local y no viaja: ni a
 * la familia ni a la red ni a los registros. «Borrar datos» lo limpia (`clearAllData`), y es el
 * único camino que baja la energía: es un borrado explícito del usuario, no del juego.
 *
 *  - `nutrikids.adventure.v1`: el libro de chispas (solo se añaden claves) y el mundo elegido.
 *  - `nutrikids.kidmode.v1`: «1» mientras el teléfono está en modo niño (vive en `kidmode.ts`).
 */

export const ADVENTURE_ITEM = "nutrikids.adventure.v1";
const EVENT = ADVENTURE_EVENT;

export const WORLDS = ["brote", "lumo", "nubo"] as const;
export type World = (typeof WORLDS)[number];

export type Adventure = { world: World; sparks: string[] };
const EMPTY: Adventure = { world: "brote", sparks: [] };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let cache: { raw: string | null; value: Adventure } | null = null;

export function readAdventure(): Adventure {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(ADVENTURE_ITEM) ?? null;
  } catch {
    raw = null;
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = EMPTY;
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Adventure>) : null;
    if (v && typeof v === "object")
      value = {
        world: WORLDS.includes(v.world as World) ? (v.world as World) : "brote",
        sparks: coerceSparks(v.sparks),
      };
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function save(next: Adventure): void {
  try {
    storage()?.setItem(ADVENTURE_ITEM, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* sin espacio o bloqueado: no se guarda */
  }
}

/** Cambia de mundo. La energía es una sola: cambiar de mundo no la toca. */
export function setWorld(world: World): void {
  const cur = readAdventure();
  if (cur.world !== world) save({ ...cur, world });
}

/**
 * Suma al libro las chispas de varios días de una vez. Solo guarda si creció: no hay forma de
 * quitar una. true si cambió algo.
 */
export function earnAll(
  days: { day: string; sources: readonly Source[] }[],
): boolean {
  const cur = readAdventure();
  let sparks = cur.sparks;
  for (const { day, sources } of days)
    sparks = earnSparks(sparks, day, sources);
  if (sparks.length === cur.sparks.length) return false;
  save({ ...cur, sparks });
  return true;
}

export function subscribeAdventure(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** «Borrar datos»: el libro, el mundo y el modo niño. */
export function clearAdventure(): void {
  try {
    const s = storage();
    s?.removeItem(ADVENTURE_ITEM);
    s?.removeItem(KIDMODE_ITEM);
    cache = null;
    if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
  } catch {
    /* nada que limpiar */
  }
}
