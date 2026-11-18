"use client";

import { useEffect } from "react";

import { loadPrefs } from "@/lib/diet/storage";
import { useLocalStore } from "@/lib/local-store";
import { applyTheme, DARK_QUERY } from "@/lib/theme";

/**
 * Mantiene el tema al día cuando cambia el ajuste o, con «Sistema», cuando el teléfono pasa
 * de claro a oscuro. El primer pintado ya lo resolvió `THEME_SCRIPT` (sin destello).
 */
export function ThemeSync() {
  const pref = useLocalStore(() => loadPrefs().theme, "system");

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const apply = () => applyTheme(document, pref, query.matches);
    apply();
    if (pref !== "system") return;
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [pref]);

  return null;
}
