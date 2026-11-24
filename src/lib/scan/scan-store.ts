/**
 * Lo que el súper ocupa en este teléfono (S13 · ADR-019): el service worker guarda `/scan/` y
 * `/catalogo/` en sus cachés propias (`nutrikids-scan-*`, `nutrikids-catalog-*`). Aquí solo se mira
 * y se borra; nunca se descarga nada.
 */
import { scanFiles } from "./files";

const SCAN_CACHE = /^nutrikids-(?:scan|catalog)-/;

const hasCaches = () => typeof caches !== "undefined";

async function scanCaches(): Promise<Cache[]> {
  const out: Cache[] = [];
  for (const name of await caches.keys())
    if (SCAN_CACHE.test(name)) out.push(await caches.open(name));
  return out;
}

/** ¿Están guardados todos los archivos que este teléfono necesita para escanear sin red? */
export async function scanCached(native: boolean): Promise<boolean> {
  if (!hasCaches()) return false;
  try {
    const all = await scanCaches();
    for (const f of scanFiles(native)) {
      let found = false;
      for (const c of all) if (await c.match(f)) found = true;
      if (!found) return false;
    }
    return all.length > 0;
  } catch {
    return false;
  }
}

/** Bytes guardados (por la cabecera de cada respuesta; si no la trae, se mide el cuerpo). */
export async function scanBytes(): Promise<number> {
  if (!hasCaches()) return 0;
  let total = 0;
  try {
    for (const cache of await scanCaches())
      for (const req of await cache.keys()) {
        const res = await cache.match(req);
        if (!res) continue;
        const len = Number(res.headers.get("content-length"));
        total +=
          Number.isFinite(len) && len > 0 ? len : (await res.blob()).size;
      }
  } catch {
    return total;
  }
  return total;
}

/** Borra el escáner y el catálogo de este teléfono. Lo demás (plan, registro, lo que compré) no se toca. */
export async function deleteScan(): Promise<void> {
  if (!hasCaches()) return;
  for (const name of await caches.keys())
    if (SCAN_CACHE.test(name)) await caches.delete(name);
}
