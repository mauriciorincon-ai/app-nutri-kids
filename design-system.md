# Nutrikids — Design System v1 (Sprint 001)

> Fuente de verdad visual de la app. Creado en el Sprint 1 (no había prototipo previo; decisión
> del usuario 2026-07-07: el builder bosqueja, el usuario aprueba sobre la preview). Toda pantalla
> posterior lo obedece; se extiende por ADR, nunca se contradice en silencio.

## Personalidad

**Es:** cálido · cercano · sereno.
**Jamás será:** clínico/hospitalario · gamificado infantil · corporativo. Única excepción, decidida por el dueño el 2026-11-24 (S14, ADR-020): la aventura del modo niño (`/aventura`) — «Las quiero todas»: el huerto de Brote, la expedición de Lumo y el cielo de Nubo, y «El niño elige su mundo». Fuera de ella la app sigue sin gamificar; y ni en ella la comida es premio ni la energía baja.

Es una herramienta de cuidado que usan adultos (la mamá, en su teléfono, a la hora de la
merienda). El tono visual es el de una cocina familiar ordenada: colores de despensa (crema,
terracota, verdes de hierbas), nada de blanco quirúrgico ni verdes neón de app fitness.

## Tokens

Implementados como CSS variables en `src/app/globals.css` (mapeadas a Tailwind vía `@theme`).
**Prohibido el valor mágico suelto en componentes** — si un valor no existe como token, se
propone aquí primero.

### Paleta (modo claro; el oscuro tiene su tabla más abajo, «Tema oscuro»)

| Rol              | Token                | Valor                   | Uso                                                          |
| ---------------- | -------------------- | ----------------------- | ------------------------------------------------------------ |
| Fondo            | `--background`       | `oklch(0.977 0.008 84)` | crema cálido, jamás blanco puro                              |
| Superficie       | `--card`             | `oklch(0.995 0.005 84)` | tarjetas apenas más claras                                   |
| Tinta            | `--foreground`       | `oklch(0.28 0.02 50)`   | marrón-gris cálido (no negro frío)                           |
| Tinta secundaria | `--muted-foreground` | `oklch(0.47 0.02 55)`   | metadatos, horas                                             |
| Acento           | `--primary`          | `oklch(0.55 0.11 45)`   | terracota — CTAs, foco, lo importante. Se gasta con avaricia |
| Acento suave     | `--accent`           | `oklch(0.93 0.03 60)`   | fondos de énfasis leve                                       |
| Borde            | `--border`           | `oklch(0.89 0.015 75)`  |                                                              |
| Destructivo      | `--destructive`      | `oklch(0.50 0.18 25)`   | solo "borrar datos" (0.50: AA en variante suave del botón)   |

### Semáforo (lenguaje central — SIEMPRE símbolo + texto + color)

Cada estado tiene tinta (texto/ícono, AA sobre fondo claro) y superficie (fondo de tarjeta):

| Estado   | Tinta                               | Superficie                                   | Símbolo (lucide) | Texto                    |
| -------- | ----------------------------------- | -------------------------------------------- | ---------------- | ------------------------ |
| Verde    | `--tl-green` `oklch(0.45 0.11 150)` | `--tl-green-surface` `oklch(0.95 0.035 150)` | `CircleCheck`    | "Se puede" / "OK"        |
| Amarillo | `--tl-yellow` `oklch(0.50 0.11 70)` | `--tl-yellow-surface` `oklch(0.96 0.05 85)`  | `TriangleAlert`  | "Con límite" / "Limited" |
| Rojo     | `--tl-red` `oklch(0.50 0.17 25)`    | `--tl-red-surface` `oklch(0.95 0.025 25)`    | `OctagonX`       | "Evitar" / "Avoid"       |

Regla A11y dura: el color solo REFUERZA; el símbolo y el texto comunican solos.

### Tipografía

| Rol                        | Familia                             | Uso                          |
| -------------------------- | ----------------------------------- | ---------------------------- |
| Títulos (`--font-heading`) | **Fraunces** (serif cálida)         | h1–h3, cifras del día        |
| Cuerpo (`--font-sans`)     | **Nunito Sans** (humanista redonda) | todo lo demás                |
| Mono (`--font-mono`)       | stack de sistema (ui-monospace…)    | solo códigos E-* de aditivos |

Escala: 30/24/20 títulos (peso 600), 16 cuerpo, 14 secundario, 13 metadatos. `tabular-nums` en
horas y conteos. Fuentes con `display: swap` (regla del kit: el budget LCP ya lo contempla).
**Presupuesto de fuentes (gate LCP):** máximo 2 familias webfont, variables SIN ejes extra — el
eje SOFT de Fraunces disparaba el LCP a ~5.4s en móvil throttled (medido en CI, sprint 1).

**Eyebrow heading (extensión S3):** rótulo de sección corto en `--font-sans`, 14/peso 600,
`uppercase tracking-wide` y color `--primary` (p. ej. "Ahora mismo" del recordatorio). Es el
ÚNICO heading en mayúsculas; los títulos normales (30/24/20) nunca van en `uppercase`.

### Spacing, radios, sombras, motion

- Spacing: escala Tailwind (múltiplos de 4). Densidad: aireada en Hoy/detalle, compacta en listas.
- Radio base `--radius: 0.75rem` (esquinas amables, misma familia en toda la app).
- Sombras: una sola, sutil (`shadow-sm`); la jerarquía la dan tamaño y espacio, no sombras.
- Motion: 150–250ms, `ease-out`, solo explica causalidad (check que se marca, panel que entra).
  `prefers-reduced-motion` lo apaga todo. **Cero motion JS above-the-fold** (patrón LCP).
- Táctil: todo control ≥44×44px (uso móvil primario).
- **Altura de reserva (anti-CLS):** un bloque que se hidrata de esqueleto → contenido de altura
  variable reserva su altura del estado lleno con `min-h-[…]` para no empujar lo de abajo (gate
  CLS = 0). Caso vivo: `ReminderCard` (`min-h-[8.75rem]`, hasta 5 líneas). Es la única excepción
  aceptada al "prohibido el valor mágico suelto": va justificada en comentario y ligada al gate.

### Apertura por lectura (patrón de piezas largas — brochure; modelo de Velo, adoptado 2026-08-22)

Cuando la mayor parte de la información vive dentro de **tarjetas desplegables**, pedir un toque
por tarjeta es cobrar un peaje por cada una. La regla que quedó tras seis rondas de gate visual
(cinco nuestras + la solución completa de Velo/app-anonimizador, que ya había pagado el camino):

**Una tarjeta está abierta exactamente mientras está a la vista.**

1. **Abre solo bajando**, cuando su cabecera cruza la línea de los **dos tercios de la pantalla**
   (`0 <= top <= vh·⅔`): queda un tercio de pantalla por debajo, donde se la ve crecer — hacia
   abajo desde su cabecera, así que nada de lo ya leído se mueve. El umbral es de PANTALLA, jamás
   de la tarjeta (⅓ de una tarjeta cerrada son ~30 px: abre asomando por el borde, fuera de vista).
   El disparo es **continuo** (rectángulos por cuadro de scroll), no por reposo ni por tick: el
   reposo hace la apertura errática y el tick la hace aleatoria.
2. **Cierra al salir ENTERA de pantalla**, por el borde que sea. Por abajo: con su transición
   (encoge fuera de cuadro). Por arriba: de golpe, sin transición, **reponiendo el scroll con el
   alto exacto perdido** vía `scrollBy({top: -perdido, behavior: "instant"})` — un `scrollBy(x, y)`
   a secas SE ANIMA con `scroll-behavior: smooth` y la página «pega saltos». `overflow-anchor:
none` en `<html>` para que el navegador no compense también (Safari no ancla nunca).
3. **Rectángulos, no IntersectionObserver**: gobierna dónde está la cabecera respecto a la
   pantalla, no cuánto de la tarjeta se ve. Y si hay coreografía de entrada con `translateY`, las
   tarjetas revelan con **umbral 0**: una caja desplazada 18 px miente sobre su posición.
4. **Corre también con `prefers-reduced-motion`**: desplegar es contenido, no decoración; el
   cinturón CSS ya lo abre sin transición.
5. **El toque manual siempre manda**: lo tocado queda en manual y el recorrido no lo toca más.
6. La apertura dura **≥0.6 s** con un cue que no mueve nada (pulso de color en el borde).
7. **Verificación**: el test de la línea (95%/80% no abren, 60% sí, posicionando en dos tiempos),
   «abre al cruzar aún sin detenerte» (bajada continua), «la que quedó atrás ya está recogida»
   (`bottom <= 0` ⇒ cerrada), y deriva cero midiendo **una cabecera visible por frame** — jamás
   `scrollY` — conduciendo con `behavior: "instant"`. Cada test **probado en rojo** contra el
   archivo del commit anterior. Y el gate visual humano, en rondas: nada de esto lo caza la CI.

Donde hay mucha información, la palabra va con **una muestra de la pantalla de la que habla**,
dibujada en SVG con estos tokens (nunca una captura incrustada), topada a su tamaño natural
(dibujada a 320 px → `max-width: 300px`). El SVG es ilustración (`aria-hidden`) y el
`<figcaption>` carga el sentido en palabras.

## Componentes canon (shadcn personalizados)

- **StatusChip** (`components/traffic-light/`): pastilla estado = ícono + texto + tinta semáforo
  sobre su superficie. Único lugar donde viven los colores del semáforo.
- **ItemCard**: nombre + StatusChip + razón en palabras simples; toda la tarjeta es tap target.
- **ChecklistRow** (`components/day-checklist/`): checkbox 44px, hora tabular, texto que NO se
  tacha al marcarse (se atenúa — marcar no es "eliminar").
- **DaySummary**: "Ya hiciste N de M" + qué falta en palabras — sin %, sin nota, sin juicio.
- **Insignia de origen** (`app/perfil`): pastilla con ícono + texto — «según tu plan» (hoja, tinta
  primaria) o «anotado por ti» (lápiz, tinta de texto). El origen nunca se dice solo con color.
- **OptionChip** (`components/traffic-light/`): opción de reemplazo con su textura (símbolo + texto).
  Si la textura hoy no se acepta: borde **punteado** + fondo apagado + «textura que hoy no acepta»;
  va después de las aceptadas y jamás se oculta.
- **MarkChip** (`components/plan-review/`, S6): estado de cada parte de «Revisa tu plan» — círculo
  «Por revisar», visto «Está bien» (tinta verde), lápiz «Corregida» (tinta amarilla) y guion «Mi plan
  no lo trae» (tinta apagada). Símbolo + texto + color, siempre. Un botón desactivado dice POR QUÉ en
  texto debajo (`aria-describedby`), nunca solo se apaga. La lista de partes y el formulario de cada
  fila son tap targets ≥ 44 px; el campo inválido lleva `aria-invalid` y su mensaje.
- **Disclaimer**: elemento permanente del layout (no letra pequeña); versión completa en /ajustes.
- **SourceBanner**: chip siempre visible "Dieta demo" / "Tu dieta" — nadie confunde la demo.
- shadcn base: button, card, checkbox, tabs, dialog, textarea, badge — con los tokens de arriba,
  nunca el default neutro.

## Los 5 estados

Toda pantalla diseña: vacío (primera impresión, explica y invita — nunca ícono gris), cargando
(skeleton con el mismo layout), error (qué pasó + qué hacer, español llano), éxito (confirma con
resumen) y contenido real.

## Microcopy

Coloquial ES primero con paridad EN estructural ("Hoy toca Multivitamínico con el desayuno").
Prohibido: calorías, peso, IMC, percentiles, "cumplimiento", culpa, premio con comida.
El "por qué" del semáforo siempre en palabras simples.

## Decisiones de alcance v1

- **Claro y oscuro desde el S11** (ver «Tema oscuro»). El S1 era solo claro; el oscuro se diseñó con su
  propia paleta AA, no con una inversión automática.
- Orientación: portrait (uso teléfono); desktop ≥1024 = misma app centrada con nav lateral simple.

## Tema oscuro (S11 · ADR-016)

- **Quién manda:** Ajustes → Tema: _Sistema_ (por defecto, sigue al teléfono) · _Claro_ · _Oscuro_. Lo elegido a mano gana
  al teléfono. Se guarda en el aparato como el idioma (`nutrikids.prefs.v1`, no es dato del niño).
- **Sin destello:** un script en línea (`THEME_SCRIPT`, `src/lib/theme-script.ts`) pone la clase `.dark`, `color-scheme` y el color de
  la barra del navegador ANTES del primer pintado. `ThemeSync` lo mantiene al día.
- **Oscuro cálido, no gris azulado:** el mismo «cocina familiar» de noche — marrones tostados (matiz 55–60), crema atenuada
  como tinta, terracota más clara como acento.

| Rol              | Token                | Valor oscuro            |
| ---------------- | -------------------- | ----------------------- |
| Fondo            | `--background`       | `oklch(0.2 0.012 55)`   |
| Superficie       | `--card`             | `oklch(0.245 0.014 55)` |
| Tinta            | `--foreground`       | `oklch(0.93 0.012 80)`  |
| Tinta secundaria | `--muted-foreground` | `oklch(0.76 0.02 70)`   |
| Acento           | `--primary`          | `oklch(0.74 0.11 50)`   |
| Telón de diálogo | `--scrim`            | `oklch(0 0 0 / 55%)`    |

- **Semáforo de noche:** los tonos `--tl-*` invierten el par (texto claro sobre superficie oscura teñida). Siguen siendo
  símbolo + texto + color (regla 4); aquí solo cambia el tono.
- **La verificación:** toda pasada de axe de las e2e pasa por `tests/e2e/theme.ts`, que falla si la página no está de verdad
  en el tema que se dice medir (clase de `<html>`, `color-scheme` y luminancia del fondo). Hasta el S10 las pasadas «dark» eran
  el claro dos veces.

## Bienestar (S10 · ADR-015)

- **Tonos del ánimo:** `--mood-{happy,tired,anxious,quiet,other}` y su `-surface` (claro y `.dark`), mapeados como `--color-mood-*`. Lejos del semáforo de alimentos y **nunca rojo**: «dentro» usa `happy`, «por debajo / por encima» usa `tired`, «sin cifra» usa `other`.
- **Elegido = marca ✓ + borde + relleno.** Ningún estado de bienestar se distingue solo por color (regla 4).

## El día a día: lonchera, recetas y viaje (S11 · ADR-017)

- **Un estado de receta es símbolo + palabra + color** (`StateChip`): «Con lo de tu plan» ✓ (verde), «Con medida» ⚠ (amarillo), «Algo no está en tu plan» ? (neutro). Lo desconocido **nunca** es verde. Una receta bloqueada no se pinta: se explica en «Ver por qué algunas no se muestran».
- **Elegir = marca ✓ + borde + relleno** también en los filtros, la despensa, los días de la lonchera y el modo de viaje (`aria-pressed`, táctil ≥ 44 px), igual que el ánimo del S10.
- **Estados de la lonchera con icono y palabra:** empacado (caja), «se lo comió» (✓), «volvió a casa» (casa). Sin rojo: volver a casa no es un fallo.
- **Hoja para imprimir:** `data-print-sheet` marca lo que sale en papel (la etiqueta y el documento del viaje) y `data-no-print` lo que se esconde; en papel todo es negro sobre blanco, sin fondos. El QR lleva zona de silencio blanca propia (`bg-white`) en los dos temas, porque un QR sobre fondo oscuro no se lee.
- **Una fila de enlaces, no una barra nueva:** en Hoy, «Para el día a día» con enlaces estáticos (Lonchera · Recetas · Viaje, y desde el S12 la Cámara); la barra inferior se queda en 6.
- **Aviso no médico en cada pantalla**, como elemento fijo (`notMedical`), y el del documento del viaje «contiene datos de salud» en un bloque propio, no en letra pequeña.

## La cámara (S12 · ADR-018)

- **Lo que el modelo vio no es un dato:** «Lo que vio» es una lista para revisar, no un resultado. Cada nombre que cuadra con el catálogo sale **sin marcar** y entra a la despensa solo cuando quien cuida lo toca («Lo tengo en casa»); lo que no cuadra se muestra aparte, sin acción, bajo «Vio esto, pero la app no lo conoce». Elegir = marca ✓ + borde + relleno (`aria-pressed`, táctil ≥ 44 px), como en el resto.
- **Mirar el plato usa el mismo lenguaje del semáforo:** cada alimento lleva `StatusChip` (símbolo + palabra + color); una alergia o intolerancia anotada se pinta como rojo con su propio texto («Choca con lo anotado…»); lo que el plan no nombra es **neutro con «?»**, jamás verde. Los grupos que faltan se dicen con «Puede estar y no verse», sin reproche.
- **«Verifícalo con un adulto» va en un bloque fijo** (fondo `accent`, letra media) al inicio de todo resultado de la cámara y de «Qué cocinar», no en letra pequeña.
- **Los títulos bajan de a un nivel:** en `/camara/cocina` los bloques de resultados son `h2` bajo el `h1` (axe `heading-order`); el panel «Cómo va el motor» y la rejilla «Marcar a mano» son `<details>` con su `summary` de 44 px, abiertos solos cuando el teléfono no puede con el modelo.
- **Estados de la descarga con palabra, no solo barra:** «Descargando el modelo… N de unos M MB» (`role="status"`), «Preparando el modelo…» si ya estaba guardado, y el fallo con `role="alert"`, su salida («Marcar a mano en Recetas») y «Volver a intentar».
- **Entrada a la cámara:** un enlace más en la fila «Para el día a día» de Hoy (Lonchera · Recetas · Viaje · Cámara); la barra inferior se queda en 6.

## La etiqueta y el súper (S13 · ADR-019)

- **Cuatro veredictos, todos con símbolo + palabra + color:** «No va» (rojo `StatusChip`), «Revisa» (amarillo), «No vi nada que choque» (verde) y «No pude leerla» (neutro con «?»: `CircleHelp` sobre `muted`, jamás verde). Un texto mal leído nunca se pinta como «apto»; «No vi nada que choque» describe lo que se leyó, no promete que sea seguro.
- **Cuando el veredicto sale del catálogo, el neutro dice lo que pasa:** «Sin lista de ingredientes» (mismo `CircleHelp`), y el bloque fijo dice «el catálogo puede estar incompleto» en vez de «el lector puede equivocarse». Lo que está en «puede contener» se dice «Puede llevar», nunca «Lleva». «Anotado en lo que compré» es un `role="status"` en `tl-green` (contraste AA), no un botón apagado: un control deshabilitado baja el contraste por debajo de AA. «Marcas que sí van» solo aparece cuando el producto no encaja o no se sabe qué lleva.
- **Lo leído va a la vista:** «Lo que se leyó» es un `<details>` abierto con su `summary` de 44 px, para que quien cuida compare con la etiqueta; el texto respeta saltos de línea y no corta palabras.
- **«Verifícalo con un adulto» va en el mismo bloque fijo** (fondo `accent`, letra media) que en la cámara, en todo resultado de la etiqueta y del súper, también cuando el veredicto sale del catálogo.
- **El aviso de «Lo que compré» es calmado:** una fila con símbolo + palabra + color y una frase en tono práctico («Esto que compraste no va con tu plan: …»), sin rojo a pantalla completa, sin mayúsculas ni signos de alarma; «Quitar» es un botón de 44 px con `aria-label` que nombra el producto.
- **La descarga se dice con palabras:** «Descargar el lector» / «Descargar el catálogo» con su tamaño antes del toque, «Descargando: N de M MB» (`role="status"`), el fallo con `role="alert"` y «Intentar de nuevo»; sin el lector o el catálogo siempre queda una salida (la foto de la etiqueta, escribir el código).
- **La atribución ODbL es parte de la pantalla, no letra pequeña:** «Datos de productos © colaboradores de Open Food Facts, bajo la licencia ODbL» con «Ver la licencia», en el modo súper y en Ajustes.
- **Entrada:** dos enlaces más en `/camara` («Leer la etiqueta de un producto», «Modo súper: escanear un código de barras»); la barra inferior se queda en 6 y Hoy no gana nada.

## La familia y la aventura (S14 · ADR-020)

- **Para la familia y «Cuando le ofrecen algo» son pantallas calmadas, sin alarma:** lecciones en `<details>` de 44 px con su fuente al pie; «Qué sí y qué no» con `StatusChip` (rojo «No», amarillo «Con condición», verde «Sí») y sin una sola cifra; el registro se llena con `ChoiceRow` (cuatro preguntas, sin texto libre) y el patrón dice «dónde» y «qué», jamás «quién». Los enlaces entre estas pantallas no precargan (`prefetch={false}`).
- **La aventura es la única excepción a «gamificado infantil»,** y es del dueño: «Las quiero todas» y «El niño elige su mundo» (`docs/diseno/marca/juego.html`). Son tres mundos, un solo juego. **Brote** (el huerto; la energía son gotas), **Lumo** (la expedición; chispas de luz) y **Nubo** (el cielo; estrellas) dibujan la MISMA energía: cambiar de mundo no la borra ni la parte, y se puede hacer en cualquier momento. Sus colores son los tokens `--adv-*` de `globals.css` (claro y oscuro); no se usan fuera de `/aventura`.
- **La energía solo sube y jamás sale de comer.** Sale de dormir, moverse o jugar, el agua, el sol, ayudar en la cocina y conocer algo nuevo (mirarlo o tocarlo cuenta igual que probarlo); la pantalla no cuenta. Una chispa por hábito y día, sin rachas, sin metas, sin pérdida: nada se marchita, se apaga ni se pierde de vista. Lo que falta para el siguiente paso se dice en positivo («Con 2 gotas más nace una flor nueva»); al final, «Las gotas siguen sumando».
- **Cada ficha lleva símbolo + palabra + color, y lo hecho lleva ✓ y «hecho»:** seis fichas (dormir, moverse, agua, sol, cocina, algo nuevo) con los mismos seis símbolos en los tres mundos (`glyph.tsx`). Las fichas de lo que ya está en el día de la familia solo se ven; la de la cocina es un botón de 64 px que toca el niño. La forma cambia por mundo (tarjetas, sellos redondos, píldoras), nunca el significado.
- **Pantalla completa y táctil de niño:** sin cabecera, sin barra inferior, sin plan ni Ajustes; botones de 64 px o más (los tres mundos y la cocina), texto de 12 px como mínimo en las fichas, `aria-label` en cada dibujo y `prefers-reduced-motion` respetado (el farol de Lumo solo respira cuando se permite el movimiento). Pasa por axe en los dos temas reales.
- **El modo niño es de un adulto:** se activa en `/aventura` («Activar modo niño») y el teléfono se queda ahí, también con Atrás y con una URL escrita (el script del `<head>` y `KidGuard`). La salida pide al adulto mantener pulsado dos segundos y resolver una suma que se lee en palabras, escrita con el teclado numérico. El aviso «no reemplaza a tu pediatra» va al pie de la pantalla, sin enlace a Ajustes.
- **Entrada:** un tercer enlace en «Para la familia» de Hoy («La aventura de tu peque»); la barra inferior se queda en 6.
