/**
 * Service worker de Nutrikids (ADR-003, revisado en el S4).
 *
 * Esta es la PLANTILLA: `scripts/build-sw.mjs` la estampa en `public/sw.js` en cada
 * build, con el id de versión y la lista de pantallas. Lo que hace:
 *  - PRECACHE: al instalarse guarda el cascarón HTML de cada pantalla y los
 *    estáticos que ese HTML referencia, de modo que la app abra sin internet.
 *  - NAVEGACIÓN: red primero (si el deploy cambió, se ve lo nuevo) y, sin señal,
 *    el cascarón guardado. `/dieta/<id>` sin visita previa usa el cascarón del detalle.
 *  - ESTÁTICOS inmutables (`/_next/static`, íconos, fuentes): caché primero.
 *  - VERSIÓN NUEVA: se instala en espera y la página avisa; solo se activa cuando
 *    la persona acepta (mensaje SKIP_WAITING). Nunca recarga a la fuerza.
 *  - AVISOS (S8 · ADR-012): el toque llega vacío; el aviso se arma aquí con la copia
 *    mínima que la página deja en IndexedDB (`NK_PUSH`, de `scripts/sw-push.js`).
 * Los datos de la dieta viven en localStorage; el trabajador solo lee esa copia.
 */
const VERSION = "__BUILD_ID__";
const CACHE = "nutrikids-shell-" + VERSION;
const SHELL_ROUTES = __SHELL_ROUTES__;
const DETAIL_SHELL = __DETAIL_SHELL__;
/** pdf.js y su worker, servidos por la app: el PDF se lee en el aparato, también sin red. */
const EXTRA_ASSETS = __EXTRA_ASSETS__;
/**
 * Caché PROPIA de pdf.js (~1,8 MB), con la versión de la librería: un deploy nuevo no la vuelve
 * a bajar mientras la versión no cambie, y no se borra con las cachés del cascarón.
 */
const PDFJS_CACHE = "nutrikids-pdfjs-__PDFJS_VERSION__";
/**
 * Caché PROPIA de `/ia/` (S12 · ADR-018): el runtime del modelo y su worker, guardados al pedirlos
 * tras el toque. El nombre cambia solo si cambian el runtime o el worker.
 */
const IA_CACHE = "__IA_CACHE__";
/**
 * Caché PROPIA de `/ocr/` (S13 · ADR-019): el lector de etiquetas —su código, su núcleo WASM y los
 * idiomas—, guardado al pedirlo tras el toque. Cambia solo si cambia una versión del lector.
 */
const OCR_CACHE = "__OCR_CACHE__";
/**
 * Al activarse, el SW borra SOLO sus cachés viejas (`nutrikids-shell-*`, `-pdfjs-*`, `-ia-*`, `-ocr-*`).
 * Cualquier otra —la del modelo, `nutrikids-model`, que guarda el runtime— no es suya y se queda:
 * borrarla obligaría a bajar otra vez ≈ 160 MB tras cada versión.
 */
const OWN_CACHE = /^nutrikids-(shell|pdfjs|ia|ocr)-/;
const NAV_TIMEOUT_MS = 3000;

const ASSET_PATTERN = /\/_next\/static\/[^"'\s\\)<>]+/g;
const STATIC_PATTERN = /\/(_next\/static|icons|pdfjs)\/|\.(?:png|ico|woff2?)$/;
/** De `/ia/` el SW guarda el código (`.js`, `.mjs`); el `.wasm` lo guarda el runtime. */
const IA_PATTERN = /^\/ia\/[^/]+\.m?js$/;
/** De `/ocr/` el SW lo guarda TODO (código, núcleo y `.traineddata.gz`): el lector no tiene caché propia. */
const OCR_PATTERN = /^\/ocr\/(?:[a-z]+\/)?[\w.-]+\.(?:js|gz)$/;

/** Clave de caché de una pantalla: su ruta, sin query ni hash. */
function shellKey(pathname) {
  return new Request(self.location.origin + pathname);
}

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  // Las pantallas son obligatorias: si una falla, la instalación falla y sigue la versión anterior.
  await Promise.all(
    [...SHELL_ROUTES, DETAIL_SHELL].map(async (route) => {
      const res = await fetch(route, { cache: "reload" });
      if (!res.ok) throw new Error("precache " + route + " " + res.status);
      const html = await res.clone().text();
      for (const m of html.matchAll(ASSET_PATTERN)) assets.add(m[0]);
      await cache.put(shellKey(route), res);
    }),
  );
  // pdf.js: solo si su caché aún no lo trae (misma versión ⇒ no se descarga otra vez).
  const pdfCache = await caches.open(PDFJS_CACHE);
  await Promise.allSettled(
    EXTRA_ASSETS.map(async (asset) => {
      if (await pdfCache.match(asset)) return;
      const res = await fetch(asset);
      if (res.ok) await pdfCache.put(asset, res);
    }),
  );
  // Los estáticos se guardan «lo mejor posible»: uno que falle no tumba la instalación
  // (se cachea al pedirlo la primera vez).
  await Promise.allSettled(
    [...assets].map(async (asset) => {
      const res = await fetch(asset);
      if (res.ok) await cache.put(asset, res);
    }),
  );
}

self.addEventListener("install", (event) => {
  // Sin skipWaiting aquí: una versión nueva espera a que la persona la acepte.
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                OWN_CACHE.test(k) &&
                k !== CACHE &&
                k !== PDFJS_CACHE &&
                k !== IA_CACHE &&
                k !== OCR_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/**
 * Sin red y sin copia propia de esa URL:
 *  - `/dieta/<id>` → el cascarón del detalle (la página lee el id de la URL);
 *  - cualquier otra ruta desconocida → una página mínima que se reemplaza sola por Hoy
 *    (no se sirve el HTML de otra ruta: Next no se hidrata con un cascarón ajeno).
 */
async function offlineFallback(cache, pathname) {
  if (pathname.startsWith("/dieta/")) {
    const detail = await cache.match(shellKey(DETAIL_SHELL));
    if (detail) return detail;
  }
  const home = await cache.match(shellKey("/"));
  if (!home) return Response.error();
  const html =
    '<!doctype html><html><meta charset="utf-8"><title>Nutrikids</title>' +
    '<meta http-equiv="refresh" content="0;url=/">' +
    '<script>location.replace("/")</script><a href="/">Nutrikids</a></html>';
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function navigate(event, request, url) {
  const cache = await caches.open(CACHE);
  const key = shellKey(url.pathname);
  const network = fetch(request).then((res) => {
    if (res.ok && res.headers.get("content-type")?.includes("text/html"))
      // Se espera: el SW no puede morir antes de terminar de escribir.
      event.waitUntil(cache.put(key, res.clone()).catch(() => {}));
    return res;
  });
  const cached = await cache.match(key);
  if (!cached) {
    // Sin copia propia: red; si falla, el cascarón de respaldo.
    return network.catch(() => offlineFallback(cache, url.pathname));
  }
  // Con copia: la red manda, pero sin señal, muy lenta o con error del servidor sale la guardada.
  const slow = new Promise((resolve) =>
    setTimeout(() => resolve(cached), NAV_TIMEOUT_MS),
  );
  return Promise.race([network, slow])
    .then((res) => (res.ok ? res : cached))
    .catch(() => cached);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(event, request, url));
    return;
  }
  const own = IA_PATTERN.test(url.pathname)
    ? IA_CACHE
    : OCR_PATTERN.test(url.pathname)
      ? OCR_CACHE
      : null;
  if (!own && !STATIC_PATTERN.test(url.pathname)) return;

  event.respondWith(
    caches
      .open(own ?? (url.pathname.startsWith("/pdfjs/") ? PDFJS_CACHE : CACHE))
      .then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
  );
});

// ---------------------------------------------------------------------------
// Avisos que llegan (S8 · ADR-012)
// ---------------------------------------------------------------------------

/* __PUSH_MODULE__ */

self.addEventListener("push", (event) => {
  event.waitUntil(
    NK_PUSH.onPush(new Date(), fetch)
      .catch(() => ({ title: "Nutrikids", options: { tag: "nk-plan" } }))
      .then((n) => self.registration.showNotification(n.title, n.options)),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = NK_PUSH.clickUrl(event.notification.data);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const open = list.find((c) => "focus" in c);
        if (open) return open.navigate(url).then((c) => (c || open).focus());
        return self.clients.openWindow(url);
      }),
  );
});
