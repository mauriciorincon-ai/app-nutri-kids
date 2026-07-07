# ADR 001 — Almacenamiento local: localStorage con claves versionadas

- **Estado:** aceptada · Sprint 001 · 2026-07-07
- **Contexto:** S1 es local-first sin backend. La dieta importada (~30 KB de JSON), el checklist
  del día y las preferencias deben vivir SOLO en el dispositivo (privacidad de datos de un menor,
  repo público). Opciones: IndexedDB (vía wrapper tipo idb) vs. localStorage.
- **Decisión:** `localStorage` con claves versionadas (`nutrikids.diet.v1`, `nutrikids.daylog.v1`,
  `nutrikids.prefs.v1`) detrás de un wrapper tipado (`src/lib/diet/storage.ts`, `day-log.ts`).
  Nada fuera de `lib/diet` toca localStorage directo; React consume vía `useSyncExternalStore`
  (`src/lib/local-store.ts`).
- **Razones:**
  1. Los datos son pequeños (dieta ~30 KB, day-log de bytes) — lejos del límite ~5 MB.
  2. API síncrona = wrappers y tests triviales; IndexedDB exigiría async en toda la UI.
  3. Todo dato leído se re-valida con zod (fail-safe: corrupto ⇒ descartar y volver a demo),
     así que la debilidad de localStorage (strings sin esquema) queda cubierta.
- **Migración futura:** si S3 (estado compartido) o el offline avanzado exigen IndexedDB/Supabase,
  la clave versionada permite migrar leyendo `*.v1` y escribiendo el formato nuevo; el wrapper es
  el único punto de cambio.
- **Consecuencias:** "borrar datos" = remover claves (derecho de supresión simple). localStorage
  es por-origen y sin expiración — suficiente para un dispositivo familiar.
