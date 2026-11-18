"use client";

import { useEffect } from "react";

import { loadPrefs } from "@/lib/diet/storage";
import { useLocalStore } from "@/lib/local-store";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Mantiene el tema al día cuando cambia el ajuste o, con «Sistema», cuando el teléfono pasa
 * de claro a oscuro. El primer pintado ya lo resolvió `THEME_SCRIPT` (sin destello): por eso
 * aquí solo se carga `@/lib/theme` cuando algo cambió de verdad, y no pesa en la primera carga
 * de ninguna pantalla (el presupuesto de script de /ajustes está a décimas del tope).
 */
export function ThemeSync() {
  const pref = useLocalStore(() => loadPrefs().theme, "system");

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const root = document.documentElement;
    let live = true;
    const sync = () => {
      const dark = pref === "dark" || (pref === "system" && query.matches);
      if (
        root.dataset.themePref === pref &&
        root.classList.contains("dark") === dark
      ) {
        return;
      }
      void import("@/lib/theme").then(({ applyTheme }) => {
        if (live) applyTheme(document, pref, query.matches);
      });
    };
    sync();
    if (pref !== "system") return () => void (live = false);
    query.addEventListener("change", sync);
    return () => {
      live = false;
      query.removeEventListener("change", sync);
    };
  }, [pref]);

  return null;
}
