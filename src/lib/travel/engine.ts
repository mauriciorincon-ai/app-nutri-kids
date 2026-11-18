/**
 * Modo viaje (S11 · ADR-017) — código primero, sin IA y sin red. Junta lo que el plan cargado y
 * lo anotado por quien cuida YA dicen: qué llevar que aguante sin nevera, los suplementos y
 * medicamentos tal como están escritos, qué evitar, las franjas del día y el documento médico
 * en español e inglés. No inventa un alimento, una hora ni una indicación; si el plan no trae
 * algo, la lista queda vacía y la pantalla lo dice. El nombre del niño solo sale si un padre lo
 * escribió. Puro: todo entra por parámetro; no lee storage ni red, y el texto que viene de
 * quien cuida pasa por `plain` (sin enlaces) porque el documento se imprime y se enseña.
 */
import type { CaregiverNote } from "@/lib/diet/answer";
import { dateKey } from "@/lib/diet/logic";
import type {
  DietPlan,
  LocalizedText,
  Meal,
  Supplement,
} from "@/lib/diet/schema";
import { buildScenario } from "@/lib/diet/scenarios";
import { lunchOptions } from "@/lib/lunchbox/engine";
import { plain } from "@/lib/lunchbox/label";

export const TRAVEL_MODES = ["road", "air"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Sin enlaces, pero sin cortar: una dosis o una alergia cortada a media palabra es peor que una larga. */
const clean = (t: LocalizedText): LocalizedText => ({
  es: plain(t.es),
  en: plain(t.en),
});

export type TravelMedication = {
  name: LocalizedText;
  dose?: LocalizedText;
  when?: LocalizedText;
};

/** El documento médico: solo datos que el plan o quien cuida escribieron. */
export type MedicalDoc = {
  date: string;
  /** Solo si un padre lo escribió para la etiqueta; si no, null y no sale ningún nombre. */
  name: string | null;
  condition: LocalizedText | null;
  allergies: LocalizedText[];
  intolerances: LocalizedText[];
  medications: TravelMedication[];
  /** Lo que no puede (rojos, restricciones vigentes, lo anotado). */
  avoid: LocalizedText[];
  supplements: {
    name: LocalizedText;
    dose: LocalizedText;
    when: LocalizedText;
  }[];
  /** Quién escribió el plan. */
  source: LocalizedText;
};

export type Travel = {
  mode: TravelMode;
  /** Lo que aguanta sin nevera (marca del plan o de quien cuida). Vacío = nada marcado. */
  foods: LocalizedText[];
  supplements: Supplement[];
  medications: TravelMedication[];
  avoid: LocalizedText[];
  /** Las franjas del día tal como las escribió el plan: sin horas inventadas. */
  slots: Meal[];
  doc: MedicalDoc;
};

export type TravelInput = {
  diet: DietPlan;
  now: Date;
  notes: readonly CaregiverNote[];
  mode: TravelMode;
  /** Escrito por un padre (almacén local); null = sin nombre. */
  childName: string | null;
};

const dedupe = (list: LocalizedText[]): LocalizedText[] => {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = `${t.es}|${t.en}`.toLowerCase();
    if (!t.es || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function buildTravel(input: TravelInput): Travel {
  const { diet, now, notes, mode, childName } = input;
  const s = buildScenario("emergency", diet, now, notes);
  const card = s.card!;
  const raw: TravelMedication[] = [
    ...card.medications,
    ...notedOf(notes, "medication").map((name) => ({ name })),
  ];
  const medications: TravelMedication[] = raw.map((m) => ({
    name: clean(m.name),
    ...(m.dose ? { dose: clean(m.dose) } : {}),
    ...(m.when ? { when: clean(m.when) } : {}),
  }));
  const avoid = dedupe(s.avoid.map((a) => clean(a.name)));
  const doc: MedicalDoc = {
    date: dateKey(now),
    name: childName ? plain(childName, 40) || null : null,
    condition: card.condition ? clean(card.condition) : null,
    allergies: dedupe(
      [...card.allergies, ...notedOf(notes, "allergy")].map(clean),
    ),
    intolerances: dedupe(
      [...card.intolerances, ...notedOf(notes, "intolerance")].map(clean),
    ),
    medications,
    avoid,
    supplements: diet.supplements.map((x) => ({
      name: clean(x.name),
      dose: clean(x.dose),
      when: clean(x.when),
    })),
    source: clean(s.professional),
  };
  // Los mismos candidatos y los mismos filtros que la lonchera (rojo, restricción, alergia,
  // intolerancia, marca de nevera del plan o de quien cuida), sin tope: la lista de viaje no
  // deja fuera nada que el plan ya dijo que aguanta.
  const packed = lunchOptions({ diet, now, notes });
  return {
    mode,
    foods: dedupe(
      packed.kind === "options" ? packed.items.map((i) => clean(i.name)) : [],
    ),
    supplements: diet.supplements,
    medications,
    avoid,
    slots: s.meals,
    doc,
  };
}

const notedOf = (
  notes: readonly CaregiverNote[],
  kind: string,
): LocalizedText[] =>
  notes.filter((n) => n.kind === kind).map((n) => ({ es: n.text, en: n.text }));
