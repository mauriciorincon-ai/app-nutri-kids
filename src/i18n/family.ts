import type { Answer, Place } from "@/lib/pressure/values";
import type { NoKind } from "@/lib/family-learn/yes-no";
import type { OfferKind } from "@/lib/pressure/offer";

import type { Locale } from "./index";

/**
 * Textos de «Para la familia» y «Cuando le ofrecen algo» (S14 · ADR-020), en su propio módulo.
 * Redactados en cada idioma; paridad y frases vetadas por test (`tests/unit/family-learn.test.ts`).
 * Sin cifras, sin culpa, sin alarma y sin indicación médica: lo que se ofrece sale del plan.
 */

type Text = {
  title: string;
  lead: string;
  lessonsTitle: string;
  lessonsLead: string;
  sayTitle: string;
  sourcesTitle: string;
  yesNoTitle: string;
  yesNoLead: string;
  noTitle: string;
  noNone: string;
  kinds: Record<NoKind, string>;
  additivesTitle: string;
  additivesNote: string;
  askTitle: string;
  askNote: string;
  yesTitle: string;
  askProfessional: string;
  notMedical: string;
  pressureLink: string;
  pressureLinkLead: string;
  // «Cuando le ofrecen algo»
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
  title: "Para la familia",
  lead: "Lo que ayuda a quien lo cuida: lecturas cortas y una hoja con lo que sí y lo que no, sacada de su plan.",
  lessonsTitle: "Lo que ayuda en la mesa",
  lessonsLead:
    "Cinco lecturas cortas. Cada una se lee en menos de dos minutos y dice de dónde sale.",
  sayTitle: "Puedes decir",
  sourcesTitle: "De dónde sale",
  yesNoTitle: "Qué sí y qué no",
  yesNoLead:
    "Armada con el plan de {alias} que está en este teléfono. Muéstrala a quien lo cuide hoy.",
  noTitle: "No puede",
  noNone: "El plan no pide evitar nada.",
  kinds: {
    red: "Evitar",
    restricted: "Evitar en estas fechas",
    allergy: "Alergia",
    intolerance: "Intolerancia",
    noted: "Lo anotó quien lo cuida",
  },
  additivesTitle: "En las etiquetas, evitar",
  additivesNote: "Es el nombre que aparece en la lista de ingredientes.",
  askTitle: "Con condición",
  askNote:
    "Pregúntale a quien lo cuida antes de darlo: el plan dice cuándo y cómo.",
  yesTitle: "Sí puede",
  askProfessional:
    "Si algo no está en esta hoja, no lo des sin preguntar. Quien lo cuida lo consulta con {professional}.",
  notMedical:
    "Esto acompaña el plan de su profesional y no lo reemplaza: no es una indicación médica.",
  pressureLink: "Cuando le ofrecen algo",
  pressureLinkLead: "Anótalo en un momento y mira qué decir la próxima vez.",
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
  title: "For the family",
  lead: "What helps whoever is looking after your child: short reads and a sheet of what yes and what no, taken from the plan.",
  lessonsTitle: "What helps at the table",
  lessonsLead:
    "Five short reads. Each takes under two minutes and says where it comes from.",
  sayTitle: "You can say",
  sourcesTitle: "Where it comes from",
  yesNoTitle: "What yes and what no",
  yesNoLead:
    "Built from {alias}'s plan on this phone. Show it to whoever is looking after them today.",
  noTitle: "Can't have",
  noNone: "The plan doesn't ask to avoid anything.",
  kinds: {
    red: "Avoid",
    restricted: "Avoid on these dates",
    allergy: "Allergy",
    intolerance: "Intolerance",
    noted: "Noted by the caregiver",
  },
  additivesTitle: "On labels, avoid",
  additivesNote: "That's the name it has in the ingredient list.",
  askTitle: "With a condition",
  askNote:
    "Ask the main caregiver before giving it: the plan says when and how.",
  yesTitle: "Can have",
  askProfessional:
    "If something isn't on this sheet, don't give it without asking. The main caregiver checks with {professional}.",
  notMedical:
    "This goes along with the professional's plan and doesn't replace it: it isn't medical advice.",
  pressureLink: "When they're offered something",
  pressureLinkLead: "Note it in a moment and see what to say next time.",
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

export type FamilyText = Text;
export const familyText: Record<Locale, FamilyText> = { es, en };
