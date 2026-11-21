/**
 * Lo que el modelo ocupa en este teléfono (S12 · ADR-018): los pesos y el `.wasm` los guarda el
 * runtime en la caché `nutrikids-model`; el código de `/ia/` lo guarda el service worker en
 * `nutrikids-ia-*`. Aquí solo se mira y se borra; nunca se descarga nada.
 */
import model from "./model.json";

const MODEL_CACHE = model.cacheKey;
const IA_CACHE = /^nutrikids-ia-/;

const hasCaches = () => typeof caches !== "undefined";

/** Los tres archivos de pesos de la revisión fijada, ya guardados. */
export async function modelCached(): Promise<boolean> {
  if (!hasCaches()) return false;
  try {
    if (!(await caches.has(MODEL_CACHE))) return false;
    const keys = await (await caches.open(MODEL_CACHE)).keys();
    const onnx = keys.filter(
      (r) => r.url.includes(model.revision) && r.url.endsWith(".onnx"),
    );
    return onnx.length >= Object.keys(model.dtype).length;
  } catch {
    return false;
  }
}

/** Bytes guardados (por la cabecera de cada respuesta; si no la trae, se mide el cuerpo). */
export async function modelBytes(): Promise<number> {
  if (!hasCaches()) return 0;
  let total = 0;
  try {
    for (const name of await caches.keys()) {
      if (name !== MODEL_CACHE && !IA_CACHE.test(name)) continue;
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        const res = await cache.match(req);
        if (!res) continue;
        const len = Number(res.headers.get("content-length"));
        total += Number.isFinite(len) && len > 0 ? len : (await res.blob()).size;
      }
    }
  } catch {
    return total;
  }
  return total;
}

/** Borra el modelo y su runtime de este teléfono. Lo demás (plan, registro) no se toca. */
export async function deleteModel(): Promise<void> {
  if (!hasCaches()) return;
  for (const name of await caches.keys())
    if (name === MODEL_CACHE || IA_CACHE.test(name)) await caches.delete(name);
}
