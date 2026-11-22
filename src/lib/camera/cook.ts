/**
 * El motor de cocina de la cámara (S12 · ADR-018). Se pide con `import()` solo cuando quien cuida
 * confirma lo que tiene: trae el recetario (37 recetas) y las plantillas, que `/camara` no necesita
 * para abrir. Código primero: el modelo no escribe ninguna receta; esto coteja el recetario con la
 * despensa y, solo si nada sale, ofrece una plantilla de cocina que el plan ya revisó.
 */
import { avoidList } from "@/lib/lunchbox/engine";
import { RECIPES } from "@/lib/recipes/book";
import { INGREDIENTS, type IngredientId } from "@/lib/recipes/catalog";
import {
  pantryPlan,
  resolveIngredient,
  reviewAll,
  type PantryResult,
  type ReviewInput,
} from "@/lib/recipes/review";
import { templateRecipes, type TemplateRecipe } from "@/lib/recipes/templates";

export type Cooked = {
  plan: PantryResult;
  /** Solo si NI «hazla ya» NI «con un cambio seguro» tienen receta (que la textura de hoy deje hacer). */
  templates: TemplateRecipe[];
  /** Lo de la despensa que el plan evita o que choca con lo anotado: no entra a ninguna receta. */
  avoided: { id: IngredientId; allergy: boolean }[];
};

export function cookFromPantry(
  pantry: ReadonlySet<IngredientId>,
  input: ReviewInput,
): Cooked {
  const reviewed = reviewAll(RECIPES, input);
  const raw = pantryPlan(reviewed.shown, pantry, input);
  // «Casi» solo con recetas que de verdad usan algo de lo que hay: nunca una lista de todo el recetario
  // a la que solo le falta un ingrediente suelto. Las que más comparten, primero.
  const shares = (r: (typeof raw.almost)[number]) =>
    r.recipe.ingredients.filter(
      (i) => !INGREDIENTS[i.id].staple && pantry.has(i.id),
    ).length;
  const plan: PantryResult = {
    ...raw,
    almost: raw.almost
      .filter((r) => shares(r) > 0)
      .sort(
        (a, b) => shares(b) - shares(a) || a.missing.length - b.missing.length,
      ),
  };
  // Una receta lista o con reemplazo que hoy no acepta su textura no frena las ideas del código.
  const usable = [...plan.ready, ...plan.swap].filter(
    (r) => !r.textureNotAccepted,
  );
  const templates = usable.length === 0 ? templateRecipes(pantry, input) : [];
  const avoid = avoidList(input.diet, input.notes);
  const avoided = [...pantry].flatMap((id) => {
    const s = resolveIngredient(input.diet, INGREDIENTS[id], input.now, avoid);
    return s.kind === "blocked" ? [{ id, allergy: s.why === "allergy" }] : [];
  });
  return { plan, templates, avoided };
}
