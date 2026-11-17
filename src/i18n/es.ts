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
    notedList: "Quien cuida anotó: {list}.",
    medicationNoted: "Anotado por quien cuida: {name}",
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
      "Borra la dieta cargada y todo tu registro del día (marcas, horas y notas) y lo que anotaste en el perfil (notas y texturas) de este dispositivo, dejas de recibir avisos y sales de la familia si estabas en una. Lo que ya está compartido en internet se borra desde «Compartir con la familia». La app vuelve a la demo.",
    clearButton: "Borrar mis datos",
    clearConfirmTitle: "¿Borrar todo?",
    clearConfirmBody:
      "Se borrará la dieta cargada y todo el registro de días (marcas, horas y notas) y lo que anotaste en el perfil (notas y texturas), dejarás de recibir avisos y saldrás de la familia. Esto no se puede deshacer.",
    clearAlsoShared:
      "También borrar lo compartido de internet. Los demás teléfonos de la familia conservan su copia.",
    clearConfirmYes: "Sí, borrar",
    clearConfirmNo: "Cancelar",
    clearedToast: "Datos borrados. Volviste a la dieta demo.",
    disclaimerTitle: "Sobre esta app",
    aiTitle: "Cómo responde el chat",
    aiBody:
      "El chat responde con código, solo con lo que trae tu plan, aquí en el teléfono: no usa servicios de inteligencia artificial en internet y nada de lo que escribes sale del teléfono. Si tu navegador trae un modelo de lenguaje propio dentro del teléfono, se usa solo para redactar con otras palabras una respuesta que el código ya decidió. Nada de la conversación se guarda.",
  },
  push: {
    title: "Avisos en este teléfono",
    intro:
      "Nutrikids puede avisarte a la hora de cada comida, del suplemento y del agua, aunque la app esté cerrada. Las horas salen de tu plan.",
    privacy:
      "El aviso se arma en tu teléfono. Lo único que sale de aquí es la dirección para despertarlo y las horas del día, sin etiqueta (y, si marcas algo antes de su hora, el día y el minuto de ese aviso, para no repetirlo); el servidor no sabe qué toca y manda un toque vacío. Nunca van nombres, alimentos, suplementos ni notas.",
    askNote:
      "Al tocar el botón, tu teléfono te pide permiso para mostrar avisos. Solo te lo pide esta vez.",
    enable: "Activar avisos en este teléfono",
    working: "Un momento…",
    on: "✓ Avisos activos en este teléfono",
    typesTitle: "Qué quieres que te avise",
    supplements: "Suplementos",
    supplementsHint: "A la hora de la primera comida, los días que tocan.",
    meals: "Comidas y meriendas",
    mealsHint: "A la hora de cada una.",
    water: "Agua",
    waterHint: "Repartida entre la primera y la última comida.",
    family: "Avisos de la familia",
    familyHint: "Cuando alguien de la familia te deja una nota.",
    familyNeeds:
      "Para recibir los avisos de la familia, este teléfono tiene que estar en una familia.",
    hideTitle: "Ocultar el detalle con el teléfono bloqueado",
    hideHint:
      "Prendido, el aviso trae un mensaje genérico en vez del detalle, y el detalle se ve al abrir la app. Vale solo para este teléfono.",
    off: "Dejar de recibir avisos",
    offDone:
      "Listo: este teléfono ya no recibe avisos y su dirección se borró del servidor.",
    offDoneLocal:
      "Listo: este teléfono ya no recibe avisos. Su dirección se borrará sola del servidor.",
    denied:
      "⚠ El permiso está bloqueado. Puedes cambiarlo en los ajustes del navegador o del teléfono y volver aquí.",
    unavailable:
      "ℹ Los avisos no están disponibles en este servicio. El resto de la app sigue igual.",
    unsupported:
      "ℹ Este navegador no puede mostrar avisos. Prueba con otro, o con la app instalada.",
    installTitle: "Primero instala la app en tu iPhone",
    installIntro:
      "En iPhone los avisos funcionan desde iOS 16.4 y solo con la app instalada en la pantalla de inicio.",
    install1: "Abre Nutrikids en Safari.",
    install2: "Toca el botón Compartir.",
    install3: "Elige «Añadir a pantalla de inicio».",
    install4: "Abre la app desde su ícono y vuelve a Ajustes.",
    lost: "El navegador quitó la suscripción de este teléfono. Actívalos de nuevo.",
    errOffline: "Sin conexión. Inténtalo otra vez cuando vuelva la red.",
    errUpdate:
      "Hay una versión nueva de la app esperando. Actualízala con el aviso de versión (o cierra y abre la app) y vuelve aquí.",
    errWorker:
      "No se pudo preparar el servicio de avisos en este navegador. Recarga la página e inténtalo de nuevo.",
    errDismissed:
      "No diste el permiso, así que no se activó nada. Puedes intentarlo otra vez cuando quieras.",
    errServer: "No se pudo guardar. Inténtalo en un rato.",
    errFull:
      "Ya hay muchos teléfonos de la familia con avisos. Quita uno e inténtalo de nuevo.",
  },
  pushNotify: {
    supplementTitle: "Suplemento de hoy",
    waterTitle: "Un vaso de agua",
    waterBody: "Vaso {n} de {total}",
    genericTitle: "Nutrikids",
    genericBody: "Hay algo del plan para esta hora. Ábrelo para verlo.",
    allDoneTitle: "Lo de esta hora ya está marcado",
    allDoneBody: "No hace falta hacer nada más.",
    many: "Toca varias cosas",
    familyFrom: "Aviso de {name}",
    familyGenericTitle: "Hay un aviso nuevo",
    familyGenericBody: "Ábrelo para verlo.",
  },
  notices: {
    title: "Avisos de la familia",
    send: "Avisar a la familia",
    hint: "Una nota corta que despierta a los demás teléfonos. Viaja cifrada: nadie más puede leerla.",
    label: "Tu aviso",
    placeholder: "Una nota corta para la familia",
    count: "{n} de {max}",
    submit: "Enviar aviso",
    sending: "Enviando…",
    sent: "✓ Aviso enviado.",
    queued: "✓ Guardado. Se envía cuando vuelva la red.",
    needName:
      "Ponle nombre a este teléfono en Ajustes para que sepan quién avisa.",
    errEmpty: "Escribe algo antes de enviar.",
    errSend: "No se pudo enviar. Inténtalo otra vez.",
    empty: "Hoy no hay avisos.",
    mine: "Por ti",
    at: "{time}",
  },
  family: {
    title: "Compartir con la familia",
    intro:
      "Para que todos los que cuidan a tu peque vean lo mismo: el plan, lo marcado del día y lo que cada uno anotó.",
    travelsTitle: "Qué se comparte",
    travels:
      "El plan, el día (marcas, horas y notas) y el perfil con sus notas, alergias y medicamentos. Cada teléfono comparte también su nombre, su rol y su llave de firma, para decir «Por Mamá» y para que nadie escriba en nombre de otro.",
    staysTitle: "Qué se queda en cada teléfono",
    stays: "El idioma, el tema y los ajustes de cada teléfono.",
    privacy:
      "Todo se cifra en tu teléfono antes de salir. En internet solo quedan datos ilegibles: sin la frase de la familia nadie puede abrirlos, ni nosotros.",
    createButton: "Crear una familia",
    joinButton: "Entrar con un código",
    unavailable:
      "Compartir no responde en este momento. Tu app sigue completa en este teléfono.",
    offlineHome:
      "Sin conexión: para crear una familia o entrar a una hace falta internet.",
    checking: "Comprobando…",
    consentTitle: "Antes de compartir",
    consentBody:
      "Vas a compartir con otros teléfonos datos de salud de tu peque: el plan, lo marcado y lo anotado, incluidas alergias y medicamentos. Viaja cifrado y solo se abre con la frase de la familia.",
    consentLost:
      "Si se pierde la frase y ningún teléfono sigue dentro, lo compartido no se puede recuperar: nadie, ni nosotros, puede abrirlo.",
    consentLeave:
      "Puedes salir cuando quieras: «Salir de la familia» conserva los datos de este teléfono y «Borrar lo compartido» borra la copia de internet.",
    consentCheck: "Entiendo qué se comparte y quiero hacerlo",
    nameLabel: "Nombre de este teléfono",
    nameHint: "Así te verán los demás: «Por Mamá». Hasta 30 letras.",
    createSubmit: "Crear la familia",
    creating: "Creando…",
    cancel: "Cancelar",
    secretsTitle: "Anota la invitación y la frase",
    secretsBody:
      "Con las dos entra otro teléfono. La invitación lleva el código de la familia y su huella; la frase se muestra solo ahora y no se guarda: si se pierde, se cambia por una nueva.",
    codeLabel: "Invitación",
    phraseLabel: "Frase de la familia",
    savedCheck: "Ya los anoté en un lugar seguro",
    secretsDone: "Listo",
    joinTitle: "Entrar a una familia",
    joinBody:
      "Pídele la invitación y la frase a una madre o un padre de la familia.",
    joinCode: "Invitación",
    joinPhrase: "Frase",
    joinSubmit: "Entrar",
    joining: "Entrando…",
    errWrongCode: "Esa invitación no es válida o la familia ya no existe.",
    errWrongPhrase: "Esa frase no es la de la familia.",
    errOffline: "Sin conexión. Inténtalo cuando vuelva internet.",
    errUnavailable: "Compartir no responde en este momento.",
    errBusy: "Fueron muchos intentos seguidos. Espera un minuto.",
    errFull: "Compartir llegó a su límite.",
    errError: "Algo no salió bien. Inténtalo otra vez.",
    errNoName: "Escribe el nombre de este teléfono.",
    statusIdle: "Al día",
    statusSyncing: "Sincronizando",
    statusOffline: "Sin conexión",
    statusLocked: "Frase cambiada",
    statusUnavailable: "No responde",
    statusFull: "Sin espacio",
    statusError: "No se pudo sincronizar",
    bodyIdle: "Todo lo compartido está al día.",
    bodySyncing: "Subiendo y bajando cambios…",
    bodyOffline:
      "Tus cambios se guardan aquí y se suben cuando vuelva internet.",
    bodyLocked:
      "Este teléfono ya no puede entrar a la familia: la frase cambió, lo sacaron o la familia se borró. Entra con la frase nueva o sal de la familia.",
    bodyUnavailable:
      "El servicio de compartir no responde. Tus datos siguen aquí y se reintenta solo.",
    bodyFull: "La familia llegó al límite de lo que se puede compartir.",
    bodyError: "Algo falló. Se reintenta solo.",
    lastSync: "Última sincronía: {when}",
    neverSynced: "Primera sincronía pendiente",
    pending: "Cambios por subir: {n}",
    codeShown: "Invitación de la familia: {code}",
    phonesTitle: "Teléfonos de la familia",
    youTag: "Este teléfono",
    seenAt: "Visto {when}",
    renameSave: "Guardar nombre",
    renamed: "Nombre guardado.",
    removeButton: "Sacar a {name}",
    removeTitle: "¿Sacar a {name}?",
    removeBody:
      "{name} sale de la lista de la familia y se cambia la frase: queda sin acceso, y los demás teléfonos entran otra vez con la frase nueva. Lo que {name} ya tiene en su teléfono se queda ahí.",
    removeYes: "Sacar y cambiar la frase",
    rotateTitle: "Cambiar la frase",
    rotateBody:
      "Úsalo si perdiste la frase o quieres sacar a alguien. Los demás teléfonos entran otra vez con la frase nueva.",
    rotateButton: "Cambiar la frase",
    rotateConfirmTitle: "¿Cambiar la frase?",
    rotateConfirmBody:
      "La frase anterior deja de servir. Los demás teléfonos tendrán que entrar con la nueva.",
    rotateYes: "Sí, cambiarla",
    newPhraseTitle: "Frase nueva",
    newPhraseBody:
      "Anótala y pásasela a los teléfonos que se quedan. La anterior ya no sirve.",
    leaveButton: "Salir de la familia",
    leaveConfirmTitle: "¿Salir de la familia?",
    leaveConfirmBody:
      "Este teléfono deja de compartir y se queda con sus datos. Los demás siguen. Para volver, entra con el código y la frase.",
    leaveYes: "Sí, salir",
    destroyButton: "Borrar lo compartido",
    destroyBody:
      "Borra de internet todo lo que la familia compartió y disuelve el grupo. Cada teléfono conserva su copia.",
    destroyConfirmTitle: "¿Borrar lo compartido?",
    destroyConfirmBody:
      "Se borra de internet todo lo compartido y el grupo se disuelve. Cada teléfono conserva su copia. Esto no se puede deshacer.",
    destroyYes: "Sí, borrar lo compartido",
    left: "Saliste de la familia. Tus datos siguen en este teléfono.",
    destroyed: "Se borró lo compartido. Tus datos siguen en este teléfono.",
    planNoticeTheirs:
      "Dos teléfonos cambiaron el plan. Quedó el más reciente, el del otro teléfono.",
    planNoticeMine:
      "Dos teléfonos cambiaron el plan. Quedó el más reciente, el de este teléfono.",
    planNoticeOk: "Entendido",
    keysNotSaved:
      "No se pudo guardar la clave en este teléfono (¿navegación privada?). Funciona mientras la app esté abierta; al cerrarla tendrás que entrar de nuevo con la frase.",
    oversize:
      "{n} registro(s) no caben en lo compartido y se quedan solo en este teléfono.",
    planTooBig:
      "Tu plan es demasiado grande para compartirlo: se queda solo en este teléfono.",
    unreadable:
      "{n} registros no se pudieron abrir en este teléfono y se dejaron como estaban.",
    lockedTitle: "Entra otra vez",
    lockedBody:
      "Pídele a quien cambió la frase la frase nueva. La invitación es la misma.",
    by: "Por {name}",
    roleParent: "Madre o padre",
    roleCaregiver: "Cuidador",
    roleSchool: "Colegio",
    roleNutritionist: "Nutricionista",
    roleParentCan: "Todo: el plan, el perfil, la familia y los roles.",
    roleCaregiverCan: "Registra el día, deja notas y avisa a la familia.",
    roleSchoolCan:
      "Marca las comidas de sus horarios, deja notas en ellas y avisa a la familia.",
    roleNutritionistCan: "Ve todo y deja notas del día y del perfil.",
    yourRole: "Tu rol: {role}",
    noRoleYet:
      "Esperando a que una madre o un padre te dé un rol. Mientras, ves todo lo compartido, pero no puedes cambiarlo.",
    peopleTitle: "Personas de la familia",
    roleFor: "Rol de {name}",
    roleSave: "Guardar rol",
    roleSaved: "Rol guardado.",
    mealsFor: "Comidas que marca {name}",
    waitingTitle: "Esperando rol",
    waitingInvited: "Entró con la invitación de {role}.",
    waitingNoInvite: "Entró sin una invitación con rol.",
    waitingMark:
      "Huella de su teléfono: {mark}. Confirma solo si es la misma que esa persona ve en su pantalla.",
    myMark:
      "Huella de este teléfono: {mark}. Quien te confirme debe ver la misma.",
    waitingConfirm: "Confirmar como {role}",
    waitingOld:
      "Su app es de antes de los roles: cuando se actualice, aquí podrás darle uno.",
    inviteTitle: "Invitar con rol",
    inviteBody:
      "Elige qué podrá hacer la persona. Le pasas esta invitación junto con la frase de la familia.",
    inviteRole: "Rol",
    inviteMeals: "Comidas que marcará el colegio",
    inviteNoMeals:
      "El plan no trae comidas con horario: el colegio podrá avisar, pero no marcar.",
    inviteCreate: "Crear invitación",
    inviteReady: "Invitación para {role}:",
    inviteHint:
      "Sirve 7 días. Cuando la persona entre, aparece en «Esperando rol» y la confirmas con un toque.",
    onlyParents: "Solo una madre o un padre puede cambiar esto.",
    roleBlocked: "Con tu rol ({role}) esto se ve, pero no se cambia.",
    logTitle: "Bitácora",
    logBody: "Quién cambió qué y cuándo, en todos los teléfonos.",
    logEmpty: "Aún no hay cambios.",
    logMark: "marcó {item} ({date})",
    logUnmark: "quitó la marca de {item} ({date})",
    logDayNote: "anotó en {item} ({date})",
    logProfileNote: "cambió una nota del perfil",
    logTextures: "cambió las texturas que acepta",
    logPlan: "cambió el plan",
    logPlanLine: "cambió una línea del plan unido ({item})",
    logGenesis: "creó la familia",
    logSet: "le dio a {name} el rol {role}",
    logRemove: "sacó a {name} de la familia",
    logInvite: "invitó a alguien como {role}",
    logNotice: "avisó a la familia",
    logItemWater: "un vaso de agua",
    logItemOther: "un registro",
    oneParent:
      "Consejo: invita a otra madre o padre. Si este teléfono se pierde, nadie más podría cambiar los roles.",
    rejected:
      "{n} cambio(s) que llegaron no se aceptaron: no traían la firma de quien dice o su rol no lo permite.",
    rosterPin:
      "La familia que hay en internet no coincide con tu invitación. Por seguridad, este teléfono no acepta sus roles: pide una invitación nueva a una madre o un padre.",
    rosterInvalid:
      "Llegó una lista de roles que no encaja; este teléfono la ignoró.",
    rewritten:
      "La bitácora de {names} llegó cambiada; se conservó lo que este teléfono ya había visto.",
    errNotAllowed: "Tu rol no permite hacer esto.",
    errInvalid: "Ese cambio no se pudo hacer.",
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
      "Lo que dice tu plan y lo que tú anotas en este teléfono, cada cosa con su origen. Se queda en el teléfono, y solo viaja a tu familia si decides compartir: siempre cifrado.",
    originPlan: "según tu plan",
    originYou: "anotado por quien cuida",
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
      "Se guarda en este teléfono, aparte de tu plan (y se comparte con tu familia solo si decides compartir): si cargas un plan nuevo, tus anotaciones se quedan.",
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
