---
sprint: 001
app: nutri-kids
status: ready-to-close # pasa a "closed" cuando el usuario apruebe preview + gate de diseño y mergee el PR
opened: 2026-07-06
closed: pendiente-de-merge
branch: sprint-001/dieta-viva-y-hoy
pr: https://github.com/mauriciorincon-ai/app-nutri-kids/pull/1
---

# Sprint 001 Summary — Nutri-Kids

## Outcome

**Sí (pendiente de validación visual del usuario).** Los 3 outcomes del SPRINT_001.md están
construidos y verificados por tests: (1) dieta completa navegable con semáforo, vigencias,
aditivos y equivalencias — el schema acepta la dieta real (validada leyéndola de la planeadora,
jamás copiada); (2) "Hoy" es checklist del día marcable con resumen "qué ya hice / qué falta" y
amanece vacío por fecha; (3) la app pública funciona completa con demo anonimizada, disclaimer
no-médico permanente y "borrar datos" en un toque.

## Qué se construyó

- **Motor** (`src/lib/diet/`): schema zod v1 bilingüe con `schemaVersion`; `logic.ts` puro
  (semáforo con precedencia restricción-vigente > rojo > amarillo > verde, suplemento-del-día
  Lun–Dom, checklist del día, búsqueda); `storage.ts` (localStorage versionado, fail-safe
  corrupto→demo); `day-log.ts` (marcas por fecha `YYYY-MM-DD`).
- **6 pantallas**: `/` Hoy (checklist) · `/dieta` (búsqueda + tabs semáforo + aditivos) ·
  `/dieta/[id]` (por qué + límites + equivalencias) · `/suplementos` (semana con check "ya lo
  tomó") · `/cargar` (file picker + pegar, 5 estados) · `/ajustes` (idioma, borrar datos,
  disclaimer).
- **design-system.md v1**: paleta cálida "cocina familiar", Fraunces + Nunito Sans, tokens
  semáforo AA (símbolo + texto siempre), light-only S1.
- **i18n propio** ES/EN tipado (paridad compile-time + test runtime) — sin librería (ADR 002).
- **PWA**: manifest + íconos any/maskable + SW mínimo (ADR 003). **Sentry** por env var.
- `data/demo-diet.json` (inventada), `scripts/validate-diet.ts` (valida la real sin copiarla),
  `docs/MANUAL-DE-USO.md` para la mamá.

## DoD — checklist (6+1)

| Estándar           | Estado | Evidencia                                                                                                                              |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Testing            | ✅     | 66 unit + 28 e2e (móvil/desktop, clock mockeado); cobertura `lib/diet` ~99% (gate 80)                                                  |
| CI/CD              | ✅     | CI del PR #1 verde (quality/e2e/lighthouse) + preview Vercel desplegada y probada por el usuario                                       |
| Observabilidad     | ✅     | Pino estructurado (import: SOLO metadatos — fix de privacidad al detail de JSON inválido); Sentry cableado, DSN por env                |
| Seguridad          | ✅     | gitleaks en cada commit (0 leaks); audit: 0 high/critical (1 moderate aceptada: postcss vía Next, build-time); cero secrets            |
| Performance        | ✅     | gate Lighthouse verde en `/` y `/dieta`; LCP observado 242–327 ms; budgets renegociados con evidencia (bitácora)                       |
| UX/A11y            | ✅     | axe limpio 6 rutas + diálogo; teclado e2e; táctil ≥44px; semáforo símbolo+texto; visto bueno del usuario sobre la preview (2026-07-07) |
| IA embebida        | n/a    | sin LLM en S1 (por diseño)                                                                                                             |
| Manual de uso      | ✅     | `docs/MANUAL-DE-USO.md` completo en español llano                                                                                      |
| Revisión de diseño | ✅     | checklist `diseno-ui` corrido + aprobación visual del usuario sobre la preview ("impecable", 2026-07-07); sin Claude Design en S1      |

## Métricas técnicas

- Paridad ES/EN 100% (test verde, incluye igualdad de placeholders). "¿Manzana se puede?" → rojo
  - fecha + reemplazos, cubierto por e2e. Suplemento correcto por día real + "hoy no toca" (e2e
    con clock). Checklist amanece vacío (e2e cruzando medianoche). Import inválido → error legible
    (e2e). Performance: **LCP observado 242–327 ms** (paint estático verificado en trace);
    el simulado de Lantern ronda 3.8 s por artefacto de auditar localhost (ver bitácora
    §Budget renegociado — LCP budget 3000→4200 con evidencia); score Lighthouse ~0.89–0.90.

## Decisiones no anticipadas

- **ADR 001** localStorage versionado (no IndexedDB): datos ~30 KB, API síncrona, zod re-valida al leer.
- **ADR 002** i18n propio tipado (no next-intl): paridad compile-time, 2 idiomas, sin rutas por idioma.
- **ADR 003** PWA mínima a mano (no next-pwa/Serwist): cache-first solo estáticos, navegación a red.
- No-ADR pero estructural: puente localStorage↔React con `useSyncExternalStore`
  (`src/lib/local-store.ts`) — exigido por la regla `react-hooks/set-state-in-effect` del linter.

## Bugs + resoluciones

1. Contraste 4.29:1 en botón destructivo (axe) → `--destructive` a `oklch(0.50 0.18 25)`.
2. Disclaimer fuera de landmark (axe region) → `<footer>`.
3. **Privacidad:** `JSON.parse` filtra extracto del input en su mensaje de error y eso iba a
   logs → detail fijo `"unparseable JSON"` + test de regresión.
4. `file.text()` sin catch dejaba la UI en "Revisando…" → cae a error legible.
5. **LCP real de ~7.5 s** en el primer gate de CI: el diálogo de primer uso (Radix, portal
   post-hidratación) era el elemento LCP en TODAS las rutas → overlay estático sin portal +
   script inline pre-paint para usuarios que vuelven; fuentes: sin eje SOFT, `display: optional`,
   pesos estáticos (preload 220→48 KB). Resultado: **LCP observado 242–327 ms**. El residual
   simulado (~3.8 s) es artefacto Lantern/localhost → budget renegociado a 4200 (bitácora).
6. e2e móvil: caché Turbopack sirvió CSS viejo → limpiar `.next` (proceso, no producto).

## Qué salió bien / qué generó fricción

**Bien:** el JSON real de la planeadora como contrato del schema (cero sorpresas al validar);
motor puro con fecha inyectada hizo triviales los tests de "amanece vacío"; el semáforo como
único dueño de sus colores (StatusChip) mantuvo la regla A11y en un solo lugar.

**Fricción del kit v1.1.x (⭐ criterio "CI verde en el primer PR sin cirugía" — el kit REQUIRIÓ cirugía):**

- K1: faltan `vitest.config.ts`/`playwright.config.ts` que el propio `ci.yml` promete (coverage 70).
- K2: la orden dice "Sentry viene cableada en el kit" — no lo está; se cableó aquí.
- K3: Lighthouse CI solo auditaba `/`; la DoD pide `/` y `/dieta`.
- K4: CLAUDE.md estampado dice v1.1.0; el commit de estampado dice v1.1.4 (cosmético).
- K5: la nota "gitleaks pendiente de instalar" estaba desactualizada — sí está instalado y activo.
- K6: `devIndicators` de Next tapa la nav inferior móvil en dev e intercepta taps (rompía e2e) —
  candidato a default del kit (`devIndicators: false`).
- Extra: el job e2e del CI no hace build; el `playwright.config` del app lo cubre con
  `pnpm build && pnpm start` bajo CI — candidato a documentarse en el kit.

## Sugerencias de mejora al método

1. El kit debería estampar `vitest.config.ts` + `playwright.config.ts` + `tests/setup.ts` (K1) y
   el cableado Sentry que la orden ya promete (K2), y parametrizar las URLs del job Lighthouse (K3).
2. Añadir al kit la regla/nota del linter `react-hooks/set-state-in-effect`: el patrón
   recomendado para estado en localStorage es `useSyncExternalStore` (reusable: `local-store.ts`).
3. La orden podría traer una fila "verificación de supuestos del kit" (qué dice la orden que ya
   viene vs. qué hay) — 10 min al abrir el sprint habrían anticipado K1/K2/K5.
4. **El gate Lighthouse castiga SPAs sanas:** Lantern sobre localhost mete todo el JS al grafo
   del LCP simulado aunque el paint sea 100% estático (observado 242 ms vs. simulado 3.8 s,
   evidencia en la bitácora). El job debería auditar la **preview de Vercel** (red real) o usar
   throttling DevTools; mientras tanto, budgets LCP de apps client-side necesitan margen Lantern.
5. **(Feedback del usuario, 2026-07-07) Claude Design bajo demanda, no de arranque:** segunda app
   consecutiva donde el proyecto Design se crea al inicio y no se usa. El default que funcionó 2
   veces: el builder bosqueja `design-system.md` → el usuario aprueba sobre la preview. Crear el
   proyecto de claude.ai/design SOLO si el gate visual falla o el usuario quiere explorar (mover
   el paso 07 del método a "condicional").
6. **(Feedback del usuario, 2026-07-07) El aprovisionamiento debe re-presentarse en el momento
   accionable:** Sentry/Vercel se listaron en la orden y en el plan, pero el usuario llegó al
   final sin tenerlo claro. Regla propuesta: al ABRIR el PR, el builder emite un checklist
   explícito de aprovisionamiento pendiente con pasos de 2 minutos (esto ya se había pedido en
   el proyecto anterior — reincidencia de método, no del builder puntual).

## Deuda técnica aceptada

- `pnpm audit`: 1 moderate (postcss <8.5.10 fijado por Next, build-time, sin exposición runtime).
  Pago: se resuelve solo al subir Next; revisar en S2.
- Modo oscuro no diseñado (decisión de alcance, documentada en design-system.md — extensión, no bug).
- Offline avanzado (navegar sin señal a páginas no visitadas) fuera de S1 (ADR 003, roadmap).

## Archivos clave (máx. 10)

1. `src/lib/diet/schema.ts` · 2. `src/lib/diet/logic.ts` · 3. `src/lib/diet/storage.ts` +
   `day-log.ts` · 4. `data/demo-diet.json` · 5. `src/app/page.tsx` (Hoy) · 6. `src/app/dieta/`
   (lista + detalle) · 7. `src/i18n/{es,en}.ts` · 8. `design-system.md` · 9.
   `tests/e2e/happy-path.spec.ts` · 10. `docs/MANUAL-DE-USO.md`

## Cómo probar

Ver sección "Cómo probar (preview)" del PR #1. Local: `pnpm dev` (demo completa sin importar
nada) · `pnpm test` · `pnpm test:e2e` · validar la dieta real:
`pnpm tsx scripts/validate-diet.ts <ruta-al-json-de-la-planeadora>`.
