import { expandAvoid } from "./allergen-families";
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

/** Lo que quien cuida anotó que NO puede (alergia o intolerancia): texto libre, tal cual lo escribió. */
export function avoidTexts(
  notes: readonly { kind: string; text: string }[],
): string[] {
  return notes
    .filter((n) => n.kind === "allergy" || n.kind === "intolerance")
    .map((n) => n.text);
}

/**
 * ¿Ese nombre choca con algo que quien cuida anotó como alergia o intolerancia? Se mira en los
 * dos sentidos («maní» frente a «crema de maní» y «frutos secos» frente a «nueces») y en los dos
 * idiomas. Ante la duda, no se propone: lo anotado por quien cuida es del mismo niño que el plan.
 */
export function avoidedByNotes(
  name: LocalizedText,
  avoid: readonly string[],
): boolean {
  for (const text of expandAvoid(avoid)) {
    for (const locale of ["es", "en"] as const) {
      const noted = toTokens(text, locale);
      if (noted.length === 0) continue;
      for (const side of ["es", "en"] as const) {
        const hay = toTokens(name[side], side);
        if (hay.length === 0) continue;
        if (containsPhrase(hay, noted) || containsPhrase(noted, hay))
          return true;
      }
    }
  }
  return false;
}

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
  avoid: readonly string[] = [],
): boolean {
  if (avoidedByNotes(name, avoid)) return false;
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
  /** Alergias e intolerancias anotadas por quien cuida (`avoidTexts`). */
  avoid: readonly string[] = [],
): Options | null {
  const eq = status.equivalences[0];
  if (eq) {
    const items = status.equivalences
      .flatMap((e) => e.use)
      .filter((u) => isSafeOption(diet, u.name, now, avoid));
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
      .filter((i) => !avoidedByNotes(i.name, avoid))
      .map((i) => ({ name: i.name }));
    if (items.length > 0)
      return { source: "group", items: orderByTexture(items, accepted) };
  }
  return null;
}
