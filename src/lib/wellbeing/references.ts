import type { AgeBand, HabitId } from "./values";

/**
 * Referencias por edad (S10 · ADR-015). SOLO estas, cada una con su fuente en el mismo dato;
 * ninguna otra cifra entra a la app. Lo que no tiene cifra oficial (sol y naturaleza; la
 * pantalla desde los 5 años) se registra y lo dice, sin inventar una meta. Una referencia es
 * eso, una referencia: la app nunca la convierte en un puntaje ni en un veredicto.
 */

type Bi = { es: string; en: string };

export type Source = {
  id: "aasm-2016" | "who-2019" | "who-2020";
  /** Cita corta, redactada en cada idioma (el título del documento queda en su idioma original). */
  cite: Bi;
  /** Dónde está en el documento. */
  where: Bi;
};

export const SOURCES: Record<Source["id"], Source> = {
  "aasm-2016": {
    id: "aasm-2016",
    cite: {
      es: "AASM 2016 · Paruthi et al., J Clin Sleep Med 12(6):785-786 (respaldada por la AAP)",
      en: "AASM 2016 · Paruthi et al., J Clin Sleep Med 12(6):785-786 (endorsed by the AAP)",
    },
    where: { es: "pp. 785-786", en: "pp. 785-786" },
  },
  "who-2019": {
    id: "who-2019",
    cite: {
      es: "OMS 2019 · Guidelines on physical activity, sedentary behaviour and sleep for children under 5 years of age",
      en: "WHO 2019 · Guidelines on physical activity, sedentary behaviour and sleep for children under 5 years of age",
    },
    // Sin número de página: el PDF oficial no se pudo abrir desde aquí (403); se cita la sección.
    where: {
      es: "sección de recomendaciones por edad",
      en: "recommendations by age section",
    },
  },
  "who-2020": {
    id: "who-2020",
    cite: {
      es: "OMS 2020 · WHO guidelines on physical activity and sedentary behaviour",
      en: "WHO 2020 · WHO guidelines on physical activity and sedentary behaviour",
    },
    // Leído en el PDF oficial el 2026-11-17: actividad 5-17 en la p. 25; pantalla en la p. 29.
    where: {
      es: "p. 25 (actividad) · p. 29 (pantalla)",
      en: "p. 25 (activity) · p. 29 (screen)",
    },
  },
};

export type Reference =
  | { kind: "range"; min: number; max: number; source: Source }
  | {
      kind: "min";
      min: number;
      /** De esos minutos, al menos tantos de intensidad moderada a fuerte (solo informa). */
      mvpa?: number;
      source: Source;
    }
  | { kind: "max"; max: number; source: Source }
  | { kind: "not-recommended"; source: Source }
  /** La guía dice «limitar» sin cifra: se registra y se dice. */
  | { kind: "limit-no-figure"; source: Source }
  /** No hay cifra oficial: se registra y se dice. */
  | { kind: "none" };

const h = (hours: number) => hours * 60;
const aasm = SOURCES["aasm-2016"];
const who19 = SOURCES["who-2019"];
const who20 = SOURCES["who-2020"];

/** Sueño total en 24 h, siestas incluidas hasta los 5 años (AASM: 13-18 años = 8-10 h). */
const SLEEP: Record<AgeBand, Reference> = {
  "1": { kind: "range", min: h(11), max: h(14), source: aasm },
  "2": { kind: "range", min: h(11), max: h(14), source: aasm },
  "3-4": { kind: "range", min: h(10), max: h(13), source: aasm },
  "5": { kind: "range", min: h(10), max: h(13), source: aasm },
  "6-12": { kind: "range", min: h(9), max: h(12), source: aasm },
  "13-17": { kind: "range", min: h(8), max: h(10), source: aasm },
};

const ACTIVITY: Record<AgeBand, Reference> = {
  "1": { kind: "min", min: 180, source: who19 },
  "2": { kind: "min", min: 180, source: who19 },
  "3-4": { kind: "min", min: 180, mvpa: 60, source: who19 },
  "5": { kind: "min", min: 60, source: who20 },
  "6-12": { kind: "min", min: 60, source: who20 },
  "13-17": { kind: "min", min: 60, source: who20 },
};

const SCREEN: Record<AgeBand, Reference> = {
  "1": { kind: "not-recommended", source: who19 },
  "2": { kind: "max", max: 60, source: who19 },
  "3-4": { kind: "max", max: 60, source: who19 },
  "5": { kind: "limit-no-figure", source: who20 },
  "6-12": { kind: "limit-no-figure", source: who20 },
  "13-17": { kind: "limit-no-figure", source: who20 },
};

/** La referencia de un hábito para una franja; el agua (meta del plan) y el sol no tienen aquí. */
export function referenceFor(habit: HabitId, band: AgeBand): Reference {
  switch (habit) {
    case "sleep":
      return SLEEP[band];
    case "activity":
      return ACTIVITY[band];
    case "screen":
      return SCREEN[band];
    case "sun":
      return { kind: "none" };
  }
}

/** Todas las referencias con cifra, para la prueba de «ninguna sin fuente». */
export function allReferences(): Reference[] {
  const bands = Object.keys(SLEEP) as AgeBand[];
  return bands.flatMap((b) => [SLEEP[b], ACTIVITY[b], SCREEN[b]]);
}
