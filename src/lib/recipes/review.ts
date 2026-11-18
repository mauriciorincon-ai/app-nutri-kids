/**
 * Revisión de recetas contra el plan (S11 · ADR-017) — código primero, sin IA. Cada ingrediente
 * se coteja con el plan CARGADO por nombre y se clasifica; la receta toma el peor estado de sus
 * ingredientes. Un rojo, una restricción vigente o una alergia la OCULTAN y dicen cuál; un
 * amarillo la marca con su medida; lo que el plan no trae queda «no está en tu plan» (jamás
 * verde); una textura que hoy no acepta la marca (no la oculta: depende de cómo se cocine).
 * «Con lo que tengo» ordena lo que se puede hacer ya y lo que sale con un reemplazo que SOLO
 * puede venir de las equivalencias del plan. Puro: la fecha y todo lo anotado entran por parámetro.
 */
import { resolveItemStatus, allItemIds } from "@/lib/diet/logic";
import { avoidedByNotes, isSafeOption } from "@/lib/diet/options";
import { containsPhrase, toTokens } from "@/lib/diet/search";
import type { DietPlan, LocalizedText, Texture } from "@/lib/diet/schema";
import { orderByTexture } from "@/lib/diet/texture";
import { avoidList } from "@/lib/lunchbox/engine";
import { foodIdsAnnotated, summarizeFood } from "@/lib/wellbeing/acceptance";
import type { DayWellbeing } from "@/lib/diet/day-log";

import {
  timeLevel,
  type Cost,
  type Recipe,
  type RecipeIngredient,
  type TimeLevel,
} from "./book";
import { INGREDIENTS, type Ingredient, type IngredientId } from "./catalog";

// --- Un ingrediente contra el plan -------------------------------------------------------------

export type BlockReason = "red" | "restricted" | "allergy";

export type IngredientStatus =
  | {
      kind: "ok";
      via: "plan" | "equivalence" | "staple";
      /** Id del alimento del plan (si salió de sus listas). */
      planId?: string;
    }
  | { kind: "caution"; limit: LocalizedText; planId: string }
  | { kind: "blocked"; why: BlockReason; planName?: LocalizedText }
  | { kind: "unknown" };

const SEVERITY = { green: 0, yellow: 1, red: 2 } as const;

/** Las formas de decir un ingrediente, como listas de palabras (es, en y las otras). */
function forms(ing: Ingredient): string[][] {
  return [ing.es, ing.en, ...(ing.alt ?? [])]
    .map((f) => toTokens(f, "es"))
    .filter((t) => t.length > 0);
}

/** 2 = igual · 1 = una contiene a la otra · 0 = nada que ver. */
function overlap(a: string[], b: string[]): 0 | 1 | 2 {
  if (a.length === b.length && a.every((x, i) => x === b[i])) return 2;
  return containsPhrase(a, b) || containsPhrase(b, a) ? 1 : 0;
}

/** El mejor cotejo de un nombre del plan (en los dos idiomas) con las formas del ingrediente. */
function matchLevel(ing: string[][], name: LocalizedText): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  for (const locale of ["es", "en"] as const) {
    const planTokens = toTokens(name[locale], locale);
    if (planTokens.length === 0) continue;
    for (const f of ing)
      best = Math.max(best, overlap(f, planTokens)) as 0 | 1 | 2;
  }
  return best;
}

export function resolveIngredient(
  diet: DietPlan,
  ing: Ingredient,
  now: Date,
  avoid: readonly string[],
): IngredientStatus {
  // 1 · Alergia o intolerancia (la del plan y la que anotó quien cuida): manda sobre todo.
  for (const f of [ing.es, ing.en, ...(ing.alt ?? [])])
    if (avoidedByNotes({ es: f, en: f }, avoid))
      return { kind: "blocked", why: "allergy" };

  // 2 · Los alimentos del plan. Un cotejo exacto vale solo; si no, todos los parciales y gana el peor
  // («ante la duda, no se propone»).
  const tokens = forms(ing);
  type Hit = {
    level: 1 | 2;
    id: string;
    status: NonNullable<ReturnType<typeof resolveItemStatus>>;
  };
  const hits: Hit[] = [];
  for (const id of allItemIds(diet)) {
    const status = resolveItemStatus(diet, id, now);
    if (!status) continue;
    const level = matchLevel(tokens, status.name);
    if (level) hits.push({ level, id, status });
  }
  const exact = hits.filter((h) => h.level === 2);
  const pool = exact.length ? exact : hits;
  if (pool.length) {
    const colored = pool.map((h) => {
      const s = h.status;
      // Una restricción vencida deja de mandar (igual que en el plan B).
      const blocked =
        s.kind === "red" || (s.kind === "restricted" && s.restrictionActive);
      return {
        h,
        rank: blocked ? 2 : SEVERITY[s.color === "red" ? "green" : s.color],
      };
    });
    const worst = colored.reduce((a, b) => (b.rank > a.rank ? b : a));
    const s = worst.h.status;
    if (worst.rank === 2)
      return {
        kind: "blocked",
        why: s.kind === "restricted" ? "restricted" : "red",
        planName: s.name,
      };
    if (s.kind === "yellow")
      return { kind: "caution", limit: s.limit, planId: worst.h.id };
    return { kind: "ok", via: "plan", planId: worst.h.id };
  }

  // 3 · Una opción de las equivalencias del plan: el plan ya la nombra como alternativa.
  for (const eq of diet.equivalences)
    for (const u of eq.use)
      if (matchLevel(tokens, u.name) === 2)
        return isSafeOption(diet, u.name, now, avoid)
          ? { kind: "ok", via: "equivalence" }
          : { kind: "blocked", why: "red", planName: u.name };

  // 4 · Un básico de despensa que el plan no menciona no estorba; cualquier otro, no se sabe.
  return ing.staple ? { kind: "ok", via: "staple" } : { kind: "unknown" };
}

// --- Una receta contra el plan -----------------------------------------------------------------

export type Blocker = {
  ingredient: IngredientId;
  why: BlockReason;
  /** El nombre con el que el plan lo tiene (si lo tiene). */
  planName?: LocalizedText;
};

export type RecipeState = "ok" | "caution" | "unknown" | "blocked";

export type ReviewedRecipe = {
  recipe: Recipe;
  state: RecipeState;
  blockers: Blocker[];
  cautions: { ingredient: IngredientId; limit: LocalizedText }[];
  unknown: IngredientId[];
  /** El plan trae el ingrediente por este id (para «lo que le gusta»). */
  planIds: Partial<Record<IngredientId, string>>;
  /** true = la textura con la que queda hoy no la acepta (se marca, no se oculta). */
  textureNotAccepted: boolean;
};

export type ReviewInput = {
  diet: DietPlan;
  now: Date;
  notes: readonly { kind: string; text: string }[];
  accepted?: readonly Texture[];
};

/** Lo que varias recetas comparten en una misma revisión: lo que se evita y lo ya resuelto por ingrediente. */
type Shared = {
  avoid: string[];
  resolved: Map<IngredientId, IngredientStatus>;
};

export function reviewRecipe(
  r: Recipe,
  input: ReviewInput,
  shared?: Shared,
): ReviewedRecipe {
  const avoid = shared?.avoid ?? avoidList(input.diet, input.notes);
  const out: ReviewedRecipe = {
    recipe: r,
    state: "ok",
    blockers: [],
    cautions: [],
    unknown: [],
    planIds: {},
    textureNotAccepted: false,
  };
  for (const { id } of r.ingredients) {
    // Un mismo ingrediente sale en muchas recetas: se coteja con el plan una sola vez por revisión.
    let s = shared?.resolved.get(id);
    if (!s) {
      s = resolveIngredient(input.diet, INGREDIENTS[id], input.now, avoid);
      shared?.resolved.set(id, s);
    }
    if (s.kind === "blocked")
      out.blockers.push({ ingredient: id, why: s.why, planName: s.planName });
    else if (s.kind === "caution") {
      out.cautions.push({ ingredient: id, limit: s.limit });
      out.planIds[id] = s.planId;
    } else if (s.kind === "unknown") out.unknown.push(id);
    else if (s.via === "plan" && s.planId) out.planIds[id] = s.planId;
  }
  const accepted = input.accepted ?? [];
  out.textureNotAccepted =
    !!r.texture && accepted.length > 0 && !accepted.includes(r.texture);
  out.state = out.blockers.length
    ? "blocked"
    : out.unknown.length
      ? "unknown"
      : out.cautions.length
        ? "caution"
        : "ok";
  return out;
}

export type Reviewed = { shown: ReviewedRecipe[]; hidden: ReviewedRecipe[] };

const RANK: Record<RecipeState, number> = {
  ok: 0,
  caution: 1,
  unknown: 2,
  blocked: 3,
};

export function reviewAll(
  recipes: readonly Recipe[],
  input: ReviewInput,
): Reviewed {
  const shared: Shared = {
    avoid: avoidList(input.diet, input.notes),
    resolved: new Map(),
  };
  const all = recipes.map((r) => reviewRecipe(r, input, shared));
  return {
    shown: all.filter((r) => r.state !== "blocked"),
    hidden: all.filter((r) => r.state === "blocked"),
  };
}

// --- Filtros: tiempo, costo y lo que le gusta (S10) -------------------------------------------

export type Filters = {
  time?: TimeLevel | null;
  cost?: Cost | null;
  /** Solo recetas con algún alimento que la última vez le gustó o aceptó. */
  liked?: boolean;
};

/** Los alimentos cuyo último veredicto fue «le gustó» o «lo aceptó» (S10), para el filtro «lo que le gusta». */
export function likedFoodIds(
  days: { day: string; wellbeing: DayWellbeing }[],
): Set<string> {
  const out = new Set<string>();
  for (const id of foodIdsAnnotated(days)) {
    const v = summarizeFood(days, id).lastVerdict;
    if (v === "loves" || v === "accepts") out.add(id);
  }
  return out;
}

export function filterRecipes(
  list: readonly ReviewedRecipe[],
  f: Filters,
  likedPlanIds: ReadonlySet<string> = new Set(),
): ReviewedRecipe[] {
  return list.filter((r) => {
    if (f.time && timeLevel(r.recipe.minutes) !== f.time) return false;
    if (f.cost && r.recipe.cost !== f.cost) return false;
    if (f.liked && !Object.values(r.planIds).some((id) => likedPlanIds.has(id)))
      return false;
    return true;
  });
}

// --- «¿Qué cocino con lo que tengo?» ----------------------------------------------------------

export type Swap = {
  from: IngredientId;
  to: IngredientId;
  /** El nombre con el que el plan trae el reemplazo. */
  planName: LocalizedText;
};

export type PantryRecipe = ReviewedRecipe & {
  missing: IngredientId[];
  swaps: Swap[];
};

export type PantryResult = {
  /** Se puede hacer ya, con lo que hay. */
  ready: PantryRecipe[];
  /** Se puede hacer cambiando algo por un reemplazo que el plan da. */
  swap: PantryRecipe[];
  /** Faltan una o dos cosas (sin reemplazo). */
  almost: PantryRecipe[];
};

/** Los ingredientes del catálogo que un nombre del plan designa (para ver si están en la despensa). */
function catalogFor(name: LocalizedText): IngredientId[] {
  return (Object.keys(INGREDIENTS) as IngredientId[]).filter(
    (id) => matchLevel(forms(INGREDIENTS[id]), name) === 2,
  );
}

const required = (i: RecipeIngredient) =>
  !i.optional && !INGREDIENTS[i.id].staple;

export function pantryPlan(
  shown: readonly ReviewedRecipe[],
  pantry: ReadonlySet<IngredientId>,
  input: ReviewInput,
): PantryResult {
  const { diet, now } = input;
  const avoid = avoidList(diet, input.notes);
  const accepted = input.accepted ?? [];
  const out: PantryResult = { ready: [], swap: [], almost: [] };

  const swapFor = (
    id: IngredientId,
    planId: string | undefined,
  ): Swap | null => {
    if (!planId) return null;
    // SOLO las equivalencias que el plan escribió para ese alimento, ya seguras y por textura.
    for (const eq of diet.equivalences.filter(
      (e) => e.whenMissing === planId,
    )) {
      const options = orderByTexture(
        eq.use.filter((u) => isSafeOption(diet, u.name, now, avoid)),
        accepted,
      ).filter((o) => !o.notAccepted);
      for (const o of options)
        for (const to of catalogFor(o.name))
          if (to !== id && pantry.has(to))
            return { from: id, to, planName: o.name };
    }
    return null;
  };

  for (const rev of shown) {
    const missing: IngredientId[] = [];
    const swaps: Swap[] = [];
    for (const ing of rev.recipe.ingredients.filter(required)) {
      if (pantry.has(ing.id)) continue;
      const sw = swapFor(ing.id, rev.planIds[ing.id]);
      if (sw) swaps.push(sw);
      else missing.push(ing.id);
    }
    const row: PantryRecipe = { ...rev, missing, swaps };
    if (missing.length === 0 && swaps.length === 0) out.ready.push(row);
    else if (missing.length === 0) out.swap.push(row);
    else if (missing.length <= 2) out.almost.push(row);
  }
  const byState = (a: PantryRecipe, b: PantryRecipe) =>
    RANK[a.state] - RANK[b.state];
  out.ready.sort(byState);
  out.swap.sort((a, b) => a.swaps.length - b.swaps.length || byState(a, b));
  out.almost.sort(
    (a, b) => a.missing.length - b.missing.length || byState(a, b),
  );
  return out;
}

// --- Recetas propias (S11): ingredientes en texto libre, el mismo cotejo con el plan ------------

export type OwnReview = {
  state: RecipeState;
  blocked: { text: string; why: BlockReason; planName?: LocalizedText }[];
  cautions: { text: string; limit: LocalizedText }[];
  unknown: string[];
};

/**
 * Cada línea es un ingrediente escrito por quien cuida: se coteja por nombre como los del
 * recetario. Lo que el plan no nombra queda «no está en tu plan» (jamás verde).
 */
export function reviewOwn(
  own: { ingredients: readonly string[] },
  input: ReviewInput,
): OwnReview {
  const avoid = avoidList(input.diet, input.notes);
  const out: OwnReview = {
    state: "ok",
    blocked: [],
    cautions: [],
    unknown: [],
  };
  for (const text of own.ingredients) {
    const s = resolveIngredient(
      input.diet,
      { es: text, en: text },
      input.now,
      avoid,
    );
    if (s.kind === "blocked")
      out.blocked.push({ text, why: s.why, planName: s.planName });
    else if (s.kind === "caution") out.cautions.push({ text, limit: s.limit });
    else if (s.kind === "unknown") out.unknown.push(text);
  }
  out.state = out.blocked.length
    ? "blocked"
    : out.unknown.length
      ? "unknown"
      : out.cautions.length
        ? "caution"
        : "ok";
  return out;
}
