# Nutri-Kids — Manual de uso

> **Documento obligatorio y vivo.** Toda feature que llega a `main` se documenta aquí en el mismo
> sprint (regla 9 del CLAUDE.md). Escrito para el **usuario final** en español llano — sin jerga
> técnica ni referencias al código. Al lanzar la app (F5), este manual es la base de la guía de
> usuario pública.

## Qué es esta app

Nutri-Kids convierte el plan de alimentación de tu peque (ese PDF largo que nadie relee a la hora
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

### Cargar tu dieta · desde Sprint 001

- **Qué hace:** guarda la dieta de tu peque EN TU TELÉFONO (no viaja a ningún servidor) y la app
  entera pasa a responder con esa dieta.
- **Cómo se usa:**
  1. Pide el archivo de la dieta a quien lo tenga (termina en `.json`; te lo pueden mandar por
     WhatsApp o correo). Descárgalo en el teléfono.
  2. Ve a **Cargar** (abajo) → **"Elegir archivo"** → busca el archivo descargado.
  3. Verás un resumen de lo que se cargó (grupos, suplementos…). Listo: el letrero de arriba
     ahora dice **"Tu dieta"**.
  - **Si el archivo no abre:** ábrelo donde te lo mandaron, copia TODO su contenido, y en
    **Cargar** pégalo en la caja de texto → **"Cargar lo pegado"**.
- **Si sale un error:** el archivo no es el correcto o llegó incompleto — pide que te lo
  reenvíen tal cual, sin editarlo.
- **Limitaciones conocidas:** la dieta queda solo en ese teléfono (cada cuidador la carga en el
  suyo, por ahora).

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

### "Hoy" — el checklist del día · desde Sprint 001

- **Qué hace:** muestra qué toca hoy (comidas con su horario, el suplemento del día y los vasos
  de agua) y deja marcar cada cosa cuando pasa. Arriba se ve cuánto va ("Ya hiciste 3 de 10") y
  qué falta.
- **Cómo se usa:** es la pantalla de inicio (**Hoy**). Toca la casilla de cada cosa cuando ya
  pasó. Al día siguiente el checklist amanece limpio solo.
- **Limitaciones conocidas:** las marcas viven en ese teléfono; todavía no se comparten entre
  cuidadores (eso viene en una versión futura).

### Pregúntale a la dieta (Chat) · desde Sprint 002

- **Qué hace:** un chat donde preguntas con tus palabras. Responde de dos formas:
  1. **Al instante y sin internet** las preguntas de "¿esto se puede?" — como "¿la manzana se
     puede?" o "¿le doy mandarina?". Te muestra la tarjeta del semáforo (con reemplazos si aplica).
     Abajo dice **"Desde tu plan · sin IA"**: la respuesta salió de tu dieta, aquí en el teléfono.
  2. **Con ayuda de un asistente de IA** las preguntas más abiertas — como "no tengo pollo, ¿qué le
     doy?" o "¿qué merienda le preparo?". El asistente lee tu plan y responde **solo con lo que la
     dieta permite**. Estas respuestas necesitan internet y llevan la nota **"Respuesta de IA"**.
- **Cómo se usa:** ve a **Chat** (abajo). Escribe tu pregunta o toca una de las sugerencias. La
  primera vez verás una nota corta que explica cómo funciona.
- **Cosas importantes:**
  - **No es consejo médico.** Si preguntas por dosis, medicinas o síntomas ("¿le subo la B12?"),
    el chat te devuelve amablemente a tu pediatra o nutricionista — no responde eso.
  - **La conversación no se guarda.** Al cerrar o recargar, el chat queda en blanco. Es a propósito
    (privacidad de los datos del peque).
  - Para las preguntas abiertas, tu dieta (con el nombre del peque oculto) se envía a un servicio de
    IA para redactar la respuesta. Lo explica la nota de **Ajustes → Asistente IA del chat**.
  - **Si el asistente no responde** (sin señal o en mantenimiento), verás un aviso y las preguntas
    de "¿se puede?" siguen funcionando igual.

### Suplementos de la semana · desde Sprint 001

- **Qué hace:** el calendario Lunes–Domingo de los suplementos, con dosis y momento ("con el
  desayuno"). El día de hoy sale resaltado y ahí mismo puedes marcar "ya lo tomó".
- **Cómo se usa:** **Suplementos** (abajo). La marca de hoy es la misma del checklist de "Hoy".

### Idioma y borrar datos · desde Sprint 001

- **Qué hace:** cambia la app entre español e inglés, muestra qué dieta está cargada, y permite
  **borrar todos los datos** del teléfono.
- **Cómo se usa:** **Ajustes** (abajo). Para borrar: **"Borrar mis datos"** → confirma. Se borra
  la dieta cargada y las marcas; la app vuelve a la demo. Esto no se puede deshacer.

## Preguntas frecuentes

- **¿Mis datos van a internet?** No. La dieta y las marcas viven solo en tu teléfono. Por eso
  mismo, si cambias de teléfono, vuelve a cargar el archivo de la dieta.
- **¿Por qué veo "Dieta demo"?** Aún no has cargado la dieta real (o la borraste). Ve a
  **Cargar**.
- **¿La app cuenta calorías o pesa al niño?** No, y no lo hará: el enfoque es qué alimentos sí y
  cuáles descansan, sin números de peso ni calorías.
- **¿El chat inventa cosas?** Está hecho para responder solo con lo que dice tu plan. Aun así,
  como cualquier asistente de IA, conviene verificar con tu profesional lo importante — por eso
  cada respuesta lleva ese recordatorio.
- **¿El chat funciona sin internet?** Las preguntas de "¿se puede?" sí (salen de tu teléfono). Las
  preguntas abiertas necesitan internet porque las responde el asistente de IA.

## Historial

| Sprint | Features añadidas a este manual                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001    | Cargar dieta (archivo + pegar) · semáforo con reemplazos · checklist "Hoy" · suplementos de la semana · idioma ES/EN · borrar datos · instalación como app        |
| 002    | Chat "Pregúntale a la dieta": consultas "¿se puede?" al instante sin internet + preguntas abiertas con asistente de IA anclado al plan · nota de transparencia IA |
