import { z } from "zod";

/**
 * El catálogo de productos de Colombia (S13 · ADR-019): dato PÚBLICO de Open Food Facts, bajo la
 * licencia ODbL-1.0, que el teléfono baja una vez. Jamás lleva nada de un plan ni de la familia.
 * Cada producto que el worker devuelve pasa por este schema antes del cotejo: si viene mal formado,
 * el resultado es «no sé qué lleva» y la foto de la etiqueta, nunca un «apto».
 */
export const productSchema = z.object({
  code: z.string().regex(/^(?:\d{8}|\d{12}|\d{13})$/),
  name: z.string().min(1).max(160),
  brand: z.string().max(80),
  /** Categorías, de la más general a la más específica (sin el prefijo de idioma). */
  cat: z.array(z.string().max(80)).max(12),
  /** El texto de ingredientes ya limpio; vacío si el catálogo no lo trae o venía con ruido. */
  ing: z.string().max(2000),
  /** Aditivos declarados, por código (`E102`). */
  add: z.array(z.string().regex(/^E\d{3,4}[A-Z]?$/)).max(60),
  /** Alérgenos y trazas declarados (`milk`, `gluten`…). */
  alg: z.array(z.string().max(60)).max(40),
  tr: z.array(z.string().max(60)).max(40),
});
export type Product = z.infer<typeof productSchema>;

export const catalogMetaSchema = z.object({
  generated: z.string().max(40),
  license: z.literal("ODbL-1.0"),
  source: z.string().max(200),
  count: z.number().int().nonnegative(),
});
export type CatalogMeta = z.infer<typeof catalogMetaSchema>;
