/**
 * El motor de cocina de la cámara (S12 · ADR-018). Se pide con `import()` solo cuando quien cuida
 * confirma lo que tiene: trae el recetario (37 recetas) y las plantillas, que `/camara` no necesita
 * para abrir. Código primero: el modelo no escribe ninguna receta; esto coteja el recetario con la
 * despensa y, solo si nada sale, ofrece una plantilla de cocina que el plan ya revisó.
 */
import { RECIPES } from "@/lib/recipes/book";
import type { IngredientId } from "@/lib/recipes/catalog";
import {
  pantryPlan,
  reviewAll,
  type PantryResult,
  type ReviewInput,
} from "@/lib/recipes/review";
import { templateRecipes, type TemplateRecipe } from "@/lib/recipes/templates";

export type Cooked = {
  plan: PantryResult;
  /** Solo si NI «hazla ya» NI «con un cambio seguro» tienen receta. */
  templates: TemplateRecipe[];
};

export function cookFromPantry(
  pantry: ReadonlySet<IngredientId>,
  input: ReviewInput,
): Cooked {
  const reviewed = reviewAll(RECIPES, input);
  const plan = pantryPlan(reviewed.shown, pantry, input);
  const templates =
    plan.ready.length === 0 && plan.swap.length === 0
      ? templateRecipes(pantry, input)
      : [];
  return { plan, templates };
}
