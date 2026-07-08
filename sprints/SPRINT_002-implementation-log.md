---
sprint: 002
app: nutri-kids
branch: sprint-002/habla-con-tu-dieta
opened: 2026-07-07
---

# Sprint 002 — Bitácora de implementación · "Habla con tu dieta"

> Orden: `portafolio/nutri-kids/ordenes/SPRINT_002-orden.md` (planeadora, READ-ONLY).
> Plan aprobado por el usuario el 2026-07-07 (plan mode). Arquitectura de dos caminos: el Camino A
> ("¿X se puede?") es 100% local (motor `search.ts`, sin LLM, sin red); el Camino B (preguntas
> abiertas) usa el LLM vía adapter env-switchable. "Offline" = solo el Camino A; el B degrada con
> honestidad si no hay proveedor/red.

## Verificación de supuestos del kit (obligatoria — G-Metodo 2026-07-07)

Repo estampado con kit v1.1.5; K1–K6 ya resueltos en S1. Verificado en la apertura del S2:

| Supuesto                                                       | Estado en este repo                       |
| -------------------------------------------------------------- | ----------------------------------------- |
| `vitest.config.ts` / `playwright.config.ts` / `tests/setup.ts` | ✅ existen (creados en S1)                |
| Sentry cableado (instrumentation + env)                        | ✅ `instrumentation*.ts`, DSN por env     |
| `devIndicators: false`                                         | ✅ en `next.config.ts`                    |
| hook gitleaks                                                  | ✅ activo (0 leaks en cada commit del S1) |
| `lighthouse-urls.json`                                         | ❌ **NO existía** — ver fricción K8       |

## Fricción del kit (⭐ separada del producto)

| #   | Fricción                                                                                                                                                                                                                                                                                                                           | Impacto                                                               | Acción en este sprint                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K8  | La orden asume `lighthouse-urls.json` (patrón kit v1.2.0) pero este repo se estampó con v1.1.5: las URLs de Lighthouse están hardcodeadas en `ci.yml`                                                                                                                                                                              | Añadir `/chat` exigía editar YAML, no un JSON                         | Crear `lighthouse-urls.json` y hacer que `ci.yml` lo lea con `jq`                                                                                             |
| K9  | AI SDK v7 (`ai@7`) tiene puntas afiladas no documentadas en la orden: `convertToModelMessages` es **async** (hay que `await`); el mock de `ai/test` exige `{type:"stream-start",warnings:[]}` como primer chunk o el stream sale vacío; `LanguageModelV4StreamPart`/`Usage` no se exportan (usage con shape `{total,noCache,...}`) | ~40 min verificando el API real del SDK antes de escribir el provider | Verificación empírica con script throwaway; cast localizado anclado al tipo del constructor del mock (no `any`). Candidato a nota del kit/skill `ia-embebida` |

## Decisiones (ADRs por tema — se formalizan en `decisions/`)

- Proveedor LLM + adapter env-switchable (Vercel AI SDK) — ADR pendiente (re-verificar precios Groq).
- Estrategia de grounding (serialización compacta mono-idioma) — ADR pendiente (medir tokens).
- Privacidad del chat (no-persistencia, logs solo-metadatos) — ADR pendiente.

## Desviación del plan

- **UI del chat con `fetch` + parseo SSE manual en vez de `useChat` (`@ai-sdk/react`).**
  El plan (Fase 3) y la orden mencionaban `useChat`. Se optó por un hilo unificado propio
  (`use-chat-thread.ts`) que intercala veredictos locales (Camino A) y respuestas del LLM
  (Camino B) en una sola conversación, con control exacto de cuándo se llama a `/api/chat` (los
  lookups NUNCA lo llaman — clave para el acceptance criterion "cero requests al LLM" y para el
  e2e). Mezclar tarjetas de veredicto locales dentro de la lista de mensajes que administra
  `useChat` habría sido más frágil. El formato del stream (UIMessageStream SSE del servidor) se
  parsea leyendo los `text-delta` — verificado contra la salida real de `toUIMessageStreamResponse`.
  `@ai-sdk/react` queda instalado por si S3 lo necesita. Sin impacto en la DoD.

## Cronología

| Fecha      | Evento                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-07 | Branch `sprint-002/habla-con-tu-dieta` creado; plan aprobado (arquitectura de dos caminos aclarada con el usuario). Fase 0 iniciada: deps del AI SDK (`ai` + `@ai-sdk/{react,groq,google,azure,anthropic,openai-compatible}`), `.env.example` con bloque chat, `lighthouse-urls.json` (K8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-07-07 | Fase 1 completa: `src/lib/diet/search.ts` — motor LOCAL del Camino A ("¿X se puede?"). Normaliza acentos/mayúsculas/plurales simples, distingue lookup de pregunta abierta (patrones open → null → LLM), matchea alimentos por id (reusa `resolveItemStatus`) y aditivos por nombre O código E-*, desambigua por nombre más largo. 16 tests unit verdes (ES/EN, acentos, plurales, vigencia activa/vencida, desambiguación, negativos). Cobertura `search.ts` 100%. NO se tocó el motor S1                                                                                                                                                                                                                                                                                                                                     |
| 2026-07-07 | Fase 2 completa: capa IA del Camino B. `provider.ts` (adapter env-switchable groq/gemini/azure/anthropic/openai-compatible/mock; `mock` determinístico locale-aware sin red), `grounding.ts` (serialización compacta mono-idioma + contexto del día + system prompt estricto bilingüe), `guardrails.ts` (pre-filtros sin tokens con frontera consulta-vs-cambio médico), `rate-limit.ts` (por IP, ventana en memoria), `src/app/api/chat/route.ts` (kill-switch → rate limit → validación zod → guardrails → `streamText`, logs SOLO metadatos). Fricción K9 del AI SDK v7 resuelta con verificación empírica. Gate de cobertura extendido a `src/lib/ia/**` (100% líneas). 117 tests verdes; test de privacidad confirma que los logs jamás llevan la pregunta/respuesta; test de conmutación por env cubre los 6 proveedores |
| 2026-07-07 | Fase 3 completa: UI de `/chat`. `use-chat-thread.ts` (hilo unificado efímero, enruta Camino A/B, ver Desviación del plan), `chat-panel.tsx` (input, hilo con `aria-live`, 6 estados: vacío+sugerencias/veredicto/streaming/error/rechazo/apagado), `verdict-card.tsx` (reusa StatusChip), `chat-intro.tsx` (nota de transparencia IA estática, patrón overlay del S1 con pre-paint hide). Nav a 6 pestañas (+`/chat`), sección "Asistente IA" en Ajustes, i18n ES/EN en el mismo paso (paridad verde). Prefs += `chatIntroSeen`. Build: `/chat` prerenderiza estático (LCP-seguro), `/api/chat` como función. Smoke prod OK: lookup local sin red, pregunta abierta streamea el mock grounded, rechazo médico con header `x-chat-outcome`                                                                                      |
