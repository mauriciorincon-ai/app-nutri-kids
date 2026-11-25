/**
 * Lo único que el gemelo guarda: desde cuándo cuenta (S15 · ADR-021). Vive solo en este teléfono,
 * jamás se sincroniza ni se envía. Todo lo demás se recalcula de lo anotado.
 */
export const TWIN_KEY = "nutrikids.twin.v1";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** El último borrado (clave de día), o null si nunca se borró. */
export function readTwinSince(): string | null {
  try {
    const raw = storage()?.getItem(TWIN_KEY);
    if (!raw) return null;
    const v = (JSON.parse(raw) as { since?: unknown }).since;
    return typeof v === "string" && DATE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** «Borrar lo aprendido»: lo anotado hasta hoy deja de contar. El registro no se toca. */
export function eraseTwin(todayKey: string): void {
  try {
    storage()?.setItem(TWIN_KEY, JSON.stringify({ since: todayKey }));
  } catch {
    // Sin almacenamiento no hay nada que guardar.
  }
}

/** «Borrar datos»: el gemelo se va con todo lo demás. */
export function clearTwin(): void {
  try {
    storage()?.removeItem(TWIN_KEY);
  } catch {
    // Nada que limpiar.
  }
}
