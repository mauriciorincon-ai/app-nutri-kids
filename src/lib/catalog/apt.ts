/**
 * «Marcas aptas» (S13 · ADR-019): productos de la misma categoría que, con el plan de HOY, dan «no
 * vi nada que choque». Puro y en el teléfono. Solo cuenta un «ok»: nunca un «revisa», un «no» ni un
 * «no sé qué lleva». Un producto que no pasa el cotejo jamás sale como apto.
 */
import type { DietPlan } from "@/lib/diet/schema";

import { checkProduct } from "./product";
import type { Product } from "./schema";

export const APT_MAX = 5;
/** Cuántos niveles de categoría se sube, como mucho, si en la más específica no hay ninguno apto. */
const LEVELS_UP = 2;

/**
 * Las categorías de un producto, de la más específica a la más general. Se sube a lo sumo
 * `LEVELS_UP` niveles y nunca hasta la raíz («alimentos y bebidas»), que no dice nada.
 */
export function categoryChain(product: Pick<Product, "cat">): string[] {
  const cats = product.cat;
  if (cats.length <= 1) return [...cats];
  return cats
    .slice(1)
    .reverse()
    .slice(0, LEVELS_UP + 1);
}

export type Apt = { product: Product };

/**
 * De los candidatos, los que dan «ok» con el plan, sin el producto que se está mirando, ordenados
 * por marca y nombre (estable, sin favoritos) y recortados a `limit`.
 */
export function aptProducts(
  candidates: readonly Product[],
  diet: DietPlan,
  now: Date,
  options: {
    exclude?: string;
    limit?: number;
    notes?: readonly { kind: string; text: string }[];
  } = {},
): Product[] {
  const { exclude, limit = APT_MAX, notes } = options;
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of candidates) {
    if (p.code === exclude || seen.has(p.code)) continue;
    seen.add(p.code);
    if (checkProduct(p, diet, now, notes).verdict === "ok") out.push(p);
  }
  return out
    .sort(
      (a, b) =>
        a.brand.localeCompare(b.brand, "es") ||
        a.name.localeCompare(b.name, "es"),
    )
    .slice(0, limit);
}
