# Nutri-Kids — Design System v1 (Sprint 001)

> Fuente de verdad visual de la app. Creado en el Sprint 1 (no había prototipo previo; decisión
> del usuario 2026-07-07: el builder bosqueja, el usuario aprueba sobre la preview). Toda pantalla
> posterior lo obedece; se extiende por ADR, nunca se contradice en silencio.

## Personalidad

**Es:** cálido · cercano · sereno.
**Jamás será:** clínico/hospitalario · gamificado infantil · corporativo.

Es una herramienta de cuidado que usan adultos (la mamá, en su teléfono, a la hora de la
merienda). El tono visual es el de una cocina familiar ordenada: colores de despensa (crema,
terracota, verdes de hierbas), nada de blanco quirúrgico ni verdes neón de app fitness.

## Tokens

Implementados como CSS variables en `src/app/globals.css` (mapeadas a Tailwind vía `@theme`).
**Prohibido el valor mágico suelto en componentes** — si un valor no existe como token, se
propone aquí primero.

### Paleta (modo claro — S1 es light-only, decisión documentada abajo)

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

- **Light-only en S1.** El modo oscuro se diseñará con su propia paleta AA (no inversión
  automática) cuando un sprint lo priorice; queda anotado como extensión, no deuda.
- Orientación: portrait (uso teléfono); desktop ≥1024 = misma app centrada con nav lateral simple.
