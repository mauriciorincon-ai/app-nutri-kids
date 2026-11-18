---
sprint: 011
app: nutri-kids
hito: H-2
opened: 2026-11-18
closed: 2026-11-18
branch: sprint-011/dia-a-dia
pr: 19
---

# S11 · El día a día

- **Objetivo y resultado:** tema oscuro real; lonchera, recetario y modo viaje sin enlaces ni datos fuera del aparato. Cerrado con una desviación de TBT; mergeado (squash `13b71ac`), rama borrada.
- **Tiempo:** estimado 6,5 h · real 5,8 h activas (`horas-sprint.mjs --rango ecbab51..7aeb9b3`, 31 commits, span 11,1 h) · diferencia −0,7 h (−11 %).

| Fase | Estimado | Real | Modelo (plan → real) |
|---|---:|---:|---|
| F1 tema oscuro | 1,3 h | 0,7 h | Sonnet 5.5 high → igual |
| F2 lonchera, recetario, viaje | 3,2 h | 1,1 h | Sonnet 5.5 high → igual |
| F3 probado y cierre | 2,0 h | 4,1 h (+105 %) | Sonnet 5.5 medium → Sonnet; Opus 5.5 en depuración de CI |

- **Entregables:** tema Sistema/Claro/Oscuro sin destello (ADR-016) · lonchera con etiqueta y QR de solo texto · 37 recetas ES/EN revisadas contra el plan, «con lo que tengo», recetas propias locales · modo viaje ES/EN (ADR-017) · e2e, manual, guía, BLUEPRINT, brochure. No completado: nada.
- **Desviaciones y causas:**
  - TBT de Hoy: mediana de la rama 260 ms frente a 252,5 ms de `main` (10 corridas alternas en el runner). No cumple el ≤ 250 ms; el presupuesto de CI (300 ms) pasa. **Tu decisión:** ¿el 250 bloquea o basta el 300 de CI?
  - F3 +105 %: 5 commits `ci(temp)` de medición y dos rondas de CI roja. Medida: la medición de rendimiento va antes de abrir la fase, en un solo workflow temporal.
  - Dos fallos de e2e solo en CI (brochure: 170 pasos fijos no alcanzan con fuentes de Linux; registro: toque antes de hidratar). Pagados en `7105e50` y `7aeb9b3`.
  - Relevos: Sonnet → Opus 5.5 al primer fallo de CI (lo pediste); Lighthouse local dio NO_FCP → TBT medido en el runner.
- **Decisiones (defaults míos):** recetas propias solo en el aparato (ADR-017 §7) · cruce receta-plan por nombre, alternativas como parciales (`aa39a48`) · lista de viaje sin tope (`cc230c7`) · texto médico sin cortar · tope de 14 por día con aviso (`95e81ef`).
- **Deuda y dependencia:** ninguna deuda imposible (fuera de este repo, para ti: la cita OMS 2019 de la planeadora). Nueva: `qrcode-generator` 2.0.4, publicada 2025-08-07, MIT, sin dependencias.
- **Auditoría** (una pasada, Sonnet 5.5 solo lectura; commits previos al squash):
  - Alcance: sin hallazgos · Calidad: M3, M4 `cc230c7` · M5, M6 `aa39a48` · B1–B4 `95e81ef`
  - Seguridad y privacidad: M2 `cc230c7` · Frases caducadas: A1 `93ecba0` + `0deaf62` · A2 `93ecba0` · B5 `95e81ef`
  - Veredicto: requiere ajustes → 12 de 12 pagados (2 altos, 5 medios, 5 bajos), sin segunda pasada.
- **Peso de scripts:** `/recetas` 436,5 KB y `/lonchera` 435,5 KB, medidos antes de B1–B5 (ADR-017 §9). CI con `perf-budget` (440 KB) y Lighthouse en verde.
- **Verificación final:** tsc y eslint limpios · vitest 1291/1291, cobertura de líneas 97,11 % · `CI=1` playwright 318 de 320 (2 omitidas a propósito) · cero-enlaces limpio.
- **Aprendizajes:** probar con `CI=1` antes de abrir PR · un tope fijo de pasos no escala · TBT en el runner, siempre en mediana.
- **Recomendación:** S12 (foto → receta) con el presupuesto de script como primer criterio (`/recetas`: 3,5 KB de margen). Esfuerzo-beneficio: alto coste de CI, beneficio: tres pantallas y tema oscuro reales.
- **Servidores al STOP:** `lsof` LISTEN en este repo: 2 procesos, ninguno abierto por mí (36510 es la extensión de Claude Code; 70525 es el test-server de Playwright de otra sesión, no lo cierro). Puerto 3600 libre.

Para mergear: ya mergeado (squash `13b71ac`) y rama borrada; después `/cierre-sprint nutri-kids`.
