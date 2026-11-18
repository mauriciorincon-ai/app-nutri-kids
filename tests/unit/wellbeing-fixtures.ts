import type { DayWellbeing } from "@/lib/diet/day-log";
import { foodKey, type VerdictId } from "@/lib/wellbeing/values";

/** Un día con lo que se anotó de cada alimento (una entrada en «almuerzo» por alimento). */
export function dayWellbeing(
  day: string,
  verdicts: Record<string, VerdictId>,
): { day: string; wellbeing: DayWellbeing } {
  const food: DayWellbeing["food"] = {};
  for (const [id, verdict] of Object.entries(verdicts))
    food[foodKey("almuerzo", id)] = {
      stage: "tasted",
      verdict,
      texture: null,
      presentation: null,
      isNew: false,
    };
  return {
    day,
    wellbeing: { moods: {}, food, well: {}, habits: {}, lunch: {} },
  };
}
