/**
 * Qué baja el teléfono para el súper y de dónde (S13 · ADR-019). Sin zod ni worker: lo importan
 * Ajustes y la pantalla, así que debe pesar casi nada. Todo sale de la propia app: ninguna CDN.
 */
import scan from "./scan.json";

export const SCAN_BASE = "/scan/";
export const CATALOG_URL = "/catalogo/off-co.json";
export const SCAN_WORKER = "/scan/scan-worker.js";
/** La licencia de los datos del catálogo; su atribución va en Ajustes y en la pantalla del súper. */
export const ODBL_URL = "https://opendatacommons.org/licenses/odbl/1-0/";

/** Lo que este teléfono baja: el worker, el catálogo y —sin detector propio— zxing con su `.wasm`. */
export function scanFiles(native: boolean): string[] {
  return [
    SCAN_WORKER,
    CATALOG_URL,
    ...(native
      ? []
      : [SCAN_BASE + "zxing-reader.js", SCAN_BASE + "zxing_reader.wasm"]),
  ];
}

const sizes = scan.files as Record<string, number>;
const sizeOf = (url: string) =>
  sizes[url.replace(/^\/(?:scan|catalogo)\//, "")] ?? 0;

/** Bytes que este teléfono baja (se muestran ANTES del toque). */
export function scanDownloadBytes(native: boolean): number {
  return scanFiles(native).reduce((sum, u) => sum + sizeOf(u), 0);
}
