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

- **Objetivo y resultado:** pagar VISION 79–81: 5 lecciones + «Qué sí y qué no», registro de presión (1a) y «La aventura» con modo niño (2a). Estado: mergeado, squash `79c4b8b`.
- **Tiempo:** estimado 6,5 h · real 3,9 h (`scripts/horas-sprint.mjs`, 23 commits; piso) · −2,6 h (−40 %). F1 1,1 h · F2 0,5 h · F3 2,4 h.
- **Entregables:** `src/lib/family-learn/lessons.ts:85` · `src/lib/family/state.ts:92` · `src/components/adventure/adventure.tsx:83` · ADR-020.
- **Dirección del juego (tu frase):** «Las quiero todas» y «El niño elige su mundo»: tres mundos, una energía que solo sube (`design-system.md:10`).
- **Lecciones:** 5 con 5 fuentes parafraseadas (`lessons.ts:26`). **Compacts:** 2. **pr:** 23.

- **Auditoría — alcance** completo · **frases caducadas** 0 · **seguridad y privacidad** 0 (`cero-enlaces` limpio).
- **Calidad:** 2 medios y 2 bajos, pagados:
  - M · `src/lib/family/sync.ts:426` · pagado · b871a3c
  - M · `src/components/adventure/adventure.tsx:83` · pagado · bdefde8
  - B · manual · pagado · 18604d4 · B · workflow TBT · pagado · a75a8b5
- **Veredicto:** listo para cierre.

- **CI #23:** `quality`, `e2e`, `lighthouse`, `un-pr-vivo` en `success` (run `45524742654`). 1728 unitarias de 1728 · cobertura 97,22 % · e2e 374 + 2 omitidas de 376.
- **TBT** (run `45523796898`): 19 rutas ≤ 300 ms; máximo 248,5 ms en `/aventura`.
- **Peso:** Lighthouse CI como único medidor (`decisions/020-family-learning-pressure-and-adventure.md:114`).

- **Medidor:** el `static.mjs` daba `/familia` 474,1 KB; Lighthouse 437,7 KB. El prefetch que suponía no ocurre al cargar (ADR-020:116-118).
- **Extras pagados:** sincronía (e000037) · bucle del brochure (0121533) · 7 carpetas (28f8610) · carrera e2e (10d1bff) · pareja Turbopack (`src/components/app-shell/shell-pins.ts:22`, f65f124).
- **Modelos:** F1 Opus 5.5 · F2 Sonnet 5.5 · F3 Sonnet 5.5 con relevo a Opus por el peso de las rutas (autorizado con «Listo opus») · cierre Haiku 5.5. **Relevos:** 1.
- **Límites:** la regla 1a la cumple la app, no la criptografía. La salida del adulto es un seguro de pantalla, no una frontera.

- **Servidores:** `lsof` LISTEN en el repo: 0 míos. Ajeno: PID 21837, `playwright test-server` de VS Code, puerto 53250; lo reporto, no lo cierro. Nada en el 3600.
- Cierre en PR aparte, «complementa #23». Para mergear: squash, borrar rama, `/cierre-sprint nutri-kids`.
