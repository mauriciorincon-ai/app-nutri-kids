/**
 * Service worker de Nutrikids (ADR-003, revisado en el S4).
 *
 * Esta es la PLANTILLA: `scripts/build-sw.mjs` la estampa en `public/sw.js` en cada
 * build, con el id de versión y la lista de pantallas. Lo que hace:
 *  - PRECACHE: al instalarse guarda el cascarón HTML de cada pantalla y los
 *    estáticos que ese HTML referencia, de modo que la app abra sin internet.
 *  - NAVEGACIÓN: red primero (si el deploy cambió, se ve lo nuevo) y, sin señal,
 *    el cascarón guardado. `/dieta/<id>` sin visita previa lleva a `/dieta`.
 *  - ESTÁTICOS inmutables (`/_next/static`, íconos, fuentes): caché primero.
 *  - VERSIÓN NUEVA: se instala en espera y la página avisa; solo se activa cuando
 *    la persona acepta (mensaje SKIP_WAITING). Nunca recarga a la fuerza.
 * Los datos de la dieta viven en localStorage, jamás aquí.
 */
const VERSION = "__BUILD_ID__";
const CACHE = "nutrikids-shell-" + VERSION;
const SHELL_ROUTES = __SHELL_ROUTES__;
const NAV_TIMEOUT_MS = 3000;

const ASSET_PATTERN = /\/_next\/static\/[^"'\s\\)<>]+/g;
const STATIC_PATTERN = /\/(_next\/static|icons)\/|\.(?:png|ico|woff2?)$/;

/** Clave de caché de una pantalla: su ruta, sin query ni hash. */
function shellKey(pathname) {
  return new Request(self.location.origin + pathname);
}

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  await Promise.all(
    SHELL_ROUTES.map(async (route) => {
      const res = await fetch(route, { cache: "reload" });
      if (!res.ok) throw new Error("precache " + route + " " + res.status);
      const html = await res.clone().text();
      for (const m of html.matchAll(ASSET_PATTERN)) assets.add(m[0]);
      await cache.put(shellKey(route), res);
    }),
  );
  await Promise.all(
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
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/**
 * Sin red y sin copia propia: `/dieta/<id>` lleva a la lista; lo demás, a Hoy.
 * No se sirve el HTML de otra ruta (Next no se hidrata con un cascarón ajeno) ni un 302:
 * una página mínima que se reemplaza sola por la pantalla guardada.
 */
async function offlineFallback(cache, pathname) {
  const target = pathname.startsWith("/dieta/") ? "/dieta" : "/";
  const shell = await cache.match(shellKey(target));
  if (!shell) return Response.error();
  if (pathname === target) return shell;
  const html =
    '<!doctype html><html lang="es"><meta charset="utf-8"><title>Nutrikids</title>' +
    '<meta http-equiv="refresh" content="0;url=' + target + '">' +
    '<script>location.replace(' + JSON.stringify(target) + ")</script>" +
    '<a href="' + target + '">Nutrikids</a></html>';
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function navigate(request, url) {
  const cache = await caches.open(CACHE);
  const key = shellKey(url.pathname);
  const network = fetch(request).then((res) => {
    if (res.ok && res.headers.get("content-type")?.includes("text/html"))
      cache.put(key, res.clone());
    return res;
  });
  const cached = await cache.match(key);
  if (!cached) {
    // Sin copia propia: red; si falla, el cascarón más cercano.
    return network.catch(() => offlineFallback(cache, url.pathname));
  }
  // Con copia: la red manda, pero sin señal (o muy lenta) sale la guardada.
  const slow = new Promise((resolve) =>
    setTimeout(() => resolve(cached), NAV_TIMEOUT_MS),
  );
  return Promise.race([network, slow]).catch(() => cached);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
    return;
  }
  if (!STATIC_PATTERN.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});
