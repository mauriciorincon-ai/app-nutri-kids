---
entrega: brochure-conoce
tipo: entrega-puntual # no es un sprint (método v1.18.0)
app: nutri-kids
modo: INICIAL
status: en-gate-visual
opened: 2026-08-22
closed:
branch: entrega/brochure-conoce
pr:
---

# Entrega puntual — El brochure vivo de Nutri-Kids (`/conoce`)

## Outcome

**Sí.** Con el PR #3 mergeado (852798c), la construcción del ciclo fase 1 quedó cerrada y esta
entrega publica su **Brochure vivo en modo INICIAL**: `docs/BROCHURE.html` (autocontenido),
la ruta pública `/conoce` sirviendo esos mismos bytes, y `docs/brochure-export.json` conforme al
**contrato v1.0.0** del portafolio. Falta únicamente el **gate visual del usuario** sobre la
preview y la **última milla sin sesión**.

## Qué se entregó

| Pieza                                    | Qué es                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/BROCHURE.html`                     | El anti-manual: 9 escenas, 5 tarjetas, 19 funcionalidades. 56 KB, cero CDNs, abre con doble clic sin internet.                                      |
| `/conoce`                                | La misma pieza servida por la app (rewrite en `next.config.ts` → `public/conoce.html`, copiado en `prebuild` y verificado byte a byte por un test). |
| `docs/brochure-export.json`              | Contrato v1.0.0 adoptado (no calcado): `_schema` tal cual, 10 métricas con `fuente` medida, `estado: "inicial"`.                                    |
| `sprints/ENTREGA-brochure-storyboard.md` | El guion aprobado ANTES de una línea de HTML (regla cero).                                                                                          |
| Fase 0                                   | Barrido de cero enlaces + reglas 11 y 12 (13 y 17 del kit) al `CLAUDE.md`.                                                                          |

## Fase 0 — registro del barrido de CERO ENLACES

El inventario de la planeadora declaraba **1 fuga**; el comando encontró **2 frentes**
(confirma la lección de ds: _el inventario es punto de partida, el gate es EL COMANDO_).

| #   | Dónde                            | Hallazgo                                      | Acción                             |
| --- | -------------------------------- | --------------------------------------------- | ---------------------------------- |
| 1   | Campo `homepage` del repo        | La URL de producción, tal cual                | `gh repo edit --homepage ""`       |
| 2   | `docs/BLUEPRINT.html` (3 líneas) | Literal `*.vercel.app` como patrón de dominio | Reescrito a «subdominio de Vercel» |

**Gate verificado (dos veces: al abrir y al cerrar la entrega):**
`grep -rn "vercel\.app\|workers\.dev" --include="*.md" --include="*.html" --include="*.json" .` → **vacío** ·
`gh repo view --json homepageUrl` → **`""`**

> ⚠️ **Limpieza RECURRENTE, no puntual.** La GitHub App de Vercel **reescribe el campo
> `homepage` en cada deploy de producción**. Hay que re-limpiarlo **después de mergear** esta
> entrega (y después de cada merge a `main`). No es automatizable sin un PAT de administración
> como secret, descartado en un repo público. Queda como paso fijo del cierre de todo PR.

## El conteo: N = 19 · tabla de mapeo

Cuadrado contra `docs/MANUAL-DE-USO.md`. **Agrupar sí, omitir jamás.**

| #   | Funcionalidad                                    | Sección del manual                        | Tarjeta                          |
| --- | ------------------------------------------------ | ----------------------------------------- | -------------------------------- |
| 1   | El semáforo de alimentos                         | El semáforo de la dieta                   | T1 · ¿Esto se puede?             |
| 2   | Equivalencias y reemplazos                       | El semáforo de la dieta                   | T1                               |
| 3   | Aditivos para revisar en etiquetas               | El semáforo de la dieta                   | T1                               |
| 4   | El checklist del día                             | «Hoy» — el checklist del día              | T2 · El día de hoy               |
| 5   | El recordatorio «Ahora mismo»                    | «Hoy» · Recordatorio (S3)                 | T2                               |
| 6   | La hora real de cada comida                      | «Hoy» · Guarda la hora real (S3)          | T2                               |
| 7   | Una nota corta por comida                        | «Hoy» · Nota corta por comida (S3)        | T2                               |
| 8   | Días anteriores                                  | Días anteriores                           | T2                               |
| 9   | Suplementos de la semana                         | Suplementos de la semana                  | T2                               |
| 10  | Respuesta al instante, sin internet              | Chat · forma 1                            | T3 · Pregúntale con tus palabras |
| 11  | Preguntas abiertas con asistente anclado al plan | Chat · forma 2                            | T3                               |
| 12  | La frontera no-médica del chat                   | Chat · Cosas importantes                  | T3                               |
| 13  | La conversación no se guarda                     | Chat · Cosas importantes                  | T3                               |
| 14  | Cargar el archivo de la dieta                    | Cargar tu dieta                           | T4 · Tu dieta, adentro           |
| 15  | Cargar pegando el contenido                      | Cargar tu dieta · «Si el archivo no abre» | T4                               |
| 16  | Dieta demo y letrero de cuál está activa         | Primeros pasos · FAQ                      | T4                               |
| 17  | Instalarla como app                              | Primeros pasos · paso 3                   | T5 · Tuya, en tu teléfono        |
| 18  | Español o English                                | Idioma y borrar datos                     | T5                               |
| 19  | Borrar mis datos                                 | Idioma y borrar datos                     | T5                               |

**Qué NO cuenta, y por qué**

- **El marco no-médico** (nota de primer uso + disclaimer permanente): es el encuadre de toda la
  app, no una funcionalidad. Vive visible en la capa 3 («Requisitos, límites y qué no es»).
- **El brochure mismo**: documenta la app, no se documenta a sí mismo (regla 3 del molde). Por eso
  `/conoce` tampoco cuenta como pantalla del producto en el export (8 `page.tsx`, sin ella).
- **El roadmap de la VISION** (multi-cuidador, avisos, foto, hábitos…): «solo lo real» — no aparece
  ni insinuado.

## Decisiones de la pieza

- **Clímax = «Aquí nadie califica a tu hijo»** (elegido por el usuario sobre la alternativa de
  privacidad). Argumento: toda app seria promete privacidad; **ninguna app de nutrición infantil
  puede prometer no calificar al niño**. El motion ES el argumento — el número se cuenta 0→7 y,
  en el beat donde otra app voltearía a «70 %», el `%` se forma a medias y se deshace. La
  privacidad se quedó con **escena propia y fuerte** (E06), no en un acordeón.
- **Dial `MOTION_INTENSITY` = «cocina serena»** (fijado con el usuario).
- **El riesgo registrado: la cinta del día** (E02, G1 serena) — las 5 comidas del plan en el
  margen y un punto que baja mientras lees. Tu lectura es el día pasando. Aislada por diseño: si
  no suma en la sala de proyección, se retira sin tocar ninguna otra escena.
- **Tipografía (trade-off declarado):** Fraunces y Nunito Sans no viajan en un archivo
  autocontenido → Georgia (display) + system-ui (cuerpo), idéntico en el archivo y en `/conoce`.
- **Light-only, declarado:** el design system de la app lo es por decisión del S1; inventar una
  paleta oscura lo contradiría. Los **tokens de color sí se copian exactos**.
- **Excepciones a solo-`transform`/`opacity`** (las tres comentadas en el código):
  `grid-template-rows` (apertura de tarjeta) · `stroke-dashoffset` (dibujar trazos, un disparo,
  SVG decorativo) · `filter: blur()` (solo en la apertura, con **opacidad 1 en el h1** — LCP honesto).

## Lo que cazó la pasada de capturas (y la CI no habría visto)

Cuatro defectos reales, todos encontrados **mirando las imágenes**, no ejecutando tests:

1. **El escalonado del semáforo estaba invertido** — el chip amarillo se coloreaba antes que el
   verde. Causa: un `calc()` con una variable CSS inexistente invalida la declaración entera y
   desordenaba toda la secuencia. Reescrito con retrasos explícitos por chip.
2. **«Se puede» se partía en dos líneas** y descuadraba la altura del chip → `white-space: nowrap`
   en el estado + textos de apoyo acortados.
3. **El marco del teléfono (E06) quedaba abierto abajo a la izquierda** — el `stroke-dasharray`
   estimado a ojo no coincidía con la longitud real del path. Resuelto con `pathLength="1"` en
   los 15 trazos dibujables: el dash deja de depender de una medida adivinada.
4. **El «%» del clímax flotaba como superíndice** en vez de sentarse en la línea base donde otra
   app pondría «70 %». Anclado con `align-self: baseline`.

## Lo que cazaron los gates automáticos

- **axe:** 3 violaciones reales, todas corregidas → **0**.
  - `landmark-one-main`: faltaba `<main>`.
  - **Hallazgo para el design system de la app:** `--muted-foreground` sobre el fondo crema da
    **4.24:1**, por debajo del 4.5:1 que exige AA para texto normal. El brochure oscurece esa
    tinta lo mínimo (`oklch(0.42 …)`) y lo **declara en el código**. Vale revisarlo en la app.
  - `--primary` sobre `--accent` da **4.13:1** (el «Tip:» y los eyebrow sobre acento) → se añadió
    `--primary-tinta`, misma familia más honda.
- **El guard del propio test de reduced-motion** descubrió que `test.use({ reducedMotion })`
  dentro de un `describe` **no llegaba al contexto** en esta versión de Playwright: el test estaba
  midiendo la rama equivocada. Sustituido por `page.emulateMedia()` explícito. Sin ese guard, el
  test habría pasado a verde midiendo la rama de siempre — exactamente el modo de fallo del piloto.

## Seguridad — deuda pagada, no diferida

`pnpm audit --audit-level high` (gate del CI) destapó **9 advisories high** publicados después del
cierre del S3, incluidos **4 de Next.js** — uno de ellos **SSRF en `rewrites`**, justo el mecanismo
que esta entrega usa para servir `/conoce`. No era diferible:

- **Next 16.2.10 → 16.2.11** (dependencia directa; los 4 advisories parchean ahí).
- Overrides de transitivas en `pnpm-workspace.yaml`, cada una fijada **dentro de su línea mayor**
  y comentada: `brace-expansion`, `undici`, `fast-uri`, `sharp`, `ip-address`, `js-yaml`, `nanoid`
  y **`postcss`** — este último era la deuda «moderate» declarada en el S3, que subió a high.
- Resultado: **`audit --high` limpio**, 212 unit + 78 e2e verdes tras el salto de versión.

## Métricas técnicas

| Métrica                       | Valor          | Fuente                                         |
| ----------------------------- | -------------- | ---------------------------------------------- |
| Funcionalidades               | 19             | medido (contra el manual, verificado por test) |
| Pantallas del producto        | 8              | medido (`page.tsx`; `/conoce` no cuenta)       |
| Pruebas unitarias             | 212            | medido (`pnpm test`)                           |
| Pruebas e2e                   | 78             | medido (2 proyectos)                           |
| Cobertura de líneas del motor | 99.52 %        | medido (v8)                                    |
| Peso del brochure             | 56 502 bytes   | medido (`wc -c`)                               |
| CLS / LCP de `/conoce`        | 0.0000 / 68 ms | medido (Playwright, móvil)                     |
| Costo de operación            | US$0/mes       | calculada                                      |

## Cómo probar

1. `pnpm install` → `pnpm test` (212) → `pnpm test:e2e` (78).
2. **Doble clic en `docs/BROCHURE.html`** con el wifi apagado: debe abrir completo e interactivo.
3. En la preview: `/conoce` en el teléfono — recorrer, abrir tarjetas, llegar al clímax.
4. Con «reducir movimiento» activado en el sistema: **todo el contenido sigue ahí, quieto**.

## Pendiente (del usuario)

1. **Gate visual sobre la preview** — obligatorio, en rondas (no sí/no).
2. **Última milla:** `/conoce` desde afuera, **sin sesión** (incógnito), sin publicar la URL.
3. Tras el merge: **re-limpiar el campo `homepage`** (Vercel lo reescribe en el deploy de prod).
4. El **sello** (INICIAL → SELLADO) queda a tu ritmo, sin fecha: no se espera aquí.
