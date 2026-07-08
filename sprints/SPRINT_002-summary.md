---
sprint: 002
app: nutri-kids
status: ready-to-close # pasa a "closed" cuando el usuario configure Groq, apruebe la preview y mergee
opened: 2026-07-07
closed: pendiente-de-merge
branch: sprint-002/habla-con-tu-dieta
pr: pendiente-de-abrir
---

# Sprint 002 Summary — Nutri-Kids · "Habla con tu dieta"

## Outcome

**Sí (pendiente de validación del usuario con Groq real + gate visual).** Los 3 outcomes del
SPRINT_002.md están construidos y verificados por tests con el provider `mock`:

1. **Principal:** en `/chat`, "¿X se puede?" devuelve una **tarjeta de veredicto local** (semáforo
   - por qué + vigencia + reemplazos) **al instante, sin red y sin LLM** (Camino A, motor
     `search.ts`); y una **pregunta abierta** recibe respuesta **grounded en la dieta cargada**, en
     streaming, en el idioma de la UI, recomendando solo lo que el plan autoriza (Camino B, LLM).
2. **Secundario (resiliencia honesta):** kill-switch, proveedor caído o sin red ⇒ el chat
   **degrada, no muere**: el Camino A sigue y un aviso claro explica el límite. Off-topic y
   consejo médico se **rechazan con redirección** sin gastar tokens.
3. **Terciario (estándar 7 estrenado):** proveedor **conmutable por env** (Groq inicial), rate
   limit, tope de tokens, kill-switch, degradación → local, **cero contenido en logs**,
   conversación **no persistida**, y **nota de transparencia IA** visible.

## Qué se construyó

- **Camino A — motor local** (`src/lib/diet/search.ts`): normaliza acentos/mayúsculas/plurales,
  distingue lookup de pregunta abierta, matchea alimentos (reusa `resolveItemStatus` del S1) y
  aditivos E-*, desambigua por nombre más largo. Cero red.
- **Camino B — capa IA** (`src/lib/ia/`): `provider.ts` (adapter env-switchable
  groq/gemini/azure/anthropic/openai-compatible/**mock**), `grounding.ts` (serialización compacta
  mono-idioma + contexto del día + system prompt estricto bilingüe), `guardrails.ts` (pre-filtros
  sin tokens, frontera consulta-vs-cambio médico). `src/lib/rate-limit.ts` (por IP).
- **Route** `src/app/api/chat/route.ts`: kill-switch → rate limit → validación zod → guardrails →
  `streamText`; logs **solo metadatos**.
- **UI** `/chat`: hilo unificado efímero (`use-chat-thread.ts`), 6 estados
  (vacío+sugerencias/veredicto/streaming/error/rechazo/apagado), `VerdictCard` (reusa StatusChip),
  nota de transparencia IA estática (patrón overlay del S1). 6ª pestaña en la nav, sección
  "Asistente IA" en Ajustes, i18n ES/EN en el mismo paso.

## DoD — checklist (6+1)

| Estándar            | Estado | Evidencia                                                                                                                                                                            |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Testing             | ✅     | 118 unit + 44 e2e (móvil/desktop). Camino A 100% cobertura; capa IA `lib/ia` 100% líneas. e2e con `mock`: lookup sin red, stream grounded, rechazo, kill-switch, no-persistencia, EN |
| CI/CD               | ⏳     | Verde en local (typecheck/lint/test/build/audit/e2e); **CI del PR pendiente de abrir** + preview a probar en teléfono                                                                |
| Observabilidad      | ✅     | Logs Pino **solo-metadatos** (test inyecta término secreto y confirma que no aparece); errores del route a Sentry; tokens por request loggeados                                      |
| Seguridad           | ✅     | `pnpm audit --audit-level high` PASS (1 moderate postcss = deuda S1); **rate limiting en `/api/chat`**; cero secrets; gitleaks activo; input capado                                  |
| Performance         | ✅     | `/chat` LCP 3766 ms < 4200; FCP 756 ms; TBT 62 ms; CLS 0; script 320 KB < 380; total 439 KB < 1000. `/chat` prerenderiza estático (LCP-seguro)                                       |
| UX/A11y             | ✅     | axe limpio en `/chat` (+ overlay de transparencia); `aria-live` en el hilo; táctil ≥44px; teclado; semáforo símbolo+texto (StatusChip)                                               |
| **IA embebida (7)** | ✅     | Ver nota de adaptación abajo — guardrails I/O, system prompt server-side, costo loggeado, mock en CI, 3 ADRs. **Sin persistencia por diseño**                                        |
| Manual de uso       | ✅     | `docs/MANUAL-DE-USO.md` += "Pregúntale a la dieta" (qué puede, qué no, ejemplos, español llano)                                                                                      |
| Revisión de diseño  | ⏳     | Extiende `design-system.md` del S1 (StatusChip reusado); **gate visual del usuario sobre la preview pendiente**                                                                      |

### Estándar 7 — adaptación declarada (skill `ia-embebida`)

El skill asume que la salida del LLM **se persiste** (`schemas.ts`/`persist.ts` → filas en BD). En
esta app la decisión de privacidad (datos de un menor, [[006-chat-privacy]]) es **no persistir
nada**: la respuesta es texto conversacional efímero. Por eso `schemas.ts`/`persist.ts` **no
aplican** (declarado, no omitido). Lo que sí se cumple: el **request** se valida con zod
(`dietPlanSchema`), guardrails de input activos, system prompt server-side, costo (tokens) por
request en el log, y `mock` determinístico en CI (jamás API real). El adapter conmutable por env
es el patrón `lib/ia/` adaptado a salida efímera.

## Métricas técnicas

- Lookup "¿la manzana se puede?" → veredicto local **con cero requests a `/api/chat`** (e2e lo
  afirma con contador de red). Grounding medido: **~730 tokens** (demo ES) → ~3K tokens/request
  con pregunta+salida ⇒ ~30 preguntas/día bajo el free tier de Groq (100K TPD, verificado 2026-07).
- Conmutación de proveedor por env cubierta por test (6 proveedores). Paridad ES/EN 100% (test).
- Conversación no-persistida verificada por e2e (recarga ⇒ hilo vacío). Logs sin contenido (test).

## Decisiones no anticipadas

- **ADR 004** proveedor LLM + adapter (Vercel AI SDK; Groq inicial, límites re-verificados a la fecha).
- **ADR 005** grounding: serialización compacta mono-idioma (tokens medidos; retrieval = plan B).
- **ADR 006** privacidad del chat (no-persistencia, logs solo-metadatos, minimización).
- **Desviación del plan:** UI con `fetch` + parseo SSE manual en vez de `useChat` (hilo unificado
  que intercala veredictos locales y respuestas LLM; control exacto de cuándo se llama al LLM).
  Detalle en la bitácora § Desviación del plan. Sin impacto en la DoD.

## Bugs + resoluciones

1. **AI SDK v7 (K9):** `convertToModelMessages` es async; el mock exige `stream-start` como primer
   chunk; tipos `StreamPart`/`Usage` no exportados → verificación empírica + cast localizado
   anclado al tipo del constructor del mock (no `any`).
2. Rechazo médico: el texto ES dice "pediatra o nutricionista" (no "profesional") → aserción e2e
   ajustada.
3. `chatIntroSeen` nuevo en `Prefs` rompió 2 tests de storage → actualizados.

## Qué salió bien / qué generó fricción

**Bien:** reusar `resolveItemStatus`/StatusChip del S1 hizo el Camino A y la VerdictCard casi
gratis; el mock determinístico locale-aware permitió e2e completos sin red ni costo; separar
Camino A (local) de B (LLM) hace el criterio "cero requests al LLM" trivial de verificar.

**Fricción del kit / SDK:**

- **K8:** este repo (kit v1.1.5) no tenía `lighthouse-urls.json` que la orden asume (v1.2.0) → se
  creó y `ci.yml` lo lee con `jq`.
- **K9:** puntas afiladas no documentadas del AI SDK v7 (ver Bugs 1) — candidato a nota del kit /
  skill `ia-embebida` con el patrón verificado (`await convertToModelMessages`, `stream-start`).

## Sugerencias de mejora al método

1. El skill `ia-embebida` asume persistencia de la salida LLM; debería contemplar el caso
   **salida efímera / no-persistida** (chats de privacidad alta) como variante de primera clase,
   con su propio checklist (guardrails + no-persistencia + logs solo-metadatos) en vez de forzar
   `schemas.ts`/`persist.ts` como N/A.
2. El kit debería estampar `lighthouse-urls.json` (K8) y una nota del patrón AI SDK v7 (K9:
   `convertToModelMessages` async, `stream-start`, tipos no exportados) para no re-descubrirlo.

## Deuda técnica aceptada

- **Rate-limit in-memory por instancia** (no global): suficiente para volumen familiar; KV/Upstash
  para volumen real (S3+). Documentado en ADR 004/006.
- **1 moderate `pnpm audit`** (postcss vía Next, build-time) — heredada del S1, se paga al subir Next.
- **Sin historial de conversación** (decisión de privacidad, no bug — ADR 006).
- Groq free tier (~100K TPD) monitoreado con logs; si se supera, tier pago o rotar proveedor por env.

## Archivos clave (máx. 10)

1. `src/lib/diet/search.ts` (Camino A) · 2. `src/lib/ia/provider.ts` · 3. `src/lib/ia/grounding.ts`
   · 4. `src/lib/ia/guardrails.ts` · 5. `src/app/api/chat/route.ts` · 6.
   `src/components/chat/use-chat-thread.ts` · 7. `src/components/chat/chat-panel.tsx` · 8.
   `src/components/chat/verdict-card.tsx` · 9. `tests/e2e/chat.spec.ts` · 10. `decisions/004-006`.

## Cómo probar

- **Local con mock (sin cuenta):** `pnpm dev` → `/chat` → "¿la manzana se puede?" (tarjeta roja
  instantánea, DevTools: 0 llamadas a `/api/chat`) → "no tengo pollo, ¿qué le doy?" (streaming del
  mock). `pnpm test` · `pnpm test:e2e`.
- **Con Groq real:** `GROQ_API_KEY` + `CHAT_PROVIDER=groq` + `CHAT_ENABLED=true` en `.env.local` →
  la misma pregunta abierta responde solo-plan; probar rechazos y kill-switch (`CHAT_ENABLED=false`).
- **Preview:** tras configurar Groq en Vercel, la mamá pregunta de verdad con la dieta real importada.
