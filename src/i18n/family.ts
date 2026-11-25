import type { NoKind } from "@/lib/family-learn/yes-no";

import type { Locale } from "./index";

/**
 * Textos de «Para la familia» (S14 · ADR-020): lecciones y «Qué sí y qué no». En su propio módulo
 * (los de «Cuando le ofrecen algo» van en `pressure.ts`): cada pantalla carga solo los suyos.
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
};

export type FamilyText = Text;
export const familyText: Record<Locale, FamilyText> = { es, en };
