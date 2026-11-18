import type { Locale } from "./index";

/**
 * Los textos del bienestar (S10), aparte del diccionario compartido a propósito: solo los
 * cargan Hoy, /bienestar, Perfil, Historial y la ficha del alimento, y el bundle que todas las
 * pantallas comparten no crece. Redactados en cada idioma (no traducidos) y con su test de
 * paridad. Tono: palabras de casa; nada diagnostica, interpreta, culpa ni urge con alarma.
 */

const es = {
  title: "Bienestar",
  lead: "Anota en segundos cómo está hoy, cómo llega a la mesa y cómo van sus hábitos. Solo se anota: la app no interpreta nada.",
  notMedical:
    "Esto se anota para que la familia lo vea junto. No es un diagnóstico y no reemplaza a tu pediatra.",

  // Semáforo emocional (antes de comer)
  moodQuestion: "¿Cómo llega a esta comida?",
  moods: {
    happy: "Feliz",
    tired: "Cansado/a",
    anxious: "Ansioso/a",
    "not-hungry": "Sin hambre",
    other: "Otro",
  },

  // Cómo está hoy
  symptomTitle: "Cómo está hoy",
  symptoms: {
    energy: "Energía",
    sleep: "Sueño (anoche)",
    mood: "Ánimo",
    stool: "Evacuaciones",
    pain: "Dolor",
    nausea: "Náuseas",
    reaction: "Reacciones",
    appetite: "Hambre y saciedad",
  },
  symptomOptions: {
    energy: {
      high: "Con mucha energía",
      usual: "Como siempre",
      low: "Con poca energía",
    },
    sleep: { well: "Bien", "so-so": "Así así", badly: "Mal" },
    mood: {
      cheerful: "Contento/a",
      calm: "Tranquilo/a",
      irritable: "Irritable",
      down: "Decaído/a",
    },
    stool: {
      usual: "Como siempre",
      different: "Distintas a lo usual",
      none: "No ha ido hoy",
    },
    pain: {
      none: "Ninguno",
      tummy: "De barriga",
      head: "De cabeza",
      other: "Otro",
    },
    nausea: { none: "No", little: "Un poco", "a-lot": "Bastante" },
    reaction: {
      none: "Ninguna",
      skin: "En la piel",
      breathing: "Al respirar",
      swelling: "Hinchazón",
      other: "Otra",
    },
    appetite: {
      hungry: "Con hambre",
      usual: "Como siempre",
      "not-hungry": "Sin hambre",
      "fills-fast": "Se llena pronto",
    },
  },
  wellNote: "Nota corta (opcional)",
  wellNoteHint: "Hasta 140 letras. Lo que quieras que la familia sepa de hoy.",
  wellNoteSave: "Guardar nota",
  reactionHelp:
    "Si hay una reacción, el plan de emergencia de la familia dice a quién llamar y qué ficha mostrar.",
  reactionLink: "Abrir el plan de emergencia",

  // Aceptación de alimentos
  foodTitle: "Cómo le fue con los alimentos",
  foodPick: "¿Con qué alimento?",
  foodStage: "¿Qué hizo?",
  foodStages: { looked: "Lo miró", touched: "Lo tocó", tasted: "Lo probó" },
  foodVerdict: "¿Cómo le cayó?",
  foodVerdicts: {
    loves: "Le encantó",
    accepts: "Lo aceptó",
    refuses: "No lo aceptó",
  },
  foodTexture: "¿Con qué textura?",
  foodPresentation: "¿Con qué presentación?",
  foodPresentations: {
    apart: "Por separado",
    mixed: "Mezclado",
    bites: "En trocitos",
    "with-favorite": "Junto a algo que le gusta",
  },
  foodNew: "Es un alimento nuevo",
  foodSave: "Guardar",
  foodRemove: "Quitar",
  exposuresOne: "Lo ha mirado, tocado o probado 1 vez.",
  exposuresMany: "Lo ha mirado, tocado o probado {n} veces.",
  exposuresHint:
    "Suele hacer falta ofrecerlo muchas veces, sin presión. Mirarlo y tocarlo también cuenta.",
  workedTextures: "Funcionó con: {list}",
  workedPresentations: "Lo aceptó: {list}",
  lastVerdict: "Última vez: {verdict}",

  // Hábitos
  habitsTitle: "Hábitos",
  habits: {
    sleep: "Sueño de anoche",
    screen: "Pantalla (recreativa)",
    activity: "Actividad",
    sun: "Sol y naturaleza",
  },
  habitSleep24: "Sueño de 24 h (con siestas)",
  habitUnit: "Minutos",
  habitSave: "Guardar",
  habitClear: "Quitar",
  waterTitle: "Agua",
  waterLine: "{done} de {target} vasos de hoy (la meta es la de su plan).",
  statusWithin: "Dentro de lo que se recomienda",
  statusBelow: "Por debajo de la referencia",
  statusAbove: "Por encima de la referencia",
  statusNotRecommended: "La guía no la recomienda a esta edad",
  statusNoFigure: "Se anota; no hay una cifra oficial",
  statusWeekly:
    "Se anota; la referencia es un promedio de la semana, no de un día",
  refRange: "Referencia para su edad: entre {min} y {max}.",
  refMin: "Referencia para su edad: al menos {min}.",
  refMinMvpa: " De ellos, al menos {mvpa} de intensidad moderada a fuerte.",
  refMinMvpaAvg:
    " De intensidad moderada a fuerte, en promedio al día durante la semana.",
  refMax: "Referencia para su edad: hasta {max} (menos es mejor).",
  refNotRecommended: "La guía no recomienda pantallas recreativas a esta edad.",
  refLimit: "La guía pide limitarla, sin dar una cifra.",
  refNone: "No hay una cifra oficial: se anota y ya.",
  refSleepNaps: " Incluye las siestas.",
  refSource: "Fuente: {source}.",
  refNotVerdict:
    "Una referencia no es un veredicto: cada niño es distinto. Si algo te preocupa, consúltalo con su pediatra.",

  // Edad
  ageTitle: "Franja de edad",
  ageBody:
    "Con ella la app compara los hábitos con la referencia de su edad. Solo guarda la franja, nunca la fecha de nacimiento.",
  ageBands: {
    "1": "1 año",
    "2": "2 años",
    "3-4": "3–4 años",
    "5": "5 años",
    "6-12": "6–12 años",
    "13-17": "13–17 años",
  },
  ageNone:
    "Una madre o un padre elige la franja de edad en el Perfil para ver las referencias.",
  ageOnlyParent: "Solo una madre o un padre elige la franja de edad.",
  ageRecheck: "Pasó un año. ¿Sigue en la franja de {band}?",
  ageSame: "Sí, sigue igual",
  ageChange: "Cambiar",

  // Pantalla y accesos
  open: "Bienestar de hoy",
  readOnly: "Tú puedes verlo; lo anotan otras personas de la familia.",
  // Historial
  historyMoods: "Cómo llegó:",
  historySymptoms: "Cómo estuvo:",
  historyHabits: "Hábitos:",
  historyFood: "Alimentos:",
};

const en: typeof es = {
  title: "Wellbeing",
  lead: "Note in seconds how they are today, how they come to the table and how their habits are going. It only records: the app interprets nothing.",
  notMedical:
    "This is noted so the family can see it together. It is not a diagnosis and does not replace your pediatrician.",

  moodQuestion: "How are they coming to this meal?",
  moods: {
    happy: "Happy",
    tired: "Tired",
    anxious: "Anxious",
    "not-hungry": "Not hungry",
    other: "Other",
  },

  symptomTitle: "How they are today",
  symptoms: {
    energy: "Energy",
    sleep: "Sleep (last night)",
    mood: "Mood",
    stool: "Bowel movements",
    pain: "Pain",
    nausea: "Nausea",
    reaction: "Reactions",
    appetite: "Hunger and fullness",
  },
  symptomOptions: {
    energy: { high: "A lot", usual: "As usual", low: "Little" },
    sleep: { well: "Well", "so-so": "So-so", badly: "Badly" },
    mood: {
      cheerful: "Cheerful",
      calm: "Calm",
      irritable: "Irritable",
      down: "Down",
    },
    stool: {
      usual: "As usual",
      different: "Different from usual",
      none: "Not yet today",
    },
    pain: { none: "None", tummy: "Tummy", head: "Head", other: "Other" },
    nausea: { none: "No", little: "A little", "a-lot": "A lot" },
    reaction: {
      none: "None",
      skin: "On the skin",
      breathing: "When breathing",
      swelling: "Swelling",
      other: "Other",
    },
    appetite: {
      hungry: "Hungry",
      usual: "As usual",
      "not-hungry": "Not hungry",
      "fills-fast": "Fills up fast",
    },
  },
  wellNote: "Short note (optional)",
  wellNoteHint:
    "Up to 140 characters. Anything the family should know about today.",
  wellNoteSave: "Save note",
  reactionHelp:
    "If there is a reaction, the family's emergency plan says who to call and which card to show.",
  reactionLink: "Open the emergency plan",

  foodTitle: "How foods went",
  foodPick: "Which food?",
  foodStage: "What did they do?",
  foodStages: {
    looked: "Looked at it",
    touched: "Touched it",
    tasted: "Tasted it",
  },
  foodVerdict: "How did it go down?",
  foodVerdicts: {
    loves: "Loved it",
    accepts: "Accepted it",
    refuses: "Did not accept it",
  },
  foodTexture: "With which texture?",
  foodPresentation: "With which presentation?",
  foodPresentations: {
    apart: "Served apart",
    mixed: "Mixed in",
    bites: "In small pieces",
    "with-favorite": "Next to something they like",
  },
  foodNew: "It is a new food",
  foodSave: "Save",
  foodRemove: "Remove",
  exposuresOne: "They have looked at, touched or tasted it 1 time.",
  exposuresMany: "They have looked at, touched or tasted it {n} times.",
  exposuresHint:
    "It often takes offering it many times, with no pressure. Looking at it and touching it count too.",
  workedTextures: "Worked with: {list}",
  workedPresentations: "Accepted it: {list}",
  lastVerdict: "Last time: {verdict}",

  habitsTitle: "Habits",
  habits: {
    sleep: "Last night's sleep",
    screen: "Screen time (recreational)",
    activity: "Activity",
    sun: "Sun and nature",
  },
  habitSleep24: "Sleep in 24 h (naps included)",
  habitUnit: "Minutes",
  habitSave: "Save",
  habitClear: "Remove",
  waterTitle: "Water",
  waterLine:
    "{done} of {target} glasses today (the goal is the one in their plan).",
  statusWithin: "Within what is recommended",
  statusBelow: "Below the reference",
  statusAbove: "Above the reference",
  statusNotRecommended: "The guideline does not recommend it at this age",
  statusNoFigure: "Noted; there is no official figure",
  statusWeekly: "Noted; the reference is a weekly average, not a single day",
  refRange: "Reference for their age: between {min} and {max}.",
  refMin: "Reference for their age: at least {min}.",
  refMinMvpa: " Of that, at least {mvpa} at a moderate to vigorous intensity.",
  refMinMvpaAvg:
    " At a moderate to vigorous intensity, as a daily average across the week.",
  refMax: "Reference for their age: up to {max} (less is better).",
  refNotRecommended:
    "The guideline does not recommend recreational screen time at this age.",
  refLimit: "The guideline asks to limit it, without giving a figure.",
  refNone: "There is no official figure: it is simply noted.",
  refSleepNaps: " Naps included.",
  refSource: "Source: {source}.",
  refNotVerdict:
    "A reference is not a verdict: every child is different. If something worries you, talk to their pediatrician.",

  ageTitle: "Age range",
  ageBody:
    "With it the app compares habits with the reference for their age. It only keeps the range, never the date of birth.",
  ageBands: {
    "1": "1 year",
    "2": "2 years",
    "3-4": "3–4 years",
    "5": "5 years",
    "6-12": "6–12 years",
    "13-17": "13–17 years",
  },
  ageNone: "A parent picks the age range in the Profile to see the references.",
  ageOnlyParent: "Only a parent picks the age range.",
  ageRecheck: "A year has passed. Are they still in the {band} range?",
  ageSame: "Yes, still the same",
  ageChange: "Change",

  open: "Today's wellbeing",
  readOnly: "You can see it; other people in the family note it.",
  historyMoods: "How they arrived:",
  historySymptoms: "How they were:",
  historyHabits: "Habits:",
  historyFood: "Foods:",
};

export type WellbeingText = typeof es;
export const wellbeingText: Record<Locale, WellbeingText> = { es, en };
