import type { Weekday } from "@/lib/diet/schema";
import type { DayStatus } from "@/lib/insights/days";
import type { Prepare, RiskFactor, RiskLevel } from "@/lib/insights/risk";
import type { Signal } from "@/lib/insights/radar";
import type { Place } from "@/lib/pressure/values";
import type { CtxId, PresentationId } from "@/lib/wellbeing/values";

import type { Locale } from "./index";

/**
 * Textos de «Lo que aprende» (S15 · ADR-021), en su propio módulo: solo los carga su pantalla.
 * Redactados en cada idioma, con paridad y frases vetadas por test. Cuentan lo anotado en palabras
 * y conteos (G-Plan 1a, sin porcentajes); jamás dicen por qué pasa algo, ni nombran una alergia,
 * ni dan una indicación: lo que coincide se comenta con el nutricionista.
 */

type Text = {
  title: string;
  lead: string;
  back: string;
  weekTitle: string;
  status: Record<DayStatus, string>;
  weekLine: string;
  weekEmpty: string;
  unrecorded: string;
  prevLine: string;
  prevEmpty: string;
  todayLine: string;
  hardest: string;
  hardestNone: string;
  radarTitle: string;
  radarQuiet: string;
  radarNone: string;
  slot: string;
  weekday: string;
  place: string;
  signal: string;
  signalNote: string;
  signalReactionNote: string;
  radarFooter: string;
  groups: { when: string; where: string; what: string };
  weekdays: Record<Weekday, string>;
  weekdayShort: Record<Weekday, string>;
  places: Record<Place, string>;
  signals: Record<Signal, string>;
  // --- El día de hoy y qué preparar (Hoy) ---
  dayTitle: string;
  levels: Record<RiskLevel, string>;
  levelHints: Record<RiskLevel, string>;
  levelHintLowPrepare: string;
  legendTitle: string;
  whyTitle: string;
  why: Record<RiskFactor, string>;
  whyNone: string;
  sleepMissing: { "no-band": string; "no-sleep": string };
  computedNew: string;
  prepareTitle: string;
  prepare: Record<Prepare, string>;
  ctxTitle: string;
  ctx: Record<CtxId, string>;
  ctxOn: string;
  ctxOff: string;
  adjustedUp: string;
  adjustedDown: string;
  open: string;
  // --- Lo que aprende (solo madre o padre) ---
  roleLimit: string;
  calendarTitle: string;
  calendarHint: string;
  calendarDay: string;
  legendCalendar: string;
  twinTitle: string;
  twinLead: string;
  twinLearning: string;
  twinLearningHint: string;
  twinFactorsTitle: string;
  twinNoFactors: string;
  factorNames: Record<RiskFactor, string>;
  factorUp: string;
  factorDown: string;
  acceptsTitle: string;
  acceptsNone: string;
  acceptGroup: string;
  acceptTexture: string;
  acceptPresentation: string;
  presentations: Record<PresentationId, string>;
  triesTitle: string;
  triesLine: string;
  triesFooter: string;
  eraseButton: string;
  eraseAsk: string;
  eraseYes: string;
  eraseNo: string;
  eraseDone: string;
};

const es: Text = {
  title: "Lo que aprende",
  lead: "De lo que anotan en casa. No es un diagnóstico.",
  back: "Hoy",
  weekTitle: "Esta semana",
  status: { in: "dentro del plan", off: "algo distinto", none: "sin anotar" },
  weekLine: "{inPlan} de {recorded} días anotados dentro del plan",
  weekEmpty: "Esta semana no hay días anotados.",
  unrecorded: "{count} sin anotar",
  prevLine:
    "La semana pasada: {inPlan} de {recorded} días anotados dentro del plan.",
  prevEmpty: "La semana pasada no hubo días anotados.",
  todayLine: "Hoy van {done} de {total} momentos marcados.",
  hardest: "Lo que más cuesta: {name} ({misses} de {of} días anotados).",
  hardestNone: "Ningún momento del plan se repite como el más difícil.",
  radarTitle: "Lo que se repite",
  radarQuiet:
    "Para buscar lo que se repite hacen falta {min} días anotados; van {count}.",
  radarNone:
    "En las últimas cuatro semanas nada se repite lo bastante para mostrarlo.",
  slot: "{name} quedó sin marcar o con «no lo quiso»: {hits} de {of} días anotados.",
  weekday:
    "{weekday} hubo algo distinto al plan: coincidió {hits} de {of} veces.",
  place: "{place}, de lo que le ofrecieron, se aceptó {hits} de {of} veces.",
  signal:
    "Se anotó «{signal}» los días en que también se anotó {food}: coincidió {hits} de {of} veces.",
  signalNote:
    "Una coincidencia no dice por qué pasa: coméntalo con tu nutricionista.",
  signalReactionNote:
    "Si hubo una reacción, sigue el plan de emergencia de tu profesional; está en Bienestar. Una coincidencia no dice por qué pasa: coméntalo con tu nutricionista.",
  radarFooter:
    "Nada de esto cambia el plan: lo cambia solo tu profesional. Si algo te llama la atención, coméntalo con tu nutricionista.",
  groups: { when: "Cuándo", where: "Dónde", what: "Qué coincidió" },
  weekdays: {
    mon: "Los lunes",
    tue: "Los martes",
    wed: "Los miércoles",
    thu: "Los jueves",
    fri: "Los viernes",
    sat: "Los sábados",
    sun: "Los domingos",
  },
  weekdayShort: {
    mon: "L",
    tue: "M",
    wed: "X",
    thu: "J",
    fri: "V",
    sat: "S",
    sun: "D",
  },
  places: {
    relatives: "En casa de familiares",
    school: "En el colegio",
    party: "En fiestas",
    kids: "Con otros niños",
    outing: "En salidas",
    other: "En otros lugares",
  },
  signals: {
    tummy: "dolor de barriga",
    head: "dolor de cabeza",
    pain: "algún dolor",
    nausea: "náuseas",
    reaction: "una reacción",
    stool: "deposiciones distintas",
  },
  dayTitle: "El día de hoy",
  levels: {
    low: "Mochila ligera",
    mid: "Mochila con algo más",
    high: "Mochila llena",
  },
  levelHints: {
    low: "Hoy no hay nada especial que preparar.",
    mid: "Hay algo para tener a mano.",
    high: "Hay varias cosas para tener a mano.",
  },
  levelHintLowPrepare:
    "Con lo anotado, hoy pesa poco; esto puede servir igual.",
  legendTitle: "Los tres niveles",
  whyTitle: "Por qué",
  why: {
    sleep: "La noche fue más corta que la referencia de su edad.",
    social: "Hay un evento con más gente.",
    away: "Hoy están fuera de casa.",
    new: "Hay alguien nuevo cuidándolo.",
  },
  whyNone: "No hay nada fuera de lo de siempre.",
  sleepMissing: {
    "no-band":
      "Elige su edad en el Perfil y anota cuánto durmió anoche en Bienestar: así también cuenta.",
    "no-sleep": "Si anotas cuánto durmió anoche en Bienestar, también cuenta.",
  },
  computedNew: "Se nota alguien nuevo en la familia hoy.",
  prepareTitle: "Qué preparar",
  prepare: {
    birthday: "Mira el plan para un cumpleaños",
    "when-asked": "Repasa qué decir cuando le ofrecen algo",
    "plan-out": "Ten a mano el plan B para cuando están fuera",
    lunchbox: "Prepara la lonchera",
    "family-yes-no": "Repasa con quien llega qué sí y qué no",
    "plan-late": "Ten a mano el plan B por si se hace tarde para comer",
    accepted: "Piensa en lo que ya acepta",
  },
  ctxTitle: "¿Cómo es hoy?",
  ctx: {
    social: "Hay un evento con más gente",
    away: "Hoy están fuera de casa",
    new: "Hay alguien nuevo cuidándolo",
  },
  ctxOn: "Anotado",
  ctxOff: "Sin anotar",
  adjustedUp:
    "Con lo anotado, los días con «{factor}» tuvieron algo distinto al plan {withOff} de {withDays} veces: pesa un poco más.",
  adjustedDown:
    "Con lo anotado, los días con «{factor}» tuvieron algo distinto al plan {withOff} de {withDays} veces: pesa un poco menos.",
  open: "Lo que aprende",
  roleLimit:
    "Esta pantalla es para madre o padre. El día de hoy y qué preparar se ven en Hoy.",
  calendarTitle: "Las últimas cuatro semanas",
  calendarHint: "Cada cuadro es un día; los días sin anotar no restan.",
  calendarDay: "{day}: {status}",
  legendCalendar: "Cómo leerlo",
  twinTitle: "Lo que va aprendiendo",
  twinLead:
    "Cuenta lo que anotan. Todo pasa en este teléfono y no usa ningún servicio.",
  twinLearning: "Aún aprendiendo ({noted} de {needed} días)",
  twinLearningHint:
    "Hasta tener {needed} días anotados no cambia nada del día de hoy.",
  twinFactorsTitle: "Qué pesa en el día",
  twinNoFactors: "Por ahora nada del día se nota distinto.",
  factorNames: {
    sleep: "una noche corta",
    social: "un evento con más gente",
    away: "estar fuera de casa",
    new: "alguien nuevo",
  },
  factorUp:
    "Los días con «{factor}»: {withOff} de {withDays} días anotados tuvieron algo distinto al plan; sin eso, {withoutOff} de {withoutDays}. Pesa un poco más.",
  factorDown:
    "Los días con «{factor}»: {withOff} de {withDays} días anotados tuvieron algo distinto al plan; sin eso, {withoutOff} de {withoutDays}. Pesa un poco menos.",
  acceptsTitle: "Lo que acepta mejor",
  acceptsNone: "Todavía nada se acepta claramente mejor que lo demás.",
  acceptGroup: "Del grupo «{name}»: lo aceptó {hits} de {of} veces.",
  acceptTexture: "Con textura {name}: lo aceptó {hits} de {of} veces.",
  acceptPresentation: "{name}: lo aceptó {hits} de {of} veces.",
  presentations: {
    apart: "Por separado",
    mixed: "Mezclado",
    bites: "En trocitos",
    "with-favorite": "Junto a algo que le gusta",
  },
  triesTitle: "Para ofrecer, del mismo grupo",
  triesLine: "Del grupo «{group}», que ya acepta, aún sin ofrecer: {foods}.",
  triesFooter: "Todo sale de tu plan; ofrecerlo o no lo decides tú.",
  eraseButton: "Borrar lo aprendido",
  eraseAsk:
    "¿Empezar de cero? Lo que anotan en el día no se toca; solo se olvida lo aprendido hasta hoy.",
  eraseYes: "Sí, borrar",
  eraseNo: "No, dejarlo",
  eraseDone: "Listo: empieza de cero desde hoy.",
};

const en: Text = {
  title: "What it learns",
  lead: "From what your family notes. It isn't a diagnosis.",
  back: "Today",
  weekTitle: "This week",
  status: {
    in: "within the plan",
    off: "something different",
    none: "not noted",
  },
  weekLine: "{inPlan} of {recorded} noted days within the plan",
  weekEmpty: "No days noted this week.",
  unrecorded: "{count} not noted",
  prevLine: "Last week: {inPlan} of {recorded} noted days within the plan.",
  prevEmpty: "No days were noted last week.",
  todayLine: "Today, {done} of {total} moments are checked.",
  hardest: "The hardest part: {name} ({misses} of {of} noted days).",
  hardestNone: "No moment of the plan stands out as the hardest.",
  radarTitle: "What repeats",
  radarQuiet:
    "Looking for what repeats takes {min} noted days; you have {count}.",
  radarNone: "Nothing in the last four weeks repeats often enough to show.",
  slot: "{name} was left unchecked or marked «didn't want it»: {hits} of {of} noted days.",
  weekday:
    "{weekday}, something differed from the plan: it matched {hits} of {of} times.",
  place: "{place}, of what was offered, it was accepted {hits} of {of} times.",
  signal:
    "“{signal}” was noted on days when {food} was also noted: it matched {hits} of {of} times.",
  signalNote:
    "Matching doesn't say why it happens: talk it over with your nutritionist.",
  signalReactionNote:
    "If there was a reaction, follow your professional's emergency plan; it is in Wellbeing. Matching doesn't say why it happens: talk it over with your nutritionist.",
  radarFooter:
    "None of this changes the plan: only your professional does. If something catches your eye, talk it over with your nutritionist.",
  groups: { when: "When", where: "Where", what: "What matched" },
  weekdays: {
    mon: "On Mondays",
    tue: "On Tuesdays",
    wed: "On Wednesdays",
    thu: "On Thursdays",
    fri: "On Fridays",
    sat: "On Saturdays",
    sun: "On Sundays",
  },
  weekdayShort: {
    mon: "M",
    tue: "T",
    wed: "W",
    thu: "T",
    fri: "F",
    sat: "S",
    sun: "S",
  },
  places: {
    relatives: "At relatives' homes",
    school: "At school",
    party: "At parties",
    kids: "With other kids",
    outing: "On outings",
    other: "Elsewhere",
  },
  signals: {
    tummy: "tummy ache",
    head: "headache",
    pain: "some pain",
    nausea: "nausea",
    reaction: "a reaction",
    stool: "different stools",
  },
  dayTitle: "Today",
  levels: {
    low: "Light backpack",
    mid: "Backpack with a little more",
    high: "Full backpack",
  },
  levelHints: {
    low: "Nothing special to prepare today.",
    mid: "There is something to have at hand.",
    high: "There are a few things to have at hand.",
  },
  levelHintLowPrepare:
    "From what was noted, today weighs little; this can still help.",
  legendTitle: "The three levels",
  whyTitle: "Why",
  why: {
    sleep: "Last night was shorter than the reference for their age.",
    social: "There is an event with more people.",
    away: "You are away from home today.",
    new: "Someone new is looking after them.",
  },
  whyNone: "Nothing outside the usual.",
  sleepMissing: {
    "no-band":
      "Pick their age in Profile and note how long they slept last night in Wellbeing: that counts too.",
    "no-sleep":
      "If you note how long they slept last night in Wellbeing, that counts too.",
  },
  computedNew: "Someone new in the family shows up today.",
  prepareTitle: "What to prepare",
  prepare: {
    birthday: "Look at the plan for a birthday",
    "when-asked": "Go over what to say when they are offered something",
    "plan-out": "Keep plan B at hand for when you are out",
    lunchbox: "Pack the lunchbox",
    "family-yes-no": "Go over what is a yes and a no with whoever arrives",
    "plan-late": "Keep plan B at hand in case it gets late for a meal",
    accepted: "Think about what they already accept",
  },
  ctxTitle: "What is today like?",
  ctx: {
    social: "There is an event with more people",
    away: "You are away from home today",
    new: "Someone new is looking after them",
  },
  ctxOn: "Noted",
  ctxOff: "Not noted",
  adjustedUp:
    "From what was noted, days with “{factor}” had something different from the plan {withOff} of {withDays} times: it weighs a little more.",
  adjustedDown:
    "From what was noted, days with “{factor}” had something different from the plan {withOff} of {withDays} times: it weighs a little less.",
  open: "What it learns",
  roleLimit:
    "This screen is for a mother or father. Today and what to prepare show in Today.",
  calendarTitle: "The last four weeks",
  calendarHint:
    "Each square is a day; days not noted never count against anyone.",
  calendarDay: "{day}: {status}",
  legendCalendar: "How to read it",
  twinTitle: "What it is learning",
  twinLead:
    "It counts what you note. Everything happens on this phone and uses no service.",
  twinLearning: "Still learning ({noted} of {needed} days)",
  twinLearningHint:
    "Until {needed} days are noted, nothing about today changes.",
  twinFactorsTitle: "What weighs on a day",
  twinNoFactors: "For now nothing about the day stands out.",
  factorNames: {
    sleep: "a short night",
    social: "an event with more people",
    away: "being away from home",
    new: "someone new",
  },
  factorUp:
    "On days with “{factor}”: {withOff} of {withDays} noted days had something different from the plan; without it, {withoutOff} of {withoutDays}. It weighs a little more.",
  factorDown:
    "On days with “{factor}”: {withOff} of {withDays} noted days had something different from the plan; without it, {withoutOff} of {withoutDays}. It weighs a little less.",
  acceptsTitle: "What they accept best",
  acceptsNone: "Nothing is clearly accepted better than the rest yet.",
  acceptGroup: "From the group “{name}”: accepted {hits} of {of} times.",
  acceptTexture: "With a {name} texture: accepted {hits} of {of} times.",
  acceptPresentation: "{name}: accepted {hits} of {of} times.",
  presentations: {
    apart: "Served apart",
    mixed: "Mixed in",
    bites: "In small bites",
    "with-favorite": "Next to something they like",
  },
  triesTitle: "To offer, from the same group",
  triesLine:
    "From the group “{group}”, which they already accept, not offered yet: {foods}.",
  triesFooter:
    "All of it comes from your plan; whether to offer it is up to you.",
  eraseButton: "Erase what it learned",
  eraseAsk:
    "Start from zero? What you note each day is not touched; only what it learned up to today is forgotten.",
  eraseYes: "Yes, erase",
  eraseNo: "No, keep it",
  eraseDone: "Done: it starts from zero from today.",
};

export type LearnText = Text;
export const learnText: Record<Locale, LearnText> = { es, en };

/** Rellena los {marcadores} de un texto. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}
