/**
 * Lo que el lector ocupa en este teléfono (S13 · ADR-019): el service worker guarda `/ocr/` en su
 * caché propia (`nutrikids-ocr-*`). Aquí solo se mira y se borra; nunca se descarga nada.
 */
import {
  OCR_BASE,
  coreVariant,
  ocrFiles,
  type CoreVariant,
} from "./ocr-client";

const OCR_CACHE = /^nutrikids-ocr-/;

const hasCaches = () => typeof caches !== "undefined";

async function ocrCaches(): Promise<Cache[]> {
  const out: Cache[] = [];
  for (const name of await caches.keys())
    if (OCR_CACHE.test(name)) out.push(await caches.open(name));
  return out;
}

/** ¿Están guardados todos los archivos que este teléfono necesita para leer sin red? */
export async function ocrCached(
  variant: CoreVariant = coreVariant(),
): Promise<boolean> {
  if (!hasCaches()) return false;
  try {
    const all = await ocrCaches();
    for (const f of ocrFiles(variant)) {
      let found = false;
      for (const c of all) if (await c.match(OCR_BASE + f)) found = true;
      if (!found) return false;
    }
    return all.length > 0;
  } catch {
    return false;
  }
}

/** Bytes guardados (por la cabecera de cada respuesta; si no la trae, se mide el cuerpo). */
export async function ocrBytes(): Promise<number> {
  if (!hasCaches()) return 0;
  let total = 0;
  try {
    for (const cache of await ocrCaches())
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

/** Borra el lector de este teléfono. Lo demás (plan, registro, modelo de la cámara) no se toca. */
export async function deleteOcr(): Promise<void> {
  if (!hasCaches()) return;
  for (const name of await caches.keys())
    if (OCR_CACHE.test(name)) await caches.delete(name);
}
