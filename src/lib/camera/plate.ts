/**
 * Mirar el plato (S12 · ADR-018). Lo que el modelo vio en una foto se lee contra el plan CARGADO:
 * el semáforo de cada alimento, un choque con una alergia o intolerancia, y qué grupos del plan le
 * faltan a esta comida. Todo lo decide el código; el modelo solo aportó nombres. Puro: la hora y lo
 * anotado por quien cuida entran por parámetro (jamás el reloj).
 *
 * Los grupos de cada comida NO viven en el schema (una comida solo trae su texto): se derivan de lo
 * que ese texto nombra (el grupo o cualquiera de sus alimentos). Si el texto no nombra ninguno, se
 * dice y no se inventa («tu plan no dice qué grupos lleva esta comida»).
 */
import { currentMealSlot, resolveItemStatus } from "@/lib/diet/logic";
import { avoidedByNotes } from "@/lib/diet/options";
import { containsPhrase, toTokens } from "@/lib/diet/search";
import type {
  DietPlan,
  GreenGroup,
  LocalizedText,
  Meal,
} from "@/lib/diet/schema";
import { avoidList } from "@/lib/lunchbox/engine";
import { INGREDIENTS } from "@/lib/recipes/catalog";
import { resolveIngredient } from "@/lib/recipes/review";

import type { Seen, SeenResult } from "./match";

/**
 * Cómo queda un alimento visto frente al plan. `allergy` es lo más fuerte (alergia o intolerancia
 * del perfil o anotada); `unknown` = el plan no lo nombra (jamás se muestra como verde).
 */
export type PlateState = "allergy" | "red" | "yellow" | "green" | "unknown";

const RANK: Record<PlateState, number> = {
  unknown: 0,
  green: 1,
  yellow: 2,
  red: 3,
  allergy: 4,
};

export type PlateFood = {
  label: string;
  state: PlateState;
  /** El nombre con el que el plan lo tiene (rojo, amarillo o verde). */
  planName?: LocalizedText;
  /** La medida del plan, si es amarillo. */
  limit?: LocalizedText;
  /** El grupo verde al que pertenece, si el plan lo trae. */
  groupId?: string;
};

export type Plate = {
  /** La comida que se está mirando (null si el plan no trae menú). */
  meal: Meal | null;
  foods: PlateFood[];
  /** Cosas que el modelo dijo, que no están en el catálogo y chocan con una alergia anotada. */
  allergyUnknown: string[];
  /** Los grupos que el texto de la comida nombra. Vacío = el plan no lo dice. */
  expected: GreenGroup[];
  /** De los esperados, los que NO se vieron en la foto. */
  missing: GreenGroup[];
};

/** La comida que se mira: la elegida, o la de la franja de ahora (la próxima si no hay una en curso). */
export function plateMeal(
  diet: DietPlan,
  now: Date,
  mealId?: string,
): Meal | null {
  if (mealId) {
    const m = diet.dailyMenu.find((x) => x.id === mealId);
    if (m) return m;
  }
  const slot = currentMealSlot(diet, now);
  if (!slot) return null;
  switch (slot.kind) {
    case "during":
      return slot.meal;
    case "before-first":
    case "between":
      return slot.next;
    case "after-last":
      return slot.prev;
  }
}

/** Los grupos verdes que el texto de una comida nombra (por el grupo o por uno de sus alimentos). */
export function mealGroups(diet: DietPlan, meal: Meal): GreenGroup[] {
  const hay = (["es", "en"] as const).map(
    (locale) => [locale, toTokens(meal.content[locale], locale)] as const,
  );
  const names = (n: LocalizedText) =>
    hay.some(([locale, tokens]) => {
      const need = toTokens(n[locale], locale);
      return need.length > 0 && containsPhrase(tokens, need);
    });
  return diet.trafficLight.green.groups.filter(
    (g) => names(g.name) || g.items.some((i) => names(i.name)),
  );
}

type Judged = Omit<PlateFood, "label">;

function judge(
  diet: DietPlan,
  seen: Seen,
  now: Date,
  avoid: readonly string[],
): Judged {
  if (avoidedByNotes({ es: seen.label, en: seen.label }, avoid))
    return { state: "allergy" };
  const out: Judged[] = [];
  if (seen.ingredient) {
    const s = resolveIngredient(diet, INGREDIENTS[seen.ingredient], now, avoid);
    if (s.kind === "blocked")
      out.push({
        state: s.why === "allergy" ? "allergy" : "red",
        planName: s.planName,
      });
    else if (s.kind === "caution") {
      const st = resolveItemStatus(diet, s.planId, now);
      out.push({
        state: "yellow",
        limit: s.limit,
        planName: st?.name,
      });
    } else if (s.kind === "ok" && s.via !== "staple") {
      const st = s.planId ? resolveItemStatus(diet, s.planId, now) : null;
      out.push({
        state: "green",
        planName: st?.name,
        groupId: st?.kind === "green" ? st.group.id : undefined,
      });
    } else out.push({ state: "unknown" });
  }
  for (const id of seen.planIds) {
    const st = resolveItemStatus(diet, id, now);
    if (!st) continue;
    if (st.kind === "restricted")
      out.push({
        state: st.restrictionActive ? "red" : "unknown",
        planName: st.name,
      });
    else if (st.kind === "red") out.push({ state: "red", planName: st.name });
    else if (st.kind === "yellow")
      out.push({ state: "yellow", planName: st.name, limit: st.limit });
    else out.push({ state: "green", planName: st.name, groupId: st.group.id });
  }
  if (out.length === 0) return { state: "unknown" };
  // Ante la duda manda el peor: un rojo o una alergia nunca se pierden detrás de un verde.
  return out.reduce((a, b) => (RANK[b.state] > RANK[a.state] ? b : a));
}

/**
 * Lee lo que el modelo vio en el plato. `seen` ya viene cotejado (`matchSeen`): lo que no cuadró con
 * nada solo se revisa contra las alergias anotadas y no se juzga de otra manera.
 */
export function readPlate(
  diet: DietPlan,
  seen: SeenResult,
  now: Date,
  notes: readonly { kind: string; text: string }[],
  mealId?: string,
): Plate {
  const avoid = avoidList(diet, notes);
  const meal = plateMeal(diet, now, mealId);
  const foods: PlateFood[] = seen.known.map((k) => ({
    label: k.label,
    ...judge(diet, k, now, avoid),
  }));
  const allergyUnknown = seen.unknown.filter((u) =>
    avoidedByNotes({ es: u, en: u }, avoid),
  );
  const expected = meal ? mealGroups(diet, meal) : [];
  const present = new Set(foods.map((f) => f.groupId).filter(Boolean));
  const missing = expected.filter((g) => !present.has(g.id));
  return { meal, foods, allergyUnknown, expected, missing };
}
