# Sprint 004 — bitácora de implementación (Nutrikids)

Rama `sprint-004/dieta-sin-internet` · orden: `SPRINT_004.md` (planeadora) · G-Plan aprobado 2026-11-15.

## Desviación del plan
- El «copiloto» no existe como código (0 coincidencias en `src/` y `docs/`): la VISION:52 lo define como «no quiso desayunar, ¿qué hago dentro del plan?». Se cubre con el patrón «no quiso X» de F2.
- `app.ciclo` del export estaba en `"fase-1"` (la devolución 026 decía «H-1»); queda `"H-2"`.
- La tabla de patrones del chat vive en `src/lib/diet/answer.ts`, no en el schema (el schema no se toca hasta S5).
- El copy de la planeadora para F10–F13 y `privacidad` describe un asistente de IA con red. Se adopta tal cual en F1 (devolución 026) y se reescribe en F3 con el comportamiento real (código primero, sin red) — la planeadora lo ve en el cierre.
- Variables del chat a quitar en Vercel (lo hace la planeadora): `CHAT_PROVIDER`, `CHAT_ENABLED`, `NEXT_PUBLIC_CHAT_ENABLED`, `CHAT_MODEL`, `GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AZURE_RESOURCE_NAME`, `AZURE_API_KEY`, `ANTHROPIC_API_KEY`, `CHAT_BASE_URL`.

## F1 — el núcleo y la limpieza
- `CLAUDE.md` = `ordenes/CLAUDE-md-para-app.md` (`cmp` = 0; centinela «el plan vivo, y en casa» presente). La constitución v1 anterior vive entera en `docs/REGLAS-ANEXO.md` § «Nutrikids».
- Piezas del kit v2.4.0: `scripts/{horas-sprint,cero-enlaces,verificar-dependencias}.mjs`, `scripts/demo-rojo.sh` (100755), `scripts/degradaciones-permitidas.json`, `cero-enlaces.json` (incluye `vercel.app`), `.github/workflows/un-pr-vivo.yml`, comandos v2 (`audita-sprint`, `design-sync`, `release-check` nuevos; `deploy-check`, `plan-sprint`, `run-tests` actualizados) y sus tres pruebas unitarias.
- CI: pasos `verificar-dependencias` (solo PR) y `cero-enlaces` en `quality`; evidencia de e2e subida si falla.
- Puertos: `dev` y `start` con `-H 127.0.0.1 -p 3600`; Playwright `E2E_PORT ?? 3600` en `127.0.0.1`; `lighthouse-urls.json` y README alineados.
- Devolución 026: (1) export con el copy de la planeadora · (2) `BROCHURE.html` sin «Tu dieta, adentro» ni «texturas», con los nombres y líneas de grupo nuevos · (3) `app.ciclo: "H-2"` · (4) fecha y sha de cada métrica: se re-miden en F3 (los valores cambian al retirar la IA) · (5) la demo no caduca: `src/lib/diet/demo.ts` corre la ventana a la fecha del aparato (−30/+60 días) + `tests/unit/demo-aging.test.ts` en 7 fechas (regla 23) · (6) Chromium rev. 1228 ya estaba instalado (`~/Library/Caches/ms-playwright`); sin acción · (7) «Nutrikids» en ES/EN, layout, manifest, docs y `global-setup`.
- Verde local: typecheck, lint, vitest 238/238, e2e (CI=1, `next start` en 127.0.0.1:3600).

### Demo en rojo (regla 15/27) — `cero-enlaces`
- Archivo `README.md`, mutación: añadir un dominio `.vercel.app` al final de la línea 1 → el gate falló nombrando `README.md:1`, restauró y volvió a verde (`scripts/demo-rojo.sh`).

### Fricción del kit / del entorno
- Las pruebas del kit (`cero-enlaces`, `horas-sprint`, `verificar-dependencias`) asumen entorno `node`; la app corre vitest en jsdom → hizo falta `// @vitest-environment node` en cada una y un guard `typeof window` en `tests/setup.ts`.
- `sed -i` de BSD (macOS) exige sufijo: los cambios por script se hacen con python.

## F2 — el chat que contesta
- Motor `answerOpen(question, diet, now, lang)` en `src/lib/diet/answer.ts` + `answerQuestion` como única puerta (guardrail → abierta → lookup → «tu plan no lo dice»). Tabla `INTENT_PATTERNS` {es, en} con precedencia rechazo > reemplazo > agua > menú; coincidencia por tokens («aguacate» ≠ «agua») y por tronco para comidas. Redacción en `answer-text.ts` con plantillas `t.answer` (i18n ES/EN).
- Retirados: `ai` y `@ai-sdk/*` (7 paquetes), `src/app/api/chat/route.ts`, `src/lib/ia/{provider,grounding}.ts`, `src/lib/rate-limit.ts`, 4 tests, las variables `CHAT_*` de `.env.example` y `playwright.config.ts`. `guardrails.ts` pasa a `src/lib/diet/`.
- Acento opcional del aparato: `src/lib/ia/device-accent.ts` (Prompt API `LanguageModel`, solo si `availability() === "available"`; esquema Zod por frase; 4 s de tope). Sin modelo, responde el código.
- UI: `AnswerCard` + hilo sin red (`use-chat-thread.ts` sin `fetch`), estados «disabled/error» retirados, ajustes y nota del chat con el copy nuevo.
- ADR-008 «chat code-first» (reemplaza al 004; 005 superado, 006 vigente en no-persistencia).
- Verde local: typecheck, lint, vitest 279/279 (cobertura líneas 99 %), e2e 96/96 con `CI=1`.

### Bugs hallados por la e2e (resueltos en la fase)
- «¿Qué le doy ahora?» respondía con la franja equivocada: el hilo usaba `useToday()` (mediodía fijo). Ahora lee la hora del envío (`now` inyectable).
- axe: `<div>` dentro de `<ol>` (ancla de scroll, venía del S2) y salto de encabezados h1→h3 en la tarjeta de veredicto (venía del S2; axe solo auditaba el chat vacío). Ancla fuera de la lista, h2 en la tarjeta.

### Demo en rojo (regla 15/27) — `tests/unit/no-cloud-ai.test.ts`
- Archivo `package.json`, mutación: añadir `"@ai-sdk/groq"` a dependencias → el gate falló nombrando `@ai-sdk/groq`, restauró y volvió a verde (3 pruebas).

## F3 — sin señal y cierre
- Service worker (ADR-003 revisado): `scripts/sw.template.js` + `scripts/build-sw.mjs` (en `prebuild` y `dev`) estampan `public/sw.js` (ahora ignorado por git) con un id de versión por build y la lista de las 8 pantallas. Precache en la instalación del HTML de cada pantalla y de los `/_next/static/*` que referencia; navegación red-primero con respaldo de caché (3 s de tope si hay copia); `/dieta/<id>` sin visita previa lleva a `/dieta`.
- Versión nueva: el SW nuevo espera (sin `skipWaiting` al instalar); `SwRegister` muestra «Hay una versión nueva» con Actualizar / Ahora no; solo al aceptar manda `SKIP_WAITING` y recarga UNA vez. Textos `t.update` ES/EN.
- e2e `tests/e2e/offline.spec.ts` (solo con `CI=1`, el SW solo existe en producción): apaga la red tras una visita, abre las 7 pantallas, usa el chat y el detalle no visitado; el aviso de versión (ES, EN, «Ahora no», «Actualizar») y axe con el aviso en tema light y dark. El «deploy nuevo» se simula registrando `/sw.js?v=…` (context.route no intercepta el script del SW). Gate de contrato (regla 19) en `tests/unit/build-sw.test.ts`.
- Bug destapado por la e2e: Chromium headless tumbaba el renderizador si una consulta `LanguageModel.availability()` estaba en vuelo durante una navegación (13 de 40 corridas). Ahora se pregunta una vez por página e idioma, se recuerda y el chat la calienta al abrirse (50/50 y 96/96 después).
- Lighthouse: `lhci` local da NO_FCP en este Mac (entorno); con `lighthouse` directo sobre `next start`: FCP ≈ 0,76 s, LCP ≈ 0,76 s, TBT ≤ 42 ms, CLS 0, script ≤ 327 KB, total ≤ 444 KB en `/`, `/dieta`, `/chat`, `/historial` y `/conoce` — dentro de `perf-budget.json` (el JS del chat bajó al quitar el AI SDK).
- Docs: manual (chat reescrito, «Usar la app sin internet», historial S4), guía de prueba v2 (bloque F del chat, nuevo bloque J, NS `s4`, S3 pasa a regresión), BLUEPRINT (sin Groq ni `/api/chat`, SW, CI), BROCHURE (tarjeta del chat, garantía, instalación), export (F11, F13, F17, stack, privacidad), kit de prueba.
- Tema oscuro: la app no tiene tema oscuro propio (solo la clase `.dark` de shadcn); axe «dark» corre con `emulateMedia({colorScheme})` y sirve de guardia si algún día lo hay.

### Demo en rojo (regla 15/27) — `tests/unit/build-sw.test.ts`
- Archivo `scripts/build-sw.mjs`, mutación: quitar `/historial` de `SHELL_ROUTES` → el gate falló nombrando «precachea el cascarón de TODAS las pantallas», restauró y volvió a verde (5 pruebas).
