import { referenceFor, type Reference } from "./references";
import type { AgeBand, HabitId } from "./values";

/**
 * Cómo se ve un hábito contra la referencia de su edad. Dos estados con símbolo, texto y color
 * («dentro» y «distinto»), jamás rojo ni «no cumplió»: «distinto» invita a mirar, no reprocha.
 */
export type HabitStatus =
  /** Dentro de lo que la guía recomienda. */
  | "within"
  /** Por debajo de la referencia (sueño, actividad). */
  | "below"
  /** Por encima de la referencia (sueño, pantalla). */
  | "above"
  /** La guía no recomienda esto a esta edad y hay minutos anotados. */
  | "not-recommended"
  /** Sin cifra oficial: se registra y se dice. */
  | "no-figure";

export type HabitReading = { status: HabitStatus; reference: Reference };

export function readHabit(
  habit: HabitId,
  band: AgeBand,
  minutes: number,
): HabitReading {
  const reference = referenceFor(habit, band);
  switch (reference.kind) {
    case "range":
      return {
        reference,
        status:
          minutes < reference.min
            ? "below"
            : minutes > reference.max
              ? "above"
              : "within",
      };
    case "min":
      return {
        reference,
        status: minutes >= reference.min ? "within" : "below",
      };
    case "max":
      return {
        reference,
        status: minutes <= reference.max ? "within" : "above",
      };
    case "not-recommended":
      return {
        reference,
        status: minutes === 0 ? "within" : "not-recommended",
      };
    case "limit-no-figure":
    case "none":
      return { reference, status: "no-figure" };
  }
}

/** «9 h 30 min», «45 min», «2 h»: las mismas unidades en los dos idiomas. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
