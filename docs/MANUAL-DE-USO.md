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
- **Limitaciones conocidas:** la primera vez necesita señal. La **Cámara** también abre sin señal, pero para mirar fotos necesita que el modelo ya se haya descargado antes (sin él, queda «Marcar a mano»). Si cambias de teléfono, la dieta no
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
- **«Cuando le ofrecen algo» (desde Sprint 014) se comparte distinto:** cualquiera de la familia anota, pero cada teléfono ve **solo lo que anotó**; **madre y padre** ven el registro completo de todos los teléfonos y lo que se repite, también lo anotado **antes** de que les dieran ese rol. Viaja cifrado y firmado como lo demás. Más en «Para la familia» (abajo).

**In English — Share with the family (since Sprint 007).** Go to **Settings → Share with the family**
to see the same plan, day and profile on every caregiver's phone. What is shared: the **plan**, the
**day** (marks, times, notes and who made them) and the **profile** with its notes, allergies and
medications. Language, theme and per-phone settings stay on each phone. Everything is **encrypted on
your phone** with a family phrase only you know; the internet only holds unreadable data, and the app
makes no request until you create or join a family. **Create a family**, write down the code and the
phrase (shown once), and on another phone choose **Join with a code**. Offline changes wait and upload
when the connection returns. To remove a phone or if the phrase is lost, **Change the phrase**: the
other phones join again with the new phrase. **Leave the family** keeps this phone's data; **Delete
what's shared** erases it from the internet and each phone keeps its copy. **When they're offered something** (since Sprint 014) is shared differently: anyone in the family notes, each phone sees **only what it noted**, and **parents** see every phone's full record and what repeats, including what was noted **before** they got that role; it travels encrypted and signed like everything else.

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
- **Qué acepta:** en **Hoy**, bajo cada comida, **«Cómo le fue con los alimentos»** (también desde la ficha de cada alimento del plan). Eliges el alimento y qué hizo (**lo miró, lo tocó o lo probó**: las tres cuentan), cómo le cayó (**le encantó, lo aceptó, no lo aceptó**), con qué textura y presentación funcionó, y si es un alimento nuevo. En los nuevos, la app cuenta las veces y recuerda que **suele hacer falta ofrecerlo muchas veces, sin presión**; no hay cifra mágica.
- **Cómo está hoy:** **Hoy** o **Historial** → **«Bienestar de hoy»** (o /bienestar). Ocho preguntas de pocas opciones en palabras de casa (energía, sueño, ánimo, evacuaciones, dolor, náuseas, reacciones, hambre y saciedad) y una nota de hasta 140 letras. Si anotas una **reacción**, la pantalla ofrece el enlace al **plan de emergencia** de la familia (a quién llamar y qué ficha mostrar); no dice qué hacer.
- **Hábitos y su referencia:** en la misma pantalla anotas los minutos. Si una madre o un padre eligió la **franja de edad** en **Perfil**, cada hábito muestra la referencia de esa edad **con su fuente** (sueño: AASM 2016; actividad y pantalla: OMS 2019 y 2020) y un estado con símbolo y palabra: **«dentro de lo que se recomienda»**, **«por debajo de la referencia»** o **«por encima de la referencia»**, nunca en rojo ni como fracaso. La actividad de 5 años en adelante es un promedio de la semana, así que un día suelto solo se anota. Hasta los 5 años el sueño es el total de 24 horas, siestas incluidas. **Una referencia no es un veredicto**: si algo te preocupa, consúltalo con su pediatra. El agua se compara con la meta de **su plan**; el sol y la pantalla de 5 años en adelante no tienen cifra oficial y se anotan sin comparar.
- **Franja de edad:** **Perfil → «Franja de edad»** (1, 2, 3–4, 5, 6–12 o 13–17 años). **Solo guarda la franja, nunca la fecha de nacimiento.** Una vez al año, en Bienestar, la app pregunta si sigue igual.
- **Quién anota qué:** madre o padre, todo (la franja es solo suya) · cuidador, ánimo, alimentos, cómo está y hábitos · colegio, solo el ánimo y los alimentos **de sus comidas** · nutricionista ve y deja notas del día. Con un rol que no lo permite, se ve y no se toca: el ánimo se ve desactivado; la bitácora de alimentos solo aparece en las comidas que ese rol anota (lo demás se ve en el Historial).
- **Limitaciones conocidas:** no hay gráficas ni alertas: esto es solo el registro. Un día guarda hasta 16 ánimos, 60 anotaciones de alimentos y los 4 hábitos. Todos los teléfonos de la familia deben tener esta versión: uno antiguo descartaría estas anotaciones al volver a subirlas.

**In English — Wellbeing: how they arrive, what they accept, how they are, their habits (since Sprint 010).**
Note in seconds how they **come to each meal** (**Happy · Tired · Anxious · Not hungry · Other**, one tap,
tap again to clear), **what they did with a food** (looked, touched or tasted all count; how it went; which
texture and presentation worked; for new foods the app counts the offers and says it often takes many
offers, with no pressure), **how they are today** (**Today → Wellbeing of today**: eight questions in plain
words and a 140-character note; a reaction only offers the link to the family's emergency plan) and **their
habits** (sleep, screen, activity, sun, water). With the **age range** a parent picks in **Profile** (the
range only, never a date of birth; the app asks once a year if it is still the same) each habit shows the
reference for that age **with its source** (AASM 2016; WHO 2019 and 2020) and a state with symbol and word:
"within what is recommended", "below the reference" or "above the reference", never red (activity from age 5 is a weekly average, so a single day is only noted). A reference is not a
verdict: if something worries you, ask the pediatrician. The app only records; it never diagnoses or
advises. Parent: everything · Caregiver: mood, foods, how they are and habits · School: mood and foods of its
own meals · Nutritionist: sees it and leaves day notes. It all shows in **History**.

### Lonchera, recetas y modo viaje · desde Sprint 011

- **Qué hacen:** tres pantallas para el día a día fuera del plato, todas armadas **con tu plan** y **en tu teléfono**: nada se inventa, nada se envía y las tres abren **sin señal**. Se llega a ellas desde **Hoy**, en la fila **«Para el día a día»**. No son un consejo médico: organizan lo que dice tu plan.
- **Lonchera (/lonchera):** elige el día (hoy y los seis siguientes) y ves las **opciones para llevar**: solo alimentos que tu plan acepta, en **verde o con medida**, que **aguantan sin nevera** (porque tu plan lo marca o porque quien cuida lo marcó en **Perfil → «Aguantan sin nevera»**) y con una textura que hoy acepta. Cada una dice quién la marcó. **Nunca** salen un alimento rojo, uno con restricción vigente, una alergia ni una intolerancia. Si algo se queda fuera porque **hoy no acepta esa textura** o **lo rechazó la última vez**, la pantalla lo dice abajo en **«Hoy se quedan fuera»**. Con **Empacar** lo pones en el día; luego **«Se lo comió»** o **«Volvió a casa»** (con símbolo y palabra), y **Quitar** lo deshace. Las **compras de la semana** se arman solas con lo que empacaste. Si tu plan no marca nada que aguante sin nevera, la pantalla lo dice y te manda al Perfil: no inventa opciones.
- **Etiqueta con QR:** **«Etiqueta de la lonchera»** junta lo que no puede comer (alergias, intolerancias) y lo que lleva hoy, con un **código QR que guarda solo texto, nunca un enlace**, y se lee sin internet. El **nombre** va únicamente si un padre lo escribe en esa pantalla (se queda en este teléfono). **«Imprimir etiqueta»** abre el cuadro de impresión de tu teléfono y solo sale la hoja; no se envía nada. Si no cabe todo en el código, se acorta la lista de lo que lleva, nunca la de lo que no puede comer.
- **Recetas (/recetas):** un recetario inicial de más de 30 recetas sencillas, **revisadas contra tu plan**. Cada una dice su estado con símbolo y palabra: **«Con lo de tu plan»**, **«Con medida»** (el plan limita algo) o **«Algo no está en tu plan»** (se dice cuál; pregunta a tu profesional). Una receta con algo rojo, con restricción vigente o con una alergia **no se muestra**, y **«Ver por qué algunas no se muestran»** dice cuál ingrediente y por qué. Si hoy no acepta una textura, la receta lo avisa (depende de cómo la prepares). **Ver receta** abre ingredientes y pasos. Filtros por **tiempo**, **costo** y **«Con lo que le gusta»**.
- **«¿Qué cocino con lo que tengo?»:** marca lo que hay en casa y la app separa las que puedes hacer **ya**, las que salen **con un reemplazo de tu plan** (solo si tu plan lo trae como equivalencia) y las que **casi** salen. La despensa se queda en este teléfono (desde el Sprint 012 también puedes llenarla con una foto en **Cámara**).
- **Mis recetas:** escribe las tuyas (nombre, ingredientes uno por línea, pasos opcionales). Se revisan contra tu plan igual que las demás. **Se guardan solo en este teléfono: no se comparten con la familia.**
- **Modo viaje (/viaje):** elige **Carretera** o **Avión**. Te da la lista **«Para llevar»** sacada de tu plan (la comida que aguanta sin nevera, los suplementos, los medicamentos anotados y lo que no puede), que puedes ir marcando; un **día de viaje** ordenado con las franjas de comida de tu plan (sin horas inventadas) y un **documento del viaje en español e inglés** con lo que tu plan y lo que anotaste dicen. El documento se arma **en tu teléfono, sin internet**, e **incluye datos de salud del niño**: guárdalo con cuidado. Lleva el nombre solo si un padre lo escribió para la etiqueta. **«Imprimir documento»** saca solo la hoja.
- **Quién la usa:** madre o padre, todo · cuidador, la lonchera y lo anotado en ella · colegio, ve la lonchera solo si su acceso incluye comidas (si no, la pantalla dice «Tu acceso no incluye comidas de la lonchera») · nutricionista, no la anota. Lo empacado viaja cifrado entre los teléfonos de la familia, como el resto del día.
- **Limitaciones conocidas:** el cotejo de una receta con tu plan es **por nombre**: si tu plan llama distinto a un alimento, la receta dirá «no está en tu plan» en vez de un verde dudoso. La despensa, las recetas propias y la lista del viaje no se comparten entre teléfonos. Un día guarda hasta 14 alimentos en la lonchera. Todos los teléfonos de la familia deben tener esta versión: uno antiguo descartaría lo empacado al volver a subirlo.

**In English — Lunchbox, recipes and travel mode (since Sprint 011).** Three screens for everyday life, built
**from your plan** and **on your phone**: nothing is invented, nothing is sent, and all three open **without
signal**. Find them on **Today**, in the **"For everyday life"** row. They organise what your plan says; they
are not medical advice. **Lunchbox:** pick a day (today and the next six) and see the **options to take**:
only foods your plan accepts, green or with a limit, that **keep without a fridge** (your plan says so, or a
caregiver marked them in **Profile → Keep without a fridge**) and in a texture they accept today. A red food,
a current restriction, an allergy or an intolerance never shows up; what is left out because of texture or
because they refused it last time is listed under "Left out today". **Pack** it, then **Ate it** or **Came
back home**; the **weekly shopping list** builds itself from what you packed. The **label** lists what they
cannot eat and what goes today, with a **QR that holds text only, never a link**; the name appears only if a
parent types it (it stays on this phone); **Print label** prints just the sheet. **Recipes:** 30+ simple
recipes **checked against your plan** (**"With your plan"**, **"With a limit"**, **"Something is not in your
plan"**); a recipe with a red food, a current restriction or an allergy is hidden and the reason is one tap
away; filters for time, cost and what they like; **"What can I cook with what I have?"** sorts recipes into
make-it-now, with-a-swap-from-your-plan and almost; **My recipes** are reviewed the same way and **stay only on
this phone**. **Travel mode:** by road or by plane, a packing list from your plan, a travel day built from your
plan's meal windows (no invented times) and a **Spanish + English document** built on the phone without
internet; it **contains the child's health data**, so keep it safe. Matching a recipe to your plan is by name:
if your plan names a food differently the recipe says "not in your plan" instead of a doubtful green.

### Tema: claro, oscuro o el del teléfono · desde Sprint 011

- **Qué hace:** la app puede verse en **claro**, en **oscuro** o seguir al teléfono. El oscuro es de verdad: el fondo, el semáforo (símbolo + palabra + color) y todo el texto se ven bien y se leen con el mismo contraste.
- **Cómo se usa:** **Ajustes → «Tema»** → **Sistema**, **Claro** u **Oscuro**. «Sistema» cambia solo cuando cambia tu teléfono. La elección se queda en este teléfono y no se pierde al cambiar de idioma.
- **Limitaciones conocidas:** cada teléfono de la familia elige el suyo; no se comparte.

**In English — Theme: light, dark or the phone's (since Sprint 011).** **Settings → "Theme"** → **System**,
**Light** or **Dark**. Dark is real: background, traffic light (symbol + word + colour) and text keep the
same contrast. "System" follows the phone; the choice stays on this phone and survives a language change.

### La cámara: de la foto a la cocina y al plato · desde Sprint 012

- **Qué hace:** con una foto de lo que hay en la cocina, la app **ve qué alimentos son** y, a partir de ahí, te ayuda a **llenar la despensa**, a **decidir qué cocinar** y a **mirar un plato contra tu plan**. Quien mira la foto es un modelo pequeño y gratuito; **solo dice los nombres de lo que ve**. Todo lo demás lo decide la programación de la app con **tu plan**: nada se inventa, y lo que no coincide con nada se muestra y no va a ningún lado. No es un consejo médico: organiza lo que dice tu plan.
- **Dónde está:** **Hoy**, en la fila **«Para el día a día»** → **Cámara** (/camara).
- **La primera vez, el modelo:** la pantalla ofrece **«Descargar el modelo»** (unos 179 MB, mejor con wifi). **Hasta que lo toques no se descarga nada y nada sale del teléfono.** Se baja **una sola vez**, se guarda en tu teléfono y después **funciona sin señal**. Es lo único que usa internet en toda la cámara, y el navegador mismo le pone el límite: el programa que mira la foto solo puede hablar con la propia app y con el sitio público de modelos de donde se baja.
- **La foto:** **«Tomar una foto»** o **«Elegir de la galería»** (el teléfono abre su propio selector: la página no pide permiso de cámara). La foto se achica, se mira **en la memoria del teléfono** y se suelta: **no se guarda y no se envía**. Ningún servicio de pago ni de terceros procesa nada.
- **«Lo que vio»:** la lista de alimentos que reconoció. Todo resultado dice **«Verifícalo con un adulto: el modelo puede equivocarse»**. Lo que la app no conoce sale aparte como **«Vio esto, pero la app no lo conoce»**, solo para que lo veas. Si dijo muchos nombres, se muestran los primeros y el resto se cuenta («Y n más que no se muestran»). Un alimento **procesado** (papitas, nuggets, salsa de tomate, torta de zanahoria…) no cuenta como el alimento que lleva dentro: no entra a la despensa como si fuera la verdura o el pollo.
- **«¿Qué tienes en casa?»:** los alimentos salen **sin marcar**. Toca solo lo que de verdad tienes y luego **«Guardar en la despensa (n)»**: nada entra a la despensa hasta que lo confirmas. Si algo de tu despensa lo evita tu plan o choca con lo anotado como alergia o intolerancia (también por familia: «lactosa» deja fuera el queso y el yogur; «mariscos», el camarón), la pantalla lo dice —**«Tu plan lo evita, así que no se usa: …»**— y no lo usa en ninguna receta ni idea.
- **«Qué cocinar con lo que tienes» (/camara/cocina):** con tu despensa, separa las recetas que puedes hacer **ya**, las que salen **con un reemplazo que tu plan propone** y las que **casi** salen (te falta poco). Si ninguna receta del recetario sale tal cual, la app arma **«Una idea con lo que tienes»** a partir de seis formas de cocinar (salteado, sopa, tortilla, al horno, puré, arroz), con **solo** lo de tu despensa que tu plan acepta: nunca un alimento rojo, una restricción vigente, una alergia, una intolerancia ni una textura que hoy no acepta. Cada idea se revisa de nuevo contra tu plan, dice su estado con símbolo y palabra y trae sus pasos, sin cantidades. «Casi» solo trae recetas que usan algo de lo que ya tienes. Si una receta pide una textura que hoy no acepta, lo dice en su fila y no frena las ideas de la app.
- **«Mirar el plato»:** lee lo que mostró la foto contra tu plan para **la comida de ahora** (o la que elijas en el selector). Cada alimento sale con símbolo, palabra y color: **«Está en tu plan»**, **«Con medida»**, **«Tu plan lo evita»**, **«Choca con lo anotado como alergia o intolerancia»** o **«Tu plan no lo nombra»**. Si tu plan sí lo nombra pero su restricción con fecha ya terminó, dice **«Su restricción en tu plan ya terminó»** (no «tu plan no lo nombra»). Una alergia o intolerancia anotada en **Perfil** choca aunque el alimento no esté en el catálogo. También dice **qué grupos de tu plan para esa comida no se vieron** («Puede estar y no verse») o, si el plan no nombra grupos para esa comida, **«Tu plan no dice qué grupos lleva esta comida»**. Un alimento que tu plan no nombra **nunca sale en verde**. Cuando lo marcaste **a mano**, el aviso dice que lo leyó el código contra tu plan, no una foto.
- **Si el modelo no se puede usar:** si el navegador del teléfono no lo corre, si no lo has descargado o si falló, la pantalla lo dice y abre **«Marcar a mano»**: eliges ingredientes y alimentos de tu plan y se leen igual. La app no se rompe sin el modelo.
- **«Cómo va el motor»:** un panel plegable pensado para probar: motor que usa el teléfono, tamaño, cuánto tardó en cargar y por foto, y una marca ✓/✗ por cada alimento visto. **«Copiar resultados»** copia solo cifras en texto, nunca la foto.
- **Borrar el modelo:** **Ajustes → «El modelo de la cámara»** dice cuánto espacio ocupa y **«Borrar el modelo»** lo quita sin tocar tu plan ni tu registro (para volver a usar la cámara se descarga de nuevo). **«Borrar mis datos»** también lo borra.
- **Quién la usa:** madre o padre, todo · cuidador, la despensa y el plato · colegio, solo el plato de **sus** comidas · nutricionista, no la usa (la pantalla dice «Con tu rol en la familia, este teléfono no puede usar esto.»). **Nada de esto se comparte con la familia:** la despensa se queda en este teléfono.
- **Limitaciones conocidas:** el modelo es pequeño: nombra los alimentos en inglés, puede equivocarse y puede no ver algo que sí está; el cotejo con tu plan y tus recetas es **por nombre**. Las **etiquetas** y el **súper** tienen sus propias pantallas (Sprint 013, abajo). Necesita espacio libre para descargarse una vez. Un teléfono muy antiguo puede no poder correrlo: para eso está «Marcar a mano».

**In English — The camera: from the photo to the kitchen and the plate (since Sprint 012).** On **Today**,
in the **"For everyday life"** row, open **Camera**. A small free model looks at a photo and **only names the
foods it sees**; the app's code does everything else, with **your plan**: it matches the names against the
recipe book and your plan, nothing is invented, and whatever matches nothing is shown ("It saw this, but the
app doesn't know it") and goes nowhere; processed foods (chips, nuggets, ketchup, carrot cake) never count as the food inside them. The model is downloaded **once** (about 179 MB, better on wifi)
**only after you tap "Download the model"**; until then nothing is downloaded and nothing leaves the phone.
It is then kept on the phone and works **without signal**; that download is the only thing the camera does
online, and the browser itself enforces the limit: the program that looks at the photo can only talk to the app and to the public model host. The photo comes from the system's own picker (no camera permission for the page), is shrunk, looked at
in the phone's memory and let go: **not saved, not sent**; no paid or third-party service processes anything.
Every result says **"Double-check it with an adult: the model can get things wrong."** The foods it saw
arrive **unticked** in **"What do you have at home?"**: tap what you really have and **Save to the pantry**.
**What to cook with what you have** sorts recipes into make-it-now, with-a-swap-your-plan-proposes and almost;
if no recipe comes out, the code offers **"An idea with what you have"** (sauté, soup, omelette, baked,
mash or rice) filled only with pantry items your plan accepts, never a red food, a current restriction, an
allergy, an intolerance (families too: "lactose" leaves out cheese and yogurt) or a texture they don't accept today, with steps and no quantities. Anything in your pantry your plan avoids is named ("Your plan avoids it, so it isn't used: …") and kept out. **Look at the
plate** reads the photo against your plan for the current meal (or the one you pick), each food with symbol,
word and colour (**In your plan · With a limit · Your plan avoids it · Clashes with what is noted as an allergy
or intolerance · Your plan doesn't name it**; "Its restriction in your plan has ended" if the plan does name it but the dated restriction is over); an allergy noted in Profile clashes even if the food is not in
the catalogue; it also says which of your plan's groups for that meal were not seen ("It may be there and not
show"). If the browser cannot run the model, or it is not downloaded, **Tick by hand** works the same way. A
folding **"How is the engine doing"** panel (engine, size, load time, time per photo, ✓/✗ per food, **Copy
results**, figures only, never the photo) is for testing. **Settings → "The camera model"** shows the space it
takes and **Delete the model** removes it without touching your plan or log; **Delete my data** removes it too.
Parent: everything · Caregiver: pantry and plate · School: the plate of its own meals · Nutritionist: not
available. Nothing here is shared with the family; the pantry stays on the phone. Limits: the small model names
foods in English, can be wrong or miss things, and matching is by name; labels and the supermarket have
their own screens (Sprint 013, below).

### Leer una etiqueta y el modo súper · desde Sprint 013

- **Qué hace:** **lee la etiqueta de un producto** con una foto y **escanea su código de barras**, y lo coteja con **tu plan**: aditivos (aunque vengan escritos como «E102», «E-102», «E 102», «INS 102» o por su nombre), alimentos rojos, restricciones vigentes, alergias e intolerancias, también **si aparecen en «puede contener»**. Dice **«No va»**, **«Revisa»**, **«No vi nada que choque»** o **«No pude leerla»**, siempre con símbolo, palabra y color, el **motivo** y **«Verifícalo con un adulto»**. Organiza lo que dice tu plan; no es un consejo médico, no da cifras de nutrientes y nada inventa un alimento.
- **Dónde está:** **Hoy**, en la fila **«Para el día a día»** → **Cámara**, y ahí **«Leer la etiqueta de un producto»** (/camara/etiqueta) y **«Modo súper: escanear un código de barras»** (/camara/super).
- **La primera vez:** cada pantalla ofrece **«Descargar el lector»** (unos 9 MB) o **«Descargar el catálogo»** (unos 2 MB; unos 3 MB si tu navegador no lee códigos de barras por sí solo), mejor con wifi. **Hasta que lo toques no se descarga nada.** Se baja **una sola vez**, se guarda en el teléfono y después **funciona sin señal**. Es lo único que usa internet, y el navegador mismo le pone el límite: los programas que leen solo pueden hablar con la propia app.
- **La foto y lo escaneado no salen del teléfono:** la foto se achica, se lee en la memoria del teléfono y se suelta; el código se busca en el catálogo **que ya está en el teléfono**. Nada se guarda ni se envía, y ningún servicio de pago ni de terceros procesa nada. El teléfono abre su propio selector (**«Tomar foto»** / **«Elegir una foto»**): la página no pide permiso de cámara.
- **«Lo que se leyó»:** el texto que sacó la foto, **siempre a la vista** para que lo compares con la etiqueta. Si algo no coincide, vuelve a tomar la foto. Un texto **mal leído jamás da «No vi nada que choque»**: da **«No pude leerla»** (también si la lectura es corta, torcida o con poca luz). Si hay algo que no va, **«No va»** manda aunque lo demás no se haya leído bien.
- **El modo súper:** apunta al código de barras (o **escríbelo**: 8, 12 o 13 números; si un número está mal, lo dice). El **catálogo** trae unos 8.800 productos de Colombia de **Open Food Facts** (datos públicos, licencia ODbL; la atribución sale en la pantalla y en Ajustes) y **menos de uno de cada cinco trae su lista de ingredientes**: para el resto dice **«No sé qué lleva»** y te lleva a **«Leer una etiqueta»**. Si el producto no está, dice **«Este producto no está en el catálogo»** y lleva al mismo camino.
- **«Marcas que sí van con tu plan»:** si un producto no va (o no se sabe qué lleva), la app muestra **hasta cinco** de su misma categoría que **sí** pasan el cotejo (solo «No vi nada que choque»; nunca uno en «Revisa» ni «No pude leerla»). Se calculan en el teléfono.
- **«Lo que compré»:** **«Anotar en lo que compré»** guarda el código, el nombre, la marca y la fecha (hasta 200). Cada vez que abres la lista se **revisa de nuevo con tu plan de hoy**: si algo ya no va, sale un aviso tranquilo (**«Esto que compraste no va con tu plan: …»**), sin alarma. **Quitar** borra uno. La lista se queda en este teléfono: **no se comparte con la familia**.
- **Borrar:** **Ajustes → «Lector de etiquetas y catálogo»** dice cuánto espacio ocupan y **«Borrar el lector y el catálogo»** los quita sin tocar tu plan, tu registro ni lo que compraste (para volver a usarlos se descargan de nuevo). **«Borrar mis datos»** los borra también, y la lista «Lo que compré».
- **Quién la usa:** leer etiquetas y productos lo hace cualquiera que vea el plan; **anotar en «Lo que compré»** lo hacen madre o padre y cuidador (con colegio o nutricionista dice **«Con tu rol puedes mirar el producto, pero no anotarlo en lo que compré»**).
- **Limitaciones conocidas:** el lector es un programa pequeño que **se equivoca con fotos torcidas, borrosas o con brillo**; por eso lo leído siempre está a la vista y siempre dice «Verifícalo con un adulto». Un aditivo que el plan no nombra, o escrito de una forma rara, puede pasar sin ser visto. El catálogo es de **Colombia**, tiene una parte de los productos y puede traer datos viejos o incompletos: lo que no está se resuelve con la foto de la etiqueta. Necesita espacio libre para descargarse una vez.

**In English — Reading a label and supermarket mode (since Sprint 013).** On **Today**, in the **"For everyday life"** row, open **Camera**, then **"Read a product label"** or **"Supermarket mode: scan a barcode"**. A photo of the ingredient list, or the barcode of a product, is checked against **your plan**: additives (written as "E102", "E-102", "E 102", "INS 102" or by name), red foods, current restrictions, allergies and intolerances, **also when they appear under "may contain"**. The answer is **Not a fit, Check it, Nothing clashes that I saw, or Couldn't read it**, always with symbol, word and colour, the reason and **"Check it with an adult"**; no nutrient figures, no medical advice. The text that was read is **always shown**, and **text that was read badly never counts as fine**: it says "Couldn't read it". The reader (about 9 MB) and the catalog (about 2 MB, or about 3 MB if your browser can't read barcodes by itself) download **once, only after you tap the button**, and then work **without signal**; the photo and the barcode **never leave the phone** (the browser itself limits the reading programs to the app), and no paid or third-party service processes anything. The catalog holds about 8,800 products from Colombia, from **Open Food Facts** (open data, ODbL licence, credited on screen and in Settings); **fewer than one in five lists its ingredients**: for the rest it says "I don't know what it has" and sends you to the label photo. If a product does not fit (or it is not known what it has), **"Brands that fit your plan"** shows up to five from its category that pass the same check (never one marked "Check it" or "Couldn't read it"). **"What I bought"** keeps code, name, brand and date (up to 200), re-checks them against today's plan and, if something no longer fits, shows a calm notice without alarm; it stays on this phone and is not shared with the family. **Settings → "Label reader and catalog"** shows the space used and **Delete the reader and the catalog** removes them without touching your plan, log or purchases; **Delete my data** removes all of it. Parent and caregiver can write to "What I bought"; school and nutritionist can look but not write. Limits: the reader can be wrong with tilted, blurry or shiny photos, an additive written in an odd way can slip by, and the catalog is partial and may be out of date.

### Para la familia: lecciones, «Qué sí y qué no» y «Cuando le ofrecen algo» · desde Sprint 014

- **Qué hace:** ayuda a **toda la familia** (abuelos, tíos, el colegio) a acompañar el plan sin regañar. Tiene **cinco lecciones cortas** (se leen en menos de dos minutos), una **hoja «Qué sí y qué no»** hecha con **tu plan** para mostrársela a quien lo cuide, y un **registro** para anotar cuándo le ofrecen algo que no va. No da consejo médico, no culpa a nadie y la comida **nunca** es premio ni castigo.
- **Dónde está:** **Hoy**, fila **«Para la familia»** → **«Qué sí y qué no, y lo que ayuda»** (/familia) y **«Cuando le ofrecen algo»** (/familia/presion). Desde el escenario **«Le ofrecen algo que no puede»** (Escenarios), el enlace **«Anotarlo y ver qué decir la próxima vez»** también lleva a anotar.
- **Las lecciones:** _apoyar sin regañar · la comida no es premio ni castigo · no forzar ni negociar bocados · probar muchas veces, sin presión · cuando pide lo que no puede_. Cada una trae **frases para decir** y **«De dónde sale»**: están **parafraseadas** de la AAP (HealthyChildren.org), el Ellyn Satter Institute (la división de responsabilidades en la alimentación) y las revisiones del USDA NESR sobre la exposición repetida; ninguna hoja ajena se copia ni se modifica.
- **«Qué sí y qué no»:** sale **solo de tu plan**: **No puede** (rojos, restricciones vigentes, alergias e intolerancias, y los códigos de aditivos que hay que buscar en las etiquetas), **Con condición** (los amarillos, **sin su cifra**: «Pregúntale a quien lo cuida antes de darlo») y **Sí puede** por grupos. La app **no inventa ningún alimento**; si algo no está en la hoja, no se da sin preguntar.
- **Anotar lo que le ofrecieron:** cuatro toques y **sin escribir texto**: **quién** (un teléfono de la familia u «Otra persona»; **jamás un nombre de un tercero**), **qué** (un alimento de tu plan o «Algo fuera del plan»), **dónde** (abuelos o familia, colegio, fiesta, entre otros niños, salida, otro lugar) y **cómo se respondió** («no, gracias» tranquilo, se cambió por algo del plan, lo comió, de otra forma). Al guardar sale **«Para la próxima vez»**: unos pasos para ese lugar, **qué puedes decirle a quien lo ofreció** y **lo que sí puedes ofrecer de su plan** (solo de la lista verde).
- **Lo que se repite:** con dos o más del mismo alimento en el mismo lugar durante el último mes, la pantalla dice, por ejemplo, **«3 veces este mes: …, en una fiesta»**, y cuenta por lugar. **Nunca dice quién**: el patrón es de dónde y qué, no de personas.
- **Quién ve qué:** **madre y padre** ven el registro completo y lo que se repite (quien recibe ese rol después también ve lo anotado antes); **cualquier otro rol** (cuidador, colegio, nutricionista) **anota y ve solo lo de su teléfono**. Sin familia, el teléfono ve todo. Se queda en el teléfono; con la familia activada viaja **cifrado y firmado** como lo demás, y no va a la bitácora de la familia, a los registros de la app ni a ningún servicio de terceros. Cada teléfono guarda hasta **200** anotaciones de los últimos **90 días**, y **quita las suyas** con el bote de basura. **«Borrar mis datos»** lo borra.
- **Limitaciones conocidas:** la familia comparte **una sola llave de cifrado**, así que la regla de «solo madre y padre ven todo» **la cumple la app, no la criptografía**: alguien con la frase de la familia y un programa alterado podría leerlo. Todos los teléfonos de la familia deben tener esta versión.

**In English — For the family: lessons, "What yes and what no" and "When they're offered something" (since Sprint 014).** On **Today**, the **"For the family"** row opens **five short lessons** (under two minutes each: support without scolding · food is not a prize or a punishment · no forcing or bargaining over bites · many tries, no pressure · what to say when they ask for what they can't have), each with **phrases to say** and **"Where it comes from"** (paraphrased from the AAP's HealthyChildren.org, the Ellyn Satter Institute and the USDA NESR reviews on repeated exposure; no outside handout is copied). **"What yes and what no"** is built **only from your plan**: **No** (red foods, current restrictions, allergies and intolerances, and the additive codes to look for on labels), **With a condition** (yellow foods, **without their figures**: "ask whoever looks after them before giving it") and **Yes** by group; it never invents a food. **"When they're offered something"** notes in four taps, **with no free text**, who offered it (a phone of the family or "Someone else", never a third party's name), what (a food in your plan or "Something outside the plan"), where (relatives, school, party, other children, outing, elsewhere) and how it went; it then shows **"For next time"** with steps for that place, what to say to whoever offered it, and what you can offer from the plan's green list. **What repeats** counts the last month by place and food, **never by person**. **Parents** see the full record and the pattern (whoever gets that role later also sees what was noted before); **every other role sees only what its own phone noted**; with no family the phone sees all. It stays on the phone and, with the family on, travels encrypted and signed, never to the family log, the app's logs or any third party; each phone keeps up to 200 entries from the last 90 days and can remove its own. **Delete my data** removes it. Limit: the family shares **one encryption key**, so "only parents see everything" is enforced by the app, not by cryptography.

### La aventura del niño y el modo niño · desde Sprint 014

- **Qué hace:** un juego tranquilo para que el peque juegue **en tu teléfono** mientras tú haces otra cosa. Tiene **tres mundos** y **el niño elige el suyo** (se puede cambiar cuando quiera): **El huerto de Brote** (gotas), **La expedición de Lumo** (chispas de luz) y **El cielo de Nubo** (estrellas). Los tres comparten **una sola energía**.
- **Dónde está:** **Hoy**, fila **«Para la familia»** → **«La aventura de tu peque»** (/aventura).
- **De dónde sale la energía:** de **cuidarse y explorar**: dormir, moverse o jugar, estar al sol (los hábitos del día que ya anotas en **Bienestar**), **tomar agua**, **ayudar en la cocina** (es lo único que toca el niño: un toque por día) y **conocer algo nuevo** (mirar, tocar o probar un alimento nuevo cuenta igual). **Nunca sale de comer**: ni de lo que come, ni de cuánto, ni de si acepta o rechaza; **las pantallas ni suman ni restan**; no hay rachas ni castigos. **La energía solo sube**: lo que se ganó no se pierde ni cuando se corrige un hábito. Cada fuente suma **una vez al día**.
- **Modo niño:** en **/aventura**, el panel de adultos tiene **«Activar modo niño»**. Con él puesto, el teléfono se queda a pantalla completa en la aventura: **sin plan, sin Ajustes y sin barra**; escribir otra dirección o tocar **Atrás** lo devuelve ahí. Para salir, un adulto **mantiene pulsado «Salir · adulto» dos segundos** y resuelve **una suma escrita en palabras** con el teclado de números. Un toque suelto no hace nada.
- **Privacidad:** todo se queda en el teléfono (no se comparte con la familia). **«Borrar mis datos»** lo vacía y apaga el modo niño: es la única forma en que la energía baja.
- **Limitaciones conocidas:** la salida del adulto es **un seguro de pantalla, no una frontera de seguridad**: frena a un niño pequeño, no a alguien que sepa abrir las herramientas del navegador. Los hábitos y los alimentos nuevos que anotan otros teléfonos de la familia suman cuando este teléfono los recibe.

**In English — The child's adventure and kid mode (since Sprint 014).** **Today → "For the family" → "Your child's adventure"**. A calm game the child plays **on your phone**, with **three worlds the child picks and can change anytime**: Brote's garden (drops), Lumo's expedition (sparks of light) and Nubo's sky (stars), all sharing **one energy**. The energy comes from **looking after themselves and exploring**: sleep, moving or playing, sun (the habits you note in **Wellbeing**), water, **helping in the kitchen** (the only thing the child taps, once a day) and **meeting something new** (looking at, touching or tasting a new food all count). It **never comes from eating**: not what, not how much, not whether they accept or refuse; screen time neither adds nor subtracts; no streaks, no punishments. **Energy only goes up.** **Kid mode** ("Turn on kid mode" in the adult panel) keeps the phone full-screen on the adventure: **no plan, no Settings, no bar**; typing another address or pressing Back brings it back. An adult leaves by **holding "Exit · adult" for two seconds** and solving **a sum written in words** on a number keypad. It all stays on the phone; **Delete my data** empties it and turns kid mode off. Limit: the adult exit is a **screen lock, not a security boundary**.

### Lo que aprende y el día de hoy · desde Sprint 015

- **Qué hace:** devuelve lo que ya anotan en casa, **en palabras y con conteos, nunca con un porcentaje ni una nota**: cómo va la semana frente al plan, qué se repite, y qué conviene tener a mano **hoy**. No es un diagnóstico, no dice por qué pasa nada, no nombra una alergia y **jamás cambia el plan**: eso lo cambia solo tu profesional.
- **El día de hoy y qué preparar (en Hoy):** una tarjeta con una **mochila** que se llena según lo que hay hoy: **«Mochila ligera»** (nada especial), **«Mochila con algo más»** (una cosa) y **«Mochila llena»** (varias). Es de color ciruela, nunca el rojo de los alimentos, y siempre trae símbolo y palabras. Debajo dice **por qué** (la noche fue más corta que la referencia de su edad · hay un evento con más gente · hoy están fuera de casa · hay alguien nuevo cuidándolo) y **qué preparar**, con enlaces a lo que la app ya tiene: el plan para un cumpleaños, qué decir cuando le ofrecen algo, el plan B, la lonchera, «Qué sí y qué no». No avisa ni suena: se ve al abrir **Hoy**.
- **«¿Cómo es hoy?»:** tres botones en la misma tarjeta (evento con más gente, fuera de casa, alguien nuevo). Los pueden tocar **madre o padre, cuidador y colegio**; la nutricionista lo ve y no lo cambia. **«Alguien nuevo»** además se nota solo: si alguien entró a la familia hace 14 días o menos y hoy marcó o anotó algo. El sueño cuenta cuando elegiste su franja de edad en el **Perfil** y anotaste cuánto durmió anoche en **Bienestar**; si falta uno, la tarjeta lo dice.
- **Lo que aprende (pantalla propia):** en **Hoy**, fila **«Para la familia»** → **«Lo que aprende»** (/aprende).
  - **Esta semana:** siete cuentas, una por día, y una frase como **«5 de 7 días anotados dentro del plan»**, con la semana pasada también en palabras y **lo que más cuesta** (por ejemplo, la merienda). Un día **sin anotar no resta**: solo cuenta lo que anotaron.
  - **Las últimas cuatro semanas:** un calendario con un cuadro por día (dentro del plan · algo distinto · sin anotar), cada uno con símbolo y palabra.
  - **Lo que se repite:** agrupado en **cuándo** (un momento del plan o un día de la semana), **dónde** (un lugar donde aceptó lo que le ofrecieron) y **qué coincidió** (algo que se anotó de cómo está los mismos días que un alimento). Solo aparece lo que coincidió **al menos 3 veces y en 3 de cada 5 o más** («coincidió 3 de 4 veces»). Con menos de **7 días anotados** calla y dice cuántos faltan. Cada coincidencia cierra con «coméntalo con tu nutricionista».
  - **Lo que va aprendiendo:** la propia estadística de la app, **en tu teléfono y sin ningún servicio ni inteligencia artificial**. Con menos de **14 días anotados** dice **«Aún aprendiendo (N de 14 días)»** y no cambia nada. Después cuenta qué pesa en el día (por ejemplo, que los días con evento hubo algo distinto al plan) y **puede mover la mochila un nivel**, y dice qué acepta mejor (textura, presentación o grupo del plan) y **qué alimentos de tu plan, del mismo grupo, aún no ha probado**. **«Borrar lo aprendido»** (dos pasos) lo deja en cero **sin tocar lo anotado**.
- **Quién ve qué:** la tarjeta del día y qué preparar la ve **quien cuida ese día** (madre o padre, cuidador, colegio y nutricionista; los que no son madre o padre ven solo los motivos, sin el ajuste de lo aprendido). **«Lo que aprende»** —la semana, el calendario, lo que se repite y lo aprendido— lo ven **solo madre y padre**; sin familia, el teléfono ve todo. Cualquier otro rol ve un aviso que lo explica.
- **Privacidad:** todo se calcula en el teléfono. El contexto del día viaja **cifrado y firmado** como lo demás; lo aprendido **nunca sale del teléfono**. Nada de esto va a los registros de la app ni a ningún tercero. **«Borrar mis datos»** también lo borra.
- **Limitaciones conocidas:** la familia comparte **una sola llave de cifrado**, así que «solo madre y padre ven lo aprendido» **lo cumple la app, no la criptografía**. Con pocos días anotados la app calla en lugar de adivinar. Sin una familia activa, «alguien nuevo» solo se marca a mano. Los demás teléfonos deben tener esta versión para ver el contexto del día.

**In English — What it learns and today's day card (since Sprint 015).** It gives back what you already note at home, **in words and counts, never a percentage or a grade**. It is not a diagnosis, never says why something happens, never names an allergy and **never changes the plan**. **Today** has a **day card**: a **backpack** that fills, **"Light backpack" · "Backpack with a little more" · "Full backpack"**, in plum (never the foods' red), always with a symbol and words, with **why** (a shorter night than the reference for their age · an event with more people · away from home · someone new looking after them) and **what to prepare**, as links to what the app already has (birthday plan, what to say when offered something, Plan B, lunchbox, "What yes and what no"). No notification: it shows when you open **Today**. **"How is today?"** has three buttons; **parents, caregivers and school** can tap them (the nutritionist only sees them), and **"someone new"** is also noticed on its own when someone joined the family 14 days ago or less and noted something today. **Today → "For the family" → "What it learns"** (parents only; with no family, the phone sees everything) shows **this week** (seven beads and a sentence such as "5 of 7 noted days within the plan", last week in words, and what is hardest), the **last four weeks** as a calendar (within the plan · something different · not noted; unnoted days never subtract), **what repeats** by when, where and what matched (only what matched **at least 3 times and in 3 of 5 or more**, "matched 3 of 4 times"; fewer than **7 noted days** and it stays quiet and says how many it needs; every match ends with "talk it over with your nutritionist") and **what it is learning**: the app's own statistics, **on the phone, with no service and no AI**. With fewer than **14 noted days** it says **"Still learning (N of 14 days)"** and changes nothing; after that it shows what weighs on the day (it can move the backpack one level), what they accept best and which foods **from your plan**, in the same group, they have not tried yet. **"Erase what it learned"** (two steps) resets it **without touching what was noted**. The day context travels encrypted and signed; what is learned never leaves the phone; **Delete my data** removes it. Limit: "only parents see what is learned" is enforced by the app, not by cryptography.

### Idioma y borrar datos · desde Sprint 001

- **Qué hace:** cambia la app entre español e inglés, muestra qué dieta está cargada, y permite
  **borrar todos los datos** del teléfono.
- **Cómo se usa:** **Ajustes** (abajo). Para borrar: **"Borrar mis datos"** → confirma. Se borra
  la dieta cargada y **todo tu registro del día (marcas, horas y notas)** y **lo que anotaste en el perfil (notas y texturas)**, y este teléfono sale de la familia y deja de recibir avisos; **si descargaste el modelo de la cámara, el lector de etiquetas o el catálogo del súper, también se borran, y la lista «Lo que compré»**, **el registro de «Cuando le ofrecen algo» y la aventura del niño (la energía vuelve a cero y el modo niño se apaga)** **y lo que aprendió «Lo que aprende» (vuelve a cero)** (puedes quitar el modelo, o el lector y el catálogo, sin tocar nada más, en **Ajustes → «El modelo de la cámara»** y **«Lector de etiquetas y catálogo»**); la app vuelve a la demo.
  Esto no se puede deshacer. Si estás en una familia, el cuadro trae la casilla **«También borrar lo compartido de internet»**: con ella marcada se borra también la copia cifrada (los demás teléfonos conservan la suya); sin marcar, solo sales de la familia. También puedes borrarla antes desde **«Borrar lo compartido»** en Compartir con la familia.

## Preguntas frecuentes

- **¿El PDF que cargo se sube o se guarda?** No. Se lee en tu teléfono, sin internet, y al terminar se
  suelta de la memoria: solo queda el plan ya revisado por ti. Las medidas del cuerpo, el nombre
  y el contacto que traiga el PDF se descartan: no entran al plan ni se guardan.
- **¿Mis datos van a internet?** Solo si activas «Compartir con la familia»: entonces el plan, el
  día (marcas, horas y notas) y el perfil (notas, alergias y medicamentos) viajan **cifrados desde tu
  teléfono**, y en internet solo quedan datos ilegibles. Sin familia y sin avisos, nada sale del teléfono (la cámara, el lector de etiquetas y el modo súper solo descargan su modelo, su lector o su catálogo, una vez y si tú lo pides, y no envían ni una foto ni un código); con los avisos activos salen solo la dirección para despertarlo y horas sin etiqueta (y, si marcas antes de la hora, el día y el minuto de ese aviso). El chat
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
  señal. Lo único que pide internet es descargar, una sola vez y
  cuando tú lo tocas, el modelo de la cámara, el lector de etiquetas y el catálogo del súper; después también funcionan sin señal.
- **¿La foto de la cámara se guarda o se envía?** No. Se mira dentro del teléfono y se suelta: no queda
  en la app ni sale a ningún lado. Solo se descarga, una vez y si tú lo pides, el modelo que mira las
  fotos; ningún servicio de pago ni de terceros ve nada.
- **¿La cámara necesita internet?** Solo para descargar el modelo la primera vez (unos 179 MB, mejor con
  wifi). Antes de tocar **«Descargar el modelo»** no se baja nada. Después se usa sin señal, y sin el
  modelo siempre queda **«Marcar a mano»**.
- **¿La cámara se puede equivocar?** Sí: el modelo es pequeño, nombra los alimentos en inglés y puede
  confundir o no ver algo. Por eso cada resultado dice **«Verifícalo con un adulto»**, nada entra a la
  despensa hasta que tú lo confirmas y lo que tu plan no nombra nunca sale en verde.
- **¿Puedo borrar el modelo de la cámara?** Sí: **Ajustes → «El modelo de la cámara» → «Borrar el
  modelo»**. No toca tu plan ni tu registro; para volver a usarla se descarga de nuevo.
- **¿La foto de la etiqueta o el código que escaneo se guardan o se envían?** No. La foto se lee dentro del teléfono y se suelta; el código se busca en el catálogo que ya está en el teléfono. Solo se descarga, una vez y si tú lo pides, el lector y el catálogo; ningún servicio de pago ni de terceros ve nada.
- **¿Puedo fiarme de «No vi nada que choque»?** Es una ayuda, no una garantía: el lector puede equivocarse y el catálogo puede estar incompleto. Por eso siempre está el texto leído a la vista y la frase **«Verifícalo con un adulto»**. Si la foto no se lee bien, la app dice **«No pude leerla»**, nunca «apto».
- **¿Por qué dice «No sé qué lleva»?** El catálogo trae el nombre y la marca de muchos productos, pero solo una parte trae sus ingredientes. Toma la foto de su etiqueta: la app la lee en el teléfono.
- **¿Puedo borrar el lector y el catálogo?** Sí: **Ajustes → «Lector de etiquetas y catálogo» → «Borrar el lector y el catálogo»**. No toca tu plan, tu registro ni lo que compraste; para volver a usarlos se descargan de nuevo.

## Historial

| Sprint | Features añadidas a este manual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001    | Cargar dieta (archivo + pegar) · semáforo con reemplazos · checklist "Hoy" · suplementos de la semana · idioma ES/EN · borrar datos · instalación como app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 002    | Chat "Pregúntale a la dieta": consultas "¿se puede?" al instante sin internet + preguntas abiertas con asistente de IA anclado al plan · nota de transparencia IA _(la parte de IA en la nube se reemplazó en el 004)_                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 003    | Registro del día: hora real al marcar + nota corta por comida (etiquetas + texto) · recordatorio "Ahora mismo" (qué toca y qué sigue; los avisos con la app cerrada llegaron en el 008) · "Ver días anteriores" (historial local de solo lectura) · borrar datos ahora cubre horas y notas                                                                                                                                                                                                                                                                                                                                                              |
| 004    | Chat nuevo que contesta con tu plan **sin internet y sin enviar nada** ("no tengo X", "no quiso X", "¿qué le doy ahora?", "¿cuánta agua?", "tu plan no lo dice") · todas las pantallas abren sin internet · aviso de versión nueva con "Actualizar" / "Ahora no"                                                                                                                                                                                                                                                                                                                                                                                        |
| 005    | Perfil de tu peque: lo del profesional **«según tu plan»** y lo anotado **«por quien cuida»** (texturas que hoy acepta y notas) · opciones de reemplazo ordenadas por textura, con la marca «textura que hoy no acepta» · el chat contesta sueño, actividad, alergias y medicamentos del plan · el plan guardado de antes se actualiza solo · la pantalla nueva abre sin internet                                                                                                                                                                                                                                                                       |
| 006    | **Tu PDF, vuelto app:** cargas el PDF de tu profesional, que se lee en tu teléfono sin internet y sin guardarse · «Revisa tu plan» parte por parte, con la página de cada dato («está bien», corregir o «mi plan no lo trae») · una revisión a medias se retoma · el JSON sigue funcionando y tus notas del Perfil se quedan                                                                                                                                                                                                                                                                                                                            |
| 007    | **Compartir con la familia:** el plan, el día (marcas, horas y notas) y el perfil en todos los teléfonos de quienes cuidan, **cifrados de punta a punta** · cada dato dice quién lo hizo («Por Mamá») · funciona sin internet y sube al volver · cambiar la frase para sacar a un teléfono · salir y borrar lo compartido                                                                                                                                                                                                                                                                                                                               |
| 008    | **Avisos que llegan:** avisos en el teléfono a la hora de las comidas, el suplemento y el agua, con la app cerrada · se eligen 4 tipos por teléfono y se puede ocultar el detalle con el teléfono bloqueado · marcar antes de la hora evita ese aviso · «Avisar a la familia» con una nota cifrada de hasta 140 letras · el servidor solo guarda horas sin etiqueta y manda toques vacíos · «Dejar de recibir avisos» y «Borrar mis datos» quitan la suscripción                                                                                                                                                                                        |
| 009    | **Coordinación:** roles (madre o padre, cuidador, colegio, nutricionista) con permisos y una bitácora firmada de quién cambió qué · **Plan B** (se acabó algo, no hay nevera, llegamos tarde) solo con lo que trae el plan · **Días especiales** (cumpleaños, restaurante, emergencia, «le ofrecen algo») sin señal · **Varias dietas:** unir dos planes, donde lo prohibido gana y cada línea dice de dónde salió                                                                                                                                                                                                                                      |
| 010    | **Bienestar:** cómo llega a cada comida (5 opciones con símbolo y palabra) · qué hizo con cada alimento · cómo está hoy (8 preguntas y una nota) · hábitos con su referencia y su fuente, sin alarmas · franja de edad en el Perfil · el Historial lo muestra                                                                                                                                                                                                                                                                                                                                                                                           |
| 011    | **El día a día:** **Lonchera** con opciones del plan que aguantan sin nevera, qué se empacó y se comió, compras de la semana y etiqueta imprimible con QR de solo texto · **Recetas** (más de 30, revisadas contra tu plan) con «lo que tengo» y recetas propias · **Modo viaje** con lista, día de viaje y documento ES+EN sin internet · **tema oscuro** de verdad en Ajustes                                                                                                                                                                                                                                                                         |
| 012    | **La cámara:** una foto de lo que hay en la cocina → **«Lo que vio»** con el aviso «verifícalo con un adulto» · **«¿Qué tienes en casa?»** (nada entra a la despensa hasta que confirmas) y **«Qué cocinar con lo que tienes»**, con ideas armadas solo con lo que tu plan acepta · **«Mirar el plato»** contra tu plan, con símbolo, palabra y color · **«Marcar a mano»** sin modelo · el modelo (unos 179 MB, una sola vez, sin señal después) se borra desde Ajustes · la foto no se guarda ni se envía                                                                                                                                             |
| 013    | **Etiquetas y súper:** la foto de la etiqueta de un producto se lee **en el teléfono** y se coteja con tu plan (aditivos escritos de varias formas, rojos, alergias también en «puede contener») → **«No va» · «Revisa» · «No vi nada que choque» · «No pude leerla»**, con el texto leído a la vista y «verifícalo con un adulto» · **Modo súper:** escanea el código de barras contra un catálogo de Colombia (Open Food Facts, ODbL) que se baja una vez · **«Marcas que sí van con tu plan»** · **«Lo que compré»**, que avisa con calma si algo ya no va · todo sin señal después de la descarga, nada sale del teléfono, y se borra desde Ajustes |
| 014    | **Para la familia y la aventura:** cinco lecciones cortas (sin regañar, la comida no es premio ni castigo, sin forzar bocados, probar muchas veces, cuando pide lo que no puede) · **«Qué sí y qué no»** hecha solo con tu plan · **«Cuando le ofrecen algo»**: se anota en cuatro toques, con «Para la próxima vez» y lo que se repite por lugar, nunca por persona · **La aventura del niño** con tres mundos y una sola energía que solo sube, y el **modo niño** con salida de adulto                                                                                                                                                               |
| 015    | **Lo que aprende:** la semana frente al plan **en palabras y conteos, sin porcentaje** y el calendario de cuatro semanas · **lo que se repite** (cuándo, dónde, qué coincidió) con su conteo y sin causa · **el día de hoy y qué preparar**: una mochila ligera, con algo más o llena, con su porqué y enlaces a lo que ya existe · «¿Cómo es hoy?» (evento, fuera de casa, alguien nuevo) y «alguien nuevo» se nota solo · **lo que va aprendiendo** (estadística propia, en el teléfono, sin IA, desde 14 días anotados) con **«Borrar lo aprendido»** · quién ve qué por rol                                                                         |
