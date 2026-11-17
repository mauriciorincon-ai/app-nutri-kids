import { isAgeBand, type AgeBand } from "./values";

/**
 * La franja de edad (decisión 1a del G-Plan): un padre la elige en el perfil; una vez al año
 * la app pregunta si sigue igual. Jamás se guarda una fecha de nacimiento. El «hoy» llega
 * por parámetro: la fecha es perilla de prueba, nunca el reloj.
 */

export const AGE_RECHECK_MS = 365 * 24 * 60 * 60 * 1000;

/** ¿Toca preguntar si la franja sigue igual? `setAt` = cuándo se eligió o confirmó. */
export function ageRecheckDue(setAt: number, now: number): boolean {
  return now - setAt >= AGE_RECHECK_MS;
}

export function parseBand(v: unknown): AgeBand | null {
  return isAgeBand(v) ? v : null;
}
