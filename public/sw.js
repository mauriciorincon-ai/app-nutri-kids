/**
 * Service worker mínimo (ADR PWA, S1): caché estático solamente.
 * - cache-first para assets inmutables (/_next/static, íconos, fuentes)
 * - la navegación va SIEMPRE a la red (los datos viven en localStorage,
 *   no aquí); sin caché de páginas no hay riesgo de servir HTML viejo.
 */
const CACHE = "nutrikids-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
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

const STATIC_PATTERN = /\/(_next\/static|icons)\/|\.(?:png|ico|woff2?)$/;

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (!STATIC_PATTERN.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }),
  );
});
