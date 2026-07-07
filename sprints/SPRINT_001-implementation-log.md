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
| K5  | gitleaks no está instalado en la máquina (nota de la propia orden) — el hook PreToolUse falla silencioso (`2>/dev/null`, exit 0)                                                                                  | El gate de secrets NO protege hasta instalarlo                        | Tarea del usuario: `winget install Gitleaks.Gitleaks`   |

## Decisiones (ADRs por tema — se formalizan en `decisions/`)

- Almacenamiento local → localStorage con claves versionadas tras wrapper tipado (ADR pendiente).
- i18n → diccionarios TS tipados sin librería, ES default (ADR pendiente).
- PWA → manifest + íconos + SW mínimo a mano (ADR pendiente).

## Desviación del plan

_(ninguna hasta ahora)_

## Cronología

| Fecha      | Evento                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-07 | Branch `sprint-001/dieta-viva-y-hoy` creado; plan aprobado; Fase 0 iniciada                                                                                                                                                                                                                                                                                                |
| 2026-07-07 | Fase 0 completa: vitest/playwright configs (K1), shadcn/ui init (preset nova/radix), `@sentry/nextjs` cableado (K2, DSN por env), logger Pino, smoke tests. `typecheck+lint+test+build` verdes en local. Cobertura scoped a `src/lib/diet/**` umbral 80 (utils/log del kit se cubren vía e2e). `@sentry/cli` aprobado en `pnpm-workspace.yaml` (patrón allowBuilds v1.1.3) |
