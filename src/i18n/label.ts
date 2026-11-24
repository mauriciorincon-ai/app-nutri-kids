import type { Locale } from "./index";

/**
 * Textos de «Leer una etiqueta» (S13 · ADR-019), en su propio módulo: la pantalla no carga los de la
 * cámara ni al revés. Redactados en cada idioma; paridad por test. Sin cantidades, calorías ni
 * alarma; todo resultado lleva «verifícalo con un adulto».
 */
const es = {
  title: "Leer una etiqueta",
  lead: "Toma una foto de la lista de ingredientes y la app la coteja con tu plan. La foto se lee en este teléfono: no se guarda ni se envía.",
  readerTitle: "El lector de etiquetas",
  readerLead:
    "Para leer, también sin internet, este teléfono necesita el lector: unos {mb} MB, una sola vez. Se descarga solo si tocas el botón.",
  readerCached: "El lector ya está en este teléfono.",
  download: "Descargar el lector",
  prepare: "Preparar el lector",
  retry: "Intentar de nuevo",
  downloading: "Descargando: {done} de {mb} MB",
  preparing: "Preparando el lector…",
  failedTitle: "No se pudo preparar el lector",
  failedBody:
    "Revisa la conexión e inténtalo de nuevo. También puedes buscar cada ingrediente en tu plan.",
  cantTitle: "Este navegador no puede usar el lector",
  cantBody: "Puedes buscar cada ingrediente en tu plan.",
  searchLink: "Buscar en mi plan",
  ready: "Toma la foto de los ingredientes",
  tip: "Que se vea toda la lista, con buena luz, de frente y sin reflejos.",
  takePhoto: "Tomar foto",
  pickPhoto: "Elegir una foto",
  reading: "Leyendo la etiqueta…",
  readFailed: "No se pudo leer esta foto. Prueba con otra.",
  verdictNo: "No va",
  verdictCheck: "Revisa",
  verdictUnreadable: "No pude leerla",
  verdictOk: "No vi nada que choque",
  leadNo: "Esta etiqueta trae algo que tu plan evita.",
  leadCheck: "Trae algo que tu plan permite con condición.",
  leadUnreadable:
    "La foto no se leyó bien, así que no puedo decir si va. Prueba con más luz, más cerca y sin reflejos.",
  leadOk: "En lo que se leyó no aparece nada que tu plan evite.",
  partial: "El resto del texto no se leyó bien: puede traer algo más.",
  reasonAdditive: "{has} {seen} ({name}), un aditivo que tu plan evita.",
  reasonRed: "{has} {name}: tu plan lo evita.",
  reasonRestricted: "{has} {name}, que tu plan tiene restringido.",
  reasonRestrictedEnded:
    "{has} {name}: su restricción terminó y la vuelta la guía tu profesional.",
  reasonYellow: "{has} {name}, con condición en tu plan: {limit}",
  reasonAllergy: "{has} {name}, anotado como alergia.",
  reasonIntolerance: "{has} {name}, anotado como intolerancia.",
  reasonSimilar:
    "Leí «{seen}», que se parece a {name} en tu plan. Puede que la foto lo haya cambiado: mira la etiqueta.",
  has: "Lleva",
  mayHave: "Puede llevar",
  codesSeen: "Aditivos que vi con su número y tu plan no nombra: {codes}.",
  readTitle: "Lo que se leyó",
  readNote:
    "Compáralo con la etiqueta: si algo no coincide, vuelve a tomar la foto.",
  readEmpty: "No se leyó ningún texto.",
  check: "Verifícalo con un adulto: el lector puede equivocarse.",
  another: "Leer otra etiqueta",
  back: "Volver a la cámara",
};

const en: typeof es = {
  title: "Read a label",
  lead: "Take a photo of the ingredient list and the app checks it against your plan. The photo is read on this phone: it is not saved or sent.",
  readerTitle: "The label reader",
  readerLead:
    "To read labels, offline too, this phone needs the reader: about {mb} MB, just once. It only downloads if you tap the button.",
  readerCached: "The reader is already on this phone.",
  download: "Download the reader",
  prepare: "Get the reader ready",
  retry: "Try again",
  downloading: "Downloading: {done} of {mb} MB",
  preparing: "Getting the reader ready…",
  failedTitle: "The reader couldn't get ready",
  failedBody:
    "Check the connection and try again. You can also look up each ingredient in your plan.",
  cantTitle: "This browser can't run the reader",
  cantBody: "You can look up each ingredient in your plan.",
  searchLink: "Search my plan",
  ready: "Take a photo of the ingredients",
  tip: "Get the whole list in, with good light, straight on and without glare.",
  takePhoto: "Take photo",
  pickPhoto: "Choose a photo",
  reading: "Reading the label…",
  readFailed: "This photo couldn't be read. Try another one.",
  verdictNo: "Not a fit",
  verdictCheck: "Check it",
  verdictUnreadable: "Couldn't read it",
  verdictOk: "Nothing clashes that I saw",
  leadNo: "This label has something your plan avoids.",
  leadCheck: "It has something your plan allows with a condition.",
  leadUnreadable:
    "The photo didn't read well, so I can't say whether it fits. Try more light, closer, without glare.",
  leadOk: "Nothing your plan avoids shows up in what was read.",
  partial: "The rest of the text didn't read well: it may have more.",
  reasonAdditive: "{has} {seen} ({name}), an additive your plan avoids.",
  reasonRed: "{has} {name}: your plan avoids it.",
  reasonRestricted: "{has} {name}, which your plan has restricted.",
  reasonRestrictedEnded:
    "{has} {name}: its restriction ended and your professional guides bringing it back.",
  reasonYellow: "{has} {name}, allowed with a condition in your plan: {limit}",
  reasonAllergy: "{has} {name}, noted as an allergy.",
  reasonIntolerance: "{has} {name}, noted as an intolerance.",
  reasonSimilar:
    "I read “{seen}”, which looks like {name} in your plan. The photo may have changed a letter: check the label.",
  has: "It has",
  mayHave: "It may have",
  codesSeen: "Additives I saw by number that your plan doesn't name: {codes}.",
  readTitle: "What was read",
  readNote:
    "Compare it with the label: if something doesn't match, take the photo again.",
  readEmpty: "No text was read.",
  check: "Check it with an adult: the reader can get things wrong.",
  another: "Read another label",
  back: "Back to the camera",
};

export type LabelText = typeof es;
export const labelText: Record<Locale, LabelText> = { es, en };
