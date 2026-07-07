# ADR 003 — PWA: manifest + íconos + service worker mínimo escrito a mano

- **Estado:** aceptada · Sprint 001 · 2026-07-07
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
