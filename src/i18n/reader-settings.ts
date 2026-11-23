import type { Locale } from "./index";

/**
 * Los textos de «Lector y catálogo» de Ajustes (S13 · ADR-019), aparte de los de la cámara y del
 * súper para que Ajustes no los cargue. Redactados en cada idioma; paridad por test.
 */
const es = {
  title: "Lector de etiquetas y catálogo",
  body: "Ocupan unos {mb} MB en este teléfono: el lector de etiquetas, el escáner y el catálogo de productos. Borrarlos no toca tu plan, tu registro ni lo que compraste; para volver a usarlos se descargan de nuevo.",
  none: "No hay ni lector ni catálogo guardados en este teléfono.",
  button: "Borrar el lector y el catálogo",
  done: "Lector y catálogo borrados.",
  checking: "Mirando qué hay guardado…",
  attribution:
    "Datos de productos © colaboradores de Open Food Facts, bajo la licencia ODbL.",
  licenseLink: "Ver la licencia",
};

const en: typeof es = {
  title: "Label reader and catalog",
  body: "They take about {mb} MB on this phone: the label reader, the scanner and the product catalog. Deleting them doesn't touch your plan, your log or what you bought; to use them again they download again.",
  none: "There is no reader or catalog saved on this phone.",
  button: "Delete the reader and the catalog",
  done: "Reader and catalog deleted.",
  checking: "Checking what is saved…",
  attribution:
    "Product data © Open Food Facts contributors, under the ODbL licence.",
  licenseLink: "See the licence",
};

export type ReaderSettingsText = typeof es;
export const readerSettingsText: Record<Locale, ReaderSettingsText> = {
  es,
  en,
};
