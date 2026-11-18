import type { Locale } from "../index";

/**
 * Textos de lo común a lonchera, recetas y viaje (S11 · ADR-017), en su propio módulo para que cada pantalla cargue solo los suyos
 * y el bundle compartido no crezca. Redactados en cada idioma (no traducidos); paridad por test.
 */

const es = {
  notMedical:
    "Esto organiza lo que dice tu plan. No es un consejo médico y no reemplaza a tu pediatra.",
  offline: "Se abre sin señal: todo sale de lo que ya está en este teléfono.",
  planLoading: "Cargando tu plan…",
};

const en: typeof es = {
  notMedical:
    "This organizes what your plan says. It is not medical advice and does not replace your pediatrician.",
  offline: "It opens without signal: everything comes from this phone.",
  planLoading: "Loading your plan…",
};

export type CommonText = typeof es;
export const commonText: Record<Locale, CommonText> = { es, en };
