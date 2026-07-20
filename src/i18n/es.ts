/**
 * Diccionario ES — idioma primario (microcopy coloquial).
 * REGLA: toda clave nueva se escribe aquí Y en en.ts EN EL MISMO PASO.
 * `Dictionary` (derivado de este objeto) fuerza la paridad estructural en compile-time;
 * el test de paridad la verifica en runtime (claves vacías incluidas).
 */
export const es = {
  app: {
    name: "Nutri-Kids",
    tagline: "La dieta de tu peque, viva y a la mano",
  },
  nav: {
    today: "Hoy",
    diet: "Dieta",
    chat: "Chat",
    supplements: "Suplementos",
    load: "Cargar",
    settings: "Ajustes",
  },
  disclaimer: {
    short: "Esta guía no reemplaza a tu pediatra.",
    full: "Nutri-Kids organiza el plan de alimentación que la familia decidió seguir. No es diagnóstico ni tratamiento médico: ante cualquier duda, consulta siempre al pediatra o a tu nutricionista.",
    firstUseTitle: "Antes de empezar",
    firstUseBody:
      "Esta app convierte el plan nutricional de tu peque en una guía fácil de consultar. Es una ayuda para el día a día, no un consejo médico: tu pediatra y tu nutricionista siempre tienen la última palabra.",
    firstUseAccept: "Entendido, empezar",
  },
  source: {
    demo: "Dieta demo",
    real: "Tu dieta",
    demoHint: "Estás viendo la dieta de ejemplo. Carga la tuya en «Cargar».",
    realHint: "Estás viendo la dieta que cargaste en este dispositivo.",
  },
  status: {
    green: "Se puede",
    yellow: "Con límite",
    red: "Evitar",
    restrictedUntil: "hasta el {date}",
    restrictionEnded:
      "la restricción ya terminó — pregunta al profesional cómo reintroducirla",
    daysLeft: "faltan {days} días",
    lastDay: "último día",
    notFound:
      "Ese alimento no está en el plan. Ante la duda, pregúntale al profesional.",
  },
  today: {
    title: "Hoy",
    summaryDone: "Ya hiciste {done} de {total}",
    summaryAllDone: "¡Listo el día! Completaste todo lo de hoy",
    summaryEmpty: "Así se ve el día de hoy — marca cada cosa cuando pase",
    pendingLabel: "Te falta:",
    meals: "Comidas",
    supplementCard: "Suplemento de hoy",
    noSupplementToday: "Hoy no toca suplemento",
    noSupplementHint:
      "Descansa tranquila: hoy no hay ninguno en el calendario.",
    water: "Vasos de agua",
    waterGlass: "Vaso {n}",
    markDone: "Marcar {item} como hecho",
    markUndone: "Desmarcar {item}",
    doneAt: "Hecho · {time}",
    doneNoTime: "Hecho",
    addNote: "Agregar nota",
    editNote: "Editar nota",
    noteFor: "Nota para {item}",
    noteChipRejected: "Lo rechazó",
    noteChipPain: "Le dolió",
    noteChipCraving: "Tuvo antojo",
    noteChipOther: "Otra cosa",
    notePlaceholder: "Algo corto que quieras recordar (opcional)",
    noteSave: "Guardar",
    noteRemove: "Quitar nota",
    historyLink: "Ver días anteriores",
  },
  reminder: {
    heading: "Ahora mismo",
    loading: "Viendo qué toca…",
    mealNow: "Es momento de {meal}",
    mealBeforeFirst: "El día empieza con {meal}, a las {time}",
    mealBetween: "Un respiro entre comidas",
    mealAfterLast: "La última comida de hoy fue {meal}",
    next: "Sigue: {meal} · {time}",
    supplementDue: "Suplemento de hoy: {names}",
    supplementsDone: "Suplemento de hoy: ya está",
    noSupplement: "Hoy no toca suplemento",
    water: "Agua: {done} de {target} vasos",
  },
  history: {
    title: "Días anteriores",
    intro:
      "Un vistazo a lo que quedó registrado otros días. Solo para consultar; no se edita.",
    empty:
      "Todavía no hay días registrados. Cuando marques cosas en «Hoy», los verás aquí.",
    todayTag: "Hoy",
    noteLabel: "Nota:",
    at: "a las {time}",
    timeUnknown: "sin hora",
    back: "Volver a Hoy",
  },
  diet: {
    title: "La dieta",
    searchPlaceholder: "¿Se puede…? Busca un alimento",
    searchNoResults:
      "No encontramos «{query}» en el plan. Ante la duda, pregúntale al profesional.",
    tabGreen: "Verde",
    tabYellow: "Amarillo",
    tabRed: "Rojo",
    restrictedSection: "Restringidos por ahora",
    restrictedIntro:
      "Estos alimentos descansan un tiempo. No es alergia: tienen fecha de regreso.",
    additivesSection: "Aditivos a evitar (etiquetas)",
    additivesIntro:
      "Cuando compres algo empacado, revisa que la etiqueta NO traiga estos códigos:",
    additiveFoundIn: "Suele venir en: {where}",
    alsoAvoid: "También evitar",
    groupPortion: "Porción: {portion}",
    seeDetail: "Ver detalle de {name}",
  },
  chat: {
    title: "Pregúntale a la dieta",
    intro: "Escribe como le hablas a alguien. Dos formas de responder:",
    emptyHint: "Prueba con una de estas:",
    sugg1: "¿La manzana se puede?",
    sugg2: "¿Qué merienda le doy?",
    sugg3: "No tengo pollo, ¿qué le doy?",
    inputPlaceholder: "Escribe tu pregunta…",
    send: "Enviar",
    sending: "Enviando…",
    thinking: "Pensando…",
    fromPlanBadge: "Desde tu plan · sin IA",
    aiBadge: "Respuesta de IA",
    aiDisclaimer:
      "Lo genera una IA sobre tu plan. Verifícalo con tu profesional.",
    replacementsTitle: "Si no hay, usa…",
    additiveTitle: "Aditivo a evitar",
    additiveFoundIn: "Suele venir en: {where}",
    restrictedUntil: "En descanso hasta el {date}",
    restrictionEnded: "El descanso ya terminó — consulta al profesional.",
    errorTitle: "El asistente no está disponible",
    errorBody:
      "No pudimos conectar con el asistente ahora. Las consultas rápidas de “¿se puede?” siguen funcionando.",
    disabledTitle: "El asistente está en pausa",
    disabledBody:
      "La parte de IA está apagada por ahora. Puedes seguir preguntando “¿la manzana se puede?” y te respondo al instante desde tu plan.",
    introTitle: "Cómo funciona este chat",
    introBody:
      "Las preguntas de “¿se puede?” se responden al instante desde tu plan, aquí en el teléfono. Para preguntas más abiertas, una IA lee tu plan (con el nombre del peque oculto) y responde solo con lo que el plan permite. No es consejo médico.",
    introAccept: "Entendido",
    aiDot: "Asistente IA",
  },
  detail: {
    whyTitle: "¿Por qué?",
    limitTitle: "¿Cuánto?",
    equivalencesTitle: "Si no hay, usa…",
    restrictedNote: "Restringido {until}",
    backToDiet: "Volver a la dieta",
  },
  supplements: {
    title: "Suplementos de la semana",
    intro:
      "Cada suplemento tiene sus días. Marca el de hoy cuando ya lo haya tomado.",
    todayLabel: "hoy",
    dose: "Dosis: {dose}",
    when: "{when}",
    taken: "Ya lo tomó",
    markTaken: "Marcar {name} como tomado hoy",
    noneThatDay: "No toca",
    notesTitle: "Bueno saber",
  },
  weekdays: {
    mon: "Lunes",
    tue: "Martes",
    wed: "Miércoles",
    thu: "Jueves",
    fri: "Viernes",
    sat: "Sábado",
    sun: "Domingo",
  },
  load: {
    title: "Cargar tu dieta",
    emptyTitle: "Aún no has cargado una dieta",
    emptyBody:
      "Pide el archivo de la dieta (termina en .json) a quien lo tenga y ábrelo aquí. Mientras tanto puedes explorar la app con la dieta demo.",
    pickFile: "Elegir archivo",
    orPaste: "…o pega el contenido",
    pasteHint:
      "Si el archivo no abre desde el teléfono, copia todo su contenido y pégalo aquí:",
    pastePlaceholder: "Pega aquí el contenido del archivo de la dieta",
    importPasted: "Cargar lo pegado",
    validating: "Revisando el archivo…",
    successTitle: "¡Dieta cargada!",
    successBody: "Esto fue lo que encontramos en tu dieta:",
    countGroups: "{n} grupos de alimentos permitidos",
    countRestricted: "{n} alimentos en descanso temporal",
    countAdditives: "{n} aditivos para vigilar en etiquetas",
    countSupplements: "{n} suplementos con su calendario",
    countMeals: "{n} momentos de comida al día",
    goToday: "Ir a Hoy",
    errorInvalidJson:
      "Ese archivo no se pudo leer como una dieta. Revisa que sea el archivo .json correcto y vuelve a intentar.",
    errorInvalidSchema:
      "El archivo se abre, pero no tiene el formato de una dieta de Nutri-Kids. Pide de nuevo el archivo original (.json) a quien te lo compartió.",
    errorNoStorage:
      "Tu navegador no dejó guardar la dieta en el dispositivo. Intenta desde otro navegador (por ejemplo Chrome).",
    activeSource: "Dieta activa:",
    useDemo: "Usar la demo",
    useReal: "Usar tu dieta",
  },
  settings: {
    title: "Ajustes",
    language: "Idioma",
    languageEs: "Español",
    languageEn: "English",
    dietVersion: "Dieta cargada",
    dietVersionDemo: "Demo de ejemplo (ninguna dieta cargada)",
    dietVersionInfo: "{title} · emitida el {date}",
    clearTitle: "Borrar datos",
    clearBody:
      "Borra la dieta cargada y todo tu registro del día (marcas, horas y notas) de este dispositivo. La app vuelve a la demo.",
    clearButton: "Borrar mis datos",
    clearConfirmTitle: "¿Borrar todo?",
    clearConfirmBody:
      "Se borrará la dieta cargada y todo el registro de días (marcas, horas y notas). Esto no se puede deshacer.",
    clearConfirmYes: "Sí, borrar",
    clearConfirmNo: "Cancelar",
    clearedToast: "Datos borrados. Volviste a la dieta demo.",
    disclaimerTitle: "Sobre esta app",
    aiTitle: "Asistente IA del chat",
    aiBody:
      "Cuando haces una pregunta abierta en el chat, tu plan (con el nombre del peque oculto) se envía a un proveedor de IA para redactar la respuesta. Las preguntas de “¿se puede?” se responden en el teléfono, sin salir. Nada de la conversación se guarda ni queda en registros.",
    aiStatusEnabled: "Asistente IA: activo",
    aiStatusDisabled: "Asistente IA: en pausa",
  },
  a11y: {
    mainNav: "Navegación principal",
    statusIcon: "Estado: {status}",
    loading: "Cargando…",
  },
} as const;

/** Shape canónico del diccionario — en.ts DEBE cumplirlo (paridad compile-time). */
export type Dictionary = {
  readonly [S in keyof typeof es]: {
    readonly [K in keyof (typeof es)[S]]: string;
  };
};
