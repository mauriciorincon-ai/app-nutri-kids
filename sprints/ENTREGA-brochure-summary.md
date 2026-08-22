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
| `docs/BROCHURE.html`                     | El anti-manual: 9 escenas, 5 tarjetas, 19 funcionalidades y 5 muestras de interfaz. 73 KB, cero CDNs, abre con doble clic sin internet.             |
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
| 2   | `docs/BLUEPRINT.html` (3 líneas) | El dominio del proveedor escrito como literal | Reescrito a «subdominio de Vercel» |

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
| Pruebas unitarias             | 214            | medido (`pnpm test`)                           |
| Pruebas e2e                   | 86             | medido (2 proyectos)                           |
| Cobertura de líneas del motor | 99.52 %        | medido (v8)                                    |
| Peso del brochure             | 73 421 bytes   | medido (`wc -c`, con las 5 muestras SVG)       |
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

---

# Delta 1 (2026-08-22) — La apertura por lectura + las muestras de interfaz

> Entra **después** del merge del PR #4, tras el gate visual del usuario sobre la preview.
> Regla 11: toda feature que cambia actualiza brochure **y** export en su mismo PR.

## Qué pidió el usuario, literal

Las tarjetas desplegables concentran la mayor parte de la información y **cobran un peaje por
cada una**. Que se abran al bajar (nunca antes de que haya salido **⅓** de la tarjeta), con una
animación que se vea; que al devolverse estén cerradas y solo se desplieguen hacia abajo; y que
ahí —donde más información hay— haya **muestras de las interfaces** de las que hablan.
No es un capricho de esta app: **se repite en varias apps del portafolio**, y por eso el usuario
pidió llevarlo a la planeadora como estándar (bloque listo más abajo).

## Cómo quedó

| Regla                  | Implementación (medida, no supuesta)                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ⅓ visible para abrir   | `threshold 1/3` contra la **zona de lectura** (viewport −38% inferior). Medido: abre con el borde superior al **46–56%** de pantalla — de frente. |
| Se ve abrirse          | La misma transición del toque (0.45 s) + muestra y features alzando detrás (0.08 → 0.33 s).                                           |
| Solo hacia abajo       | Ancla superior fija: lo que se desplaza queda bajo el pliegue.                                                                        |
| Al devolverme, cerrada | Cierra **solo** la que salió completa por abajo (gracia 8%). Verificado subiendo la pieza entera: las 5 quedan cerradas.              |
| Subiendo no abre       | e2e que recorre hacia arriba afirmando que **ninguna** pasó de cerrada a abierta.                                                     |
| Muestras               | 5 recortes **dibujados en SVG** con el texto real de la dieta demo, uno por tarjeta.                                                  |

**CLS de carga: 0.0000** — es lo que mide el gate, y nada se abre sin que bajes. En el recorrido
sube a 0.13 (escritorio) y 0.32 (móvil): abrir una tarjeta a media pantalla **desplaza a propósito**
lo que va debajo. Es el efecto pedido, medido y declarado, no un descuido.

## La corrección tras el gate visual (misma tarde)

La primera versión del delta pasó todos los gates y **falló el único que importa**. Veredicto del
usuario: _«no veo que se desplieguen… se ven ya desplegadas, y las imágenes gigantes, cero
estética»_. Las dos causas, medidas:

| Síntoma                        | Causa medida                                                                                                              | Corrección                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| «Se ven ya desplegadas»        | Abría con la cabecera al **72–79%** de la pantalla: a punto de salir por abajo. La animación ocurría fuera del campo visual. | Zona de lectura al **38%** → abre al **46–56%**, delante de los ojos.  |
| «Imágenes gigantes»            | La muestra crecía al ancho de la tarjeta: **646×457 px** en escritorio para un dibujo hecho a 320 px (escala ×2).          | Topada a su tamaño natural (`max-width: 300px`), pie a ancho de lectura. |

También cambió el corte de `prefers-reduced-motion`: entregar las cinco abiertas producía el mismo
efecto que el usuario rechazó (un muro ya desplegado). Ahora es **el mismo mecanismo sin
transición** — la tarjeta se abre al llegar, pero cambia de estado en vez de animarse.

**La lección, para el estándar: una animación que ocurre fuera del campo visual no existe, por más
que el test la vea.** Ningún gate automático puede cazar esto; lo caza una persona mirando.

## Decisiones

- **Dibujar las muestras, no incrustar capturas** (elección del usuario sobre 3 opciones): +17 KB
  en vez de ~200 KB, escalan sin pixelarse, usan los tokens del design system y **no pueden
  arrastrar un píxel que no esté escrito en el archivo** — la regla mayor se cumple por
  construcción, no por revisión. Fidelidad verificada contra capturas reales de las 7 pantallas
  corriendo con la dieta demo; esas capturas **no entran al repo**.
- **Cerrar al salir por abajo**, no al primer gesto hacia arriba: cerrar lo que la persona está
  mirando es peor que dejarlo abierto.
- **El toque siempre gana.** Una página que corrige lo que hiciste con el dedo se siente rota.
- **Copy reescrito**: la portada y la capa 1 prometían «ninguna se abre sola». Habría quedado
  mintiendo — el texto es parte de la feature, no decoración.

## Lo que cazó esta ronda

1. **El gate de cero enlaces me delató a mí.** Al documentar la Fase 0 escribí el literal del
   dominio dentro de la tabla del summary, así que el `grep` del gate **dejó de salir vacío**.
   Corregido aquí. Lección: el gate no distingue entre una fuga y su acta — y hace bien.
2. **La limpieza del `homepage` es recurrente, confirmada en vivo:** tras el merge del PR #4,
   Vercel volvió a escribir la URL de producción. Limpiada y re-verificada (`""`).
3. **Una banda de gracia de 25% dejaba la primera tarjeta abierta** al volver arriba del todo:
   estaba fuera de la pantalla pero «dentro» del margen. Ajustada a 8%.
4. **El helper de los e2e corría contra el propio automático**: leía «cerrada» y, entre la lectura
   y el toque, la tarjeta se abría sola — el toque la cerraba y 7 tests fallaban. Ahora reintenta
   (el primer toque la pasa a manual, así que converge siempre).
5. **Los retrasos del stagger iban por `nth-child`**: insertar la `<figure>` habría corrido toda
   la secuencia en silencio. Pasados a `nth-of-type`, que cuenta solo los `.feature`.

6. **El gate e2e podía estar midiendo OTRA app.** La suite completa cayó en masa (8 de 86) sin
   una sola pista: otro proyecto del portafolio tenía tomado el puerto 3000 y, con
   `reuseExistingServer`, Playwright **lo reutilizó**. Pasó dos veces el mismo día (dos apps
   distintas). El falso rojo se ve; **el peligro real es el falso verde**. Reparado: puerto
   configurable (`E2E_PORT`) y `tests/e2e/global-setup.ts`, un **gate de identidad** que exige
   que quien conteste sea Nutri-Kids antes de correr el primer test, con la salida en el
   mensaje de error. De paso apareció un literal `localhost:3000` quemado dentro del test de
   privacidad «CERO red»: ahora el origen propio sale de la config.

## Propuesta de estándar para la planeadora

> **Esta casa no escribe en la planeadora.** El bloque va listo para que el usuario lo lleve a
> `metodo/` o `estandares/` como corresponda. Aquí queda como registro de lo acordado.

**Estándar propuesto — «Apertura por lectura» en piezas con tarjetas desplegables** (brochures y
cualquier documento largo del portafolio):

1. Si las tarjetas desplegables concentran la mayor parte de la información, **se abren al llegar
   a ellas**, no al toque. El toque es el control, no el peaje.
2. Disparo: **⅓ de la tarjeta dentro de la zona de lectura** (viewport menos su 15% inferior).
   Nunca contra el borde crudo: la apertura ocurriría fuera de cuadro.
3. **Ancla superior**: la tarjeta crece hacia abajo. Lo que se desplaza queda bajo el pliegue.
   Consecuencia medible: el CLS no se dispara — y se **mide**, no se supone.
4. **Subiendo no se abre nada.** Cierra solo lo que ya salió completo por abajo, con una banda de
   gracia; jamás lo que la persona esté mirando; y nunca si al encoger la página el documento
   quedara más corto que la posición actual (Safari no compensa).
5. **El toque saca la tarjeta del automático** para el resto de la visita.
6. **`prefers-reduced-motion`**: el automático no existe; todo llega abierto y quieto.
7. **Donde más información hay, va una muestra de la interfaz** de la que se habla, **dibujada en
   SVG** con los tokens del design system — no una captura incrustada (peso, envejecimiento
   silencioso y píxeles no revisados en un repo público). El SVG es ilustración; el `figcaption`
   carga el sentido en palabras.
8. Se verifica con **e2e reales de scroll** (abre al llegar · no abre subiendo · queda cerrada al
   volver · el toque gana · la rama reduced-motion) y con **CLS medido en un recorrido completo**.

Implementación de referencia y su porqué: `docs/BROCHURE.html` (bloque «M1 · Apertura por
lectura») y `design-system.md` de esta app.
