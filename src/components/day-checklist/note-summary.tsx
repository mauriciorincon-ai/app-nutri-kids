"use client";

import { useI18n, type Dictionary } from "@/i18n";
import type { DayNote, NoteChip } from "@/lib/diet/day-log";

/**
 * Chip de nota → clave i18n. Único mapa (antes duplicado en note-editor e
 * historial): un chip nuevo del vocabulario (`NOTE_CHIPS`) se traduce en un solo
 * sitio. `Dictionary["today"]` fuerza que la clave exista en ambos idiomas.
 */
export const CHIP_I18N_KEY: Record<NoteChip, keyof Dictionary["today"]> = {
  rejected: "noteChipRejected",
  pain: "noteChipPain",
  craving: "noteChipCraving",
  other: "noteChipOther",
};

/**
 * Resumen textual de una nota: "chip · chip · texto" en el idioma activo. Fuente
 * única para "Hoy" y el historial (antes el join se repetía carácter por
 * carácter). Devuelve null si la nota no tiene contenido — el llamador decide el
 * envoltorio (prefijo "Nota:", etc.).
 */
export function NoteSummary({ note }: { note: DayNote }) {
  const { t } = useI18n();
  const parts = [
    ...note.chips.map((c) => t.today[CHIP_I18N_KEY[c]]),
    note.text,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <>{parts.join(" · ")}</>;
}
