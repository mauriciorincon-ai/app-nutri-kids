import type { Locale } from "./index";

/**
 * Textos de la cámara (S12 · ADR-018), en su propio módulo: solo los carga `/camara` y el bundle
 * compartido no crece. Redactados en cada idioma (no traducidos); paridad por test. Todo resultado
 * de la cámara lleva «verifícalo con un adulto»; nada de cantidades, calorías ni alarma.
 */

const es = {
  title: "Cámara",
  lead: "Toma una foto de lo que tienes en la cocina y la app te dice qué es. La foto se mira dentro de este teléfono y se suelta: no se guarda ni se envía.",
  check: "Verifícalo con un adulto: el modelo puede equivocarse.",
  modelTitle: "El modelo que mira la foto",
  modelLead:
    "Se descarga una sola vez (unos {mb} MB, mejor con wifi) y queda guardado en este teléfono para usarlo sin señal.",
  download: "Descargar el modelo",
  prepare: "Preparar el modelo",
  prepareLead:
    "Ya está guardado en este teléfono: se prepara sin descargar nada.",
  downloading: "Descargando el modelo… {done} de unos {mb} MB",
  preparing: "Preparando el modelo…",
  ready: "Listo para mirar fotos",
  cantTitle: "Este teléfono no puede usar el modelo",
  cantBody:
    "Su navegador no trae lo que el modelo necesita. Puedes seguir marcando a mano lo que tienes en Recetas.",
  failedTitle: "No se pudo preparar el modelo",
  failedBody:
    "Puede faltar espacio o señal. Vuelve a intentarlo, o marca a mano lo que tienes en Recetas.",
  retry: "Volver a intentar",
  manualLink: "Marcar a mano en Recetas",
  takePhoto: "Tomar una foto",
  pickPhoto: "Elegir de la galería",
  analyzing: "Mirando la foto…",
  analyzeFailed:
    "No se pudo mirar esa foto. Prueba con otra, con más luz o más de cerca.",
  seenTitle: "Lo que vio",
  seenNone: "No reconoció ningún alimento en esta foto.",
  inCatalog: "Ingrediente de tus recetas",
  inPlan: "Está en tu plan",
  notKnownTitle: "Vio esto, pero no está en tu catálogo",
  notKnownHint: "No entra a ningún lado: solo se muestra.",
  trialTitle: "Cómo va el motor",
  trialLead:
    "Para la prueba: marca ✓ si está en la foto y ✗ si no está. Luego copia los resultados.",
  engineLabel: "Motor",
  sizeLabel: "Tamaño",
  loadLabel: "Carga",
  perPhotoLabel: "Por foto",
  maxLabel: "máx",
  hitsLabel: "Aciertos",
  inventedLabel: "Inventados",
  fromCache: "ya estaba en el teléfono",
  deviceLabel: "Teléfono",
  photoLabel: "Foto",
  markYes: "Está en la foto: {label}",
  markNo: "No está en la foto: {label}",
  copy: "Copiar resultados",
  copied: "Copiado",
  copyTitle: "Prueba de la cámara · Nutrikids",
  criteriaTitle: "Lo que pide la prueba",
  criteriaSize: "Descarga de {max} MB o menos",
  criteriaSpeed: "{max} s o menos por foto",
  criteriaHits: "{min} aciertos de {of} fotos",
  criteriaInvented: "{max} inventado como mucho",
  criteriaMet: "Cumple",
  criteriaPending: "Aún no",
  photosCount: "{n} de {of} fotos",
};

const en: typeof es = {
  title: "Camera",
  lead: "Take a photo of what you have in the kitchen and the app tells you what it is. The photo is looked at inside this phone and then let go: it is not saved or sent.",
  check: "Double-check it with an adult: the model can get things wrong.",
  modelTitle: "The model that looks at the photo",
  modelLead:
    "It downloads once (about {mb} MB, best on wifi) and stays on this phone so it works without signal.",
  download: "Download the model",
  prepare: "Get the model ready",
  prepareLead:
    "It is already on this phone: it gets ready without downloading anything.",
  downloading: "Downloading the model… {done} of about {mb} MB",
  preparing: "Getting the model ready…",
  ready: "Ready to look at photos",
  cantTitle: "This phone can't run the model",
  cantBody:
    "Its browser lacks what the model needs. You can keep ticking what you have by hand in Recipes.",
  failedTitle: "The model couldn't get ready",
  failedBody:
    "Space or signal may be short. Try again, or tick what you have by hand in Recipes.",
  retry: "Try again",
  manualLink: "Tick by hand in Recipes",
  takePhoto: "Take a photo",
  pickPhoto: "Choose from the gallery",
  analyzing: "Looking at the photo…",
  analyzeFailed:
    "That photo couldn't be read. Try another one, with more light or closer up.",
  seenTitle: "What it saw",
  seenNone: "It didn't recognize any food in this photo.",
  inCatalog: "An ingredient in your recipes",
  inPlan: "It's in your plan",
  notKnownTitle: "It saw this, but it isn't in your catalog",
  notKnownHint: "It doesn't go anywhere: it is only shown.",
  trialTitle: "How the engine is doing",
  trialLead:
    "For the test: tick ✓ if it's in the photo and ✗ if it isn't. Then copy the results.",
  engineLabel: "Engine",
  sizeLabel: "Size",
  loadLabel: "Loading",
  perPhotoLabel: "Per photo",
  maxLabel: "max",
  hitsLabel: "Hits",
  inventedLabel: "Made up",
  fromCache: "already on the phone",
  deviceLabel: "Phone",
  photoLabel: "Photo",
  markYes: "It's in the photo: {label}",
  markNo: "It isn't in the photo: {label}",
  copy: "Copy results",
  copied: "Copied",
  copyTitle: "Camera test · Nutrikids",
  criteriaTitle: "What the test asks for",
  criteriaSize: "A download of {max} MB or less",
  criteriaSpeed: "{max} s or less per photo",
  criteriaHits: "{min} hits out of {of} photos",
  criteriaInvented: "At most {max} made up",
  criteriaMet: "Met",
  criteriaPending: "Not yet",
  photosCount: "{n} of {of} photos",
};

export type CameraText = typeof es;
export const cameraText: Record<Locale, CameraText> = { es, en };
