/**
 * Borra, de este teléfono, el lector de etiquetas, el escáner y el catálogo (S13 · ADR-019): sus
 * cachés propias del service worker (`nutrikids-ocr-*`, `-scan-*`, `-catalog-*`). Vive aparte y sin
 * imports a propósito: «Borrar datos» de Ajustes lo usa y Ajustes va en la barra inferior, así que
 * lo que pese aquí lo paga cada pantalla. Lo demás (plan, registro, lo que compré) no se toca.
 */
const READER_CACHE = /^nutrikids-(?:ocr|scan|catalog)-/;

export async function deleteReaderCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  for (const name of await caches.keys())
    if (READER_CACHE.test(name)) await caches.delete(name);
}
