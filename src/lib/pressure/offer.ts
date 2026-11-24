import type { DietPlan, LocalizedText } from "@/lib/diet/schema";

import { OUTSIDE_PLAN } from "./values";

/**
 * Qué se puede anotar como «lo que le ofrecieron» (S14 · ADR-020): solo lo que el plan cargado
 * pide evitar o da con condición, por su id, y «algo fuera del plan». Puro. Así la anotación
 * guarda un id del plan y nunca texto libre.
 */

export type OfferKind = "red" | "restricted" | "yellow";
export type Offerable = { id: string; name: LocalizedText; kind: OfferKind };

export function offerables(diet: DietPlan): Offerable[] {
  const seen = new Set<string>();
  const out: Offerable[] = [];
  const add = (id: string, name: LocalizedText, kind: OfferKind) => {
    if (id === OUTSIDE_PLAN || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name, kind });
  };
  for (const f of diet.restrictions.foods) add(f.id, f.name, "restricted");
  for (const i of diet.trafficLight.red.items) add(i.id, i.name, "red");
  for (const i of diet.trafficLight.red.alsoAvoid) add(i.id, i.name, "red");
  for (const i of diet.trafficLight.yellow.items) add(i.id, i.name, "yellow");
  return out;
}

/** El nombre de lo anotado; null si es «fuera del plan» o el plan ya no lo trae. */
export function offeredName(
  diet: DietPlan,
  what: string,
): LocalizedText | null {
  if (what === OUTSIDE_PLAN) return null;
  return offerables(diet).find((o) => o.id === what)?.name ?? null;
}
