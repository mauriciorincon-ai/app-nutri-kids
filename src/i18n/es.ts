/**
 * Diccionario ES — idioma primario (microcopy coloquial).
 * REGLA: toda clave nueva se escribe aquí Y en en.ts EN EL MISMO PASO.
 * `Dictionary` (derivado de este objeto) fuerza la paridad estructural en compile-time;
 * el test de paridad la verifica en runtime (claves vacías incluidas).
 */
export const es = {
  app: {
    name: "Nutrikids",
    tagline: "La dieta de tu peque, viva y a la mano",
  },
  update: {
    notice:
      "Hay una versión nueva de Nutrikids. Tu dieta y tu registro no se tocan.",
    action: "Actualizar",
    later: "Ahora no",
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
    full: "Nutrikids organiza el plan de alimentación que la familia decidió seguir. No es diagnóstico ni tratamiento médico: ante cualquier duda, consulta siempre al pediatra o a tu nutricionista.",
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
    noteCancel: "Cancelar",
    historyLink: "Ver días anteriores",
    profileLink: "Perfil de tu peque",
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
    unknownItem: "Elemento de una dieta anterior",
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
    intro:
      "Escribe como le hablas a alguien. Todo se responde con tu plan, aquí en el teléfono y sin internet.",
    emptyHint: "Prueba con una de estas:",
    sugg1: "¿La manzana se puede?",
    sugg2: "¿Qué merienda le doy?",
    sugg3: "No tengo pollo, ¿qué le doy?",
    sugg4: "¿Cuánta agua le doy?",
    inputPlaceholder: "Escribe tu pregunta…",
    send: "Enviar",
    fromPlanBadge: "Desde tu plan · sin IA",
    deviceBadge: "Desde tu plan · redactado en tu teléfono",
    offlineStatus: "Responde sin internet",
    replacementsTitle: "Si no hay, usa…",
    additiveTitle: "Aditivo a evitar",
    additiveFoundIn: "Suele venir en: {where}",
    restrictedUntil: "En descanso hasta el {date}",
    restrictionEnded: "El descanso ya terminó — consulta al profesional.",
    introTitle: "Cómo funciona este chat",
    introBody:
      "Respondo solo con lo que dice tu plan: qué se puede, con qué reemplazar, qué toca ahora y cuánta agua. Todo pasa aquí en el teléfono; nada sale a internet. Si tu plan no lo dice, te lo digo. No es consejo médico.",
    introAccept: "Entendido",
  },
  answer: {
    optionsTitle: "Opciones de tu plan",
    replacementLead: "Si no hay {food}, tu plan da estas opciones:",
    replacementGroupLead:
      "Si no hay {food}, puedes usar otro alimento de su mismo grupo:",
    refusedFoodLead:
      "Pasa, y no es una falla. Si no quiso {food}, tu plan ofrece:",
    refusedLead: "Pasa, y no es una falla: no hace falta insistir.",
    nextTitle: "Lo que sigue",
    refusedNext: "{meal}, a las {start}: {content}",
    refusedNoNext:
      "Por hoy ya pasaron las comidas del plan; mañana empieza como siempre.",
    mealNow: "Ahora toca {meal} ({start}–{end}): {content}",
    mealNext: "Lo siguiente es {meal}, a las {start}: {content}",
    mealNamed: "{meal} en tu plan ({start}–{end}): {content}",
    mealTomorrow:
      "Por hoy ya pasaron las comidas. Mañana empieza con {meal}, a las {start}: {content}",
    hydration:
      "Tu plan pide entre {min} y {max} litros de agua al día, unos {glasses} vasos. {habit}",
    notInPlan: "Tu plan no lo dice. Pregúntale a tu profesional.",
    allergyYes:
      "Sí: tu plan anota {food} como alergia. Cualquier duda, con tu profesional.",
    allergyNotedYes:
      "Anotaste {food} como alergia (no viene de tu plan). Cualquier duda, con tu profesional.",
    intoleranceNotedYes:
      "Anotaste {food} como intolerancia (no viene de tu plan): pregúntale a tu profesional.",
    notedList: "Tú anotaste: {list}.",
    medicationNoted: "Anotado por ti: {name}",
    intoleranceYes:
      "Tu plan anota {food} como intolerancia: pregúntale a tu profesional cuánto y cuándo.",
    allergyList: "Tu plan anota estas alergias: {list}.",
    intoleranceList: "Y estas intolerancias: {list}.",
    allergyOther:
      "Si preguntas por otra cosa, tu plan no lo dice. Pregúntale a tu profesional.",
    medicationLead:
      "Esto es lo que dice tu plan de medicamentos. Cualquier cambio, solo con tu profesional.",
    medicationTitle: "Medicamentos de tu plan",
    notInPlanFood:
      "Tu plan no trae reemplazos para {food}. Pregúntale a tu profesional.",
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
      "Elige el PDF que te dio tu profesional, o el archivo de la dieta (termina en .json). También puedes explorar la app con la dieta demo.",
    pickFile: "Elegir JSON",
    pickPdf: "Elegir PDF",
    pdfHint:
      "El PDF de tu profesional se lee aquí, en tu teléfono, sin internet. No se guarda: solo queda tu plan, ya revisado por ti.",
    reading: "Leyendo el PDF en tu teléfono…",
    errorNotPdf:
      "Ese archivo no es un PDF. Elige el PDF que te dio tu profesional, o carga el plan con el archivo .json.",
    errorNoText:
      "Este PDF es una foto del plan, sin texto que se pueda leer. Pide a tu profesional el PDF original o carga el plan con el archivo .json.",
    errorUnreadable:
      "No pudimos abrir ese PDF. Prueba con el original que te dieron o carga el plan con el archivo .json.",
    draftNotSaved:
      "No pudimos guardar tu avance en este teléfono (¿poco espacio?). Termina la revisión sin salir de esta pantalla.",
    resumeTitle: "Tienes una revisión a medias",
    resumeBody:
      "Dejaste tu plan a medio revisar en este teléfono. Puedes seguir donde ibas. Si eliges otro PDF, esta revisión se reemplaza.",
    resumeContinue: "Seguir revisando",
    resumeDiscard: "Descartar esta revisión",
    reviewTitle: "Revisa tu plan",
    reviewIntro:
      "Esto es lo que leímos de tu PDF, parte por parte. Confirma lo que está bien, corrige lo que no y di cuando tu plan no trae algo. Nada se guarda hasta que termines.",
    reviewProgress: "{done} de {total} partes revisadas",
    reviewPrivacy: "Leído en tu teléfono. El PDF no se guarda ni sale de aquí.",
    markPending: "Por revisar",
    markOk: "Está bien",
    markCorrected: "Corregida",
    markAbsent: "Mi plan no lo trae",
    sectionOpen: "Abrir {name}",
    back: "Volver a la lista",
    pageLabel: "Página {n} del PDF",
    addedByYou: "Añadido por ti",
    unrecognizedNote:
      "No encontramos esta parte en tu PDF. Complétala a mano o di que tu plan no la trae.",
    skippedNote:
      "No pudimos leer {n} fila(s) de esta parte. Compárala con tu PDF y añade lo que falte.",
    emptyNote: "Aquí no hay nada todavía.",
    confirmButton: "Está bien",
    absentButton: "Mi plan no lo trae",
    absentRequired:
      "Tu plan necesita esta parte para funcionar: complétala para poder guardar.",
    absentHasContent:
      "Esta parte tiene datos. Si tu plan no la trae, quítalos primero.",
    confirmEmpty:
      "Aún no hay nada que confirmar: añade lo que falte, o di que tu plan no lo trae.",
    edit: "Editar",
    remove: "Quitar",
    add: "Añadir",
    saveRow: "Guardar cambios",
    cancel: "Cancelar",
    fieldsError: "Revisa los campos marcados.",
    removeLabel: "Quitar {name}",
    editLabel: "Editar {name}",
    savePlan: "Guardar mi plan",
    saveBlocked: "Faltan {n} partes por revisar para guardar.",
    saveBlockedRequired: "Tu plan necesita estas partes: {names}.",
    saveFailed:
      "No pudimos armar tu plan con lo que hay. Revisa las partes de abajo y vuelve a intentar.",
    sec_validity: "Fecha del plan",
    sec_restricted: "Alimentos en descanso temporal",
    sec_red: "Rojo fijo: lo que se evita siempre",
    sec_additives: "Aditivos para vigilar",
    sec_alsoAvoid: "También evitar",
    sec_green: "Verde: permitido y recomendado",
    sec_yellow: "Amarillo: con límite",
    sec_equivalences: "Equivalencias",
    sec_supplements: "Suplementos",
    sec_menu: "Menú del día",
    sec_hydration: "Hidratación",
    sec_goals: "Metas de actividad y sueño",
    hint_red:
      "El PDF cuenta estos alimentos en texto corrido y no podemos separarlos con seguridad. Añade aquí, uno por uno, los que tu plan pide evitar siempre.",
    hint_restricted:
      "Los que tu plan pide dejar un tiempo. La app cuenta el plazo desde la fecha del plan: 90 días si tu PDF no lo dice. Lo ajustas en «Fecha del plan».",
    f_name: "Nombre",
    f_code: "Código (por ejemplo E123)",
    f_foundIn: "Se encuentra en",
    f_portion: "Porción",
    f_items: "Alimentos, separados por comas",
    f_limit: "Límite",
    f_whenMissing: "Cuando falta",
    f_title: "Entonces",
    f_uses: "Opciones, separadas por comas",
    f_days: "Días",
    f_dose: "Dosis",
    f_when: "Cuándo",
    f_start: "Desde",
    f_end: "Hasta",
    f_content: "Qué lleva",
    f_min: "Litros por día, mínimo",
    f_max: "Litros por día, máximo",
    f_habit: "Hábito",
    f_activity: "Actividad",
    f_sleep: "Sueño",
    f_issuedAt: "Fecha del plan",
    f_restrictionDays: "Días de la restricción (vacío = 90)",
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
      "El archivo se abre, pero no tiene el formato de una dieta de Nutrikids. Pide de nuevo el archivo original (.json) a quien te lo compartió.",
    errorNoStorage:
      "Tu navegador no dejó guardar la dieta en el dispositivo. Intenta desde otro navegador (por ejemplo Chrome).",
    activeSource: "Dieta activa:",
    activeDemo: "la demo",
    activeReal: "tu dieta",
    useDemo: "Usar la demo",
    useReal: "Usar tu dieta",
  },
  settings: {
    profileTitle: "Perfil de tu peque",
    profileBody:
      "Lo que dice tu plan y lo que tú anotas, cada cosa con su origen.",
    profileLink: "Abrir el perfil",
    title: "Ajustes",
    language: "Idioma",
    languageEs: "Español",
    languageEn: "English",
    dietVersion: "Dieta cargada",
    dietVersionDemo: "Demo de ejemplo (ninguna dieta cargada)",
    dietVersionInfo: "{title} · emitida el {date}",
    clearTitle: "Borrar datos",
    clearBody:
      "Borra la dieta cargada y todo tu registro del día (marcas, horas y notas) y lo que anotaste en el perfil (notas y texturas) de este dispositivo. La app vuelve a la demo.",
    clearButton: "Borrar mis datos",
    clearConfirmTitle: "¿Borrar todo?",
    clearConfirmBody:
      "Se borrará la dieta cargada y todo el registro de días (marcas, horas y notas) y lo que anotaste en el perfil (notas y texturas). Esto no se puede deshacer.",
    clearConfirmYes: "Sí, borrar",
    clearConfirmNo: "Cancelar",
    clearedToast: "Datos borrados. Volviste a la dieta demo.",
    disclaimerTitle: "Sobre esta app",
    aiTitle: "Cómo responde el chat",
    aiBody:
      "El chat responde con código, solo con lo que trae tu plan, aquí en el teléfono: no usa servicios de inteligencia artificial en internet y nada de lo que escribes sale del teléfono. Si tu navegador trae un modelo de lenguaje propio dentro del teléfono, se usa solo para redactar con otras palabras una respuesta que el código ya decidió. Nada de la conversación se guarda.",
  },
  a11y: {
    mainNav: "Navegación principal",
    statusIcon: "Estado: {status}",
    loading: "Cargando…",
  },
  texture: {
    liquid: "Líquida",
    puree: "Puré",
    mashed: "Machacada",
    soft: "Blanda",
    chopped: "Picada",
    crunchy: "Crujiente",
    notAccepted: "textura que hoy no acepta",
    accepted: "acepta hoy",
  },
  profile: {
    title: "Perfil de tu peque",
    intro:
      "Lo que dice tu plan y lo que tú anotas en este teléfono, cada cosa con su origen. Nada de esto sale del teléfono.",
    originPlan: "según tu plan",
    originYou: "anotado por ti",
    notSaid: "Tu plan no lo dice.",
    goalsTitle: "Objetivos del profesional",
    groupsTitle: "Grupos de alimentos",
    scheduleTitle: "Horarios de comida",
    hydrationTitle: "Hidratación",
    hydrationValue: "Entre {min} y {max} litros al día, unos {glasses} vasos.",
    activityTitle: "Actividad",
    sleepTitle: "Sueño",
    limitsTitle: "Restricciones vigentes y suplementos",
    restrictionsActive: "En descanso hasta el {date}: {foods}.",
    restrictionsEnded:
      "El descanso de la dieta ya terminó — consulta al profesional.",
    restrictionsFuture: "El descanso empieza el {date}: {foods}.",
    supplementsCount: "Suplementos en tu calendario: {n}.",
    supplementsLink: "Ver el calendario de suplementos",
    childTitle: "Sobre tu peque",
    conditionTitle: "Condición",
    allergiesTitle: "Alergias",
    intolerancesTitle: "Intolerancias",
    medicationsTitle: "Medicamentos",
    mineTitle: "Lo que tú anotas",
    mineBody:
      "Se guarda solo en este teléfono, aparte de tu plan: si cargas un plan nuevo, tus anotaciones se quedan.",
    texturesTitle: "Texturas que hoy acepta",
    texturesHint:
      "Márcalas: las opciones con otra textura se muestran al final, marcadas, y nunca se ocultan.",
    noteKindLabel: "Tipo de nota",
    noteLabel: "Tu nota (hasta {max} letras)",
    noteAdd: "Agregar nota",
    noteRemove: "Quitar la nota: {text}",
    noteAdded: "Nota agregada.",
    noteRemoved: "Nota quitada.",
    noteEmpty: "Aún no anotaste nada.",
    noteDate: "Anotado el {date}",
    noteKinds_condition: "Condición",
    noteKinds_allergy: "Alergia",
    noteKinds_intolerance: "Intolerancia",
    noteKinds_medication: "Medicamento",
    noteKinds_other: "Otra nota",
    medicalReminder:
      "Para cambios de dosis o dudas médicas, consulta a tu profesional.",
  },
} as const;

/** Shape canónico del diccionario — en.ts DEBE cumplirlo (paridad compile-time). */
export type Dictionary = {
  readonly [S in keyof typeof es]: {
    readonly [K in keyof (typeof es)[S]]: string;
  };
};
