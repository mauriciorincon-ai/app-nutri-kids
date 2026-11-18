import type { Locale } from "./index";

/**
 * Los textos de la lonchera, el recetario y el modo viaje (S11 · ADR-017), aparte del
 * diccionario compartido a propósito: solo los cargan sus tres pantallas y el bundle que todas
 * comparten no crece. Redactados en cada idioma (no traducidos) y con su test de paridad. Tono:
 * palabras de casa; nada diagnostica, culpa ni urge con alarma. Las cifras salen del dato.
 *
 * `travel.doc` se muestra SIEMPRE en los dos idiomas (es el documento para llevar de viaje),
 * por eso la pantalla lee `dayToDayText.es` y `dayToDayText.en` a la vez.
 */

const es = {
  common: {
    notMedical:
      "Esto organiza lo que dice tu plan. No es un consejo médico y no reemplaza a tu pediatra.",
    offline: "Se abre sin señal: todo sale de lo que ya está en este teléfono.",
    planLoading: "Cargando tu plan…",
  },

  lunch: {
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
    shoppingEmpty:
      "Cuando empaques algo, aquí se suma lo que necesitas comprar.",
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
  },

  recipes: {
    title: "Recetas",
    lead: "Recetas sencillas revisadas contra TU plan: lo que el plan evita no aparece, y lo que no está en el plan se dice.",
    timeLabel: "Tiempo",
    costLabel: "Costo",
    all: "Todas",
    time: { quick: "Rápidas", medium: "Medianas", long: "Largas" },
    cost: { low: "Económicas", mid: "Intermedias", high: "Más caras" },
    likedOnly: "Con lo que le gusta",
    likedHint:
      "Recetas con algún alimento que la última vez le gustó o aceptó.",
    minutes: "{n} min",
    ingredientsTitle: "Ingredientes",
    stepsTitle: "Pasos",
    tipTitle: "Un consejo",
    optional: "(opcional)",
    states: {
      ok: "Con lo de tu plan",
      caution: "Con medida",
      unknown: "Algo no está en tu plan",
    },
    cautionLine: "{food}: {limit}",
    unknownLine:
      "No está en tu plan: {foods}. Pregúntale a tu profesional si puede.",
    textureNote:
      "Hoy no acepta esa textura: depende de cómo la prepares y puedes ajustarla.",
    open: "Ver receta",
    close: "Cerrar",
    empty: "Ninguna receta coincide con estos filtros.",
    hiddenToggle: "Ver por qué algunas no se muestran",
    hiddenTitle: "Recetas que no se muestran",
    hiddenLead: "Llevan algo que tu plan evita o que anotaste para evitar.",
    hiddenLine: "{recipe}: {ingredient} ({why})",
    hiddenWhy: {
      red: "tu plan lo evita",
      restricted: "restricción vigente",
      allergy: "lo anotaste para evitar",
    },
    pantryTitle: "¿Qué cocino con lo que tengo?",
    pantryLead: "Marca lo que hay en casa y te digo qué se puede preparar.",
    pantryStaples: "Agua, aceite, canela y limón se dan por sabidos.",
    pantryClear: "Vaciar la despensa",
    pantryNone: "Con lo marcado aún no sale ninguna; marca algo más.",
    pantryReady: "Puedes hacerlas ya",
    pantrySwap: "Con un reemplazo de tu plan",
    pantryAlmost: "Casi: te falta poco",
    swapLine: "En vez de {from}, tu plan propone {to}.",
    missingLine: "Te falta: {foods}",
    ownTitle: "Mis recetas",
    ownLead:
      "Escribe las tuyas. Se revisan contra tu plan igual que las demás.",
    ownLocal: "Se guardan solo en este teléfono: no se comparten.",
    ownName: "Nombre de la receta",
    ownIngredients: "Ingredientes (uno por línea)",
    ownSteps: "Cómo se hace (opcional)",
    ownSave: "Guardar receta",
    ownRemove: "Quitar",
    ownRemoveAria: "Quitar {name}",
    ownEmpty: "Aún no tienes recetas propias.",
    ownFull:
      "Llegaste al máximo de recetas propias; quita una para sumar otra.",
    ownInvalid: "Falta el nombre o al menos un ingrediente.",
    ownHidden: "Esta receta lleva algo que tu plan evita: {foods}.",
  },

  travel: {
    title: "Modo viaje",
    lead: "Qué llevar y cómo ordenar el día fuera de casa, sacado de tu plan. Funciona sin señal.",
    modeLabel: "¿Cómo viajan?",
    modes: { road: "Carretera", air: "Avión" },
    checklistTitle: "Para llevar",
    checklistHint: "Marca lo que ya guardaste; se queda en este teléfono.",
    checkAria: "Marcar: {item}",
    foodsTitle: "Comida que aguanta sin nevera",
    foodsNone:
      "Tu plan no marca nada que aguante sin nevera. Márcalo en el Perfil.",
    supplementsTitle: "Suplementos",
    supplementsNone: "Tu plan no trae suplementos.",
    supplementLine: "{name} · {dose} · {when}",
    medsTitle: "Medicamentos anotados",
    medsNone: "Tu plan no trae medicamentos anotados.",
    medLine: "{name}",
    avoidTitle: "Lo que no puede",
    avoidNone: "Tu plan no trae nada para evitar.",
    docTitle: "Documento del viaje",
    docItem: "El documento, impreso o guardado",
    planTitle: "El día de viaje",
    roadLead:
      "Por carretera: ordena las paradas según las franjas de comida de tu plan.",
    airLead:
      "En avión: ten a mano lo que aguanta sin nevera para las franjas de tu plan.",
    slotLine: "{name} · {start}–{end}",
    docLead:
      "Una hoja en español e inglés con lo que tu plan y lo que anotaste dicen. Se arma en este teléfono, sin internet.",
    docPrivacy:
      "Contiene datos de salud del niño: guárdalo con cuidado y enséñalo solo a quien lo necesite.",
    docNameNote:
      "Lleva el nombre solo si un padre lo escribió para la etiqueta de la lonchera.",
    docPrint: "Imprimir documento",
    docPrintHint:
      "Abre el cuadro de impresión de tu teléfono; nada se envía a ningún sitio.",
    doc: {
      title: "Ficha de alimentación para viaje",
      date: "Fecha",
      name: "Nombre",
      condition: "Situación",
      allergies: "Alergias",
      intolerances: "Intolerancias",
      medications: "Medicamentos",
      dose: "Dosis",
      when: "Cuándo",
      avoid: "Lo que no puede comer",
      supplements: "Suplementos",
      source: "Plan escrito por",
      notWritten: "El plan no lo dice.",
      footer:
        "Armado en el teléfono con el plan de la familia. No reemplaza a un profesional: ante cualquier duda, pregúntale a quien escribió el plan.",
    },
  },
};

const en: typeof es = {
  common: {
    notMedical:
      "This organizes what your plan says. It is not medical advice and does not replace your pediatrician.",
    offline: "It opens without signal: everything comes from this phone.",
    planLoading: "Loading your plan…",
  },

  lunch: {
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
    noMarksTitle:
      "Your plan does not mark anything that keeps without a fridge",
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
    shoppingEmpty:
      "When you pack something, what you need to buy adds up here.",
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
    readOnly:
      "You can see the lunchbox; whoever looks after the child packs it.",
    schoolNoSlot: "Your access does not include lunchbox meals.",
  },

  recipes: {
    title: "Recipes",
    lead: "Simple recipes checked against YOUR plan: what the plan avoids does not show up, and what is not in the plan is said out loud.",
    timeLabel: "Time",
    costLabel: "Cost",
    all: "All",
    time: { quick: "Quick", medium: "Medium", long: "Long" },
    cost: { low: "Budget", mid: "Mid-range", high: "Pricier" },
    likedOnly: "With what they like",
    likedHint: "Recipes with a food they liked or accepted the last time.",
    minutes: "{n} min",
    ingredientsTitle: "Ingredients",
    stepsTitle: "Steps",
    tipTitle: "A tip",
    optional: "(optional)",
    states: {
      ok: "Fits your plan",
      caution: "With a limit",
      unknown: "Something is not in your plan",
    },
    cautionLine: "{food}: {limit}",
    unknownLine:
      "Not in your plan: {foods}. Ask your professional if it is fine.",
    textureNote:
      "They do not take that texture today: it depends on how you prepare it, and you can adjust it.",
    open: "See recipe",
    close: "Close",
    empty: "No recipe matches these filters.",
    hiddenToggle: "See why some are not shown",
    hiddenTitle: "Recipes that are not shown",
    hiddenLead:
      "They include something your plan avoids or that you noted to avoid.",
    hiddenLine: "{recipe}: {ingredient} ({why})",
    hiddenWhy: {
      red: "your plan avoids it",
      restricted: "restriction in force",
      allergy: "you noted it to avoid",
    },
    pantryTitle: "What can I cook with what I have?",
    pantryLead:
      "Mark what you have at home and I will tell you what you can make.",
    pantryStaples: "Water, oil, cinnamon and lemon are taken for granted.",
    pantryClear: "Empty the pantry",
    pantryNone:
      "Nothing comes out yet with what is marked; mark something more.",
    pantryReady: "You can make these now",
    pantrySwap: "With a swap from your plan",
    pantryAlmost: "Almost: just a little missing",
    swapLine: "Instead of {from}, your plan suggests {to}.",
    missingLine: "Missing: {foods}",
    ownTitle: "My recipes",
    ownLead:
      "Write your own. They are checked against your plan like the rest.",
    ownLocal: "They are saved only on this phone: they are not shared.",
    ownName: "Recipe name",
    ownIngredients: "Ingredients (one per line)",
    ownSteps: "How it is made (optional)",
    ownSave: "Save recipe",
    ownRemove: "Remove",
    ownRemoveAria: "Remove {name}",
    ownEmpty: "You have no recipes of your own yet.",
    ownFull:
      "You reached the limit of your own recipes; remove one to add another.",
    ownInvalid: "The name or at least one ingredient is missing.",
    ownHidden: "This recipe has something your plan avoids: {foods}.",
  },

  travel: {
    title: "Travel mode",
    lead: "What to pack and how to order the day away from home, taken from your plan. It works without signal.",
    modeLabel: "How are you travelling?",
    modes: { road: "By road", air: "By plane" },
    checklistTitle: "To pack",
    checklistHint: "Tick what you have already packed; it stays on this phone.",
    checkAria: "Tick: {item}",
    foodsTitle: "Food that keeps without a fridge",
    foodsNone:
      "Your plan does not mark anything that keeps without a fridge. Mark it in the Profile.",
    supplementsTitle: "Supplements",
    supplementsNone: "Your plan has no supplements.",
    supplementLine: "{name} · {dose} · {when}",
    medsTitle: "Noted medicines",
    medsNone: "Your plan has no noted medicines.",
    medLine: "{name}",
    avoidTitle: "What they cannot have",
    avoidNone: "Your plan has nothing to avoid.",
    docTitle: "Travel document",
    docItem: "The document, printed or saved",
    planTitle: "The travel day",
    roadLead: "By road: order the stops around your plan's meal windows.",
    airLead:
      "By plane: keep within reach what keeps without a fridge for your plan's meal windows.",
    slotLine: "{name} · {start}–{end}",
    docLead:
      "One sheet in Spanish and English with what your plan and your notes say. It is built on this phone, without internet.",
    docPrivacy:
      "It holds the child's health data: keep it carefully and show it only to whoever needs it.",
    docNameNote:
      "It carries the name only if a parent wrote it for the lunchbox label.",
    docPrint: "Print document",
    docPrintHint:
      "It opens your phone's print dialog; nothing is sent anywhere.",
    doc: {
      title: "Food sheet for travel",
      date: "Date",
      name: "Name",
      condition: "Situation",
      allergies: "Allergies",
      intolerances: "Intolerances",
      medications: "Medicines",
      dose: "Dose",
      when: "When",
      avoid: "What they cannot eat",
      supplements: "Supplements",
      source: "Plan written by",
      notWritten: "The plan does not say.",
      footer:
        "Built on the phone from the family's plan. It does not replace a professional: if in doubt, ask whoever wrote the plan.",
    },
  },
};

export type DayToDayText = typeof es;
export const dayToDayText: Record<Locale, DayToDayText> = { es, en };
