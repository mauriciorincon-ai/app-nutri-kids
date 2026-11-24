import type { OfferKind } from "@/lib/pressure/offer";
import type { Answer, Place } from "@/lib/pressure/values";

import type { Locale } from "./index";

/**
 * Textos de «Cuando le ofrecen algo» (S14 · ADR-020), en su propio módulo: la pantalla de las
 * lecciones no los carga. Redactados en cada idioma; paridad y frases vetadas por test. No culpan
 * a nadie ni nombran personas: el patrón dice dónde y qué, nunca quién.
 */

type Text = {
  pTitle: string;
  pLead: string;
  pBack: string;
  formTitle: string;
  whoQ: string;
  whoOther: string;
  whatQ: string;
  whatOutside: string;
  offerKinds: Record<OfferKind, string>;
  placeQ: string;
  places: Record<Place, string>;
  answerQ: string;
  answers: Record<Answer, string>;
  save: string;
  missing: string;
  saved: string;
  strategyTitle: string;
  sayAdultTitle: string;
  offerTitle: string;
  offerNone: string;
  listTitle: string;
  listEmpty: string;
  mineOnly: string;
  byLine: string;
  thisPhone: string;
  remove: string;
  patternTitle: string;
  patternTop: string;
  patternNone: string;
  patternPlaces: string;
  privacy: string;
};

const es: Text = {
  pTitle: "Cuando le ofrecen algo",
  pLead:
    "Si alguien le ofreció algo que no va en su plan, anótalo aquí. No es para señalar a nadie: sirve para preparar la próxima vez.",
  pBack: "Para la familia",
  formTitle: "Anotarlo",
  whoQ: "¿Quién se lo ofreció?",
  whoOther: "Otra persona",
  whatQ: "¿Qué le ofrecieron?",
  whatOutside: "Algo fuera del plan",
  offerKinds: {
    red: "Evitar",
    restricted: "Evitar en estas fechas",
    yellow: "Con condición",
  },
  placeQ: "¿Dónde fue?",
  places: {
    relatives: "Con los abuelos o la familia",
    school: "En el colegio",
    party: "En una fiesta",
    kids: "Entre otros niños",
    outing: "En una salida",
    other: "En otro lugar",
  },
  answerQ: "¿Cómo se respondió?",
  answers: {
    "calm-no": "Con un «no, gracias» tranquilo",
    swap: "Se cambió por algo de su plan",
    accepted: "Lo comió",
    other: "De otra forma",
  },
  save: "Guardar",
  missing: "Elige qué le ofrecieron, dónde y cómo se respondió.",
  saved: "Anotado. Esto puede ayudar la próxima vez.",
  strategyTitle: "Para la próxima vez",
  sayAdultTitle: "Puedes decirle a quien lo ofreció",
  offerTitle: "Lo que sí puedes ofrecer de su plan",
  offerNone: "El plan no trae alimentos de la lista verde.",
  listTitle: "Lo anotado",
  listEmpty: "Aquí aparece lo que anotes.",
  mineOnly:
    "Ves lo que anotó este teléfono. El registro completo y lo que se repite lo ven madre y padre.",
  byLine: "Lo anotó {name}",
  thisPhone: "este teléfono",
  remove: "Quitar",
  patternTitle: "Lo que se repite",
  patternTop: "{count} veces este mes: {what}, {place}.",
  patternNone: "Este mes nada se repite.",
  patternPlaces: "Dónde pasó este mes",
  privacy:
    "Se guarda en este teléfono. Si hay familia conectada, viaja cifrado y solo madre y padre ven todo.",
};

const en: Text = {
  pTitle: "When they're offered something",
  pLead:
    "If someone offered something that isn't in the plan, note it here. It's not about pointing fingers: it helps you prepare for next time.",
  pBack: "For the family",
  formTitle: "Note it",
  whoQ: "Who offered it?",
  whoOther: "Someone else",
  whatQ: "What was offered?",
  whatOutside: "Something outside the plan",
  offerKinds: {
    red: "Avoid",
    restricted: "Avoid on these dates",
    yellow: "With a condition",
  },
  placeQ: "Where was it?",
  places: {
    relatives: "With grandparents or relatives",
    school: "At school",
    party: "At a party",
    kids: "Among other children",
    outing: "On an outing",
    other: "Somewhere else",
  },
  answerQ: "How did it go?",
  answers: {
    "calm-no": "A calm “no, thank you”",
    swap: "Swapped for something from the plan",
    accepted: "They ate it",
    other: "Some other way",
  },
  save: "Save",
  missing: "Choose what was offered, where, and how it went.",
  saved: "Noted. This may help next time.",
  strategyTitle: "For next time",
  sayAdultTitle: "You can tell whoever offered it",
  offerTitle: "What you can offer from the plan",
  offerNone: "The plan has no foods on the green list.",
  listTitle: "What's been noted",
  listEmpty: "What you note shows up here.",
  mineOnly:
    "You see what this phone noted. Parents see the full record and what repeats.",
  byLine: "Noted by {name}",
  thisPhone: "this phone",
  remove: "Remove",
  patternTitle: "What repeats",
  patternTop: "{count} times this month: {what}, {place}.",
  patternNone: "Nothing repeats this month.",
  patternPlaces: "Where it happened this month",
  privacy:
    "It's kept on this phone. If a family is connected, it travels encrypted and only parents see everything.",
};

export type PressureText = Text;
export const pressureText: Record<Locale, PressureText> = { es, en };
