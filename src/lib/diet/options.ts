import { allItemIds, resolveItemStatus, type ItemStatus } from "./logic";
import { containsPhrase, matchItem, toTokens } from "./search";
import type { DietPlan, LocalizedText, Texture } from "./schema";
import { orderByTexture, type OrderedOption } from "./texture";

// ---------------------------------------------------------------------------
// Opciones del plan para un alimento
// ---------------------------------------------------------------------------

/** Una opción del plan, con su textura y si hoy cae en una que no acepta. */
export type OptionItem = OrderedOption;

export type Options = {
  /** De dónde salen: una equivalencia explícita del plan o su mismo grupo verde. */
  source: "equivalence" | "group";
  /** Ya ordenadas por textura (las que hoy no acepta, al final y marcadas). */
  items: OptionItem[];
  note?: LocalizedText;
};

/**
 * ¿Ese nombre es hoy una opción segura (verde, o un nombre que el plan no clasifica)? Además de
 * «el nombre contiene un alimento del plan», se mira al revés: si el nombre de la opción es
 * un pedazo del nombre de un rojo o de una restricción vigente («Gaseosas» frente a «Gaseosas
 * y jugos de caja»), tampoco es segura. Ante la duda, no se propone (plan B jamás sugiere un rojo).
 */
export function isSafeOption(
  diet: DietPlan,
  name: LocalizedText,
  now: Date,
): boolean {
  for (const locale of ["es", "en"] as const) {
    const hit = matchItem(diet, name[locale], locale, now);
    if (hit && hit.kind !== "green") return false;
    const opt = toTokens(name[locale], locale);
    if (opt.length === 0) continue;
    for (const id of allItemIds(diet)) {
      const st = resolveItemStatus(diet, id, now);
      if (!st) continue;
      const blocked =
        st.kind === "red" || (st.kind === "restricted" && st.restrictionActive);
      if (blocked && containsPhrase(toTokens(st.name[locale], locale), opt))
        return false;
    }
  }
  return true;
}

/**
 * Reemplazos que el plan da para un alimento; null si no hay ninguno. Nunca se
 * propone algo que HOY esté restringido o en rojo, aunque el plan lo liste o viva
 * en un grupo verde.
 */
export function planOptionsFor(
  status: ItemStatus,
  diet: DietPlan,
  now: Date,
  /** Texturas que quien cuida marcó como aceptadas hoy (vacío = orden del plan). */
  accepted: readonly Texture[] = [],
): Options | null {
  const eq = status.equivalences[0];
  if (eq) {
    const items = status.equivalences
      .flatMap((e) => e.use)
      .filter((u) => isSafeOption(diet, u.name, now));
    if (items.length > 0)
      return {
        source: "equivalence",
        items: orderByTexture(items, accepted),
        ...(eq.note ? { note: eq.note } : {}),
      };
  }
  if (status.kind === "green") {
    const items = status.group.items
      .filter((i) => i.id !== status.id)
      .filter((i) => resolveItemStatus(diet, i.id, now)?.kind === "green")
      .map((i) => ({ name: i.name }));
    if (items.length > 0)
      return { source: "group", items: orderByTexture(items, accepted) };
  }
  return null;
}
