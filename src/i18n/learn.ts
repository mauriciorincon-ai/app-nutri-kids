import type { Weekday } from "@/lib/diet/schema";
import type { DayStatus } from "@/lib/insights/days";
import type { Signal } from "@/lib/insights/radar";
import type { Place } from "@/lib/pressure/values";

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
  radarFooter: string;
  weekdays: Record<Weekday, string>;
  weekdayShort: Record<Weekday, string>;
  places: Record<Place, string>;
  signals: Record<Signal, string>;
};

const es: Text = {
  title: "Lo que aprende",
  lead: "De lo que anotan en casa. No es un diagnóstico.",
  back: "Para la familia",
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
  radarFooter: "Nada de esto cambia el plan: lo cambia solo tu profesional.",
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
};

const en: Text = {
  title: "What it learns",
  lead: "From what your family notes. It isn't a diagnosis.",
  back: "For the family",
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
    "«{signal}» was noted on days when {food} was also noted: it matched {hits} of {of} times.",
  signalNote:
    "Matching doesn't say why it happens: talk it over with your nutritionist.",
  radarFooter: "None of this changes the plan: only your professional does.",
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
};

export type LearnText = Text;
export const learnText: Record<Locale, LearnText> = { es, en };

/** Rellena los {marcadores} de un texto. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}
