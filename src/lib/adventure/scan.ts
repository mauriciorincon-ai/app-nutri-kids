import { listRecordedEntries, listWellbeingDays } from "@/lib/diet/day-log";

import { sourcesOfDay, type DaySignals, type Source } from "./energy";

/**
 * Lo que los días ya anotados le dan a la aventura. Solo LEE el registro del día (jamás lo
 * escribe) y entrega ids de fuente, sin nada de lo anotado: ni alimentos, ni minutos.
 */
export function scanDays(): { day: string; sources: Source[] }[] {
  const days = new Map<string, DaySignals>();
  const at = (day: string): DaySignals => {
    let d = days.get(day);
    if (!d) {
      d = { habits: {}, markIds: [], food: {} };
      days.set(day, d);
    }
    return d;
  };
  for (const { day, record } of listRecordedEntries())
    at(day).markIds = Object.keys(record.marks);
  for (const { day, wellbeing } of listWellbeingDays()) {
    const d = at(day);
    d.habits = wellbeing.habits;
    d.food = wellbeing.food;
  }
  return [...days].map(([day, signals]) => ({
    day,
    sources: sourcesOfDay(signals),
  }));
}
