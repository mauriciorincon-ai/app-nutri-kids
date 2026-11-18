import type { Locale } from "../index";

/**
 * Textos de la lonchera (S11 · ADR-017), en su propio módulo para que cada pantalla cargue solo los suyos
 * y el bundle compartido no crezca. Redactados en cada idioma (no traducidos); paridad por test.
 */

const es = {
  title: "Lonchera",
  lead: "Arma la lonchera con lo que tu plan marca como «aguanta sin nevera». Nada se inventa: si el plan no lo dice, aquí no aparece.",
  dayLabel: "¿Para qué día?",
  today: "Hoy",
  optionsTitle: "Opciones para llevar",
  optionsLead:
    "Verde o con medida, y que aguante sin nevera. Cada una dice quién la marcó.",
  byPlan: "Lo marca el plan",
  byAdult: "Lo marcó quien cuida",
  limitLine: "Medida: {limit}",
  fromLine: "Del plan: {from}",
  noMarksTitle: "Tu plan no marca nada que aguante sin nevera",
  noMarksBody:
    "En el Perfil puedes marcar los alimentos que sí aguantan sin nevera, y aparecerán aquí.",
  noMarksLink: "Ir al perfil",
  emptyToday:
    "Hoy ninguna opción encaja con lo que acepta y con lo que rechazó la última vez. Abajo ves por qué.",
  heldTitle: "Hoy se quedan fuera",
  heldTexture: "hoy no acepta esa textura",
  heldRefused: "lo rechazó la última vez",
  heldLine: "{name}: {why}",
  pack: "Empacar",
  packAria: "Empacar {name}",
  packFull:
    "Este día ya tiene {n} cosas anotadas: es el máximo. Quita alguna para empacar otra.",
  states: {
    packed: "Empacado",
    eaten: "Se lo comió",
    back: "Volvió a casa",
  },
  markEaten: "Se lo comió",
  markBack: "Volvió a casa",
  clear: "Quitar",
  stateAria: "{name}: {state}",
  packedTitle: "Lo que lleva este día",
  packedEmpty: "Aún no has empacado nada para este día.",
  shoppingTitle: "Compras de la semana",
  shoppingLead:
    "Lo que empacaste en estos siete días, para que lo tengas a mano.",
  shoppingEmpty: "Cuando empaques algo, aquí se suma lo que necesitas comprar.",
  shoppingOne: "{name} · un día",
  shoppingMany: "{name} · {n} días",
  labelTitle: "Etiqueta de la lonchera",
  labelLead:
    "Una etiqueta para imprimir, con un código QR que guarda solo texto: lo que lleva hoy y lo que no puede comer. Se lee sin internet.",
  labelNameLabel: "Nombre en la etiqueta (opcional)",
  labelNameHint:
    "Solo un padre lo escribe y se queda en este teléfono. Si lo dejas vacío, la etiqueta no lleva nombre.",
  labelNameSave: "Guardar nombre",
  labelNameOnlyParent: "Solo un padre puede poner el nombre.",
  labelPrint: "Imprimir etiqueta",
  labelPrintHint:
    "Abre el cuadro de impresión de tu teléfono; nada se envía a ningún sitio.",
  labelQrAlt: "Código QR con el texto de la etiqueta",
  labelCut:
    "No cupo todo en el código: se acortó la lista de lo que lleva. Lo que no puede comer siempre va completo.",
  labelBuilding: "Dibujando el código…",
  labelQrError:
    "No se pudo dibujar el código; el texto de la etiqueta sí está completo.",
  readOnly: "Puedes ver la lonchera; la arma quien cuida al niño.",
  schoolNoSlot: "Tu acceso no incluye comidas de la lonchera.",
};

const en: typeof es = {
  title: "Lunchbox",
  lead: "Pack the lunchbox from what your plan marks as «keeps without a fridge». Nothing is made up: if the plan does not say it, it is not here.",
  dayLabel: "For which day?",
  today: "Today",
  optionsTitle: "Options to pack",
  optionsLead:
    "Green or with a limit, and keeps without a fridge. Each one says who marked it.",
  byPlan: "Marked by the plan",
  byAdult: "Marked by a caregiver",
  limitLine: "Limit: {limit}",
  fromLine: "From the plan: {from}",
  noMarksTitle: "Your plan does not mark anything that keeps without a fridge",
  noMarksBody:
    "In the Profile you can mark the foods that do keep without a fridge, and they will show up here.",
  noMarksLink: "Go to the profile",
  emptyToday:
    "Today no option fits what they accept and what they refused last time. Below you can see why.",
  heldTitle: "Left out today",
  heldTexture: "they do not take that texture today",
  heldRefused: "they refused it last time",
  heldLine: "{name}: {why}",
  pack: "Pack",
  packAria: "Pack {name}",
  packFull:
    "This day already has {n} things noted: that is the most. Remove one to pack another.",
  states: {
    packed: "Packed",
    eaten: "Ate it",
    back: "Came back home",
  },
  markEaten: "Ate it",
  markBack: "Came back home",
  clear: "Remove",
  stateAria: "{name}: {state}",
  packedTitle: "What goes in on this day",
  packedEmpty: "Nothing packed for this day yet.",
  shoppingTitle: "This week's shopping",
  shoppingLead:
    "What you packed over these seven days, so you have it at hand.",
  shoppingEmpty: "When you pack something, what you need to buy adds up here.",
  shoppingOne: "{name} · one day",
  shoppingMany: "{name} · {n} days",
  labelTitle: "Lunchbox label",
  labelLead:
    "A label to print, with a QR code that holds plain text only: what goes in today and what they cannot eat. It reads without internet.",
  labelNameLabel: "Name on the label (optional)",
  labelNameHint:
    "Only a parent writes it and it stays on this phone. If you leave it empty, the label carries no name.",
  labelNameSave: "Save name",
  labelNameOnlyParent: "Only a parent can add the name.",
  labelPrint: "Print label",
  labelPrintHint:
    "It opens your phone's print dialog; nothing is sent anywhere.",
  labelQrAlt: "QR code with the label text",
  labelCut:
    "Not everything fit in the code: the list of what goes in was shortened. What they cannot eat always stays complete.",
  labelBuilding: "Drawing the code…",
  labelQrError:
    "The code could not be drawn; the label text is still complete.",
  readOnly: "You can see the lunchbox; whoever looks after the child packs it.",
  schoolNoSlot: "Your access does not include lunchbox meals.",
};

export type LunchText = typeof es;
export const lunchText: Record<Locale, LunchText> = { es, en };
