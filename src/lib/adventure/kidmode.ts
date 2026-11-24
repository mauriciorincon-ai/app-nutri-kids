/**
 * El modo niño de este teléfono (S14 · ADR-020 · G-Plan 2a): una bandera local, «1» mientras el
 * teléfono está en la aventura. Módulo mínimo A PROPÓSITO: lo importa el cascarón (para llevar al
 * niño de vuelta a `/aventura` en cualquier pantalla, también con Atrás), así que no puede arrastrar
 * el libro de chispas ni los dibujos. Solo se apaga con la salida del adulto (`AdultExit`) o con
 * «Borrar datos».
 */

export const KIDMODE_ITEM = "nutrikids.kidmode.v1";
export const ADVENTURE_EVENT = "nutrikids:adventure";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function kidModeOn(): boolean {
  try {
    return storage()?.getItem(KIDMODE_ITEM) === "1";
  } catch {
    return false;
  }
}

export function setKidMode(on: boolean): void {
  try {
    const s = storage();
    if (!s) return;
    if (on) s.setItem(KIDMODE_ITEM, "1");
    else s.removeItem(KIDMODE_ITEM);
    window.dispatchEvent(new Event(ADVENTURE_EVENT));
  } catch {
    /* sin espacio o bloqueado */
  }
}

export function subscribeKidMode(listener: () => void): () => void {
  window.addEventListener(ADVENTURE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(ADVENTURE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
