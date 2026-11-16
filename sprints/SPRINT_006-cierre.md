---
sprint: 006
app: nutri-kids
hito: H-2
opened: 2026-11-15
closed: 2026-11-15
branch: sprint-006/tu-pdf
pr: 9
---

# S6 · Tu PDF, vuelto app

**Objetivo/resultado:** quien cuida carga el PDF del profesional; se lee en el teléfono sin red y sin guardarse, se revisa parte por parte (12, con la página de cada dato) y solo queda el plan. JSON y notas del S5 siguen. **Estado:** construido, auditado, PR listo.
**Tiempo** (`node scripts/horas-sprint.mjs`): 12 commits · 1 sesión · **2,4 h activas** (span 1,9 h) · F1 0,7 h · F2 0,4 h · F3 1,2 h. **Diferencia vs 3,5 h: −1,1 h (−31 %).** Ninguna fase pasó el 50 %.
**Pruebas:** unit 27 archivos / 605 de 605 (98,68 % líneas) · e2e 164 de 164 con `CI=1` (mobile+desktop, offline incluido) · tsc y eslint limpios · Lighthouse 6 de 6 URL dentro de `perf-budget.json`, `/cargar` incluida.
**Entregables:** lector puro (`src/lib/diet/pdf-*.ts`, `plan-assemble.ts`) · revisión (`plan-review.ts`, `components/plan-review/`) · `/cargar` con «Elegir PDF» · pdf.js propio y precacheado en caché aparte · ADR-010 · e2e `cargar-pdf.spec.ts` · manual es+en, guía, BLUEPRINT, brochure+export, design-system.
**Auditoría** (Sonnet 5.5 · high · una pasada · 1 A, 15 M, 8 B; todos los hallazgos se pagan, salvo 2 con decisión del dueño):

- Alcance: 1.1 vigencia editable `pagado · f86b8ce` · 1.2 «mi plan no lo trae» no existe para verde, menú ni hidratación (el schema los exige; ADR-010 §7) `pagado · este commit` · 1.3 estados sin e2e/axe `pagado · eed9ddf`.
- Calidad: 2.1 lectura colgada `pagado · f86b8ce, eed9ddf` · 2.2 error de guardado `pagado · f86b8ce, eed9ddf` · 2.3 objetivos 44 px `pagado · eed9ddf` · 2.4 foco `pagado · eed9ddf` · 2.5 borrador con Zod `pagado · f86b8ce` · 2.6 filas no leídas avisadas `pagado · f86b8ce, eed9ddf` · 2.7 pruebas de read-pdf `pagado · f86b8ce` · 2.8 nombre con tilde `pagado · f86b8ce` · 2.9 fecha solo de páginas permitidas `pagado · f86b8ce` · 2.10 ids de equivalencia `pagado · f86b8ce` · 2.11 menores `pagado · f86b8ce, eed9ddf` · 2.12 red del contexto `pagado · eed9ddf` · 2.13 caché propia de pdf.js `pagado · f86b8ce` · 2.14 formato ajeno en i18n: lo hizo el formateador del editor; se declara, no se revierte `pagado · este commit`.
- Hallazgo propio (e2e): el hover del botón primario aclaraba el fondo (3,4:1) `pagado · eed9ddf`.
- Seguridad y privacidad: 3.1 `@napi-rs/canvas` con 3 días `pagado · e83e058` · 3.4 «nunca se lee» → «se descarta» `pagado · 6286e31` · **3.2 anclas genéricas del lector vs «ningún título literal»: abierto · decisión del dueño (ADR-010, «Open point»)** · **3.3 el PDF de prueba se parece a una dieta real: abierto · decisión del dueño/planeadora (comparar en privado; lo hace al pasar el lector por el PDF real)**.
- Frases caducadas: 4.1 brochure decía «desde un archivo» `pagado · 6286e31` · 4.2 métricas del export `pagado · 6286e31` · 4.3 storyboard y guía `pagado · 6286e31`. Veredicto: listo para cierre salvo 3.2 y 3.3.
  **Defaults técnicos:** rojo fijo a mano · lista roja del PDF → `restrictions.foods` con la aclaración en la nota · plan en es=en, textos de la app en ambos · mínimos relajados (restricted, yellow, supplements) y verde, menú, hidratación requeridos · plazo 90 d si el PDF no lo dice · título «Tu plan» / «tu peque» · «Elegir JSON» · una revisión nueva reemplaza el borrador (avisado en la tarjeta) · una equivalencia por alimento · pdf.js en `nutrikids-pdfjs-<versión>` · tema oscuro: el sistema es solo claro, e2e con `colorScheme` como el resto · brochure sigue en 21 bloques.
  **Modelo por fase y desvío:** F1 Opus 5.5 · F2 Sonnet 5.5 · F3 Sonnet 5.5, todos como se requerían; cierre escrito con Sonnet (se pedía Haiku): sin desvío de calidad. **Relevos:** 0. **/compact pedidos:** 2.
  **Desviaciones:** (1) «mi plan no lo trae» no aplica a 3 partes; (2) el plazo y el rojo fijo no salen del PDF. **Deuda:** ninguna con archivo:línea; solo 3.2 y 3.3 arriba.
  **Recomendación:** pasar el lector por el PDF real en privado y mandar a la planeadora los campos vacíos como primera tarea del S7.
  **Servidores:** `lsof` LISTEN en este repo: 0 (solo el test-server de Playwright de VS Code y la propia sesión de Claude Code, que no cuentan).
  **Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.**
