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

- **Qué hace:** guarda el plan de tu peque EN TU TELÉFONO (solo viaja a tu familia, cifrado, si activas «Compartir con la familia») y la app
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
     porque en el PDF viene en texto corrido. Los consejos que nombran a alguien de la familia
     («si tiene sed, …») tampoco se leen: si quieres ese cambio, añádelo en **Equivalencias**.
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
  el plan queda en ese teléfono; si no usas «Compartir con la familia», cada cuidador lo carga en el suyo.

**In English — Load your plan (from the PDF, since Sprint 006).** Go to **Load** → **"Choose PDF"**
and pick the PDF your professional gave you. The app reads it **on your phone, with no internet**;
the PDF is **not saved and never leaves the phone** — only your reviewed plan is kept. In **"Review
your plan"** each part shows the PDF page it came from, and you mark it **"Looks right"**, fix it
(edit, remove or add) or **"My plan doesn't have it"**; whatever the app didn't recognize you fill in
by hand. Tips that name someone in the family ("if they're thirsty, …") are not read either: add that
swap yourself under **Equivalences**. **"Save my plan"** turns on when every part is reviewed. An unfinished review can be
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
  agua). Es la información correcta cuando
  abres la app, y con los **avisos en este teléfono** (más abajo) también te llega aunque la app esté cerrada.
  Nunca te reprocha nada — solo informa.
- **Avisar a la familia (Sprint 008):** si estás en una familia, debajo del recordatorio hay
  **«Avisar a la familia»**: escribes una nota corta (hasta 140 letras) y despierta los demás teléfonos.
  Los avisos de hoy se leen ahí mismo, con quién los dejó («Por Papá») y la hora.
- **Limitaciones conocidas:** las marcas, las horas y las notas viven en tu teléfono; si activas
  **«Compartir con la familia»** (en Ajustes), los demás teléfonos las ven y cada marca dice quién la hizo
  («Por Mamá»). Si dos personas marcan lo mismo a la vez, gana el último cambio.

### Días anteriores · desde Sprint 003

- **Qué hace:** guarda un historial de lo que registraste otros días — con las horas y las notas —
  para que puedas repasarlo (por ejemplo, antes de una cita con el pediatra).
- **Cómo se usa:** en **Hoy**, abajo del todo, toca **"Ver días anteriores"**. Verás la lista por
  fecha, del más reciente al más antiguo. Es **solo para consultar**: no se edita desde ahí.
- **Limitaciones conocidas:** vive en tu teléfono y, con la familia activada, también en los de ella; **"Borrar mis datos"** en Ajustes lo borra
  de este teléfono (incluidas horas y notas).

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
  - **"¿Es alérgico a los mariscos?"** → las alergias e intolerancias que **anota tu plan** (y, aparte, las que anotó quien cuida en el Perfil, dichas como «anotado por quien cuida»). Si preguntas
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
  - **El chat nunca envía nada a internet.** No hay asistente en la nube ni servicio de terceros. (Lo que compartes con tu familia, si lo activas, viaja cifrado: eso no es del chat.)
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
  - **«anotado por quien cuida»**: las **texturas que hoy acepta** (líquida, puré, machacada, blanda,
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
  - **Solo viaja si compartes con tu familia:** la condición, las alergias, los medicamentos y las
    notas salen del teléfono únicamente si activas «Compartir con la familia», y siempre cifrados. Nunca se
    registran ni se envían a ningún otro servicio.
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
  viaja sola —salvo que entres a tu familia con el código y la frase—: vuelve a cargar tu PDF o el archivo.

### Suplementos de la semana · desde Sprint 001

- **Qué hace:** el calendario Lunes–Domingo de los suplementos, con dosis y momento ("con el
  desayuno"). El día de hoy sale resaltado y ahí mismo puedes marcar "ya lo tomó".
- **Cómo se usa:** **Suplementos** (abajo). La marca de hoy es la misma del checklist de "Hoy".

### Compartir con la familia · desde Sprint 007

- **Qué hace:** para que todos los que cuidan a tu peque vean lo mismo. Comparte el **plan**, el **día**
  (marcas, horas, notas y quién las hizo) y el **perfil** con sus notas, alergias y medicamentos. El
  idioma, el tema y los ajustes de cada teléfono se quedan en cada teléfono.
- **Es privado de punta a punta:** todo se cifra en tu teléfono antes de salir, con una **frase de la
  familia** que solo conocen ustedes. En internet solo quedan datos ilegibles: ni siquiera nosotros
  podemos abrirlos. Mientras no elijas crear una familia o entrar a una, la app no hace ninguna petición.
- **Cómo se usa:**
  1. **Ajustes → Compartir con la familia → «Crear una familia».** Lee qué se comparte (y que, si se
     pierde la frase y ningún teléfono sigue dentro, nadie puede recuperarlo), escribe el nombre de este
     teléfono («Mamá») y marca que lo entiendes.
  2. Te muestra el **código** y la **frase** una sola vez: anótalos en un lugar seguro. La frase no se guarda en el teléfono; si el teléfono no pudiera guardar las claves, la pantalla lo avisa.
  3. En otro teléfono: **«Entrar con un código»**, con el código, la frase y su nombre.
  4. Desde ahí todo se sincroniza solo: al abrir la app, al volver la señal, tras cada cambio y cada
     30 segundos. En **Hoy**, **Días anteriores** y **Perfil** cada dato dice quién lo hizo.
  5. Para **sacar a un teléfono** (o si se perdió la frase): **«Cambiar la frase»** o **«Sacar a …»**.
     La frase cambia, ese teléfono queda fuera y los demás entran con la frase nueva (solo la frase).
  6. **«Salir de la familia»** quita las claves de este teléfono y conserva sus datos.
     **«Borrar lo compartido»** borra de internet todo lo compartido y disuelve el grupo; cada teléfono conserva su copia.
- **Sin internet:** lo que marcas se guarda aquí, la pantalla dice cuántos cambios faltan por subir y
  se suben solos al volver. Los estados se dicen con símbolo y texto: «Al día», «Sincronizando», «Sin conexión», «Frase cambiada»…
- **Limitaciones conocidas:** si dos teléfonos cambian lo mismo a la vez, gana el último cambio; si
  dos teléfonos cargan un plan distinto, gana el último y el otro teléfono lo avisa. El plan se
  comparte si cabe en 180 000 caracteres (si no, la pantalla lo dice y el resto sí se comparte); una nota o marca demasiado grande se avisa igual y no frena lo demás. Una
  familia sin uso se borra sola a los 400 días.

**In English — Share with the family (since Sprint 007).** Go to **Settings → Share with the family**
to see the same plan, day and profile on every caregiver's phone. What is shared: the **plan**, the
**day** (marks, times, notes and who made them) and the **profile** with its notes, allergies and
medications. Language, theme and per-phone settings stay on each phone. Everything is **encrypted on
your phone** with a family phrase only you know; the internet only holds unreadable data, and the app
makes no request until you create or join a family. **Create a family**, write down the code and the
phrase (shown once), and on another phone choose **Join with a code**. Offline changes wait and upload
when the connection returns. To remove a phone or if the phrase is lost, **Change the phrase**: the
other phones join again with the new phrase. **Leave the family** keeps this phone's data; **Delete
what's shared** erases it from the internet and each phone keeps its copy.

### Avisos que llegan · desde Sprint 008

- **Qué hace:** te avisa en el teléfono a la hora de cada comida, del suplemento y del agua, aunque la
  app esté cerrada, y deja que quien cuida le avise a la familia con una nota corta. Las horas salen de
  tu plan: comidas y meriendas a su hora, el suplemento a la hora de la primera comida los días que
  toca, y el agua repartida entre la primera y la última comida.
- **Cómo se activa:** **Ajustes → Avisos en este teléfono**. Primero lees qué sale del teléfono, y solo
  al tocar **«Activar avisos en este teléfono»** el teléfono te pide el permiso (una sola vez). En
  iPhone, los avisos funcionan desde iOS 16.4 y solo con la app instalada en la pantalla de inicio: la
  pantalla te muestra los 4 pasos.
- **Qué eliges:** cuatro tipos, cada uno por teléfono: **Suplementos**, **Comidas y meriendas**,
  **Agua** y **Avisos de la familia**. Y **«Ocultar el detalle con el teléfono bloqueado»** (apagado al
  inicio): con él prendido, el aviso trae un mensaje genérico en vez del detalle, y el detalle se ve al abrir la app.
- **Si ya lo marcaste:** si marcas una comida o el suplemento antes de su hora, ese aviso de hoy no
  suena. Si lo desmarcas, vuelve a sonar.
- **Avisar a la familia:** en **Hoy**, **«Avisar a la familia»** → escribe → **«Enviar aviso»**. La nota
  viaja cifrada y los demás teléfonos con los avisos de la familia activos suenan con «Aviso de
  Mamá»; al tocarlo abre **Hoy** en esa nota. Hace falta que este teléfono tenga nombre (Ajustes).
- **Dejar de recibir avisos:** **Ajustes → Dejar de recibir avisos** borra la dirección del servidor y
  quita los avisos de este teléfono. **«Borrar mis datos»** también lo hace.
- **Qué sabe el servidor:** solo la dirección para despertar tu teléfono, tu huso horario y las horas
  del día **sin etiqueta** (no sabe si es comida, suplemento o agua), más el código de la familia si
  recibes avisos de ella. Si marcas algo **antes de su hora**, también sale el día y el minuto de ese
  aviso (para no repetirlo): el servidor no sabe qué era, pero sí que algo de ese minuto ya se marcó. El toque va vacío: el aviso se arma en tu teléfono. Nunca viajan nombres,
  alimentos, suplementos ni notas. Google, Apple, Mozilla o Microsoft (el servicio de tu navegador) ven
  que llegó un toque vacío, nada más.
- **Limitaciones conocidas:** el reloj es de cada 5 minutos, así que un aviso puede llegar hasta unos
  minutos después de su hora; uno que llega tarde no se repite y uno que se pierde no rompe nada. Si el
  navegador quita el permiso o la suscripción, la pantalla te pide activarlos de nuevo. Sin la
  conexión del servicio configurada, la pantalla lo dice y el resto de la app sigue igual.

**In English — Notices that arrive (since Sprint 008).** **Settings → Notices on this phone** explains
what leaves the phone, and only when you tap **Activate notices on this phone** does the phone ask for
permission (once). On iPhone, notices work from iOS 16.4 and only with the app on the home screen; the
screen shows the 4 steps. Four types are switched per phone: supplements, meals and snacks, water and
family notices; times come from the plan. **Hide the detail on a locked phone** is off at first. Marking
something early skips that notice for today. In **Today**, **Notify the family** sends a short note
(up to 140 characters) that wakes the other phones; it travels encrypted and opens Today with the note
and who wrote it. The server keeps only the address, the time zone and label-free times (plus the day and minute of a notice you marked early), and sends an
empty push: the notice is built on your phone. **Stop receiving notices** and **Delete my data** both
delete the subscription.

### Roles y bitácora de la familia · desde Sprint 009

- **Qué hace:** cada persona que entra a la familia tiene un **rol** que dice qué puede cambiar. Todos ven lo compartido; solo cambia lo que su rol permite. Cada cambio queda en la **bitácora**: quién, qué y cuándo.
- **Los cuatro roles:** **Madre o padre** (todo: el plan, el perfil, la familia y los roles) · **Cuidador** (registra el día, deja notas y avisa a la familia) · **Colegio** (marca solo las comidas de sus horarios, deja notas en ellas y avisa) · **Nutricionista** (ve todo y deja notas del día y del perfil).
- **Cómo se usa:** **Ajustes → Compartir con la familia**. Una madre o un padre, en **«Invitar con rol»**, elige el rol (y, para el colegio, qué comidas marca), crea la invitación y se la pasa a la persona junto con la frase. Cuando la persona entra, aparece en **«Esperando rol»**: se confirma con un toque, comparando la **huella** de su teléfono con la que ella ve en su pantalla (en persona o por llamada, no por el mismo mensaje en que llegó la invitación). Para cambiar el rol de alguien o sacarlo, en **«Personas de la familia»**.
- **Con un rol que no lo permite:** la pantalla muestra el dato pero no el botón, y dice «Con tu rol (…) esto se ve, pero no se cambia». Un cambio que llegue sin la firma de quien dice haberlo hecho, o que su rol no permita, no se acepta, y la pantalla avisa cuántos se rechazaron.
- **Bitácora:** al final de Compartir con la familia. Dice «Mamá marcó el desayuno (hoy)», «Papá le dio a Tía el rol Cuidador», «cambió una línea del plan unido». Está firmada y encadenada: si alguien la reescribe, este teléfono conserva lo que ya había visto y lo avisa.
- **Limitaciones conocidas:** se aconseja invitar a una segunda madre o padre: si el único teléfono con ese rol se pierde, nadie podría cambiar los roles. Un teléfono con una versión anterior de la app entra sin rol hasta que se actualice. La lista de personas guarda hasta 120 cambios (o menos, si los nombres y las comidas del colegio son muy largos): cuando se llena, el padre ve «La lista de personas de la familia está llena…» al intentar el cambio y un aviso fijo en Compartir con la familia, y, para seguir, sale de la familia en ese teléfono y crea una nueva (los datos se quedan; se invita de nuevo a quien haga falta).

**In English — Roles and the family log (since Sprint 009).** Everyone who joins the family has a **role**
that says what they can change; everyone sees what is shared. **Parent** (everything), **Caregiver**
(logs the day, leaves notes, notifies the family), **School** (marks only its own meals, leaves notes on
them, notifies) and **Nutritionist** (sees everything, leaves day and profile notes). A parent uses
**Settings → Share with the family → Invite with a role**, then confirms the new person under **Waiting
for a role** after comparing the phone's fingerprint on both screens (in person or by phone call, not in the same message as the invitation). With a role that does not allow it,
the screen shows the data without the button. Every change goes in the signed, chained **log** (who, what,
when); a change without its author's signature, or that their role does not allow, is rejected and the
screen says how many. Tip: invite a second parent, so roles can still change if one phone is lost. The list of people keeps up to 120 changes (fewer if names and school meals are very long): when it is full, a parent sees "The family's list of people is full…" when trying a change and a standing notice in Share with the family, and, to go on, leaves the family on that phone and creates a new one (the data stays; invite again whoever needs it).

### Plan B · desde Sprint 009

- **Qué hace:** cuando algo falla —se acabó un alimento, no hay nevera o van tarde— te dice **qué sí** dar, **solo con lo que trae tu plan**. Nunca inventa un alimento ni propone algo prohibido o con restricción vigente. Si el plan no lo dice, te lo dice y te manda a tu profesional.
- **Cómo se usa:** en **Hoy**, tarjeta **«Plan B»**: **«Se acabó algo»** (eliges el alimento y ves las opciones de tu plan, ordenadas por la textura que hoy acepta) · **«No hay nevera»** (las opciones que aguantan sin nevera) · **«Llegamos tarde»** (qué comida toca ahora y cómo se acomoda). El chat también contesta «no tengo X».
- **Qué aguanta sin nevera:** lo dice tu plan o, si no, lo que quien cuida marcó en **Perfil → «Aguantan sin nevera»**. Lo que el plan ya marca no se puede quitar.
- **Limitaciones conocidas:** si el plan no trae reemplazos para un alimento, la app no los busca fuera: lo dice.

**In English — Plan B (since Sprint 009).** On **Today**, the **Plan B** card answers "we ran out of
something", "no fridge" and "we're late" using only what the plan says; it never invents a food or
suggests a forbidden one, and if the plan is silent it says so. Which options keep without a fridge comes
from the plan or from what a caregiver marks in **Profile → Keep without a fridge**.

### Días especiales · desde Sprint 009

- **Qué hace:** una ficha para **cumpleaños**, **restaurante**, **emergencia** y **«le ofrecen algo que no puede»**: qué llevar o elegir, lo que no puede, qué decir (frases listas) y, en emergencia, la ficha a mano y a quién llamar. Todo sale del plan y se abre **sin señal**.
- **Cómo se usa:** desde **Hoy**, «Días especiales», o la ruta **/escenarios**. Eliges el día y lees la ficha; «Avisar a la familia» y «Preguntar en el chat» están a un toque.
- **Lo que no es:** no da indicaciones médicas ni inventa teléfonos: «los servicios de emergencia de tu zona» y el nombre de tu profesional si el plan lo trae. Lo que el plan no dice, se le pregunta a tu profesional.

**In English — Special days (since Sprint 009).** A card for **birthday**, **restaurant**, **emergency**
and **"someone offers something he can't have"**: what to bring, what to avoid, ready-made phrases and,
for emergencies, the profile card and who to call. It comes from the plan, opens offline, and gives no
medical instructions.

### Varias dietas: unir dos planes · desde Sprint 009

- **Qué hace:** si otro profesional te dio otro plan, lo agregas como **segundo plan** y la app te lo muestra lado a lado con el tuyo; si quieres, los **une en uno solo**. **Lo prohibido gana solo:** si un plan prohíbe algo, queda en rojo en el plan unido, marcado con el plan de donde viene; así el unido nunca es más flojo que ninguno. Las alergias se suman y la restricción con fecha usa la ventana más ancha.
- **Cómo se usa:** **Cargar → «Agregar como segundo plan»** → **Dieta → «Varias dietas»** (o /unir). Lo que los dos planes dicen distinto (porciones, dosis, horarios…) lo eliges tú, uno por uno, con «Usar este»; con todo elegido, **«Unir los dos planes»**. El segundo plan vive solo en este teléfono y se descarta con **«Descartar el segundo plan»**.
- **Cada línea dice de dónde salió:** en el detalle de cada alimento y en «De dónde salió cada línea».
- **Cambiar una línea en rojo:** una madre o un padre puede cambiar cualquier línea del plan unido, también una prohibida. Ve los dos orígenes, confirma una vez («Confirmar el cambio») y queda en la bitácora; puede volver a cambiarla. Los demás roles ven la línea pero no la cambian.
- **Limitaciones conocidas:** se une de a dos planes; para sumar un tercero, se une el resultado con el nuevo. El segundo plan no se comparte con la familia hasta que se une.

**In English — Several diets: merging two plans (since Sprint 009).** Add another professional's plan as a
**second plan** (**Load → Add as second plan**), see both side by side under **Diet → Several diets**, and
merge them into one. **Forbidden wins on its own:** whatever either plan forbids stays red in the merged
plan, tagged with its origin; allergies are added and a dated restriction takes the widest window. Where
the plans differ you choose, one by one. Every line shows where it came from. A parent can change any
line, even a red one: they see both origins, confirm once, and it goes in the log. Other roles can see
but not change it.

### Bienestar: cómo llega, qué acepta, cómo está y sus hábitos · desde Sprint 010

- **Qué hace:** deja **anotar** en segundos cuatro cosas, y nada más: cómo **llega a cada comida**, **qué hizo con un alimento**, **cómo está hoy** y **sus hábitos** (sueño, pantalla, actividad, sol y agua). La app **solo anota**: no diagnostica, no interpreta, no da puntajes ni dice qué hacer. Todo viaja cifrado entre los teléfonos de la familia y se ve en el **Historial**.
- **Cómo llega a la comida:** en **Hoy**, bajo cada comida, cinco opciones con símbolo y palabra (**Feliz · Cansado · Ansioso · Sin hambre · Otro**). Un toque elige; tocar la elegida la quita.
- **Qué acepta:** en **Hoy**, bajo cada comida, **«Cómo le fue con los alimentos»**. Eliges el alimento y qué hizo (**lo miró, lo tocó o lo probó**: las tres cuentan), cómo le cayó (**le encantó, lo aceptó, no lo aceptó**), con qué textura y presentación funcionó, y si es un alimento nuevo. En los nuevos, la app cuenta las veces y recuerda que **suele hacer falta ofrecerlo muchas veces, sin presión**; no hay cifra mágica.
- **Cómo está hoy:** **Hoy → «Bienestar de hoy»** (o /bienestar). Ocho preguntas de pocas opciones en palabras de casa (energía, sueño, ánimo, evacuaciones, dolor, náuseas, reacciones, hambre y saciedad) y una nota de hasta 140 letras. Si anotas una **reacción**, la pantalla ofrece el enlace al **plan de emergencia** de la familia (a quién llamar y qué ficha mostrar); no dice qué hacer.
- **Hábitos y su referencia:** en la misma pantalla anotas los minutos. Si una madre o un padre eligió la **franja de edad** en **Perfil**, cada hábito muestra la referencia de esa edad **con su fuente** (sueño: AASM 2016; actividad y pantalla: OMS 2019 y 2020) y un estado con símbolo y palabra: **«dentro de lo que se recomienda»** o **«un poco distinto a la referencia»**, nunca en rojo ni como fracaso. **Una referencia no es un veredicto**: si algo te preocupa, consúltalo con su pediatra. El agua se compara con la meta de **su plan**; el sol y la pantalla de 5 años en adelante no tienen cifra oficial y se anotan sin comparar.
- **Franja de edad:** **Perfil → «Franja de edad»** (1, 2, 3–4, 5, 6–12 o 13–17 años). **Solo guarda la franja, nunca la fecha de nacimiento.** Una vez al año, en Bienestar, la app pregunta si sigue igual.
- **Quién anota qué:** madre o padre, todo (la franja es solo suya) · cuidador, ánimo, alimentos, cómo está y hábitos · colegio, solo el ánimo y los alimentos **de sus comidas** · nutricionista ve y deja notas del día. Con un rol que no lo permite, se ve y no se toca.
- **Limitaciones conocidas:** no hay gráficas ni alertas: esto es solo el registro. Un día guarda hasta 16 ánimos, 60 alimentos y 8 hábitos. Todos los teléfonos de la familia deben tener esta versión: uno antiguo descartaría estas anotaciones al volver a subirlas.

**In English — Wellbeing: how they arrive, what they accept, how they are, their habits (since Sprint 010).**
Note in seconds how they **come to each meal** (**Happy · Tired · Anxious · Not hungry · Other**, one tap,
tap again to clear), **what they did with a food** (looked, touched or tasted all count; how it went; which
texture and presentation worked; for new foods the app counts the offers and says it often takes many
offers, with no pressure), **how they are today** (**Today → Wellbeing of today**: eight questions in plain
words and a 140-character note; a reaction only offers the link to the family's emergency plan) and **their
habits** (sleep, screen, activity, sun, water). With the **age range** a parent picks in **Profile** (the
range only, never a date of birth; the app asks once a year if it is still the same) each habit shows the
reference for that age **with its source** (AASM 2016; WHO 2019 and 2020) and a state with symbol and word:
"within what is recommended" or "a little different from the reference", never red. A reference is not a
verdict: if something worries you, ask the pediatrician. The app only records; it never diagnoses or
advises. Parent: everything · Caregiver: mood, foods, how they are and habits · School: mood and foods of its
own meals · Nutritionist: sees it and leaves day notes. It all shows in **History**.

### Idioma y borrar datos · desde Sprint 001

- **Qué hace:** cambia la app entre español e inglés, muestra qué dieta está cargada, y permite
  **borrar todos los datos** del teléfono.
- **Cómo se usa:** **Ajustes** (abajo). Para borrar: **"Borrar mis datos"** → confirma. Se borra
  la dieta cargada y **todo tu registro del día (marcas, horas y notas)** y **lo que anotaste en el perfil (notas y texturas)**, y este teléfono sale de la familia y deja de recibir avisos; la app vuelve a la demo.
  Esto no se puede deshacer. Si estás en una familia, el cuadro trae la casilla **«También borrar lo compartido de internet»**: con ella marcada se borra también la copia cifrada (los demás teléfonos conservan la suya); sin marcar, solo sales de la familia. También puedes borrarla antes desde **«Borrar lo compartido»** en Compartir con la familia.

## Preguntas frecuentes

- **¿El PDF que cargo se sube o se guarda?** No. Se lee en tu teléfono, sin internet, y al terminar se
  suelta de la memoria: solo queda el plan ya revisado por ti. Las medidas del cuerpo, el nombre
  y el contacto que traiga el PDF se descartan: no entran al plan ni se guardan.
- **¿Mis datos van a internet?** Solo si activas «Compartir con la familia»: entonces el plan, el
  día (marcas, horas y notas) y el perfil (notas, alergias y medicamentos) viajan **cifrados desde tu
  teléfono**, y en internet solo quedan datos ilegibles. Sin familia y sin avisos, nada sale del teléfono; con los avisos activos salen solo la dirección para despertarlo y horas sin etiqueta (y, si marcas antes de la hora, el día y el minuto de ese aviso). El chat
  **nunca** envía nada: solo el de tu propio teléfono usa lo que anotaste, para contestarte con eso
  marcado como «anotado por quien cuida».
- **¿Los avisos le cuentan algo a alguien?** Solo que un teléfono quiere avisos a ciertas horas del día,
  sin decir de qué, y que algo de un minuto de hoy ya se marcó cuando marcas antes de la hora. El aviso se arma en tu teléfono con lo que ya tiene; el servidor manda un toque vacío.
- **¿Y si pierdo la frase de la familia?** Con otro teléfono que ya esté dentro, **«Cambiar la frase»**
  crea una nueva; los demás teléfonos entran con ella. Sin ningún teléfono dentro, la familia no se
  puede abrir: se crea otra (nadie, ni nosotros, puede leerla).
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

| Sprint | Features añadidas a este manual                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001    | Cargar dieta (archivo + pegar) · semáforo con reemplazos · checklist "Hoy" · suplementos de la semana · idioma ES/EN · borrar datos · instalación como app                                                                                                                                                                                                                                                                                                       |
| 002    | Chat "Pregúntale a la dieta": consultas "¿se puede?" al instante sin internet + preguntas abiertas con asistente de IA anclado al plan · nota de transparencia IA _(la parte de IA en la nube se reemplazó en el 004)_                                                                                                                                                                                                                                           |
| 003    | Registro del día: hora real al marcar + nota corta por comida (etiquetas + texto) · recordatorio "Ahora mismo" (qué toca y qué sigue; los avisos con la app cerrada llegaron en el 008) · "Ver días anteriores" (historial local de solo lectura) · borrar datos ahora cubre horas y notas                                                                                                                                                                       |
| 004    | Chat nuevo que contesta con tu plan **sin internet y sin enviar nada** ("no tengo X", "no quiso X", "¿qué le doy ahora?", "¿cuánta agua?", "tu plan no lo dice") · todas las pantallas abren sin internet · aviso de versión nueva con "Actualizar" / "Ahora no"                                                                                                                                                                                                 |
| 005    | Perfil de tu peque: lo del profesional **«según tu plan»** y lo anotado **«por quien cuida»** (texturas que hoy acepta y notas) · opciones de reemplazo ordenadas por textura, con la marca «textura que hoy no acepta» · el chat contesta sueño, actividad, alergias y medicamentos del plan · el plan guardado de antes se actualiza solo · la pantalla nueva abre sin internet                                                                                |
| 006    | **Tu PDF, vuelto app:** cargas el PDF de tu profesional, que se lee en tu teléfono sin internet y sin guardarse · «Revisa tu plan» parte por parte, con la página de cada dato («está bien», corregir o «mi plan no lo trae») · una revisión a medias se retoma · el JSON sigue funcionando y tus notas del Perfil se quedan                                                                                                                                     |
| 007    | **Compartir con la familia:** el plan, el día (marcas, horas y notas) y el perfil en todos los teléfonos de quienes cuidan, **cifrados de punta a punta** · cada dato dice quién lo hizo («Por Mamá») · funciona sin internet y sube al volver · cambiar la frase para sacar a un teléfono · salir y borrar lo compartido                                                                                                                                        |
| 008    | **Avisos que llegan:** avisos en el teléfono a la hora de las comidas, el suplemento y el agua, con la app cerrada · se eligen 4 tipos por teléfono y se puede ocultar el detalle con el teléfono bloqueado · marcar antes de la hora evita ese aviso · «Avisar a la familia» con una nota cifrada de hasta 140 letras · el servidor solo guarda horas sin etiqueta y manda toques vacíos · «Dejar de recibir avisos» y «Borrar mis datos» quitan la suscripción |
| 009    | **Coordinación:** roles (madre o padre, cuidador, colegio, nutricionista) con permisos y una bitácora firmada de quién cambió qué · **Plan B** (se acabó algo, no hay nevera, llegamos tarde) solo con lo que trae el plan · **Días especiales** (cumpleaños, restaurante, emergencia, «le ofrecen algo») sin señal · **Varias dietas:** unir dos planes, donde lo prohibido gana y cada línea dice de dónde salió                                               |
