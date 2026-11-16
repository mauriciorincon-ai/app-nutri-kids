# ADR 003 — PWA: manifest + íconos + service worker mínimo escrito a mano

- **Estado:** aceptada · Sprint 001 · 2026-07-07 · **revisada en el Sprint 004 (2026-11-15):** el SW ahora precachea el cascarón de todas las pantallas (ver «Revisión S4»; el «límite conocido» de abajo quedó superado) · **revisada en el Sprint 008 (2026-11-16):** el SW atiende `push` y `notificationclick` (ver «Revisión S8» y ADR-012).
- **Contexto:** la app debe ser instalable (Add to Home Screen, uso diario en el teléfono).
  Opciones: next-pwa (sin mantenimiento activo para Next 16), Serwist, o SW mínimo propio.
- **Decisión:** sin dependencia: `public/manifest.webmanifest` (standalone, portrait, íconos
  any+maskable 192/512 generados por `scripts/generate-icons.mjs`) + `public/sw.js` escrito a
  mano, registrado solo en producción (`SwRegister`).
- **Estrategia de caché (deliberadamente mínima):**
  - cache-first SOLO para estáticos inmutables (`/_next/static`, íconos, fuentes).
  - la navegación va SIEMPRE a la red — sin caché de HTML no hay riesgo de servir una versión
    vieja de la app tras un deploy (el clásico bug de next-pwa).
  - los datos ya son offline por diseño: viven en localStorage, no en el SW.
- **Razones:** instalabilidad hoy requiere manifest + íconos (el SW ya no es obligatorio en
  Chrome); el SW mínimo acelera revisitas y evita adoptar una dependencia con churn. ~40 líneas
  auditables.
- **Límite conocido:** sin señal, la NAVEGACIÓN a una página no visitada falla (offline avanzado
  "lonchera sin señal" es de sprints futuros — se haría con precache del app shell o Serwist).
- **Versionado:** el nombre del caché (`nutrikids-static-v1`) se rota si cambia la estrategia;
  `activate` limpia caches viejos.

## Revisión S4 — «la dieta responde sin internet» (2026-11-15)

- **Qué cambia:** el SW sigue escrito a mano y sin dependencias, pero ya no es solo de estáticos.
  - `scripts/sw.template.js` es la plantilla; `scripts/build-sw.mjs` (en `prebuild` y `dev`) la estampa
    en `public/sw.js` (ignorado por git) con un id de versión por build y la lista de pantallas.
  - **Precache en la instalación:** el HTML de `/`, `/dieta`, `/suplementos`, `/cargar`, `/ajustes`,
    `/chat`, `/historial` y `/conoce`, más los estáticos `/_next/static/*` que ese HTML referencia. Si
    algo falla, la instalación falla entera y sigue la versión anterior.
  - **Navegación: red primero, caché de respaldo.** Con señal se ve siempre lo último del deploy
    (el riesgo de HTML viejo que motivó la v1 se evita porque la red manda); sin señal, o con la red
    más lenta que 3 s habiendo copia, sale el cascarón guardado. `/dieta/<id>` sin visita previa usa el
    cascarón genérico `/dieta/_` (la página lee el id de la URL con `usePathname`, no de los params del
    servidor, y por eso un mismo cascarón sirve cualquier alimento; una ruta desconocida vuelve a Hoy).
  - **Versión nueva:** el SW nuevo queda **en espera** (sin `skipWaiting` al instalar; las otras pestañas avisan también al quedar con la versión vieja). La página avisa
    «hay una versión nueva» con «Actualizar» y «Ahora no»; solo al aceptar manda `SKIP_WAITING`, el SW
    toma el control y se recarga una vez. **Nunca recarga a la fuerza.**
- **Gates (regla 19, puente SW ↔ página):** `tests/unit/build-sw.test.ts` compara la lista de pantallas
  con las rutas reales de `src/app`, exige que la versión nueva espere y que el mensaje coincida en ambos
  lados; `tests/e2e/offline.spec.ts` apaga la red tras una visita y abre cada pantalla, usa el chat y
  congela el aviso de versión con axe. Demostrado en rojo quitando una pantalla de la lista.
- **Lo que no cambia:** los datos de la dieta y del registro viven en `localStorage`, nunca en el caché
  del SW; el SW solo se registra en producción.

## Revisión S8 — «avisos que llegan» (2026-11-16)

- **El SW atiende dos eventos más:** `push` (el toque llega vacío; el aviso se arma con la copia mínima que
  la página deja en IndexedDB `nutrikids-push`, y el aviso de la familia se descifra en el teléfono) y
  `notificationclick` (abre solo rutas de la propia app). El código vive en `scripts/sw-push.js` y
  `build-sw.mjs` lo inserta en `public/sw.js`.
- **Contrato (regla 19):** `tests/unit/push-sw.test.ts` carga ese mismo módulo contra la copia que escribe
  `src/lib/push/copy.ts` y contra registros sellados por `src/lib/family/crypto.ts`.
- **Lo que cambia de «lo que no cambia»:** el SW ya lee datos, pero solo esa copia local para armar el
  aviso; los datos de la dieta siguen en `localStorage` y nada de esto entra al caché.
