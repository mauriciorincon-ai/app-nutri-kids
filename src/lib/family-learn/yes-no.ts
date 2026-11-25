import { isRestrictionActive } from "@/lib/diet/logic";
import { avoidedByNotes, avoidTexts } from "@/lib/diet/options";
import type { CaregiverNote } from "@/lib/diet/answer";
import type { DietPlan, LocalizedText } from "@/lib/diet/schema";

/**
 * «Qué sí y qué no» (S14 · ADR-020): la hoja para el familiar, armada SOLO con el plan cargado y lo
 * que quien cuida anotó. Puro y sin red. No inventa alimentos ni da indicaciones: lo con condición
 * se nombra sin su medida (esa la decide quien cuida, que tiene el plan), así la hoja no lleva
 * cifras. Lo que se evita va primero; lo que sí, por los grupos del plan.
 */

export type NoKind = "red" | "restricted" | "allergy" | "intolerance" | "noted";

export type YesNo = {
  /** Lo que no puede: restricciones vigentes, rojos, «además evitar», alergias e intolerancias. */
  no: { name: LocalizedText; kind: NoKind }[];
  /** Aditivos que el plan pide evitar (el código es su nombre en la etiqueta, no una cantidad). */
  additives: { code: string; name: LocalizedText }[];
  /** Con condición: el nombre, sin la medida. */
  ask: LocalizedText[];
  /** Lo que sí, por los grupos del plan, sin nada que hoy se evite. */
  yes: { group: LocalizedText; items: LocalizedText[] }[];
  professional: LocalizedText;
  alias: LocalizedText;
};

const key = (t: LocalizedText) => t.es.trim().toLocaleLowerCase("es");

export function familyYesNo(
  diet: DietPlan,
  now: Date,
  notes: readonly CaregiverNote[] = [],
): YesNo {
  const seen = new Set<string>();
  const no: YesNo["no"] = [];
  const add = (name: LocalizedText, kind: NoKind) => {
    const k = key(name);
    if (seen.has(k)) return;
    seen.add(k);
    no.push({ name, kind });
  };

  if (isRestrictionActive(diet, now))
    for (const f of diet.restrictions.foods) add(f.name, "restricted");
  for (const i of diet.trafficLight.red.items) add(i.name, "red");
  for (const i of diet.trafficLight.red.alsoAvoid) add(i.name, "red");
  for (const a of diet.profile?.allergies ?? []) add(a.name, "allergy");
  for (const a of diet.profile?.intolerances ?? []) add(a.name, "intolerance");
  const noted = avoidTexts(notes);
  for (const text of noted) add({ es: text, en: text }, "noted");

  const ask = diet.trafficLight.yellow.items
    .map((i) => i.name)
    .filter((n) => !seen.has(key(n)) && !avoidedByNotes(n, noted));

  const yes = diet.trafficLight.green.groups
    .map((g) => ({
      group: g.name,
      items: g.items
        .map((i) => i.name)
        .filter((n) => !seen.has(key(n)) && !avoidedByNotes(n, noted)),
    }))
    .filter((g) => g.items.length > 0);

  return {
    no,
    additives: diet.trafficLight.red.additives.map((a) => ({
      code: a.code,
      name: a.name,
    })),
    ask,
    yes,
    professional: diet.meta.source,
    alias: diet.meta.childAlias,
  };
}
