---
id: pieza-brochure-nutri-kids-storyboard
titulo: Storyboard — El brochure vivo de Nutri-Kids (/conoce)
arquetipo: app # molde v2 del kit (BROCHURE.plantilla.html) + banco de técnicas en vanilla
elemento_tipo: entregable
rigor: completo
capa: producto
version: 1.0.0
fecha: 2026-08-22
estado: aprobado # «guion aprobado» del usuario, 2026-08-22 — antes de una línea de HTML
objetivo: "El recorrido de la mamá por Nutri-Kids, contado con el sosiego de una cocina en calma: el día pasa mientras ella lee, y al final el número se niega a volverse nota."
depende_de: [ENTREGA-brochure-summary.md]
relacionado_con: [docs/BROCHURE.html, docs/brochure-export.json]
tags: [pieza, storyboard, g-guion, brochure, inicial]
---

# Storyboard — El brochure vivo de Nutri-Kids

> **El contrato de G-Guion.** Sin este documento aprobado no se toca el HTML. Si no reconoces
> aquí tu idea, se corrige aquí — el punto más barato.
> Cobertura: **todos los mensajes del brochure (n/n)** — agrupar sí, omitir jamás.
>
> **Decisiones del usuario ya selladas (2026-08-22):** storyboard primero · dial
> `MOTION_INTENSITY` = **«cocina serena»** · **clímax = «sin culpa»** (la privacidad se queda
> con su propia escena fuerte, E06, pero no es el pico) · modo **INICIAL** (se sella con el
> cierre de pruebas del usuario, sin fecha).

## La narrativa

Ella abre el link en su teléfono, probablemente de pie en la cocina. Lo primero que ve no es un
documento: es una frase que se **enfoca palabra por palabra**, como quien por fin entiende algo
que llevaba semanas en un PDF de 36 páginas: _La dieta de tu peque, viva en tu bolsillo._ Debajo,
un sello discreto y honesto: esto es un brochure **inicial**, y lo dice sin disimular.

Al bajar descubre la regla del viaje: por el borde izquierdo corre **la cinta del día** — cinco
marcas diminutas, las cinco comidas del plan, y un punto terracota que va cayendo de desayuno a
cena mientras ella avanza. Nadie se lo explica. Su lectura **es** el día pasando.

Las cinco puertas la esperan. Entran asentándose una tras otra y cada icono **se termina de
dibujar** al llegar — los mismos iconos que ya viven en su app. Ninguna se abre sola: cuando
ELLA toca una, se abre como un cajón sereno y las features se acomodan en fila, una por
instante, en orden de lectura.

Entre "qué hace" y lo fino, un respiro de dos segundos: **el semáforo se arma solo**. Primero
llega el símbolo, después la palabra, y solo al final el color. Es la regla de accesibilidad de
la app demostrada en vez de explicada: el color nunca comunica solo.

Después, la garantía. Un teléfono dibujado en trazo; adentro, las horas y las notas del día. Le
pregunta algo al chat y de ahí sale **una sola flecha** que se lleva la dieta sin nombre — y las
horas y las notas **no se mueven ni un pixel**. Lo que ella escribió sobre su hijo se queda
adentro. Siempre.

Y entonces el clímax, que no es un truco: es la promesa que ninguna otra app de nutrición puede
hacer. El número **se cuenta solo** — 7 de 10 — y justo en el instante en que cualquier otra app
lo voltearía a "70 %", el signo de porcentaje **empieza a formarse y se deshace**. Nunca llega.
Debajo, en palabras: _sin puntaje, sin porcentaje, sin calorías._ Y la lista corta de las
palabras que esta app no dice, vigilada por una prueba que corre en cada cambio.

Después del pico, la página baja la voz: lo fino se lee, no se dramatiza. Cierra con la verdad
contable — el **19** se cuenta a sí mismo, la cinta del día llega a su meta — y con lo único que
un anti-manual puede prometer: están todas, y las descubres a tu ritmo.

## Decisiones de pieza

- **Dial `MOTION_INTENSITY` = «cocina serena»** — coreografía constante pero sin espectáculo:
  curvas largas, entradas que se asientan, y **una sola escena con movimiento propio continuo**
  (el clímax). Fiel al design system: _cálido · cercano · sereno_, motion que solo explica
  causalidad.
- **Gramática dominante: G3** (coreografía temporizada + IntersectionObserver, sin secuestrar el
  scroll). **G2** en las tarjetas (máquina de estados). **Un momento G1 serena** con
  justificación narrativa: la cinta del día (E02) — mapeo puro scroll→progreso, sin pin, sin
  scrub-jack.
- **Identidad en una frase (dirección de arte):** _«La página se mueve como una cocina en calma:
  todo llega a su tiempo, nada apura — y nada califica.»_
- **El riesgo registrado:** **la cinta del día** (E02). Un personaje persistente guiado por
  scroll en el margen de un documento es raro; aquí es la tesis del producto vuelta navegación
  (la app organiza EL DÍA; leerla es recorrer un día). Cuesta ~1 pantalla de scroll en móvil, no
  3–4. Lo juzgas tú en la sala de proyección.
- **Motion-system (tokens de la pieza, derivados del DS de la app):**
  - Curvas: la del DS (`ease-out`, 150–250 ms) + `--ease-asentar: cubic-bezier(.22, 1, .36, 1)`
    (decelera largo, sin rebote — el "aliento" de la pieza).
  - Duraciones: `--dur-corta` 220 ms · `--dur-escena` 600 ms · `--dur-apertura` 900 ms. Nada de
    números mágicos sueltos.
  - Vocabulario: **enfocar** (blur→nítido) · **alzar** (sube y se asienta) · **dibujar** (el
    trazo se completa) · **asentar** (llega y se queda) · **latir** (pulso lento de invitación).
  - Stagger con jerarquía, jamás uniforme: título → apoyo → señal; tarjetas a ~70 ms con la
    primera entrando sola un beat antes.
- **Tipografía (trade-off declarado):** Fraunces y Nunito Sans son webfonts de marca y **no
  viajan** en un archivo autocontenido (peso + cero CDNs). Salida: **Georgia** para display +
  **system-ui** para cuerpo, idéntica en el archivo y en `/conoce` (las dos vidas no se
  desincronizan). Los **tokens de color sí se copian exactos** del design system.
- **Tema: light-only, declarado.** El DS de la app es light-only por decisión del S1 ("el modo
  oscuro se diseñará con su propia paleta AA cuando un sprint lo priorice"). Inventar una paleta
  oscura para el brochure contradiría el DS, así que la pieza no la finge. El brochure además
  vive fuera del storage de la app: no puede seguir su selector de tema, solo el del sistema.
- **Excepciones declaradas a "solo `transform`/`opacity`":** (1) `grid-template-rows` en la
  apertura de tarjeta (heredada del molde, un disparo por clic); (2) `stroke-dashoffset` para
  **dibujar** los iconos y el marco del teléfono (una vez, sobre SVG decorativo `aria-hidden`);
  (3) `filter: blur()` en **enfocar** (solo apertura, jamás en scroll) con **opacidad SIEMPRE 1
  en el h1** (LCP honesto). Las tres van comentadas en el código con su porqué.
- **Lo que el cine NO negocia aquí:** autocontenido (vanilla, cero CDNs, abre con doble clic sin
  internet) · reduced-motion = **corte editorial completo por escena** (verificado por e2e, no
  prometido) · lo cerrado FUERA del árbol de accesibilidad · **cero datos del menor** (todo
  sintético) · **cero URLs de producción** (regla 17) · el conteo 19 del pie cuadrado con el manual.

## Inventario COMPLETO de escenas

### E01 · Portada — la frase que por fin se entiende

| Campo                                | Valor                                                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | La promesa: _La dieta de tu peque, viva en tu bolsillo_ — y el sello honesto de que esto es un brochure INICIAL.                                                              |
| **Gramática**                        | G3                                                                                                                                                                            |
| **Técnica**                          | Cascada **enfocar** palabra por palabra (blur 3px→0, patrón yevtam) + la línea de apoyo **alza** con retraso + la flecha de bajar **late** lento.                             |
| **Cómo el motion cuenta el mensaje** | El título se enfoca como se entiende algo que estaba borroso: exactamente lo que la app le hace a un PDF de 36 páginas. La claridad no se afirma, se ejecuta delante de ella. |
| **Assets + origen**                  | Ninguno externo. Título en spans por palabra (`aria-hidden`) con el texto íntegro en `aria-label`.                                                                            |
| **Peso estimado**                    | ~1 KB CSS/JS.                                                                                                                                                                 |
| **Frame budget / propiedades**       | `transform` + `opacity` + excepción declarada `filter: blur()`. **El h1 mantiene `opacity: 1` siempre** (candidato LCP: sube y se enfoca, jamás nace invisible).              |
| **Reduced-motion**                   | Todo en su pose final desde el primer frame, nítido; la flecha no late. El sello INICIAL y la promesa completos. Nada falta.                                                  |

### E02 · La cinta del día — tu lectura es el día que pasa _(el riesgo de la pieza)_

| Campo                                | Valor                                                                                                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | La tesis del producto: esta app organiza EL DÍA. Recorrer la página es recorrer un día.                                                                                                                                                             |
| **Gramática**                        | **G1 serena** (scroll→progreso, mapeo puro; sin pin, sin scrub-jack, sin tocar la rueda).                                                                                                                                                           |
| **Técnica**                          | Hairline en el borde izquierdo con **5 marcas** (las 5 comidas del plan demo: desayuno · media mañana · almuerzo · merienda · cena) + punto terracota que baja con `translateY` interpolado en rAF (lerp 0.14), y el rAF **se apaga al asentarse**. |
| **Cómo el motion cuenta el mensaje** | El avance del punto ES el avance del lector: sin una palabra, la página enseña que la app vive en el tiempo del día. Al llegar al pie, el punto toca su meta (ver E09).                                                                             |
| **Assets + origen**                  | CSS + un `<div>` mínimo. Las 5 marcas y sus horas salen de `data/demo-diet.json` (dieta demo inventada — **cero datos reales**).                                                                                                                    |
| **Peso estimado**                    | ~1,5 KB JS.                                                                                                                                                                                                                                         |
| **Frame budget / propiedades**       | Solo `transform: translateY`. Cero lectura de layout en el tick (medidas cacheadas en `resize`).                                                                                                                                                    |
| **Reduced-motion**                   | La cinta **no existe como animación**: aparece completa y quieta, con el punto en su meta. Decoración estática de margen; ningún mensaje depende de ella.                                                                                           |

### E03 · Las cinco puertas — entradas con oficio

| Campo                                | Valor                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | Qué hace la app, en 5 grupos — y que se sienta la mano que lo hizo (esto no es plantilla).                                                                                                                                               |
| **Gramática**                        | G3                                                                                                                                                                                                                                       |
| **Técnica**                          | Tarjetas que **alzan y se asientan** con stagger jerárquico (la primera entra sola un beat antes; las demás a ~70 ms) + cada icono **se dibuja** (`stroke-dashoffset`, un disparo).                                                      |
| **Cómo el motion cuenta el mensaje** | El orden de aparición ES la jerarquía: primero la pregunta de todos los días ("¿esto se puede?"). El trazo dibujándose dice "hecho a mano", el argumento anti-genérico.                                                                  |
| **Assets + origen**                  | Los **mismos iconos lucide de la app**, copiados como SVG idénticos: `Search` (`/dieta`) · `Clock` (`reminder-card`) · `Sparkles` (`chat-panel`) · `FileUp` (`/cargar`) · el de Ajustes (`bottom-nav`). Cero emojis (el DS los prohíbe). |
| **Peso estimado**                    | ~2 KB.                                                                                                                                                                                                                                   |
| **Frame budget / propiedades**       | `transform`/`opacity` + excepción declarada `stroke-dashoffset` (decorativo, un disparo).                                                                                                                                                |
| **Reduced-motion**                   | Tarjetas e iconos completos y dibujados desde el primer frame.                                                                                                                                                                           |

### E04 · La tarjeta abierta — el cajón sereno (G2)

| Campo                                | Valor                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mensaje**                          | Nadie lee lo que no pidió — pero cuando pides, la casa te recibe ordenada.                                                                                                           |
| **Gramática**                        | G2 (máquina de estados cerrada/abierta).                                                                                                                                             |
| **Técnica**                          | Apertura `grid-rows: 0fr→1fr` + `visibility` en la transición + **coreografía interior**: las features **alzan** en fila (stagger ~40 ms) + presión táctil `scale(.99)` en el press. |
| **Cómo el motion cuenta el mensaje** | El detalle no "aparece": te lo van sirviendo en orden de lectura — el mismo respeto por el ritmo de la persona que tiene la app.                                                     |
| **Assets + origen**                  | Todo propio.                                                                                                                                                                         |
| **Peso estimado**                    | ~1 KB.                                                                                                                                                                               |
| **Frame budget / propiedades**       | `transform`/`opacity` (+ `grid-template-rows` ya declarada).                                                                                                                         |
| **Reduced-motion**                   | La tarjeta abre sin transición con TODO su contenido en pose final.                                                                                                                  |

### E05 · El respiro — el semáforo en dos segundos

| Campo                                | Valor                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | El lenguaje central de la app: **símbolo + texto + color — el color nunca comunica solo**.                                                                    |
| **Gramática**                        | G3 (corrida temporizada al entrar en viewport, una vez).                                                                                                      |
| **Técnica**                          | Los 3 StatusChip se arman en secuencia: llega el **símbolo**, después la **palabra**, y **solo al final el color** (la superficie tiñe con un fundido corto). |
| **Cómo el motion cuenta el mensaje** | Es la regla dura de accesibilidad DEMOSTRADA: el chip ya se entendía completo antes de tener color. Lo que en el DS es una línea de reglamento, aquí se ve.   |
| **Assets + origen**                  | Iconos `CircleCheck` / `TriangleAlert` / `OctagonX` y los tokens `--tl-*` — **los mismos** del design system.                                                 |
| **Peso estimado**                    | ~1,5 KB.                                                                                                                                                      |
| **Frame budget / propiedades**       | `transform`/`opacity` (el color entra por `opacity` de una capa de superficie, no por animación de `background-color`).                                       |
| **Reduced-motion**                   | Los 3 chips completos —símbolo, palabra y color— quietos. El mensaje es idéntico; solo se pierde el orden de llegada.                                         |

### E06 · La garantía — lo que ella escribe se queda adentro

| Campo                                | Valor                                                                                                                                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | El registro del día (horas y notas del niño) **jamás viaja** — ni siquiera al chat de IA.                                                                                                                                                                                  |
| **Gramática**                        | G3                                                                                                                                                                                                                                                                         |
| **Técnica**                          | Teléfono dibujado en trazo; adentro, filas sintéticas de registro (horas + una nota inventada). Al preguntarle al chat, **una sola flecha** sale del marco llevando la dieta sin nombre; las filas del registro **no se mueven ni un pixel** y quedan visiblemente dentro. |
| **Cómo el motion cuenta el mensaje** | El test negativo del S3 vuelto imagen: lo que sale, sale sin nombre; lo que ella escribió, no sale. La quietud de esas filas es el argumento — no se explica, se ve.                                                                                                       |
| **Assets + origen**                  | SVG propio (trazo 1.5, estilo de los iconos de la app). **Contenido 100 % sintético**: horas y una nota inventadas, jamás datos reales (regla mayor).                                                                                                                      |
| **Peso estimado**                    | ~2 KB.                                                                                                                                                                                                                                                                     |
| **Frame budget / propiedades**       | `transform`/`opacity` + `stroke-dashoffset` (ya declarada) para dibujar marco y flecha.                                                                                                                                                                                    |
| **Reduced-motion**                   | Composición estática: marco y flecha ya dibujados, el registro dentro, y el texto íntegro de la garantía visible. El mensaje completo sin un frame de movimiento.                                                                                                          |

### E07 · CLÍMAX — «Aquí nadie califica a tu hijo»

| Campo                                | Valor                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | LA promesa mayor: aquí no hay puntaje, ni porcentaje, ni calorías, ni peso. Marcar el día no es una nota.                                                                                                                                                                                                                     |
| **Gramática**                        | G3 — la única escena con movimiento propio continuo (la promesa que nunca descansa).                                                                                                                                                                                                                                          |
| **Técnica**                          | «Ya hiciste **7** de 10» con el 7 contándose 0→7 (~700 ms, `tabular-nums`, ancho fijo en `ch`). En el beat exacto en que cualquier otra app voltearía a «70 %», el glifo `%` **empieza a formarse y se deshace** (escala + opacidad, nunca completa). Debajo, el texto visible y la lista de las palabras que la app no dice. |
| **Cómo el motion cuenta el mensaje** | El motion ES el argumento: **el número se niega a volverse nota**. Ninguna otra app de nutrición infantil puede hacer esta promesa; aquí no se afirma, se ejecuta delante de ella. El texto queda VISIBLE — jamás en un acordeón.                                                                                             |
| **Assets + origen**                  | Solo tipografía y CSS. Las cifras (7 de 10) son las del checklist de la **dieta demo**; las palabras prohibidas salen de la regla dura 2 y del test `microcopy.test.ts`.                                                                                                                                                      |
| **Peso estimado**                    | ~1,5 KB.                                                                                                                                                                                                                                                                                                                      |
| **Frame budget / propiedades**       | `transform`/`opacity`; el contador muta texto en rAF sin layout thrash (ancho `ch`). Loop del `%` pausado fuera de viewport (IO) y bajo `document.hidden`.                                                                                                                                                                    |
| **Reduced-motion**                   | Número final quieto («7 de 10»), **el `%` nunca existe**, y el texto completo de la promesa + la lista de palabras, íntegros. Es la escena que mejor sobrevive sin movimiento.                                                                                                                                                |

### E08 · Lo fino — la página baja la voz

| Campo                                | Valor                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | Qué mide y qué no finge medir · requisitos y limitaciones honestas · el marco no-médico · el mapa de rutas.                        |
| **Gramática**                        | G3 + G2 (`details` nativo).                                                                                                        |
| **Técnica**                          | Entradas **alzar** con el reveal general; al abrir un `details`, su cuerpo **alza** una vez (60 ms de retraso interior). Nada más. |
| **Cómo el motion cuenta el mensaje** | Ritmo: _toda escena clímax = ninguna lo es_. Después del pico, sosiego — lo fino se lee, no se dramatiza.                          |
| **Assets + origen**                  | Rutas reales de la app (un e2e verifica que todas existan).                                                                        |
| **Peso estimado**                    | ~0,5 KB.                                                                                                                           |
| **Frame budget / propiedades**       | `transform`/`opacity`.                                                                                                             |
| **Reduced-motion**                   | Apertura instantánea completa.                                                                                                     |

### E09 · Cierre — el número que se cuenta solo

| Campo                                | Valor                                                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mensaje**                          | Están las **19**, ninguna por fuera — y el día que empezaste a leer, se completó.                                                                                                |
| **Gramática**                        | G3 (+ remate del G1 de E02).                                                                                                                                                     |
| **Técnica**                          | El **19** se cuenta 0→19 (~700 ms, una vez al entrar en viewport; el texto accesible dice "19 funcionalidades" desde el primer byte) + la cinta del día llega a su última marca. |
| **Cómo el motion cuenta el mensaje** | El dato duro dramatizado + la metáfora de la cinta cerrada: leerlo todo también fue recorrer un día completo.                                                                    |
| **Assets + origen**                  | Reutiliza la cinta de E02.                                                                                                                                                       |
| **Peso estimado**                    | ~0,5 KB.                                                                                                                                                                         |
| **Reduced-motion**                   | «19» quieto desde siempre; la cinta en su meta.                                                                                                                                  |

## Cuadre de mensajes contra el brochure

| Mensaje del brochure                                   | Escena(s)        |
| ------------------------------------------------------ | ---------------- |
| La promesa / identidad + sello INICIAL                 | E01              |
| La app vive en el tiempo del día                       | E02 · E09        |
| Qué hace — los 5 grupos (19 funcionalidades)           | E03 · E04        |
| El semáforo: símbolo + texto + color, nunca color solo | E05              |
| El registro jamás viaja (ni al chat)                   | **E06**          |
| **Sin culpa: ni puntaje, ni porcentaje, ni calorías**  | **E07 (clímax)** |
| Qué mide y qué no finge medir                          | E08              |
| Requisitos, limitaciones y marco no-médico             | E08              |
| El mapa de rutas                                       | E08              |
| Conteo completo (19) y brochure vivo                   | E09              |

**Total escenas: 9 · Mensajes cubiertos: 10/10 · Funcionalidades: 19/19** (tabla de mapeo
completa en `ENTREGA-brochure-summary.md`).

## Fuentes

- `docs/MANUAL-DE-USO.md` — la fuente del conteo (19 funcionalidades) y del "cómo se usa".
- `docs/GUIA-DE-PRUEBA.html` — el detalle operativo real de cada pantalla.
- `VISION.md` (planeadora, RO) — la promesa y el tono. **Se toma solo lo `[MVP]` construido**:
  el roadmap (multi-cuidador, avisos, foto, hábitos…) NO aparece — «solo lo real».
- `design-system.md` — personalidad, tokens, la regla del semáforo, light-only, eyebrow heading.
- `docs/BLUEPRINT.html` — dominio y protección de deployment (la última milla).
- Molde v2 `BROCHURE.plantilla.html` + `BROCHURE-banco-de-tecnicas.md` (kit, RO).
- Piloto de referencia: `app-habla` (storyboard + brochure), RO.

## Gaps

- **El feel no es verificable por CI** ("la CI verifica el comportamiento, no la experiencia"):
  la sala de proyección eres tú, en tu teléfono, a velocidad real. Este storyboard es el
  contrato de qué vas a ver.
- **La cinta del día (E02) no tiene precedente en esta app**: es el riesgo registrado. Si en la
  sala de proyección no suma, se retira sin tocar ninguna otra escena (está aislada por diseño).
