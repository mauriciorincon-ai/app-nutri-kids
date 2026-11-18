import type { ThemePref } from "@/lib/diet/storage";

/**
 * Tema de la app (S11, ADR-016). Puro: decide el tema real y lo pone en el documento.
 * El mismo trabajo lo hace `THEME_SCRIPT` antes del primer pintado (sin destello) y
 * `ThemeSync` cuando cambia el ajuste o el teléfono.
 */

export type ResolvedTheme = "light" | "dark";

/** Los dos colores de la barra del navegador: son el `--background` de cada tema. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#faf7f0",
  dark: "#1a1511",
};

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  pref: ThemePref,
  systemDark: boolean,
): ResolvedTheme {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  return systemDark ? "dark" : "light";
}

/**
 * Pone `.dark`, `color-scheme` y el color de la barra. Con un tema elegido a mano las dos
 * etiquetas `theme-color` llevan el mismo color (la pregunta al sistema ya no manda); con
 * «Sistema» cada una conserva el suyo y el navegador elige. Con guardas: tocar `<html>` sin
 * cambio invalida estilos de toda la página (lección de `lang`, S2).
 */
export function applyTheme(
  doc: Document,
  pref: ThemePref,
  systemDark: boolean,
): ResolvedTheme {
  const theme = resolveTheme(pref, systemDark);
  const root = doc.documentElement;
  const dark = theme === "dark";
  // Qué ajuste se aplicó: `ThemeSync` lo lee para no cargar este módulo si ya está al día.
  if (root.dataset.themePref !== pref) root.dataset.themePref = pref;
  if (root.classList.contains("dark") !== dark) {
    root.classList.toggle("dark", dark);
  }
  if (root.style.colorScheme !== theme) root.style.colorScheme = theme;
  doc.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const own: ResolvedTheme = /dark/.test(meta.getAttribute("media") ?? "")
      ? "dark"
      : "light";
    const color = THEME_COLORS[pref === "system" ? own : theme];
    if (meta.getAttribute("content") !== color) {
      meta.setAttribute("content", color);
    }
  });
  return theme;
}
