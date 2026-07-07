---
sprint: 001
app: nutri-kids
branch: sprint-001/dieta-viva-y-hoy
opened: 2026-07-07
---

# Sprint 001 — Bitácora de implementación

> Orden: `portafolio/nutri-kids/ordenes/SPRINT_001-orden.md` (planeadora, READ-ONLY).
> Plan aprobado por el usuario el 2026-07-07 (plan mode). Decisión de diseño: el builder bosqueja
> `design-system.md` y el usuario aprueba visualmente sobre la preview (Claude Design queda como
> herramienta opcional de iteración, no bloquea).

## Fricción del kit v1.1.x (⭐ separada del producto — valida "CI verde en el primer PR sin cirugía")

| #   | Fricción                                                                                                                                                                                                          | Impacto                                                               | Acción en este sprint                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| K1  | No existe `vitest.config.ts` ni `playwright.config.ts`; el comentario de `ci.yml` dice "vitest run --coverage (umbral 70% en vitest.config)" pero el script `test` es `vitest run --passWithNoTests` sin coverage | El gate de cobertura prometido no existe; e2e sin config de webServer | Crear ambos configs + ajustar scripts en `package.json` |
| K2  | La orden dice "Sentry viene cableada en el kit" — no hay `@sentry/nextjs` ni config alguna                                                                                                                        | Observabilidad (estándar 3) requiere cirugía en el sprint             | Cablear `@sentry/nextjs` con DSN por env                |
| K3  | El job Lighthouse de `ci.yml` solo audita `/`; la DoD exige `/` y `/dieta`                                                                                                                                        | Gate de performance incompleto                                        | Extender `--collect.url` en `ci.yml`                    |
| K4  | `CLAUDE.md` estampado dice "kit-app v1.1.0" pero el commit de estampado dice v1.1.4                                                                                                                               | Cosmético (trazabilidad de versión)                                   | Solo se registra aquí                                   |
| K5  | ~~gitleaks no instalado~~ **RESUELTO antes del sprint:** el pre-commit del primer commit corrió gitleaks OK ("no leaks found") — la nota de la orden estaba desactualizada                                        | Ninguno: el gate de secrets SÍ protege                                | Nada — corregir la nota en la próxima orden             |

## Decisiones (ADRs por tema — se formalizan en `decisions/`)

- Almacenamiento local → localStorage con claves versionadas tras wrapper tipado (ADR pendiente).
- i18n → diccionarios TS tipados sin librería, ES default (ADR pendiente).
- PWA → manifest + íconos + SW mínimo a mano (ADR pendiente).

## Desviación del plan

_(ninguna hasta ahora)_

## Budget renegociado (estándar 5, corolario del patrón lcp-nace-estatico)

- `perf-budget.json` script: **300 → 380 KB**. Razón: el cliente de `@sentry/nextjs` (~75 KB
  transfer) — el estándar 3 (observabilidad) cuesta bundle; el scaffold del kit medía sin Sentry.
  380 deja ~10% de margen sobre lo medido (338 KB). Revisar en S2 si Sentry ofrece build slim.
- Primer run de Lighthouse en CI falló LCP (~5.4s en `/` y `/dieta`): causa raíz = fuentes (el
  eje SOFT de Fraunces disparaba el peso del webfont y el font-swap repintaba el candidato LCP
  tardísimo) + en `/` las comidas se renderizaban solo tras hidratar. Fix: 2 familias sin ejes
  extra, mono de sistema, y comidas/agua estáticas en el prerender de `/` (solo el suplemento
  espera el día real). Regla nueva en design-system.md §Tipografía.

## Cronología

| Fecha      | Evento                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-07 | Branch `sprint-001/dieta-viva-y-hoy` creado; plan aprobado; Fase 0 iniciada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-07 | Fase 0 completa: vitest/playwright configs (K1), shadcn/ui init (preset nova/radix), `@sentry/nextjs` cableado (K2, DSN por env), logger Pino, smoke tests. `typecheck+lint+test+build` verdes en local. Cobertura scoped a `src/lib/diet/**` umbral 80 (utils/log del kit se cubren vía e2e). `@sentry/cli` aprobado en `pnpm-workspace.yaml` (patrón allowBuilds v1.1.3)                                                                                                                                                                                                                                                                                                                     |
| 2026-07-07 | Fase 1 completa: schema zod v1 (`schema.ts`), motor puro (`logic.ts`: semáforo con precedencia restricción-vigente>rojo>amarillo>verde, suplemento-del-día, checklist), `storage.ts` (localStorage versionado, fail-safe corrupto→demo), `day-log.ts` (clave YYYY-MM-DD local), `data/demo-diet.json` (inventada, bilingüe, ejercita todos los campos incl. opcionales). 42 tests unit verdes, cobertura ~99% en `lib/diet`. **Dieta real validada con `scripts/validate-diet.ts` leyendo la planeadora (9 restringidos / 10 aditivos / 3 suplementos / 8 grupos) — sin copiar nada al repo.** Barrido de privacidad limpio (git grep de términos identificantes = 0)                          |
| 2026-07-07 | Fase 2 completa: `design-system.md` v1 (paleta "cocina familiar" cálida, Fraunces+Nunito Sans, tokens semáforo AA con símbolo+texto, light-only S1), i18n propio sin librería (diccionarios tipados, paridad compile-time + test runtime con placeholders), 6 pantallas (/ Hoy checklist · /dieta con búsqueda "¿se puede?" · /dieta/[id] equivalencias · /suplementos semana · /cargar file+pegar · /ajustes). Estado localStorage↔React vía `useSyncExternalStore` (la regla `react-hooks/set-state-in-effect` del linter del kit vetó el patrón useEffect+setState → `src/lib/local-store.ts`). 65 tests verdes; build con 5 rutas estáticas + detalle dinámico; LCP nace estático en todas |
| 2026-07-07 | Fase 3 completa: PWA (manifest + 4 íconos generados con sharp `scripts/generate-icons.mjs` + SW mínimo cache-first solo estáticos, navegación siempre a red) y e2e 28/28 verdes (móvil Pixel 7 + desktop): happy path con clock mockeado (lunes 2026-07-06 → suplemento correcto; día siguiente → checklist amanece vacío), import inválido/válido, demo↔real, borrar datos, toggle ES/EN persistente, axe limpio en las 6 rutas + diálogo, checklist por teclado. Fixes del camino: disclaimer a `<footer>` (axe region), `--destructive` a 0.50 (AA 4.5:1), `devIndicators: false` (el badge dev de Next tapaba la nav móvil e interceptaba taps — fricción K6, solo dev)                    |
