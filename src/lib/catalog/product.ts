/**
 * Un producto del catálogo → el mismo cotejo que la foto (S13 · ADR-019). El texto de ingredientes
 * entra como texto; lo que el catálogo declara aparte (aditivos, alérgenos, trazas) SUMA, jamás
 * resta: una declaración vacía no vuelve apto un producto, y sin lista de ingredientes el resultado
 * es «no sé qué lleva» (toma foto de la etiqueta), nunca «no vi nada que choque».
 */
import type { DietPlan } from "@/lib/diet/schema";
import { checkLabel, type LabelCheck } from "@/lib/label/check";

import type { Product } from "./schema";

/**
 * Cómo se dice, en palabras de la vida diaria, cada alérgeno que Open Food Facts etiqueta. Lo que
 * no está aquí entra con sus propias palabras (`tree-nuts` → «tree nuts»): se sobra, nunca se falta.
 */
const ALLERGEN_WORDS: Readonly<Record<string, string>> = {
  milk: "leche lácteos milk dairy",
  eggs: "huevo huevos egg eggs",
  gluten: "gluten trigo wheat",
  soybeans: "soya soja soy",
  peanuts: "maní cacahuate peanut peanuts",
  nuts: "frutos secos nueces nuts",
  fish: "pescado fish",
  crustaceans: "crustáceos mariscos crustaceans shellfish",
  molluscs: "moluscos mariscos molluscs shellfish",
  "sesame-seeds": "ajonjolí sésamo sesame",
  celery: "apio celery",
  mustard: "mostaza mustard",
  lupin: "altramuz lupin",
  "sulphur-dioxide-and-sulphites": "sulfitos sulphites",
};

export const allergenWords = (tag: string): string =>
  ALLERGEN_WORDS[tag] ?? tag.replace(/-/g, " ");

export function checkProduct(
  product: Product,
  diet: DietPlan,
  now: Date,
  notes?: readonly { kind: string; text: string }[],
): LabelCheck {
  return checkLabel({
    text: product.ing,
    diet,
    now,
    notes,
    declared: {
      codes: product.add,
      contains: product.alg.map(allergenWords),
      traces: product.tr.map(allergenWords),
    },
  });
}
