# Nutrikids — Manual de uso

> **Documento obligatorio y vivo.** Toda feature que llega a `main` se documenta aquí en el mismo
> sprint (regla 9 del CLAUDE.md). Escrito para el **usuario final** en español llano — sin jerga
> técnica ni referencias al código. Al lanzar la app (F5), este manual es la base de la guía de
> usuario pública.

## Qué es esta app

Nutrikids convierte el plan de alimentación de tu peque (ese PDF largo que nadie relee a la hora
de la merienda) en una guía viva en tu teléfono: qué se puede y qué no (con un semáforo), con qué
reemplazar lo que falta, qué suplemento toca hoy y un checklist para ir marcando el día.
**Importante:** es una ayuda para el día a día — no reemplaza a tu pediatra ni a tu nutricionista.

## Primeros pasos

1. Abre la app en el navegador del teléfono (Chrome funciona muy bien).
2. La primera vez verás una nota que explica que la app no es consejo médico. Toca
   **"Entendido, empezar"**.
3. **Instálala como app:** en Chrome, toca el menú (⋮) → **"Agregar a pantalla de inicio"**.
   Queda con su ícono, como cualquier app.
4. La app arranca con una **dieta demo de ejemplo** (lo dice un letrero arriba). Así puedes
   explorar todo antes de cargar la dieta de verdad.

## Features

### Cargar tu dieta · desde Sprint 001 (con el PDF, desde Sprint 006)

- **Qué hace:** guarda el plan de tu peque EN TU TELÉFONO (no viaja a ningún servidor) y la app
  entera pasa a responder con ese plan. Puedes cargarlo **desde el PDF que te dio tu profesional**
  o desde un archivo `.json`.
- **Cómo se usa con el PDF:**
  1. Ve a **Cargar** (abajo) → **"Elegir PDF"** → busca el PDF que te dio tu profesional.
  2. La app lo lee **en tu teléfono, sin internet** (funciona también sin señal). El PDF **no se
     guarda ni sale del teléfono**: solo queda tu plan, ya revisado por ti.
  3. Aparece **"Revisa tu plan"**, parte por parte (fecha del plan, alimentos en descanso, rojo fijo,
     verde, amarillo, equivalencias, suplementos, menú, hidratación, metas…). Cada parte te dice
     **de qué página del PDF** salió lo que se leyó. En cada una eliges:
     **"Está bien"** (✓), corregir (✎: editar, quitar o añadir) o **"Mi plan no lo trae"** (–).
  4. Lo que la app no reconoció lo completas a mano en la misma pantalla; un PDF con otra forma
     nunca se rechaza. El **rojo fijo** (lo que se evita siempre) lo añades tú, uno por uno,
     porque en el PDF viene en texto corrido.
  5. Cuando todas las partes están revisadas, **"Guardar mi plan"** se activa. Si te falta algo,
     el botón dice qué (cuántas partes faltan, o que verde, menú e hidratación son necesarios).
  - **Si lo dejas a medias:** al volver a **Cargar** aparece **"Tienes una revisión a medias"**:
    **"Seguir revisando"** o **"Descartar esta revisión"**. **"Borrar mis datos"** también la borra.
  - **Lo que no se guarda del PDF:** las medidas del cuerpo, el nombre, el contacto y los resultados
    de laboratorio se descartan al leer: no entran al plan, no se guardan y no salen del teléfono.
- **Cómo se usa con el archivo:** pide el `.json` a quien lo tenga (te lo pueden mandar por
  WhatsApp o correo), descárgalo → **Cargar** → **"Elegir JSON"**. Si no abre, copia TODO su
  contenido y pégalo en la caja de texto → **"Cargar lo pegado"**.
- **Si sale un error:** "ese archivo no es un PDF", "el PDF no trae texto" (es una foto escaneada)
  o "no pudimos abrirlo": elige otro PDF o carga el archivo `.json`.
- **Lo que anotaste en el Perfil** (notas y texturas) **se queda** al cargar un plan nuevo.
- **Limitaciones conocidas:** el PDF debe traer texto (uno escaneado como foto no se puede leer);
  el plan queda solo en ese teléfono (cada cuidador lo carga en el suyo).

**In English — Load your plan (from the PDF, since Sprint 006).** Go to **Load** → **"Choose PDF"**
and pick the PDF your professional gave you. The app reads it **on your phone, with no internet**;
the PDF is **not saved and never leaves the phone** — only your reviewed plan is kept. In **"Review
your plan"** each part shows the PDF page it came from, and you mark it **"Looks right"**, fix it
(edit, remove or add) or **"My plan doesn't have it"**; whatever the app didn't recognize you fill in
by hand. **"Save my plan"** turns on when every part is reviewed. An unfinished review can be
resumed from **Load**. Body measurements, names, contact details and lab results in the PDF are
discarded: they never enter the plan or get saved. You can still load a `.json` file (**"Choose JSON"**), and what you noted in the
Profile stays.

### El semáforo de la dieta · desde Sprint 001

- **Qué hace:** responde "¿esto se puede?" en segundos.
- **Cómo se usa:**
  1. Ve a **Dieta** (abajo) y escribe el alimento en el buscador (ej. "manzana").
  2. Cada alimento sale con su color Y su palabra: 🟢 **Se puede** · 🟡 **Con límite** (dice
     cuánto) · 🔴 **Evitar** (dice por qué y hasta cuándo si es temporal).
  3. Toca el alimento para ver el detalle: el porqué en palabras simples y los **reemplazos**
     ("si no hay X → usa Y o Z").
  - También puedes navegar por pestañas Verde / Amarillo / Rojo. En Rojo están además los
    **aditivos** (códigos E-) que conviene revisar en las etiquetas de lo empacado.
- **Limitaciones conocidas:** si un alimento no está en el plan, la app te dice que le preguntes
  al profesional (no inventa respuestas).

### "Hoy" — el checklist del día · desde Sprint 001 (registro y recordatorio · Sprint 003)

- **Qué hace:** muestra qué toca hoy (comidas con su horario, el suplemento del día y los vasos
  de agua) y deja marcar cada cosa cuando pasa. Arriba se ve cuánto va ("Ya hiciste 3 de 10") y
  qué falta.
- **Cómo se usa:** es la pantalla de inicio (**Hoy**). Toca la casilla de cada cosa cuando ya
  pasó. Al día siguiente el checklist amanece limpio solo.
- **Guarda la hora real (Sprint 003):** cuando marcas una comida, la app anota **a qué hora** fue
  y la muestra ("Hecho · 7:35 a. m."). Es solo para tu memoria — nadie te califica por la hora.
- **Nota corta por comida (Sprint 003):** debajo de cada comida hay **"Agregar nota"**. Ahí puedes
  tocar una etiqueta rápida (**Lo rechazó · Le dolió · Tuvo antojo · Otra cosa**) y, si quieres,
  escribir algo corto ("solo comió dos cucharadas"). Sirve para contarle al pediatra cómo va la
  semana sin fiarte de la memoria. Puedes editarla o quitarla cuando quieras.
- **Recordatorio "Ahora mismo" (Sprint 003):** arriba de todo, la app te dice **qué toca en este
  momento** y **qué sigue** (la comida de la franja, el suplemento del día si falta, y los vasos de
  agua). No manda notificaciones ni pide permisos: es simplemente la información correcta cuando
  abres la app. Nunca te reprocha nada — solo informa.
- **Limitaciones conocidas:** las marcas, las horas y las notas viven en ese teléfono; todavía no
  se comparten entre cuidadores (eso viene en una versión futura).

### Días anteriores · desde Sprint 003

- **Qué hace:** guarda un historial de lo que registraste otros días — con las horas y las notas —
  para que puedas repasarlo (por ejemplo, antes de una cita con el pediatra).
- **Cómo se usa:** en **Hoy**, abajo del todo, toca **"Ver días anteriores"**. Verás la lista por
  fecha, del más reciente al más antiguo. Es **solo para consultar**: no se edita desde ahí.
- **Limitaciones conocidas:** vive solo en ese teléfono; **"Borrar mis datos"** en Ajustes lo borra
  todo (incluidas horas y notas).

### Pregúntale a la dieta (Chat) · desde Sprint 002 (reescrito en Sprint 004)

- **Qué hace:** un chat donde preguntas con tus palabras y te contesta **con tu plan, aquí en el
  teléfono, sin internet y sin enviar nada a ningún lado**. Entiende cosas como:
  - **"¿La manzana se puede?"** → la tarjeta del semáforo, con reemplazos si aplica.
  - **"No tengo pollo, ¿qué le doy?"** → lo que tu plan propone en su lugar.
  - **"No quiso el brócoli"** (o "no quiso desayunar") → otras opciones del plan y qué toca
    después, sin regaños.
  - **"¿Qué le doy ahora?"** o **"¿qué le doy de merienda?"** → el menú de esa comida del plan.
  - **"¿Cuánta agua?"** → la meta de agua que dice tu plan.
  - **"¿Cuántas horas duerme?"** o **"¿qué actividad le toca?"** → lo que dice el plan en sus
    objetivos de sueño y de actividad.
  - **"¿Es alérgico a los mariscos?"** → las alergias e intolerancias que **anota tu plan** (y, aparte, las que tú anotaste en el Perfil, dichas como «anotado por ti»). Si preguntas
    por algo que el plan no lista, no te dice "no": te muestra lo que sí anota y que lo demás
    **tu plan no lo dice**.
  - **"¿Qué medicamentos toma?"** → los que tu plan lista, con su dosis y su momento, tal cual; los que tú anotaste salen aparte.
  - **Lo que tu plan no dice:** te lo dice tal cual ("Tu plan no lo dice. Pregúntale a tu
    profesional.") — **nunca se inventa una respuesta**.
- **Cómo se usa:** ve a **Chat** (abajo). Escribe tu pregunta o toca una de las 4 sugerencias. La
  primera vez verás una nota corta que explica cómo funciona. Arriba verás el símbolo de "sin
  internet": el chat nunca lo necesita.
- **Cosas importantes:**
  - **No es consejo médico.** Consultar lo que dice el plan (sus alergias o sus medicamentos) sí
    se puede. Pero si pides **cambiar** una dosis, hablas de síntomas o de un diagnóstico
    ("¿le subo la B12?", "¿es una reacción alérgica?"), el chat te devuelve amablemente a tu
    pediatra o nutricionista — no responde eso.
  - **La conversación no se guarda.** Al cerrar o recargar, el chat queda en blanco. Es a propósito
    (privacidad de los datos del peque).
  - **Nada sale del teléfono.** No hay asistente en la nube, ni servicio de terceros, ni cuenta.
  - **Si tu teléfono ya trae un modelo de lenguaje propio** (algunos Chrome recientes), el chat
    puede usarlo, **sin descargar nada y sin internet**, solo para decir la misma respuesta con
    otras palabras. Se nota con la etiqueta **"Desde tu plan · redactado en tu teléfono"**. Si no lo trae, o si lo
    que produce no encaja con el plan, verás siempre la respuesta directa del plan. El dato es
    el mismo en los dos casos.

### Perfil de tu peque · desde Sprint 005

- **Qué hace:** junta en una pantalla lo que **dijo el profesional** y lo que **tú completas** en
  el teléfono, y cada dato dice de dónde viene:
  - **«según tu plan»**: los objetivos del profesional (grupos de alimentos, horarios de comida,
    hidratación, actividad y sueño), las restricciones vigentes, los suplementos y lo que el plan
    trae del peque (condición, alergias, intolerancias y medicamentos). Lo que el plan no trae
    dice **"Tu plan no lo dice."**; nunca se inventa.
  - **«anotado por ti»**: las **texturas que hoy acepta** (líquida, puré, machacada, blanda,
    picada, crujiente) y tus **notas** (hasta 140 letras, con un tipo: condición, alergia,
    intolerancia, medicamento u otra).
- **Cómo se usa:** toca **«Perfil de tu peque»** en **Hoy** o en **Ajustes** (no está en la barra
  de abajo). Para marcar una textura, tócala: queda con una palomita y el borde grueso. Para
  anotar, elige el tipo, escribe y toca **«Agregar nota»**; cada nota tiene su botón para quitarla.
- **Las texturas ordenan, nunca esconden:** si marcas texturas, en el detalle de un alimento, en
  la tarjeta del semáforo y en el chat las opciones de reemplazo con esas texturas van **primero**.
  Las demás van **después**, con la marca **«textura que hoy no acepta»** (símbolo, texto y borde
  punteado), y siguen a la vista: la lista nunca queda vacía. Si no marcas ninguna, ves el orden
  del plan.
- **Cosas importantes:**
  - **Tus notas viven aparte del plan.** Si cargas un plan nuevo, se quedan. «Borrar mis datos» las
    quita.
  - **Nada sale del teléfono:** ni la condición, ni las alergias, ni los medicamentos, ni tus
    notas viajan por internet, ni se registran, ni se envían a ningún servicio.
  - **Un plan anterior sigue funcionando.** Si guardaste tu dieta antes de esta versión, se lee y
    se actualiza sola sin perder nada; solo le faltarán los datos nuevos ("Tu plan no lo dice.")
    hasta que cargues un plan que los traiga.
  - Para cambios de dosis o dudas médicas, consulta a tu profesional.

### Usar la app sin internet · desde Sprint 004

- **Qué hace:** después de abrirla **una vez con señal**, todas las pantallas (Hoy, Dieta, Perfil,
  Suplementos, Cargar, Ajustes, Chat, Historial y "Conoce Nutrikids") se abren **sin internet**:
  en la lonchera, en el parque, en el carro. Tu dieta y tu registro del día ya vivían en el
  teléfono; ahora la app también.
- **Cómo se usa:** no hay nada que activar. Abre la app una vez con señal (se guarda sola) y
  listo. También el detalle de cualquier alimento de tu dieta abre sin señal, aunque nunca lo hayas
  visitado.
- **Cuando hay una versión nueva:** con señal, la app lo detecta y muestra un aviso abajo: **"Hay
  una versión nueva de Nutrikids. Tu dieta y tu registro no se tocan."** Toca **"Actualizar"**
  cuando te convenga (la app se recarga una vez) o **"Ahora no"** para seguir con lo que estás
  haciendo. **Nunca se actualiza sola mientras la usas.**
- **Limitaciones conocidas:** la primera vez necesita señal. Si cambias de teléfono, la dieta no
  viaja sola: vuelve a cargar tu PDF o el archivo.

### Suplementos de la semana · desde Sprint 001

- **Qué hace:** el calendario Lunes–Domingo de los suplementos, con dosis y momento ("con el
  desayuno"). El día de hoy sale resaltado y ahí mismo puedes marcar "ya lo tomó".
- **Cómo se usa:** **Suplementos** (abajo). La marca de hoy es la misma del checklist de "Hoy".

### Idioma y borrar datos · desde Sprint 001

- **Qué hace:** cambia la app entre español e inglés, muestra qué dieta está cargada, y permite
  **borrar todos los datos** del teléfono.
- **Cómo se usa:** **Ajustes** (abajo). Para borrar: **"Borrar mis datos"** → confirma. Se borra
  la dieta cargada y **todo tu registro del día (marcas, horas y notas)** y **lo que anotaste en el perfil (notas y texturas)**; la app vuelve a la demo.
  Esto no se puede deshacer.

## Preguntas frecuentes

- **¿El PDF que cargo se sube o se guarda?** No. Se lee en tu teléfono, sin internet, y al terminar se
  suelta de la memoria: solo queda el plan ya revisado por ti. Las medidas del cuerpo, el nombre
  y el contacto que traiga el PDF se descartan: no entran al plan ni se guardan.
- **¿Mis datos van a internet?** No. La dieta, las marcas, las horas y las notas viven solo en tu
  teléfono. Por eso mismo, si cambias de teléfono, vuelve a cargar tu PDF (o el archivo de la dieta). Las notas
  del día (lo que escribes en "Agregar nota") **nunca** salen del teléfono: el chat ni las lee. Lo que
  anotas en el **Perfil** tampoco sale: solo el chat de tu propio teléfono lo usa, para contestarte
  con eso marcado como «anotado por ti».
- **¿Por qué veo "Dieta demo"?** Aún no has cargado la dieta real (o la borraste). Ve a
  **Cargar**.
- **¿La app cuenta calorías o pesa al niño?** No, y no lo hará: el enfoque es qué alimentos sí y
  cuáles descansan, sin números de peso ni calorías.
- **¿El chat inventa cosas?** No: contesta con programación sobre tu plan, no "adivina". Cuando tu
  plan no trae la respuesta, lo dice ("Tu plan no lo dice. Pregúntale a tu profesional.") en vez
  de inventarla.
- **¿El chat funciona sin internet?** Sí, **todas** sus respuestas: nunca usa internet.
- **¿La app abre sin internet?** Sí, todas las pantallas, después de haberla abierto una vez con
  señal.

## Historial

| Sprint | Features añadidas a este manual                                                                                                                                                                                                                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001    | Cargar dieta (archivo + pegar) · semáforo con reemplazos · checklist "Hoy" · suplementos de la semana · idioma ES/EN · borrar datos · instalación como app                                                                                                                                                                                                                    |
| 002    | Chat "Pregúntale a la dieta": consultas "¿se puede?" al instante sin internet + preguntas abiertas con asistente de IA anclado al plan · nota de transparencia IA _(la parte de IA en la nube se reemplazó en el 004)_                                                                                                                                                        |
| 003    | Registro del día: hora real al marcar + nota corta por comida (etiquetas + texto) · recordatorio "Ahora mismo" (qué toca y qué sigue, sin notificaciones) · "Ver días anteriores" (historial local de solo lectura) · borrar datos ahora cubre horas y notas                                                                                                                  |
| 004    | Chat nuevo que contesta con tu plan **sin internet y sin enviar nada** ("no tengo X", "no quiso X", "¿qué le doy ahora?", "¿cuánta agua?", "tu plan no lo dice") · todas las pantallas abren sin internet · aviso de versión nueva con "Actualizar" / "Ahora no"                                                                                                              |
| 005    | Perfil de tu peque: lo del profesional **«según tu plan»** y lo tuyo **«anotado por ti»** (texturas que hoy acepta y notas) · opciones de reemplazo ordenadas por textura, con la marca «textura que hoy no acepta» · el chat contesta sueño, actividad, alergias y medicamentos del plan · el plan guardado de antes se actualiza solo · la pantalla nueva abre sin internet |
| 006    | **Tu PDF, vuelto app:** cargas el PDF de tu profesional, que se lee en tu teléfono sin internet y sin guardarse · «Revisa tu plan» parte por parte, con la página de cada dato («está bien», corregir o «mi plan no lo trae») · una revisión a medias se retoma · el JSON sigue funcionando y tus notas del Perfil se quedan |
