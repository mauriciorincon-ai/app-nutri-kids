import type { Locale } from "./index";

/**
 * Textos del «Modo súper» (S13 · ADR-019), en su propio módulo: la pantalla no carga los de la
 * cámara ni los de la etiqueta. Redactados en cada idioma; paridad por test. Sin cantidades,
 * calorías ni alarma; todo resultado lleva «verifícalo con un adulto» (lo pone el resultado).
 */
const es = {
  title: "Modo súper",
  lead: "Escanea el código de barras de un producto y la app lo coteja con tu plan. Todo se resuelve en este teléfono: lo que escaneas no se guarda ni se envía.",
  catalogTitle: "El catálogo de productos",
  catalogLead:
    "Para escanear, también sin internet, este teléfono necesita el catálogo de productos de Colombia: unos {mb} MB, una sola vez. Se descarga solo si tocas el botón.",
  catalogCached: "El catálogo ya está en este teléfono.",
  download: "Descargar el catálogo",
  prepare: "Preparar el catálogo",
  retry: "Intentar de nuevo",
  downloading: "Descargando: {done} de {mb} MB",
  preparing: "Preparando el catálogo…",
  failedTitle: "No se pudo preparar el catálogo",
  failedBody:
    "Revisa la conexión e inténtalo de nuevo. También puedes leer la etiqueta con una foto o buscar el alimento en tu plan.",
  cantTitle: "Este navegador no puede usar el modo súper",
  cantBody: "Puedes leer la etiqueta con una foto o buscar en tu plan.",
  searchLink: "Buscar en mi plan",
  labelLink: "Leer una etiqueta",
  attribution:
    "Datos de productos © colaboradores de Open Food Facts, bajo la licencia ODbL.",
  licenseLink: "Ver la licencia",
  catalogInfo: "Catálogo del {date}: {count} productos.",
  ready: "Escanea un producto",
  tip: "Que el código de barras se vea entero, con buena luz y sin reflejos.",
  takePhoto: "Escanear código",
  pickPhoto: "Elegir una foto",
  another: "Escanear otro producto",
  typeTitle: "O escribe el código",
  typeLabel: "Código de barras (los números)",
  typeButton: "Buscar",
  reading: "Buscando el código…",
  noCode:
    "No encontré un código de barras en la foto. Prueba más cerca y con más luz, o escribe los números.",
  readFailed:
    "No se pudo leer esta foto. Prueba con otra o escribe los números.",
  codeLength: "Un código de barras tiene 8, 12 o 13 números. Revísalo.",
  codeChecksum:
    "Ese código no es válido: revisa los números o vuelve a escanearlo.",
  notFoundTitle: "Este producto no está en el catálogo",
  notFoundBody:
    "No lo tengo en el catálogo de Colombia. Toma la foto de su etiqueta y la reviso con tu plan.",
  scannedCode: "Código {code}",
  catalogText: "Lo que el catálogo dice que lleva",
  catalogNote:
    "Compáralo con la etiqueta del producto: el catálogo lo escriben personas y puede estar incompleto.",
  noIngredients:
    "El catálogo no trae la lista de ingredientes de este producto.",
  chipNoList: "Sin lista de ingredientes",
  catalogCheck:
    "Verifícalo con un adulto: el catálogo puede estar incompleto o desactualizado.",
  catalogLeadOk:
    "En lo que dice el catálogo no aparece nada que tu plan evite.",
  catalogPartial:
    "El catálogo no trae todo el texto: el producto puede llevar algo más.",
  leadUnreadable:
    "No sé qué lleva: el catálogo no trae su lista de ingredientes completa. Toma la foto de su etiqueta.",
  aptTitle: "Marcas que sí van con tu plan",
  aptLead:
    "Productos parecidos en los que no vi nada que choque con tu plan. Compáralos con su etiqueta.",
  aptNone:
    "No encontré productos parecidos que vayan con tu plan en el catálogo.",
  aptPending: "Buscando productos parecidos…",
  add: "Anotar en lo que compré",
  added: "Anotado en lo que compré.",
  boughtTitle: "Lo que compré",
  boughtLead:
    "Esta lista vive solo en este teléfono. Cada vez se revisa con tu plan de hoy.",
  boughtEmpty: "Aún no has anotado nada. Escanea un producto y anótalo.",
  boughtSince: "Anotado el {date}",
  boughtPending: "Prepara el catálogo para revisarlo con tu plan.",
  boughtGone: "Ya no lo encuentro en el catálogo: revisa su etiqueta.",
  boughtUnknown: "No sé qué lleva: toma la foto de su etiqueta.",
  boughtWarnNo:
    "Esto que compraste no va con tu plan: {reasons} Verifícalo con un adulto.",
  boughtWarnCheck:
    "Esto que compraste pide revisar: {reasons} Verifícalo con un adulto.",
  boughtOk: "Con tu plan de hoy, no vi nada que choque.",
  remove: "Quitar {name}",
  roleBlocked:
    "Con tu rol puedes mirar el producto, pero no anotarlo en lo que compré.",
  back: "Volver a la cámara",
};

const en: typeof es = {
  title: "Supermarket mode",
  lead: "Scan a product's barcode and the app checks it against your plan. Everything is worked out on this phone: what you scan is not saved or sent.",
  catalogTitle: "The product catalog",
  catalogLead:
    "To scan, offline too, this phone needs the catalog of products from Colombia: about {mb} MB, just once. It only downloads if you tap the button.",
  catalogCached: "The catalog is already on this phone.",
  download: "Download the catalog",
  prepare: "Get the catalog ready",
  retry: "Try again",
  downloading: "Downloading: {done} of {mb} MB",
  preparing: "Getting the catalog ready…",
  failedTitle: "The catalog couldn't get ready",
  failedBody:
    "Check the connection and try again. You can also read the label with a photo or look the food up in your plan.",
  cantTitle: "This browser can't run supermarket mode",
  cantBody: "You can read the label with a photo or look it up in your plan.",
  searchLink: "Search my plan",
  labelLink: "Read a label",
  attribution:
    "Product data © Open Food Facts contributors, under the ODbL licence.",
  licenseLink: "See the licence",
  catalogInfo: "Catalog of {date}: {count} products.",
  ready: "Scan a product",
  tip: "Get the whole barcode in, with good light and without glare.",
  takePhoto: "Scan barcode",
  pickPhoto: "Choose a photo",
  another: "Scan another product",
  typeTitle: "Or type the code",
  typeLabel: "Barcode (the numbers)",
  typeButton: "Look it up",
  reading: "Looking for the code…",
  noCode:
    "I didn't find a barcode in the photo. Try closer and with more light, or type the numbers.",
  readFailed:
    "This photo couldn't be read. Try another one or type the numbers.",
  codeLength: "A barcode has 8, 12 or 13 numbers. Check it.",
  codeChecksum: "That code isn't valid: check the numbers or scan it again.",
  notFoundTitle: "This product isn't in the catalog",
  notFoundBody:
    "I don't have it in the Colombia catalog. Take a photo of its label and I'll check it against your plan.",
  scannedCode: "Code {code}",
  catalogText: "What the catalog says it has",
  catalogNote:
    "Compare it with the product's label: the catalog is written by people and may be incomplete.",
  noIngredients: "The catalog doesn't have this product's ingredient list.",
  chipNoList: "No ingredient list",
  catalogCheck:
    "Check it with an adult: the catalog may be incomplete or out of date.",
  catalogLeadOk: "Nothing your plan avoids shows up in what the catalog says.",
  catalogPartial:
    "The catalog doesn't have all the text: the product may have something more.",
  leadUnreadable:
    "I don't know what it has: the catalog doesn't have its full ingredient list. Take a photo of its label.",
  aptTitle: "Brands that fit your plan",
  aptLead:
    "Similar products where I saw nothing that clashes with your plan. Compare them with their label.",
  aptNone: "I didn't find similar products in the catalog that fit your plan.",
  aptPending: "Looking for similar products…",
  add: "Add to what I bought",
  added: "Added to what I bought.",
  boughtTitle: "What I bought",
  boughtLead:
    "This list lives only on this phone. Each time it is checked against today's plan.",
  boughtEmpty: "You haven't added anything yet. Scan a product and add it.",
  boughtSince: "Added on {date}",
  boughtPending: "Get the catalog ready to check it against your plan.",
  boughtGone: "I can't find it in the catalog any more: check its label.",
  boughtUnknown: "I don't know what it has: take a photo of its label.",
  boughtWarnNo:
    "This product you bought doesn't fit your plan: {reasons} Check it with an adult.",
  boughtWarnCheck:
    "This product you bought needs a look: {reasons} Check it with an adult.",
  boughtOk: "Against today's plan, I saw nothing that clashes.",
  remove: "Remove {name}",
  roleBlocked:
    "With your role you can look at the product, but not add it to what you bought.",
  back: "Back to the camera",
};

export type SuperText = typeof es;
export const superText: Record<Locale, SuperText> = { es, en };
