/**
 * La lista de compras de la semana (S11 · ADR-017): DERIVADA de lo que se puso en la lonchera de
 * hoy y de los próximos seis días; no hay una lista guardada que se desincronice entre teléfonos.
 * Cada alimento sale una vez, con los días que lo lleva. Solo nombres que el plan trae.
 */
import type { LocalizedText } from "@/lib/diet/schema";
import type { LunchState } from "@/lib/wellbeing/values";

export type ShoppingLine = { key: string; name: LocalizedText; days: number };

/** `week`: lo anotado de cada día (clave de alimento → estado). `names`: clave → nombre del plan. */
export function shoppingList(
  week: readonly { day: string; lunch: Record<string, LunchState> }[],
  names: ReadonlyMap<string, LocalizedText>,
): ShoppingLine[] {
  const count = new Map<string, number>();
  for (const { lunch } of week)
    for (const [key, state] of Object.entries(lunch))
      // «Puesta» es lo que se va a llevar; lo que ya se comió o volvió es de un día que pasó.
      if (state === "packed" && names.has(key))
        count.set(key, (count.get(key) ?? 0) + 1);
  return [...count]
    .map(([key, days]) => ({ key, name: names.get(key)!, days }))
    .sort((a, b) => b.days - a.days || (a.key < b.key ? -1 : 1));
}
