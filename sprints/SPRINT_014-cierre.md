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

- **Objetivo y resultado:** pagar VISION 79–81. 5 lecciones + «Qué sí y qué no»; registro de presión (1a); «La aventura» con modo niño (2a).
- **Estado:** mergeado, squash `79c4b8b`, PR #23.
- **Tiempo:** estimado 6,5 h · real 3,9 h activas (`scripts/horas-sprint.mjs --rango a8ce5de..sprint-014/familia-y-nino`, 23 commits) · −2,6 h (−40 %). Es un piso. Por fase: F1 1,1 h (8 commits) · F2 0,5 h (1) · F3 2,4 h (14).
- **Entregables:** `src/lib/family-learn/lessons.ts:85` · `src/lib/family/state.ts:92` · `src/components/adventure/adventure.tsx:83` · ADR-020.
- **Dirección del juego (tu frase):** «Las quiero todas» y «El niño elige su mundo»: tres mundos, una energía que solo sube. Excepción a «gamificado infantil» solo en `/aventura` (`design-system.md:10`).
- **Lecciones:** 5, con 5 fuentes (`aap-mealtime`, `aap-picky`, `aap-praise`, `satter-dor`, `usda-nesr`; `lessons.ts:26`), parafraseadas.
- **Compacts pedidos:** 2 · **pr:** 23.

## Auditoría

- **Alcance:** completo. **Frases caducadas:** 0. **Seguridad y privacidad:** 0 hallazgos; `cero-enlaces` limpio (lo corrí yo).
- **Calidad:** 2 medios y 2 bajos, todos pagados:
  - M · retraso del padre (`src/lib/family/sync.ts:426`) · pagado · b871a3c
  - M · contraste de Nubo (`src/components/adventure/adventure.tsx:83`) · pagado · bdefde8
  - B · manual «Compartir con la familia» · pagado · 18604d4
  - B · workflow temporal de TBT · pagado · a75a8b5
- **Veredicto:** listo para cierre tras los pagos.

## CI y medidas

- **CI #23:** `quality`, `e2e`, `lighthouse` y `un-pr-vivo` en `success` (run `45524742654`). Unitarias 1728 de 1728, cobertura 97,22 %. e2e 374 pasan y 2 se omiten de 376.
- **TBT en el runner** (run `45523796898`, workflow ya borrado): 19 rutas ≤ 300 ms; máximo 248,5 ms en `/aventura`.
- **Peso:** un solo medidor, Lighthouse CI (`decisions/020-family-learning-pressure-and-adventure.md:114`). El `static.mjs` daba `/familia` 474,1 KB y Lighthouse 437,7 KB: el prefetch que suponía no ocurre al cargar (ADR-020:116-118).

## Desviaciones y modelos

- **Pareja de Turbopack:** `src/components/app-shell/shell-pins.ts:22` ancla `Checkbox` y `roleCan` (f65f124).
- **Extras pagados:** sincronía del registro (e000037) · bucle del brochure (0121533) · 7 carpetas de `src/lib` (28f8610) · carrera del e2e de dos teléfonos (10d1bff).
- **Modelos:** F1 Opus 5.5 (high) · F2 Sonnet 5.5 (high) · F3 Sonnet 5.5 (medium), con relevo a Opus 5.5 por el peso de las rutas, autorizado con «Listo opus» · cierre Haiku 5.5 (low). **Relevos:** 1.
- **Límites declarados:** la regla 1a la cumple la app, no la criptografía (una sola clave por familia). La salida del adulto es un seguro de pantalla, no una frontera de seguridad.

## Servidores y PR

- `lsof` LISTEN en este repo: 0 míos. Hay 1 ajeno: PID 21837, `playwright test-server` de la extensión de VS Code, puerto 53250. Lo reporto y no lo cierro. Nada en el 3600.
- Este cierre va en un PR aparte, «complementa #23», porque #23 ya está mergeado.
- Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
