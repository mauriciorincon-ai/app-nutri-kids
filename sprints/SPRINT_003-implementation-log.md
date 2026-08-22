# Sprint 003 — Bitácora de implementación · "El día completo" + cierre de ciclo fase 1

> Branch `sprint-003/el-dia-completo` (nace de `main` `4c7856d`, merge del PR #2 del S2).
> Registro vivo de progreso, decisiones, bugs y desviaciones. La planeadora es READ-ONLY —
> las desviaciones se anotan aquí y se avisan al usuario.

## Riesgos de integración con lo existente (kit v1.7.3 — leídos EN EL CÓDIGO)

Enumerados en el plan aprobado y confirmados en el código antes de la fase 1:

- **(a) e2e de "Hoy" del S1 asumen el layout/textos actuales.** `tests/e2e/happy-path.spec.ts`
  asevera `"Ya hiciste 1 de 10"`, checkboxes por nombre accesible (`/Multivitamínico demo/`,
  `/Vaso 1/`), `"Te falta:"` y el amanecer del martes. Añadir hora + chips de nota cambia
  accessible names y DOM. → **Regla 9:** la suite ENTERA de `happy-path` corre en la fase que
  toque "Hoy"; los asserts se adaptan solo donde el comportamiento cambió, jamás se borra
  cobertura de regresión.
- **(b) Claves nuevas de storage (precedente `chatIntroSeen`, S2).** Los e2e siembran
  `nutrikids.prefs.v1` con merge; `tests/unit/storage.test.ts` fija la forma de `Prefs` y del
  day-log. La clave nueva `nutrikids.daylog.v2` obliga a actualizar `clearAllData` (+ unit) y el
  e2e de "Borrar datos" para que cubra el registro. NO se toca `Prefs` (no hace falta pref nueva).
- **(c) El grounding del chat consume `logic.ts` — el registro NO debe filtrarse.** Hoy el payload
  a `/api/chat` es exactamente `{messages, diet, locale}` y `grounding.ts` es puro sobre
  `(diet, locale, date)`. → **Test negativo obligatorio (doble):** unit (nota centinela plantada
  en el registro jamás aparece en la serialización del grounding) + e2e (el body del POST tiene
  EXACTAMENTE `{messages, diet, locale}`, cero rastro del centinela).
- **(d) `useToday` fija la fecha a mediodía** (`T12:00:00`) — correcto para lógica por-día, inútil
  para "qué toca AHORA" (siempre diría la franja del almuerzo). → El recordatorio necesita un
  `useNow()` propio (tick por minuto + `visibilitychange`, mockeable con el clock de Playwright),
  acotado al componente del recordatorio para no re-renderizar todo "Hoy" cada minuto.
- **(e) LCP de "Hoy" nace estático y debe seguir así.** El bloque "Ahora toca / Sigue" depende de
  la hora real → nace como esqueleto estático pre-hidratación (mismo patrón de la tarjeta de
  suplementos), sin envolver el candidato LCP actual (patrón `lcp-nace-estatico`).
- **(f) `/suplementos` comparte el day-log.** El API v2 conserva `getDoneIds` (derivada de las
  marcas) — `/suplementos` sigue funcionando sin tocarlo; su e2e corre entero (regla 9).

## Desviación del plan (aviso a la planeadora)

1. **La orden dice "franja vigente desde `logic.ts` — ya existe". NO existe.** `logic.ts` no tiene
   resolutor de franja; lo que existe son los horarios `start`/`end` del menú en el schema. Este
   sprint crea `currentMealSlot`/`buildReminder` — es la extensión prevista, solo que parte de
   menos de lo que la orden asume. Sin impacto en alcance.
2. **La orden nombra `src/lib/local-store.ts` como lo que se extiende.** Ese archivo es el puente
   React↔localStorage (`useSyncExternalStore`). La persistencia real a extender es
   `src/lib/diet/day-log.ts` (+ `storage.ts` para "borrar datos"). Misma arquitectura, nombre
   distinto. Sin impacto en alcance.

## Fase 0 — Setup (deltas kit ×8 + carnada + branch) · COMPLETA

- Branch `sprint-003/el-dia-completo` creada desde `main` actualizado.
- **8 deltas del kit v1.1.5→v1.7.5 aplicados:**
  1. v1.6.2 gate de arranque → `.claude/commands/plan-sprint.md` (paso 7→7+8) + `CLAUDE.md`
     § Workflow (Apertura).
  2. v1.6.3/v1.7.3 carnada canónica PARTIDA → `CLAUDE.md` regla 7 (armada solo en archivo de
     prueba).
  3. v1.6.4 § e2e-BD-real → `testing-patterns.md` (documental: la app no tiene BD; ADR-007 lo
     ratifica).
  4. v1.7.1 bloque "Cierre de CICLO" → `CLAUDE.md` § Workflow (este sprint lo ejecuta).
  5. v1.7.2 anti-flakiness 6–8 + "Lighthouse solo páginas públicas" → `testing-patterns.md`.
  6. v1.7.3 regla 9 + § riesgos de integración → `testing-patterns.md` + `plan-sprint.md`.
  7. v1.7.4 humo de credenciales + mock de primera clase → `plan-sprint.md` fase 0 +
     `ia-embebida.md` §7/§8.
  8. v1.7.5 variante efímera de primera clase + notas AI SDK v7 → `ia-embebida.md` §2/§1 (el chat
     del S2 es el precedente, ADR-006). El skill local estaba atrás (solo §1–5 + checklist viejo);
     se sincronizó con la versión canónica v1.7.5 del kit — trae también §6/§7 y strict/import-type
     (v1.2.2) que nunca se habían aplicado a nutri-kids.
- **Prueba del hook gitleaks (carnada ARMADA):** carnada concatenada solo en archivo de prueba
  temporal (scratchpad) → `./githooks/pre-commit` la detectó (`leaks found: 1`, exit 1,
  "commit bloqueado"). Limpieza total, cero rastro en el repo. Hook vivo ✅ (K12 pagada `5e7850b`).
- **Humo de credenciales (v1.7.4):** `.env.local` NO existe → la GROQ_API_KEY no está configurada.
  Declarado: la validación real con Groq queda para el gate ⭐ acumulado (como anticipa la orden);
  el chat degrada a local honesto mientras tanto. Checklist de aprovisionamiento se re-emite en el
  PR con su humo (`curl …/models → 200`).

## Fase 1 — Motor (unit primero, todo puro con fecha inyectada) · COMPLETA

- **`src/lib/diet/day-log.ts` → schema v2** (`nutrikids.daylog.v2`): cada marca guarda
  `{ at: "HH:MM" | null }` (hora real, o null = desconocida); cada comida puede llevar
  `DayNote { chips, text }` (chips de vocabulario cerrado `rejected|pain|craving|other`, texto
  acotado a 140). API nueva: `getDayRecord`, `getMarkTime`, `getNote`, `markDone`, `unmark`,
  `setNote`, `listRecordedDays`. **API v1 preservada** (`getDoneIds`, `toggleDone`, `clearDayLog`,
  `DAY_LOG_KEY`) → `/suplementos` y "Hoy" siguen sin tocarse (riesgo f mitigado).
- **Migración v1→v2** al primer read: las marcas del S1/S2 entran con `at: null` (honesto), se
  escribe la v2 y se elimina la v1 (una sola fuente de verdad). Test desde el estado REAL de un
  usuario (`daylog.v1` sembrado). v1 corrupto ⇒ v2 fresco (fail-safe).
- **`src/lib/diet/logic.ts` — recordatorio determinista:** `clockLabel(date)` ("HH:MM" local);
  `currentMealSlot(diet, at)` → franja vigente/siguiente desde `start`/`end` del menú, cubre los 4
  casos incluidos los HUECOS entre franjas; `buildReminder(diet, at, doneIds)` → franja +
  suplementos del día pendientes + hidratación (target/done). Cero `Date.now()` — hora inyectada.
- **Tests:** +85 sobre el motor (logic + storage): migración, hora, notas (chips inválidos y cap
  de texto), historial descendente, franja ×5 tiempos, recordatorio ×7 días con reloj falso.
  **Suite unit: 146/146 verde; typecheck limpio.** Piso >80% de `lib/diet/` intacto.
- **Privacidad estructural:** `grounding.ts` sigue siendo puro sobre `(diet, locale, date)` — no
  importa `day-log`; el registro no tiene ruta al grounding por construcción (el test negativo de
  la fase 3 lo afirma).

## Fase 2 — UI (bilingüe en el mismo paso) · COMPLETA

- **"Hoy" extendida** (`src/app/page.tsx`): al marcar una comida se muestra la **hora real**
  ("Hecho · 12:35"; "Hecho" sin hora si es una marca migrada); `NoteEditor` por comida (chips
  rechazó/dolor/antojo/otro + texto corto, accesibles por teclado ≥44px); bloque
  **`ReminderCard`** ("Ahora mismo") con `aria-live="polite"` y esqueleto estático
  pre-hidratación (no envuelve el candidato LCP — patrón `lcp-nace-estatico`, riesgo e mitigado);
  enlace a `/historial`.
- **`useNow()`** (nuevo, en `use-today.ts`): instante vivo con HORA (tick 60 s +
  `visibilitychange`), aparte de `useToday` para no re-renderizar todo "Hoy" cada minuto; null
  pre-hidratación; mockeable con el clock de Playwright (riesgo d resuelto).
- **`useDayLog` extendido:** devuelve `record` (marcas con hora + notas) + `saveNote`; `toggle`
  registra la hora real vía `toggleDone` (default `new Date()` → mockeable). API previa intacta →
  `/suplementos` sin tocar.
- **`/historial`** (`src/app/historial/page.tsx`): lista solo-lectura por fecha descendente con
  horas reales y notas; estado vacío que invita; enlace de vuelta a "Hoy". Ruta pública, estática
  en el build.
- **Ajustes:** copy de "Borrar datos" ahora nombra explícitamente el registro (marcas, horas y
  notas) en ES/EN.
- **Observabilidad** (`src/lib/diet/day-events.ts`): eventos `registro_marcado` (solo la
  categoría meal/supplement/water) · `nota_agregada` (chipCount + hasText, JAMÁS los valores ni el
  texto) · `recordatorio_visto`. Cero contenido del registro.
- **Bilingüe:** claves nuevas en `es.ts` **y** `en.ts` en el mismo paso (secciones `reminder`,
  `history`, y `today`/`settings` extendidas). Paridad verde (test + tipo `Dictionary`).
- **Estado:** typecheck limpio · lint limpio · 148 unit/integration verde · build OK
  (`/historial` prerender estático). e2e y regla 9 → fase 3.

## Fase 3 — Integración + e2e · COMPLETA

- **`tests/e2e/registro.spec.ts` (nuevo, 4 tests):**
  1. **Flujo completo + CERO red:** marcar desayuno → "Hecho · hora" → nota (chip + texto) →
     recargar (persiste) → cambiar idioma (nada se pierde; el texto de la nota NO se traduce) →
     historial muestra el día con su nota. **Contador de red: 0 llamadas a `/api/*` y 0 a
     orígenes externos** en todo el flujo (garantía arquitectónica del registro local).
  2. **Recordatorio determinista** con hora inyectada (07:30 durante desayuno → "Es momento de
     Desayuno" + "Sigue: Media mañana"; 09:00 → "Un respiro entre comidas"; al marcar el
     suplemento → "ya está", sin reproche).
  3. **Migración v1→v2** desde el estado real de un usuario S1/S2 (clave `daylog.v1` sembrada):
     2 marcas migradas siguen (2 de 10), la v1 se elimina, la v2 queda; se sigue marcando encima.
  4. **Negativo del grounding (e2e):** con una nota centinela plantada en el registro, el POST a
     `/api/chat` lleva EXACTAMENTE `{messages, diet, locale}` y el centinela (nota + hora) no
     aparece en NINGUNA parte del payload.
- **Negativo del grounding (unit):** `grounding.test.ts` — `buildGroundedSystem` nunca contiene la
  nota/hora centinela del registro (minimización estructural, ADR-007). Doble red de seguridad.
- **Regla 9 (kit v1.7.3):** las suites ENTERAS de `happy-path`, `chat` y `a11y` corren en esta
  fase. Adaptados solo los asserts donde el comportamiento cambió legítimamente (el suplemento
  ahora aparece también en el recordatorio → los asserts de "Hoy" apuntan al checkbox del
  checklist, nombre accesible único). `/historial` añadido al gate axe.
- **Estado:** **54/54 e2e verde en móvil (Pixel 7) + desktop** · 149 unit/integration verde ·
  typecheck y lint limpios.

## Fase 4 — Calidad · COMPLETA

- **Microcopy sin culpa (gate nuevo `tests/unit/microcopy.test.ts`, 18 tests):** términos
  prohibidos (calorías/peso/IMC/percentil/kcal/BMI/weight) = 0 en ES y EN; tono no coercitivo en
  `reminder`/`history` (cero "olvidaste/no marcaste/deberías/forgot/failed…"); **frase-vs-métrica**
  del agua (el número de "Agua: N de M vasos" es el de vasos MARCADOS, no el objetivo — patrón
  `la-ci-verifica-comportamiento-no-experiencia`).
- **Lighthouse:** `/historial` añadido a `lighthouse-urls.json` (ruta pública). Budget LCP 4200;
  "Hoy" sigue estática de nacimiento; el bloque recordatorio es esqueleto pre-hidratación.
- **`/self-review` (staff engineer):** 2 nits arreglados — `next-env.d.ts` (churn del dev-server,
  restaurado a main; el build lo regenera) y aserciones `note!` en `note-editor` (narrado con
  `note &&`, sin non-null). Cero `console.log`/`TODO`/`any` en el código nuevo.
- **Verificación visual (autochequeo del builder):** capturas móviles de "Hoy" (recordatorio +
  "Hecho · hora" + nota) y `/historial` — coherentes con `design-system.md` (Fraunces, paleta
  cálida, símbolo+texto, disclaimer permanente, HOY tag). El gate visual ⭐ del usuario sigue
  pendiente (acumulado S1–S3).
- **`/deploy-check`:** todas las verificaciones automáticas verde (167 unit + 54 e2e, typecheck,
  lint, build, audit high limpio, axe). Cobertura app 97% / lib/diet 96%. Sin env vars nuevas.
  **NO MERGE aún:** faltan entregables de cierre (fase 5) + gate ⭐ del usuario.

## Fase 5 — Cierre de ciclo · COMPLETA (falta solo el gate ⭐ del usuario)

- **ADR-007** — registro local + minimización (local-only, ratifica ADR-001; el registro JAMÁS a
  red/repo/grounding; logs solo-metadatos; "borrar datos" lo cubre; migración v1→v2). `decisions/`.
- **MANUAL-DE-USO** — "Hoy" extendida (hora + nota), recordatorio "Ahora mismo", "Días anteriores";
  borrar datos nombra horas/notas; FAQ + fila de historial S3. Español llano para la mamá.
- **Kit de prueba** (`docs/kit-de-prueba/`): README + preguntas de calibración del chat + día de
  registro de ejemplo. La dieta real se entrega aparte (regla de privacidad: repo público).
- **Guía v1 ACUMULATIVA S1–S3** (`docs/GUIA-DE-PRUEBA.html`): HTML autocontenido (cero CDNs),
  **26 pruebas** con origen por línea (17 heredadas S1/S2 = regresión · 2 mejoradas · 7 nuevas S3),
  filtros (Todo 26 · Cambió en S3 9 · Gate mínimo ⭐ 6), `localStorage` versionado `s3`, paleta
  cálida de la app. Gate ⭐: Groq real (paga el diferido del S2) + migración en dispositivo real +
  PWA + recorrido de la mamá con dieta real + aprobación visual.
- **BLUEPRINT.html** — as-built de la fase 1: local-first sin BD (datos solo en el dispositivo),
  Vercel Hobby, Groq opcional (solo Camino B), CI con 3 checks, observabilidad Pino+Sentry, costo
  **US$0/mes**, punto único de falla = el dispositivo (por diseño de privacidad). SVG embebido,
  Supabase multi-cuidador punteado como fase 2.
- **`/design-sync`** — design system publicado en Claude Design (proyecto "Nutri-Kids — Design
  System", 6 tarjetas: overview, paleta, tipografía, StatusChip/ItemCard, ChecklistRow/DaySummary,
  ReminderCard/NoteEditor del S3). Cierra el gate visual diferido del S2 en su vía de publicación.
- **Verificación visual del builder:** capturas de "Hoy", `/historial`, guía y blueprint — todas
  coherentes con `design-system.md`. Aprobación visual del USUARIO = gate ⭐ (pendiente).

## Remate de auditoría de dos fases (v1.9.1) · COMPLETO — cazó 1 defecto latente

Recomendado al diferir el gate ⭐. Dos auditores adversariales en paralelo (privacidad · correctness),
fase encontrar → fase verificar-refutando. Igual que en habla S3, el remate justificó su costo:

- **BUG-S3-1 (confirmado, media severidad — ARREGLADO):** el recordatorio decía **"Suplemento de
  hoy: ya está"** en días SIN suplemento programado (jueves/domingo en la demo) — le afirmaba a la
  mamá un suplemento cumplido que ese día no existía (viola "sin culpa / honesto"). La cadena i18n
  correcta `reminder.noSupplement` existía pero **nunca se cableó**; el tipo `Reminder` no llevaba
  el conteo de suplementos PROGRAMADOS, así que la UI no distinguía "no toca ninguno" de "todos
  hechos". **Fix:** `buildReminder` expone `supplementsToday` (conteo programado); `reminder-card`
  usa tres estados (no toca / pendiente / hecho). **Regresión cubierta:** unit (jueves/domingo →
  `supplementsToday: 0`; la distinción de los 3 estados) + e2e (jueves → "Hoy no toca suplemento",
  jamás "ya está"). El caso solo se probaba en lunes antes; ~2 de cada 7 días afectados.
- **Obs. C (bajo/improbable — endurecido):** `NoteEditor` derivaba su estado de props sin re-sync;
  solo se desincroniza en el cruce de medianoche con la pestaña abierta. **Fix barato:** `key` por
  día en el `NoteEditor` → se remonta con la nota del día nuevo.
- **Obs. A y B (aceptadas, no alcanzables en uso forward-only):** coexistencia v1+v2 tras un
  **rollback de despliegue** S3→S2→S3 (marcas del rollback quedan huérfanas en v1) · v2 corrupto
  con v1 presente. Ninguna ocurre en avance normal (la migración escribe v2 y borra v1 atómicamente
  en la misma llamada síncrona); requieren manipulación externa del storage o un rollback de ops.
  Deuda defensiva declarada, no de fase 1 (app personal de un dispositivo).
- **Verificado como correcto por el remate:** migración v1→v2 sin pérdida (formato real confirmado
  en git), `getDoneIds` compat S1, `currentMealSlot` en TODOS los bordes horarios, `useNow`/
  `useToday` sin loops, y el invariante de privacidad de ADR-007 (cero caminos de fuga del registro
  a red/logs/grounding — auditados uno a uno).

**Estado final (pre-CI):** 168 unit/integration + 56 e2e verde · typecheck + lint limpios.

## PR #3 — CI y fix de Lighthouse

- PR #3 abierto (`sprint-003/el-dia-completo`). Primer run: **quality ✅ · e2e ✅ · Vercel ✅ ·
  lighthouse ❌** — CLS **0.170** en `/` (budget 0.1). Defecto de perf que introduje: el
  `ReminderCard` crecía de esqueleto (2 líneas) a contenido (~5) al hidratar, y los botones
  "Agregar nota" solo aparecían post-hidratación — ambos empujaban el contenido de abajo.
- **Fix:** `min-h-[8.75rem]` en el ReminderCard (reserva el estado lleno) + el `NoteEditor` se
  renderiza también en el prerender (reserva su altura; `saveNote` es no-op pre-hidratación).
  Medido con la API `layout-shift` (Pixel 7): CLS de `/` **0.0000**. 168 unit + 56 e2e siguen verde.
  Confirma el patrón `lcp-nace-estatico`/CLS: lo que aparece al hidratar reserva su espacio o
  la CI lo caza (el gate de perf hizo su trabajo).

## Fase 2 — correcciones de la auditoría final (revisión pre-cierre)

Auditoría de solo lectura con 4 revisores adversariales (correctitud · seguridad/privacidad ·
tests · diseño/deps) sobre `git diff main...HEAD`. Veredicto Fase 1: 0 Críticos, 6 Altos, 10 Medios,
12 Bajos; privacidad ESTRUCTURAL (el registro no puede llegar al grounding — grafo de imports +
doble test negativo). El usuario aprobó **corregir todo**. Resumen de lo aplicado (todo verificado:
198 unit + 60 e2e verde, typecheck/lint/build limpios):

**Altos**

- **A1 — comida contigua/solapada:** `currentMealSlot` calculaba "sigue" con `>` sobre el `end`;
  una comida con `start === end` previa se saltaba (invisible con la demo —tiene huecos— pero real
  con la dieta importada). Ahora la siguiente es `meals[indexOf(during)+1]`. + unit contiguo (07:00–
  08:00 · 08:00–09:00) que antes fallaba.
- **A2 — `day-events.ts` sin candado:** el módulo que sostiene "solo metadatos" (ADR-007) estaba al
  0% de cobertura y el gate global de 80% no lo delataba. Nuevo `tests/unit/day-events.test.ts`
  (centinela de texto/chips/id) → 100%. Si alguien añade el texto al payload, FALLA.
- **A3 — cruce de medianoche con la pestaña abierta:** `useToday` solo escuchaba `visibilitychange`
  → el día no rotaba solo y una marca a las 00:00:30 caía en el día anterior. `subscribeToDayChange`
  ahora tiene su propio `setInterval(60s)`; `toggle`/`saveNote` escriben al día REAL si se cruzó la
  medianoche. + e2e que avanza el reloj con `clock.fastForward` y verifica el amanecer sin reload.
- **A4 — hora real sin assert de valor:** el e2e afirmaba "Hecho ·" sin el valor. Ahora `/Hecho ·
7:30/` + unit con `vi.setSystemTime` para el camino por defecto de `toggleDone`.
- **A5 — localStorage hostil tumbaba el render:** un `at`/clave de día basura llegaba a `Intl` →
  RangeError (crash de Hoy//historial); `QuotaExceededError` en la migración reventaba el render en
  bucle. `coerceRecord`/`coerceStore` validan con regex y truncan al leer; `writeStore` devuelve
  bool y solo borra la v1 si la v2 quedó escrita; `storage()` y `format.ts` con guardas. + `it.each`
  de formas corruptas, quota, y precedencia v1+v2.
- **A6 — /historial mostraba ids crudos:** reimplementaba la resolución de rótulos y pintaba
  `meal:algo` si el id era de otra dieta. Nuevo motor: `parseCheckId`/`checkIdFor`/`resolveCheckTarget`
  (parte por el PRIMER `:`) + clave i18n `history.unknownItem`.

**Medios (10):** `Reminder.supplements` pasó a UNIÓN DISCRIMINADA (`none-today`/`pending`/`all-done`)
resuelta en el motor y consumida por un `switch` exhaustivo — el orden de ternarios ya no puede
mentir (raíz de BUG-S3-1) · `useNow`+`buildReminder` movidos DENTRO de `ReminderCard` (el tick por
minuto ya no re-renderiza todo "Hoy") · `listDayEntries` (orden del día, sin el centinela "99:99")
y `listRecordedEntries` (una sola lectura del store, O(días) en historial) en el motor · `NOTE_TEXT_MAX`
exportado (fin del duplicado motor/UI) · `NoteSummary`+`CHIP_I18N_KEY` compartidos (fin del mapa/join
gemelos) · foco gestionado en `NoteEditor` (Escape/Cancelar + retorno de foco) · `Dictionary`
re-exportado de `@/i18n` · contador de red por `context.route("**")` + `serviceWorkers:"block"` ·
axe sobre `/historial` CON contenido sembrado · bordes de franja (07:00/19:00/00:00/23:59) y
`dailyMenu` vacío en unit.

**Bajos:** `TodayBadge` (fin de la pastilla duplicada historial↔suplementos) · `aria-live` acotado
a la franja (fin del doble anuncio) · non-null asserts fuera de `logic.ts` · `<time dateTime>` ·
frase de agua assertada también en EN · guard del init-script de migración · sync PWA+pestaña por
listener `storage` en `local-store.ts` · `schema.ts` endurece `timeSchema` (rango válido) + exige
`end ≥ start` por comida. Registro en `design-system.md`: eyebrow-heading + altura de reserva CLS.

## Desviación del plan — parche de seguridad (dep transitiva)

Al verificar el gate de seguridad surgió un advisory **nuevo** (posterior al audit verde del sprint):
`brace-expansion <1.1.16` — ReDoS **GHSA-3jxr-9vmj-r5cp** (severidad **high**). Entra SOLO
transitivamente por la cadena de `eslint` (devDependency; `minimatch@3 → brace-expansion@1.1.x`),
no se envía al usuario, y estaba igual en `main` (cero deps nuevas en el sprint). Como el CI
gatea con `pnpm audit --audit-level high` (ci.yml:23), habría puesto rojo el próximo run. **Fix:**
`overrides` en `pnpm-workspace.yaml` fijando `brace-expansion@<1.1.16 → ^1.1.16` (se mantiene en la
línea 1.x, compatible con `minimatch@3`; se evitó `>=1.1.16` porque pnpm resolvía a 5.0.7, un salto
mayor). No es dependencia nueva: es un pin de seguridad de una transitiva ya presente. `audit --high`
queda limpio (solo persiste el postcss moderate, deuda ya declarada); lint/tests siguen verde.

**Estado final (pre-CI):** 198 unit/integration + 60 e2e (móvil + desktop) verde · typecheck · lint ·
build · `audit --high` limpio · cobertura lib/diet 97% (day-events 100%).
