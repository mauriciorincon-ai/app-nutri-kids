import type { Locale } from "../index";

/**
 * Textos de el modo viaje (incluye el documento, que sale SIEMPRE en los dos idiomas) (S11 · ADR-017), en su propio módulo para que cada pantalla cargue solo los suyos
 * y el bundle compartido no crezca. Redactados en cada idioma (no traducidos); paridad por test.
 */

const es = {
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
};

const en: typeof es = {
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
  docPrintHint: "It opens your phone's print dialog; nothing is sent anywhere.",
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
};

export type TravelText = typeof es;
export const travelText: Record<Locale, TravelText> = { es, en };
