import type { LocalizedText, Texture } from "./schema";

/** Símbolo de cada textura (el color nunca va solo: símbolo + texto + color). */
export const TEXTURE_SYMBOL: Record<Texture, string> = {
  liquid: "≈",
  puree: "◍",
  mashed: "◐",
  soft: "○",
  chopped: "▦",
  crunchy: "✦",
};

/**
 * Orden por textura (ADR-009, decisión 2 a del G-Plan del S5). Puro: recibe las
 * opciones del plan y las texturas que quien cuida marcó como aceptadas hoy.
 *
 * Orden: 1) textura aceptada · 2) sin textura en el plan (no se sabe: no se castiga)
 * · 3) textura que hoy NO acepta, marcada. Dentro de cada grupo se conserva el
 * orden del plan. NUNCA se oculta una opción ni se deja la lista vacía. Sin
 * texturas marcadas no hay nada que ordenar ni que marcar: queda el orden del plan.
 */
export type TextureOption = { name: LocalizedText; texture?: Texture };

export type OrderedOption<T extends TextureOption = TextureOption> = T & {
  /** true = el plan le da una textura que hoy no acepta (se muestra marcada). */
  notAccepted: boolean;
};

export function orderByTexture<T extends TextureOption>(
  options: readonly T[],
  accepted: readonly Texture[],
): OrderedOption<T>[] {
  if (accepted.length === 0)
    return options.map((o) => ({ ...o, notAccepted: false }));
  const rank = (o: T) =>
    !o.texture ? 1 : accepted.includes(o.texture) ? 0 : 2;
  return options
    .map((o, i) => ({ o, i, r: rank(o) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ o, r }) => ({ ...o, notAccepted: r === 2 }));
}
