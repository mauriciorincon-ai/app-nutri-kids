---
sprint: 010
app: nutri-kids
hito: H-2
opened: 2026-11-17
closed: 2026-11-17
branch: sprint-010/bienestar
pr: 16
---

# S10 · Bienestar

- **Objetivo:** cómo llega a la mesa, qué acepta, cómo está hoy y sus hábitos, anotado en la familia cifrada, sin interpretar.
- **Resultado:** ADR-015. Semáforo emocional por comida, bitácora de aceptación (también desde la ficha del alimento), «Bienestar de hoy» (`/bienestar`), hábitos contra referencia con fuente, franja de edad elegida por un padre con pregunta anual, lo visto en Historial, permisos por rol.
- **Estado:** construido y auditado; PR #16 abierto, pendiente de merge. No completado: ninguno del alcance.
- **Tiempo:** estimado 4,5 h · real 2,1 h activas (`node scripts/horas-sprint.mjs`, 10 commits, 2 sesiones). Diferencia −2,4 h (−53 %): sin medida.
| Fase | Commits | Horas activas |
|---|---:|---:|
| F1 registro + ADR | 3 | 0,5 h |
| F2 pantallas | 2 | 0,6 h |
| F3 pruebas, docs, auditoría | 5 | 1,0 h |

- **Entregables:** `src/lib/wellbeing/`, `src/components/wellbeing/`, `src/app/bienestar/`, `src/i18n/wellbeing.ts`, tests unit (1187) y e2e (`bienestar.spec.ts`), manual, guía (bloque R), BLUEPRINT, brochure (31 funcionalidades), export.
- **Verde:** vitest 1187 / 1187 (cobertura líneas 96,98 %); Playwright 252 verdes y 2 omitidas a propósito; tsc, eslint, cero-enlaces limpios.
- **Desviaciones y causas:**
  - Cuidador anota hábitos además de ánimo, alimentos y cómo está (default del builder, ADR-015 §6).
  - Bitácora de alimentos en la ficha del alimento: planeada en F2, entregada en F3 (auditoría A-1).
- **Decisiones:** un registro `day:<fecha>` con cuatro mapas; exposiciones derivadas; franja sin fecha; textos fuera del bundle; sin dependencias nuevas. Tras el #16 (PR #17): Sentry se inicia cuando el navegador queda libre (TBT de Hoy al borde de 300 ms en la CI; local 43–57 → 13–15 ms, scripts 421 → 425 KB; errores tempranos en cola; el enlace de Historial a Bienestar sin precarga: /historial 441,6 → 432,7 KB; /ajustes queda a 0,5 KB del tope); Vercel instala con pnpm 11 como la CI; 3 pruebas fijan el reloj (fallaban pasada la medianoche UTC) y el centinela de franja va entre comillas.
- **Deuda (solo lo imposible):**
  - Página de la OMS 2019 sin verificar (el PDF devolvió 403): `src/lib/wellbeing/references.ts` cita la sección, no la página. **Decisión del dueño:** aceptar la cita por sección o darme el PDF para fijar la página.
  - Dark mode: la app solo lo activa con `.dark`, que nada pone; los tonos oscuros existen pero no se ven. **Decisión del dueño:** heredada de S1 (light-only). · CI: picomatch GHSA-fc5q-39xc-vjpf (alta, sin versión arreglada publicada) → **pagado con parche propio** a 2.3.2 y 4.0.7 (`patches/`, prueba `picomatch-redos.test.ts`; 1 de ~1980 pruebas upstream cambia: `*(a*|b)`, que también explotaba). La auditoría lo sigue viendo por número: ignore atado al parche; ambos se quitan cuando salga la versión arreglada (pnpm falla al no usarse el parche). Decisión del dueño: «solucionar pase lo que pase».
- **Recomendación:** merge tras revisar la decisión de la OMS 2019. Esfuerzo-beneficio: alto (registro único, sin infraestructura nueva).
- **Auditoría** (Sonnet 5.5, solo lectura, una pasada): 0 críticos, 0 altos; 8 medios, 12 bajos.
  - Alcance: A-1 ficha del alimento → pagado · 27d9b6e · A-2 enlace desde Historial → pagado · 27d9b6e · A-3 cuidador hábitos → desviación declarada arriba.
  - Calidad: C-1 cobertura wellbeing → pagado · 27d9b6e · C-2 sueño 24 h → pagado · 27d9b6e · C-3 actividad semanal → pagado · 27d9b6e · C-4 graduación «un poco» → pagado · 27d9b6e · C-5 ✓ en ánimo → pagado · 27d9b6e · C-6 fuentes en español en EN → pagado · 27d9b6e · C-7 OMS 2019 páginas → **abierto · decisión del dueño** (ver deuda) · C-8 clave «constructor» → pagado · 27d9b6e · C-9 texturas sincronizadas → pagado · 27d9b6e · C-10 topes deterministas → pagado · 27d9b6e · C-11 claves canónicas → pagado · 27d9b6e · C-12 textos muertos → pagado · 27d9b6e · C-13 pruebas faltantes → pagado · 8d5b3f8 · C-14 cap de hábitos → pagado · 27d9b6e · C-15 género y frase truncada → pagado · 27d9b6e · C-16 design-system y ADR → pagado · 6590ac3 · C-17 manual de roles → pagado · 6590ac3 · C-18 erratas → pagado · 6590ac3.
  - Seguridad y privacidad: sin hallazgos (permisos por rol, firma, sentinela de red, sin fecha de nacimiento, sin secretos).
  - Frases caducadas: sin promesas aplazadas; cifras de evidencia recontadas tras pagar (1187 / 254 / 96,98 %).
- **Modelo por fase:** F1–F3 Sonnet 5.5 (high, medium, medium) · auditoría Sonnet 5.5 high · cierre Haiku 5.5 low. Sin desvíos ni relevos. `/compact`: 2.
- **Servidores al STOP:** `lsof` LISTEN en este repo: 0.
- Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
