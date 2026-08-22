---
sprint: 003
app: nutri-kids
status: closed
opened: 2026-07-20
closed: 2026-07-20
branch: sprint-003/el-dia-completo
pr: https://github.com/mauriciorincon-ai/app-nutri-kids/pull/3
---

# Sprint 003 Summary — Nutri-Kids

> **Último sprint del ciclo fase 1 (CIERRE DE CICLO)** y último de construcción de la cola F0 #6.
> Los deliverables del builder están completos; **el merge queda gated por el gate ⭐ ACUMULADO
> S1–S3 del usuario** (Groq real + prueba de la mamá con la dieta real + PWA), única vía de cierre
> del ciclo — momento pausable, jamás diferible.

## Outcome

**Sí (3/3), con el gate ⭐ del usuario pendiente.** O1 registro rápido REAL (hora + nota, cero red,
migración sin pérdida) ✅ · O2 recordatorio determinista (qué toca ahora/sigue, sin push) ✅ · O3
ciclo fase 1 cerrado (guía v1 acumulativa + BLUEPRINT + design-sync + summary → gate ⭐) ✅ construido.
Con el gate ⭐ del usuario, el **MVP personal de un dispositivo queda COMPLETO**.

## Qué se construyó

- **Registro del día v2** (`lib/diet/day-log.ts`): cada marca guarda la **hora real** (`at:"HH:MM"`);
  cada comida una **nota corta** (chips rechazó/dolor/antojo/otro + texto acotado). Migración
  automática v1→v2 sin perder marcas. API v1 preservada → `/suplementos` y "Hoy" intactos.
- **Recordatorio determinista** (`lib/diet/logic.ts`): `currentMealSlot` (franja vigente/siguiente,
  4 casos incl. huecos) + `buildReminder` (franja + suplementos del día + hidratación). Reloj
  inyectable, cero `Date.now()`.
- **"Hoy" extendida** + `ReminderCard` ("Ahora mismo", `aria-live`, esqueleto pre-hidratación) +
  `NoteEditor` (chips + texto, teclado, ≥44px). **`/historial`** (días anteriores, solo lectura).
  Ajustes: "borrar datos" cubre el registro. Bilingüe ES/EN en el mismo paso.
- **Cierre de ciclo:** ADR-007, MANUAL, kit de prueba, **guía v1 ACUMULATIVA S1–S3**, BLUEPRINT.html,
  design system publicado en Claude Design. **8 deltas del kit v1.6.2→v1.7.5** aplicados.

## DoD — checklist (6+1)

- [x] **Testing:** 198 unit/integration + 60 e2e (móvil Pixel 7 + desktop) verde. Registro
      (guardar/hora/nota/migración desde estado real S1/S2), recordatorio ×7 días con reloj falso +
      bordes de franja y menú vacío, coerción fail-safe ante store hostil, cruce de medianoche,
      paridad ES/EN, **cero requests de red** en el flujo (contador `context.route`), **regla 9**
      (suites enteras de Hoy/chat/a11y). Cobertura `lib/diet` 97% (day-events 100%) / app 97%.
- [x] **CI/CD:** pipeline verde esperado (quality/e2e/lighthouse); sin jobs nuevos (ruleset intacta).
      `/historial` añadida a `lighthouse-urls.json`.
- [x] **Observabilidad:** eventos `registro_marcado`/`nota_agregada`/`recordatorio_visto` SOLO
      metadatos (jamás el texto de la nota — test con centinela). Sentry sin contenido del registro.
- [x] **Seguridad:** cero red en el registro (garantía arquitectónica por e2e); gitleaks vivo
      (carnada PARTIDA probada); `pnpm audit --audit-level high` limpio (1 moderate postcss, deuda
      declarada; el high `brace-expansion` GHSA-3jxr-9vmj-r5cp se parcheó por override). Test
      negativo del grounding (doble: unit + e2e).
- [x] **Performance:** "Hoy" sigue estática de nacimiento; el recordatorio nace esqueleto
      pre-hidratación (patrón `lcp-nace-estatico`); budget LCP 4200 sin cambios.
- [x] **UX/A11y:** axe AA en 8 rutas incl. `/historial`; chips por teclado; `aria-live` en el
      recordatorio; **microcopy sin culpa verificado** (gate de términos prohibidos + no-coerción +
      frase-vs-métrica). Símbolo+texto siempre.
- [x] **IA embebida:** sin cambios de motor. Deltas v1.7.4/v1.7.5 aplicados al skill (variante
      efímera + AI SDK v7 + humo día 0 + mock de primera clase). Validación Groq real → gate ⭐.
- [x] **Manual de uso:** § registro + § recordatorios + § días anteriores (español llano).
- [x] **Cierres de ciclo:** BLUEPRINT.html + design-sync + guía v1 ACUMULATIVA + kit de prueba +
      summary. **Gate ⭐ ACUMULADO del usuario → PENDIENTE (única vía de cierre).**
- [x] Retrospectiva: en el SPRINT_003.md de la planeadora al cerrar (la bitácora alimenta la retro).

## Métricas técnicas

- 198 unit/integration + 60 e2e (2 proyectos) · typecheck + lint limpios · build OK.
- Cobertura `lib/diet` 96.2% stmts / 84.6% branch (>80 exigido); app 97%.
- **US$0/mes** (cero servicios nuevos). Cero dependencias añadidas. 31 archivos, +2891/−158.

## Decisiones no anticipadas

- **ADR-007 — registro local + minimización:** el registro (hora + nota) es dato de salud del
  menor; local-only (ratifica ADR-001), JAMÁS a red/repo/grounding, logs solo-metadatos, "borrar
  datos" lo cubre, migración versionada v1→v2. Ratifica el "sin BD".

## Bugs + resoluciones

- **BUG-S3-1 (cazado por el remate de auditoría v1.9.1):** el recordatorio afirmaba "Suplemento de
  hoy: ya está" en días sin suplemento programado (jueves/domingo) — un cumplido falso que viola el
  tono sin culpa. Causa: la cadena i18n `noSupplement` existía pero nunca se cableó y `Reminder` no
  llevaba el conteo de suplementos programados. **Resuelto:** `buildReminder` expone
  `supplementsToday`; la UI usa tres estados. Regresión cubierta por unit (jueves/domingo) + e2e.

## Qué salió bien / qué generó fricción

**Bien:** (1) El **remate de dos fases pagó su costo** — cazó un defecto de honestidad que 149 tests
no vieron porque solo probaban lunes (patrón `la-ci-verifica-comportamiento-no-experiencia`: la CI
verificaba el comportamiento en un día, no la experiencia en todos). (2) La separación motor/UI hizo
el recordatorio trivial de testear (reloj inyectado, 7 días). (3) La **API v1 preservada** en el
day-log dejó `/suplementos` y los e2e del S1 intactos — la migración fue aditiva. (4) El invariante
de privacidad (registro ∉ grounding) resultó **estructural** (el grounding ni importa el day-log),
verificado por doble test negativo y por el auditor adversarial.

**Fricción:** ninguna del kit (los 8 deltas se aplicaron limpios; el skill `ia-embebida` local
estaba 3 versiones atrás y se sincronizó de una). La orden asumía dos cosas que el código no tenía
(`logic.ts` "ya" resolvía la franja — no existía; `local-store.ts` como la persistencia a extender —
era `day-log.ts`); ambas anotadas como desviación menor sin impacto de alcance.

## Sugerencias de mejora al método

- **Regla 2 de `la-ci-verifica` aplicada a los recordatorios calendáricos:** cuando un copy depende
  del día de la semana / la hora, el test debe recorrer **los 7 días / las franjas límite**, no un
  día representativo — el bug del suplemento existió porque el recordatorio solo se probaba en lunes.
  Candidato a nota en `testing-patterns` (patrón "recorre el ciclo, no un punto del ciclo").

## Deuda técnica aceptada

- **Nota sin guardar se pierde al cruzar la medianoche con la pestaña abierta:** el `NoteEditor` se
  remonta por `key` de día al rotar, descartando texto tecleado y NO guardado. Es diseño consciente
  (no arrastra la nota de ayer al día nuevo); el descarte de un borrador en curso solo ocurre en la
  ventana <60 s tras medianoche con el editor abierto. Auto-guardar al desmontar persistiría un
  borrador que la mamá no confirmó — peor. Se documenta; se revisita si el uso real lo pide.
- **day-log v2 ante rollback de despliegue** (obs. A/B del remate): coexistencia v1+v2 o v2 corrupto
  con v1 presente solo se dan tras un rollback de ops S3→S2→S3 o manipulación externa del storage —
  no en avance normal (ya endurecido contra crash en la Fase 2: nunca lanza, degrada a fail-safe).
  Deuda defensiva; se paga si la app deja de ser mono-dispositivo (fase 2).
- **Heredadas a su momento:** rate-limit in-memory (volumen real) · postcss moderate (upstream) ·
  dark mode (fase 2) · estado compartido multi-cuidador + push (fase 2, con su F0).

## Auditoría final + correcciones (Fase 2, pre-cierre)

4 revisores adversariales → 0 Críticos · 6 Altos · 10 Medios · 12 Bajos, **todos corregidos y
verificados** (detalle en `sprints/SPRINT_003-implementation-log.md` § Fase 2). Lo estructural:
`Reminder.supplements` como unión discriminada (BUG-S3-1 imposible por construcción) · motor
endurecido contra `localStorage` hostil (jamás llega a `Intl` → sin crash de Hoy//historial) ·
cruce de medianoche corregido (día real + rollover automático) · candado de "solo metadatos"
(`day-events` 0%→100%) · resolución de rótulos centralizada (`resolveCheckTarget`, sin ids crudos).
**Parche de seguridad:** `brace-expansion ≥1.1.16` vía override (advisory GHSA-3jxr-9vmj-r5cp
posterior al audit del sprint; dev-only, cero deps nuevas) → `audit --high` limpio.

## Archivos clave (máx. 10)

1. `src/lib/diet/day-log.ts` — registro v2 (hora + nota + historial + migración v1→v2).
2. `src/lib/diet/logic.ts` — `currentMealSlot` + `buildReminder` (recordatorio determinista).
3. `src/lib/diet/day-events.ts` — eventos de uso solo-metadatos.
4. `src/app/page.tsx` — "Hoy" extendida (hora, nota, recordatorio, enlace a historial).
5. `src/app/historial/page.tsx` — días anteriores (solo lectura).
6. `src/components/day-checklist/{reminder-card,note-editor,use-today}.tsx` — UI + hooks del registro.
7. `decisions/007-registro-local-minimizacion.md` — ADR del sprint.
8. `docs/GUIA-DE-PRUEBA.html` — guía v1 ACUMULATIVA S1–S3 (+ `docs/kit-de-prueba/`).
9. `docs/BLUEPRINT.html` — as-built de la infraestructura de la fase 1.
10. `tests/e2e/registro.spec.ts` + `tests/unit/{logic,storage,microcopy,grounding}.test.ts` — cobertura.

## Cómo probar

1. `pnpm install` → `pnpm test` (198 unit) → `pnpm test:e2e` (60 e2e, móvil + desktop).
2. Local: `pnpm dev`, abrir `/` — marcar una comida (aparece la hora), "Agregar nota", ver "Ahora
   mismo", "Ver días anteriores"; cambiar idioma en Ajustes; "Borrar mis datos".
3. Gate ⭐ ACUMULADO: abrir `docs/GUIA-DE-PRUEBA.html` (filtro **Gate mínimo ⭐**, 6 pruebas) —
   incluye la pregunta real al chat con **Groq configurado**, la migración y el PWA en el teléfono de
   la mamá, y el recorrido con la **dieta real** (entregada aparte).
