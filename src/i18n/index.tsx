"use client";

import { createContext, useCallback, useContext, useEffect } from "react";

import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import { loadPrefs, savePrefs } from "@/lib/diet/storage";
import type { LocalizedText } from "@/lib/diet/schema";
import { en } from "./en";
import { es, type Dictionary } from "./es";

/**
 * i18n propio sin librería (ADR de i18n): 2 idiomas, diccionarios tipados con
 * paridad compile-time. ES es el default y lo que prerenderiza el servidor
 * (LCP estático en ES); si la preferencia es EN, el texto cambia al hidratar.
 */

export type Locale = "es" | "en";

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

type I18nContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  /** Contenido bilingüe de la dieta ({es,en}) en el idioma activo. */
  l: (text: LocalizedText) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/** Interpola {placeholders} de los diccionarios: fmt(t.today.summaryDone, {done: 3, total: 6}). */
export function fmt(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocalStore(() => loadPrefs().locale, "es");

  useEffect(() => {
    // Guard: mutar `lang` (aun al mismo valor) invalida estilos de toda la
    // página → repaint post-hidratación que se vuelve el LCP (medido: ~3.7s).
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    savePrefs({ ...loadPrefs(), locale: next });
    notifyLocalStore();
  }, []);

  const l = useCallback((text: LocalizedText) => text[locale], [locale]);

  return (
    <I18nContext.Provider
      value={{ locale, t: DICTIONARIES[locale], setLocale, l }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
