# Nutri-Kids (app-nutri-kids) — constitución de la app (Claude Code)

> Auto-cargado en cada sesión de este repo. Esta app pertenece al pipeline **AI-APPs**; su plan
> vive en la casa planeadora. Estampada desde kit-app v1.1.0 el 2026-07-06 (Sprint 001).

## Las dos casas (regla dura)

| Casa           | Path                            | Escritor único   | Qué vive ahí                                                                     |
| -------------- | ------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| **Planeadora** | `C:\Code\hr01-develop-ai-apps\` | su propia sesión | brief, VISION, sprints (plan+retro), órdenes de construcción, método, estándares |
| **Esta app**   | este repo                       | **tú**           | código, tests, ADRs de implementación, bitácora y summary del sprint             |

- ✅ Puedes **leer** la planeadora (agregada como `additionalDirectories`, o por path absoluto).
- ❌ **Nunca escribes** en la planeadora. Si el plan necesita cambio, lo anotas en tu
  `sprints/SPRINT_NNN-implementation-log.md` bajo `## Desviación del plan` y avisas al usuario.
- El avance de implementación vive **solo aquí** — la planeadora te lee, tú no le reportas a mano.

## Qué es esta app

**Nutri-Kids** — la dieta médica estricta de un niño, viva y compartida: PWA móvil-primero,
bilingüe ES/EN, que convierte el plan nutricional (un PDF de 36 pp.) en guía coloquial con
**semáforo de alimentos**, **equivalencias**, calendario de suplementos y **checklist del día**.
S2: chat "habla con tu dieta". S3: estado compartido multi-cuidador.
Contrato de alcance: `portafolio/nutri-kids/VISION.md` (planeadora, aprobada 2026-07-06).

## ⚠️ Reglas duras de esta app (producto, no estilo)

1. **PRIVACIDAD — el repo es PÚBLICO y JAMÁS contiene datos del niño.** Ni nombre, ni contacto,
   ni la dieta real: ni en código, ni en fixtures, ni en tests, ni en screenshots, ni en
   mensajes de commit. El repo solo lleva `data/demo-diet.json` (inventada, anonimizada). La
   dieta real (`portafolio/nutri-kids/contenido/dieta-oficial-v1.json`, planeadora) es
   **contenido de runtime del usuario**: puedes LEERLA para validar el schema, NUNCA copiarla aquí.
2. **SIN calorías, peso, IMC ni percentiles** en UI, datos o copy. Nada de lenguaje de culpa,
   premio con comida, ni "cumplimiento" como calificación moral. Tono positivo, práctico.
3. **Framing no-médico visible:** disclaimer permanente ("no reemplaza a tu pediatra") — es un
   elemento del sistema de diseño, no letra pequeña.
4. **El semáforo nunca comunica solo con color** (símbolo + texto siempre — A11y).

## Stack

- **Frontend:** Next.js + TypeScript strict + Tailwind + shadcn/ui, **PWA instalable**
  móvil-primero (360–420px prioridad absoluta). i18n ES/EN (approach → ADR).
- **Backend/BD/Auth:** **ninguno en Sprint 1** — local-first: la dieta y el checklist del día
  viven en el dispositivo (IndexedDB vs localStorage → ADR). Supabase entra en S3 (estado
  compartido multi-cuidador) — RLS desde la primera tabla cuando exista.
- **IA embebida:** **ninguna en Sprint 1.** En S2: chat multi-proveedor con **adapter conmutable
  por env** (Azure AI Foundry / Claude API / Gemini / Groq / self-host OpenAI-compatible),
  presupuesto runtime ≤ US$20/mes, guardrails + circuit breaker con fallback estático. Patrón
  obligatorio: skill `ia-embebida`. NO instalar SDK de ningún proveedor antes de su ADR (S2).
- **Tests:** Vitest (unit/integration) + Playwright (e2e) + Testing Library + @axe-core/playwright.
- **Deploy:** Vercel (preview por PR, prod desde `main`). **Observabilidad:** Pino + Sentry —
  los logs JAMÁS incluyen contenido de la dieta (solo metadatos: versión de schema, conteos).

## Estructura

```
src/
├─ app/            (App Router: / hoy · /dieta · /suplementos · /cargar · /ajustes)
├─ components/     (UI sin lógica de negocio; traffic-light/ · day-checklist/)
├─ lib/
│  ├─ diet/        (schema.ts zod v1 · logic.ts semáforo/hoy · storage.ts · day-log.ts)
│  └─ ia/          (S2 — patrón IA-embebida: schemas.ts · client.ts · guardrails.ts · persist.ts)
├─ i18n/           (es · en — paridad exigida por tests)
└─ types/
data/demo-diet.json       (ÚNICA dieta del repo: demo inventada, anonimizada, bilingüe)
public/manifest.webmanifest
tests/{unit,integration,e2e}/
design-system.md          (fuente de verdad visual — se crea en el sprint 1, skill diseno-ui)
docs/MANUAL-DE-USO.md     (manual para la mamá — OBLIGATORIO, español llano, vivo desde S1)
sprints/SPRINT_NNN-implementation-log.md · SPRINT_NNN-summary.md
decisions/NNN-titulo.md   (ADRs de implementación)
```

## Reglas de desarrollo

1. **TypeScript strict.** Sin `any` ni `@ts-ignore` sin justificación en comentario.
2. **Tests con cada feature.** Lógica pura de `lib/diet/` >80%, UI >50%, ≥1 e2e por feature core.
   Fechas SIEMPRE mockeables (suplemento-de-hoy y day-log dependen del día real).
3. **Motor separado de UI.** Semáforo/hoy/vigencias en `lib/diet/` puro; componentes sin lógica.
4. **Toda salida de LLM que se persista pasa por esquema Zod** (skill `ia-embebida`) — aplica
   desde S2; nunca texto libre directo a almacenamiento.
5. **A11y desde el inicio:** tabindex, aria-labels, contraste AA, `prefers-reduced-motion`,
   táctil ≥44px (uso móvil primario), semáforo con símbolo+texto.
6. **Commits convencionales**; branch `sprint-NNN/<tema>`; **jamás push directo a `main`** (hook lo
   bloquea); PR con CI verde + preview probado.
7. **Secrets solo en `.env.local` (gitignored) y Vercel env vars.** Doble protección gitleaks
   (hook PreToolUse + `githooks/pre-commit`). El hook nace ejecutable (100755) y `core.hooksPath`
   se re-aplica en cada `pnpm install` (script `prepare` — K12); si un commit con secreto de
   prueba NO es bloqueado, el gate está muerto — repáralo antes de seguir. **Carnada canónica
   verificada (kit v1.6.3; desde v1.7.3 viaja PARTIDA aquí para no disparar el hook al comitear
   este archivo): ármala concatenando `AWS_ACCESS_KEY_ID=` + `AKIAQ7RTZ4PX` + `KM2WNB3S` SOLO en
   el archivo de prueba del hook** — no improvises el secreto de prueba: las reglas modernas de
   gitleaks exigen alfabeto real (base32 tras `AKIA`) y entropía, y una carnada floja pasa en
   silencio (lección 2026-07-15: dos falsos "todo bien" seguidos). En esta app el gate de
   privacidad es doble: secrets Y datos personales (regla dura 1).
8. **Presupuesto de esfuerzo:** ~12 pasos por pantalla; si lo excedes, detente y simplifica o consulta.
9. **Manual de uso vivo (`docs/MANUAL-DE-USO.md`, obligatorio).** Escrito PARA LA MAMÁ en español
   llano: cómo cargar la dieta, leer el semáforo, usar el checklist de "Hoy", borrar datos. Toda
   feature que llegue a `main` queda documentada en el mismo sprint.
10. **Diseño con gate (`design-system.md` + skill `diseno-ui`).** No hay prototipo previo: el
    sprint 1 CREA el `design-system.md` (exploración en Claude Design). Tono visual: cálido,
    familiar, calmado — NO clínico, NO gamificado infantil. Cada sprint con UI cierra con el
    checklist de revisión de diseño + aprobación visual del usuario sobre la preview (ideal: la
    mamá completa el flujo en su teléfono).
11. **Brochure vivo con estados + export** _(regla 13 del kit v1.9.0→v2)_. `docs/BROCHURE.html` (autocontenido) +
    la ruta `/conoce` que sirve esos MISMOS bytes + `docs/brochure-export.json` (contrato v1.0.0 del
    portafolio: `_schema` copiado tal cual · toda métrica con su `fuente` MEDIDA · el total cuadrado
    contra `docs/MANUAL-DE-USO.md`). Dos estados: **INICIAL** (la construcción está cerrada; la
    cabecera lo declara) y **SELLADO** (cuando el gate de pruebas del usuario terminó — `sellado_en`
    deja de ser null). El sello NO congela: **todo sprint que cambie una feature actualiza brochure y
    export EN SU MISMO PR**, y el `_schema` no se reinventa. El brochure documenta la app, jamás a sí
    mismo (no entra al manual ni al conteo). Regla cero: **storyboard aprobado por el usuario ANTES de
    una línea de HTML**.
12. **CERO ENLACES de producción en el repo** _(regla 17 del portafolio)_. Ninguna URL de despliegue
    vive versionada aquí — ni en código, ni en docs, ni en JSON, ni en el campo `homepage` del repo.
    La producción se MUESTRA, jamás se ENTREGA: en el export `enlaces.produccion` es `null` con su
    `razon`, y `repositorio` también `null`. Gate (debe salir vacío):
    `grep -rn "vercel\.app\|workers\.dev" --include="*.md" --include="*.html" --include="*.json" .`
    más `gh repo view --json homepageUrl` → `""`. **La GitHub App de Vercel REESCRIBE `homepage` en
    cada deploy de producción**: la limpieza es RECURRENTE y se re-verifica después de cada merge a
    `main` (no hay automatización posible sin un PAT de administración como secret — descartado en un
    repo público).

## Estándares (los 6+1, gates en CI)

Testing · CI/CD · Observabilidad · Seguridad · Performance (contra `perf-budget.json`) · UX+A11y ·
**IA embebida responsable** (desde S2). Detalle canónico: `estandares/estandares.md` de la
planeadora (read-only). Ítem rojo ⇒ deuda técnica explícita en el summary o el sprint no cierra.

## Workflow de un sprint

**Apertura** — el usuario trae la **orden de construcción**
(`portafolio/nutri-kids/ordenes/SPRINT_NNN-orden.md` de la planeadora). Léela entera + sus
referencias (SPRINT_NNN.md, VISION.md, brief, extracción de la dieta).
**Plan mode primero, siempre.** **La aprobación del plan NO arranca la construcción** (gate de
arranque, kit v1.6.2): tras aprobarse el plan, emite el bloque de arranque — tu recomendación de
**modelo y esfuerzo** para el sprint (el usuario los fija con `/model`) + espacio para sus ajustes
— y espera su **«construye»** explícito antes de tocar cualquier archivo. Branch `sprint-NNN/<tema>`.

**Durante** — construye por fases (setup → motor → UI → integración → e2e). Mantén viva la
bitácora `sprints/SPRINT_NNN-implementation-log.md`. ADRs en `decisions/` para decisiones no
anticipadas. `/self-review` tras cada bloque; `/run-tests` frecuente. ⭐ Sprint 1: registra toda
fricción del kit v1.1.0 en la bitácora, SEPARADA del trabajo del producto (valida el criterio
"CI verde en el primer PR sin cirugía").

**Cierre — summary OBLIGATORIO.** Con la DoD completa: `/deploy-check` → genera
`sprints/SPRINT_NNN-summary.md` (plantilla abajo) → PR → merge con CI verde. **Sin summary el
sprint NO está cerrado** (es lo que la planeadora lee para la retrospectiva).

**Cierre de CICLO (método v1.8.0 — cuando este sprint es el ÚLTIMO de un ciclo H1/fase/MVP; la
orden lo declara):** además de la DoD, el sprint entrega (1) **`docs/BLUEPRINT.html`** — as-built
de TODA la infraestructura que soporta la app (plantilla `BLUEPRINT.plantilla.html` del kit: HTML
autocontenido con diagrama SVG embebido — jamás mermaid ni CDNs — + tabla por pieza + costo real +
punto único de falla), vivo y acumulativo entre ciclos; (2) el **design system publicado en Claude
Design** (`/design-sync`); y (3) la **guía v1 ACUMULATIVA** con el **gate ⭐ ACUMULADO** del usuario
(remate de auditoría de dos fases RECOMENDADO antes del merge, método v1.9.1). Todo ciclo tiene
MÍNIMO 3 sprints (regla dura 2026-07-17).

### Plantilla del summary

```markdown
---
sprint: NNN
app: nutri-kids
status: closed
opened: YYYY-MM-DD
closed: YYYY-MM-DD
branch: sprint-NNN/<tema>
pr: <link>
---

# Sprint NNN Summary — Nutri-Kids

## Outcome [¿Se logró el outcome del SPRINT_NNN.md? Sí/No/Parcial + 1 frase]

## Qué se construyó [features/pantallas/componentes]

## DoD — checklist [los 6+1 estándares, uno a uno, con evidencia breve]

## Métricas técnicas [cumplidas vs. no, del SPRINT_NNN.md]

## Decisiones no anticipadas [ADR-NNN: resumen]

## Bugs + resoluciones

## Qué salió bien / qué generó fricción [S1: fricciones del kit v1.1.0 aparte]

## Sugerencias de mejora al método [¿algo de metodo/metodo.md debería cambiar?]

## Deuda técnica aceptada [qué, por qué, sprint de pago]

## Archivos clave (máx. 10) · ## Cómo probar
```

## Patrones de dominio de esta app

- **La dieta = datos versionados con schema.** TODO el contenido nutricional entra por
  `lib/diet/schema.ts` (zod, `schemaVersion`); el build/import FALLA si está malformado
  (fail-safe). Ningún alimento/regla hardcodeado en componentes.
- **Semáforo como lenguaje central:** `logic.ts` resuelve el estado (verde/amarillo/rojo) de
  cualquier ítem consultando SOLO los datos cargados; la UI lo presenta con símbolo + texto +
  color y el "por qué" en palabras simples.
- **Checklist del día por fecha:** `day-log.ts` persiste marcas con clave `YYYY-MM-DD`; amanece
  vacío cada día sin borrar el historial local; "borrar datos" limpia dieta + day-log.
- **Demo↔real:** la app funciona completa con `data/demo-diet.json`; la dieta real se importa en
  runtime (file picker + textarea alterno) y vive solo en el dispositivo. Banner siempre visible
  de cuál está activa.
- **Bilingüe estructural:** contenido de datos con campos `es`/`en`; UI por i18n; tests de
  paridad de claves. Todo contenido nuevo se escribe en ambos idiomas EN EL MISMO PASO.

## Idioma

Español en conversación y bitácoras. Inglés en código, commits, nombres y ADRs.
El contenido de la app es bilingüe ES/EN (vive en `data/` e `i18n/`, no en el código).
