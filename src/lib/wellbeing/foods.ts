import type { DietPlan, LocalizedText } from "@/lib/diet/schema";

/**
 * Los alimentos que se pueden anotar en la bitácora de aceptación: los del plan que SÍ se
 * ofrecen (verdes y amarillos). Los rojos y los restringidos no se ofrecen, así que no se
 * anotan. Puro: sale solo del plan cargado.
 */
export type AcceptableFood = { id: string; name: LocalizedText };

export function acceptableFoods(diet: DietPlan): AcceptableFood[] {
  const seen = new Set<string>();
  const out: AcceptableFood[] = [];
  const add = (item: AcceptableFood) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push({ id: item.id, name: item.name });
  };
  for (const g of diet.trafficLight.green.groups) g.items.forEach(add);
  diet.trafficLight.yellow.items.forEach(add);
  return out;
}
