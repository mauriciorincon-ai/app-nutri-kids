import { log } from "../log";
import type { DayNote } from "./day-log";

/**
 * Eventos de uso del registro del día — SOLO metadatos (regla dura 1 · ADR-007).
 * JAMÁS el texto de una nota, ni el alimento concreto: solo la categoría del
 * ítem (meal/supplement/water), conteos y flags. Suficiente para saber que la
 * feature se usa, cero contenido de salud del menor.
 */

/** Categoría del checkId sin el id concreto: "meal:desayuno" → "meal". */
function kindOf(checkId: string): string {
  return checkId.split(":")[0] ?? "unknown";
}

export function trackMark(checkId: string): void {
  log.info({ event: "registro_marcado", kind: kindOf(checkId) });
}

export function trackNote(note: DayNote): void {
  // chipCount + hasText, jamás los valores ni el texto.
  log.info({
    event: "nota_agregada",
    chipCount: note.chips.length,
    hasText: note.text.trim().length > 0,
  });
}

export function trackReminderSeen(): void {
  log.debug({ event: "recordatorio_visto" });
}
