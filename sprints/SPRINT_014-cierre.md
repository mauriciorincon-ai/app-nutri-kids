---
sprint: 014
app: nutri-kids
hito: H-2
opened: 2026-11-24
closed: 2026-11-25
branch: sprint-014/familia-y-nino
pr: 23
---

# Sprint 014 · Familia y niño · cierre ejecutivo

- **Objetivo:** pagar VISION 79–81: educación a familiares, registro de presión social y juego del niño.
- **Resultado:** 5 lecciones + «Qué sí y qué no»; registro de presión (1a); «La aventura» con modo niño (2a).
- **Estado:** mergeado, squash `79c4b8b`, PR #23.
- **Tiempo:** estimado 6,5 h · real 3,9 h activas (`scripts/horas-sprint.mjs --rango a8ce5de..sprint-014/familia-y-nino`, 23 commits) · diferencia −2,6 h (−40 %). El script es un piso.
- **Fases:** F1 8 commits, 1,1 h · F2 1 commit, 0,5 h · F3 14 commits, 2,4 h.
- **Entregables:** `src/lib/family-learn/lessons.ts:85` · `src/lib/family/state.ts:92` · `src/components/adventure/adventure.tsx:83` · ADR-020.
- **Dirección del juego (tu frase):** «Las quiero todas» y «El niño elige su mundo»: tres mundos, una energía que solo sube. Excepción a «gamificado infantil» solo en `/aventura` (`design-system.md:10`).
- **Lecciones:** 5, con 5 fuentes (`aap-mealtime`, `aap-picky`, `aap-praise`, `satter-dor`, `usda-nesr`; `src/lib/family-learn/lessons.ts:26`). Parafraseadas.
- **Compacts pedidos:** 2.

## Auditoría

- **Alcance:** completo.
- **Calidad:** 2 medios y 2 bajos, pagados:
  - M · retraso del padre (`src/lib/family/sync.ts:426`) · pagado · b871a3c
  - M · contraste de Nubo (`src/components/adventure/adventure.tsx:83`; prueba `tests/unit/adventure-contrast.test.ts:58`) · pagado · bdefde8
  - B · manual «Compartir con la familia» · pagado · 18604d4
  - B · workflow temporal de TBT · pagado · a75a8b5
- **Seguridad y privacidad:** 0 hallazgos. `cero-enlaces` limpio (lo corrí yo; el auditor no).
- **Frases caducadas:** 0 hallazgos.
- **Veredicto:** «listo para cierre» tras los pagos. Extra: export del brochure a 1728 pruebas · 4d8302a.

## CI y medidas

- **CI de #23:** `quality`, `e2e`, `lighthouse` y `un-pr-vivo` en `success` (run `45524742654`).
- **Unitarias:** 1728 de 1728, 95 archivos, cobertura de líneas 97,22 %.
- **e2e:** 374 pasan, 2 omitidas de 376.
- **TBT en el runner** (mediana de 10, run `45523796898`, workflow ya borrado): las 19 rutas ≤ 300 ms; máximo de la rama 248,5 ms en `/aventura`.
- **Peso:** un solo medidor, Lighthouse CI (`decisions/020-family-learning-pressure-and-adventure.md:114`).

## Desviaciones y decisiones

- **Medidor de peso (F1):** el `static.mjs` del scratchpad sumaba los chunks de las 6 rutas de la barra y daba `/familia` 474,1 KB; Lighthouse dio 437,7 KB. Causa: ese prefetch no ocurre al cargar. Se borró; la razón está en el ADR.
- **Pareja de Turbopack:** `src/components/app-shell/shell-pins.ts:22` ancla `Checkbox` y `roleCan` (f65f124).
- **Hallazgos extra pagados:** sincronía del registro (e000037) · bucle del brochure (0121533) · 7 carpetas de `src/lib` (28f8610) · carrera del e2e de dos teléfonos (10d1bff).
- **Decisión del dueño:** solo la frase del juego.

## Modelo y relevos

- **F1** Opus 5.5 (high) · **F2** Sonnet 5.5 (high) · **F3** Sonnet 5.5 (medium), relevo a Opus 5.5 por el peso de las rutas, autorizado con «Listo opus» · **Cierre** Haiku 5.5 (low).
- **Relevos:** 1.

## Límites declarados

- **Regla 1a:** la cumple la app, no la criptografía; la familia comparte una sola clave.
- **Salida del adulto:** seguro de pantalla, no frontera de seguridad.

## Servidores al STOP

- `lsof` LISTEN en este repo: 0 míos. Hay 1 ajeno: PID 21837, `playwright test-server` lanzado por la extensión de VS Code, puerto 53250. Lo reporto y no lo cierro. Nada en el 3600.

## Cierre

- Este cierre va en un PR aparte, «complementa #23»; #23 ya está mergeado.
- Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
