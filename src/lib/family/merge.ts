/**
 * Mezcla determinista de lo que dos teléfonos cambiaron (S7 · ADR-011).
 *
 * - Marcas, notas del día y notas del perfil: cada una por separado, gana la más reciente
 *   (registro «el último que escribe gana»). Quitar una marca o borrar una nota también es
 *   un cambio (lápida, `v: null`), para que lo borrado no reaparezca.
 * - Empate de hora: gana el teléfono de id mayor; empate total, el valor mayor en JSON.
 *   Así la mezcla es la misma en todos los aparatos, en cualquier orden (conmutativa,
 *   asociativa e idempotente: lo prueban los tests).
 * - El plan: entero, por versión. Si los dos teléfonos lo cambiaron desde la última vez,
 *   queda el más reciente y se avisa.
 */

export type Stamp = { t: number; by: string };
/** `s`: firma de quien lo escribió (S9 · ADR-013). No cuenta para decidir quién gana. */
/** Un valor con sello; `v: null` es una lápida (se quitó o se borró). */
export type Reg<T> = Stamp & { v: T | null; s?: string };
export type RegMap<T> = Record<string, Reg<T>>;

/** ¿`a` le gana a `b`? Orden total: hora, luego teléfono, luego valor. */
export function wins<T>(a: Reg<T>, b: Reg<T>): boolean {
  if (a.t !== b.t) return a.t > b.t;
  if (a.by !== b.by) return a.by > b.by;
  return JSON.stringify(a.v) > JSON.stringify(b.v);
}

export function mergeReg<T>(
  a: Reg<T> | undefined,
  b: Reg<T> | undefined,
): Reg<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  if (wins(b, a)) return b;
  if (wins(a, b)) return a;
  // El mismo cambio, firmado y sin firmar (o con dos firmas): se queda el firmado, y entre
  // dos firmas la mayor, para que todos los teléfonos lleguen a lo mismo.
  if ((b.s ?? "") > (a.s ?? "")) return b;
  return a;
}

export function mergeMap<T>(a: RegMap<T>, b: RegMap<T>): RegMap<T> {
  const out: RegMap<T> = { ...a };
  for (const [k, reg] of Object.entries(b)) out[k] = mergeReg(out[k], reg)!;
  return out;
}

/** ¿Cambió algo de `next` respecto de `prev`? (para saber si hay que subirlo). */
export function mapChanged<T>(prev: RegMap<T>, next: RegMap<T>): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    const a = prev[k];
    const b = next[k];
    if (!a || !b || a.t !== b.t || a.by !== b.by || a.s !== b.s) return true;
    if (JSON.stringify(a.v) !== JSON.stringify(b.v)) return true;
  }
  return false;
}

/** Solo lo vivo (sin lápidas), para mostrar. */
export function live<T>(map: RegMap<T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, reg] of Object.entries(map))
    if (reg.v !== null) out[k] = reg.v;
  return out;
}

export type PlanSide<T> = Stamp & { diet: T };
export type PlanMerge<T> = {
  winner: PlanSide<T>;
  /** true = los dos teléfonos lo cambiaron: la app avisa cuál quedó. */
  conflict: boolean;
  /** true = hay que subir el de este teléfono. */
  push: boolean;
};

/**
 * `dirty`: este teléfono cambió el plan desde la última versión que bajó.
 * `remote`: lo que hay en el servidor si cambió desde entonces (null = no cambió).
 */
export function mergePlan<T>(
  local: PlanSide<T>,
  dirty: boolean,
  remote: PlanSide<T> | null,
): PlanMerge<T> {
  if (!remote) return { winner: local, conflict: false, push: dirty };
  if (!dirty) return { winner: remote, conflict: false, push: false };
  const localWins = wins(
    { t: local.t, by: local.by, v: 1 },
    { t: remote.t, by: remote.by, v: 1 },
  );
  return localWins
    ? { winner: local, conflict: true, push: true }
    : { winner: remote, conflict: true, push: false };
}
