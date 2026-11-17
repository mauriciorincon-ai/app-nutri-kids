/**
 * Escenarios especiales — cumpleaños, restaurante, emergencia y «le ofrecen algo que no
 * puede» (ADR-014, S9). Código primero: el motor junta lo que el plan YA dice (lo que no
 * puede, lo que sí, las medidas, las franjas, la ficha del perfil) y la pantalla lo
 * redacta con las plantillas de i18n (`t.scenarios`). Puro, sin red: se arma con el plan
 * guardado en el teléfono y por eso se abre sin señal.
 *
 * Jamás inventa un alimento ni da una indicación médica: si el plan no trae algo, el
 * campo queda vacío y la pantalla dice «tu plan no lo dice». Nada de contactos del niño
 * ni de la familia: a quién llamar sale del propio plan (quién lo escribió) y de los
 * servicios de emergencia de la zona, sin número inventado.
 */
import { isRestrictionActive, currentMealSlot } from "./logic";
import { fridgeKey } from "./plan-b";
import type { CaregiverNote } from "./answer";
import type { DietPlan, LocalizedText, Meal } from "./schema";

export const SCENARIO_IDS = [
  "birthday",
  "restaurant",
  "emergency",
  "offered",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type ScenarioAvoid = {
  name: LocalizedText;
  /** red = rojo fijo · restricted = restricción vigente del plan. */
  kind: "red" | "restricted";
  why?: LocalizedText;
};

export type ScenarioData = {
  id: ScenarioId;
  /** Lo que NO puede (rojos, restricciones vigentes y «además evitar»). */
  avoid: ScenarioAvoid[];
  /** Con medida (amarillo), tal como lo escribió el plan. */
  limits: { name: LocalizedText; limit: LocalizedText }[];
  /** Qué llevar o elegir: lo marcado «aguanta sin nevera» primero, luego verdes de cada grupo. */
  safe: { name: LocalizedText; keepsWithoutFridge: boolean }[];
  /** Aditivos que el plan pide evitar (código + nombre). */
  additives: { code: string; name: LocalizedText }[];
  /** Las franjas del día, ordenadas; `now` marca la que corre o la que sigue. */
  meals: Meal[];
  focusMeal: Meal | null;
  /** Ficha de la emergencia: lo que el plan y quien cuida anotaron, sin añadir nada. */
  card: {
    condition: LocalizedText | null;
    allergies: LocalizedText[];
    intolerances: LocalizedText[];
    medications: {
      name: LocalizedText;
      dose?: LocalizedText;
      when?: LocalizedText;
    }[];
    noted: LocalizedText[];
  } | null;
  /** Quién escribió el plan (a quien se le pregunta lo que el plan no dice). */
  professional: LocalizedText;
  alias: LocalizedText;
};

const SAFE_MAX = 8;

const noted = (
  notes: readonly CaregiverNote[],
  kinds: string[],
): LocalizedText[] =>
  notes
    .filter((n) => kinds.includes(n.kind))
    .map((n) => ({ es: n.text, en: n.text }));

export function buildScenario(
  id: ScenarioId,
  diet: DietPlan,
  now: Date,
  notes: readonly CaregiverNote[] = [],
): ScenarioData {
  const active = isRestrictionActive(diet, now);
  const avoid: ScenarioAvoid[] = [
    ...(active
      ? diet.restrictions.foods.map((f) => ({
          name: f.name,
          kind: "restricted" as const,
        }))
      : []),
    ...diet.trafficLight.red.items.map((i) => ({
      name: i.name,
      kind: "red" as const,
      why: i.why,
    })),
    ...diet.trafficLight.red.alsoAvoid.map((i) => ({
      name: i.name,
      kind: "red" as const,
    })),
  ];
  const blocked = new Set(avoid.map((a) => fridgeKey(a.name)));
  const marks = new Set(
    notes
      .filter((n) => n.kind === "fridge")
      .map((n) => n.text.trim().toLocaleLowerCase("es")),
  );

  // Verdes de cada grupo, nunca algo que hoy esté restringido o en rojo.
  const greens = diet.trafficLight.green.groups.flatMap((g) =>
    g.items
      .filter((i) => !blocked.has(fridgeKey(i.name)))
      .map((i) => ({
        name: i.name,
        keepsWithoutFridge:
          i.keepsWithoutFridge === true || marks.has(fridgeKey(i.name)),
      })),
  );
  const marked = greens.filter((g) => g.keepsWithoutFridge);
  const rest = greens.filter((g) => !g.keepsWithoutFridge);
  const safe = [...marked, ...rest].slice(0, SAFE_MAX);

  const meals = [...diet.dailyMenu].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const slot = currentMealSlot(diet, now);
  const focusMeal =
    slot === null
      ? null
      : slot.kind === "during"
        ? slot.meal
        : slot.kind === "after-last"
          ? null
          : slot.next;

  const p = diet.profile;
  const card =
    id === "emergency"
      ? {
          condition: p?.condition ?? null,
          allergies: (p?.allergies ?? []).map((a) => a.name),
          intolerances: (p?.intolerances ?? []).map((a) => a.name),
          medications: (p?.medications ?? []).map(({ name, dose, when }) => ({
            name,
            ...(dose ? { dose } : {}),
            ...(when ? { when } : {}),
          })),
          noted: noted(notes, ["allergy", "intolerance", "medication"]),
        }
      : null;

  return {
    id,
    avoid,
    limits: diet.trafficLight.yellow.items.map((i) => ({
      name: i.name,
      limit: i.limit,
    })),
    safe,
    additives: diet.trafficLight.red.additives.map((a) => ({
      code: a.code,
      name: a.name,
    })),
    meals,
    focusMeal,
    card,
    professional: diet.meta.source,
    alias: diet.meta.childAlias,
  };
}
