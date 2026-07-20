"use client";

import { useDayLog, useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { TodayBadge } from "@/components/today-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { fmt, useI18n } from "@/i18n";
import { weekdayFromDate } from "@/lib/diet/logic";
import type { Weekday } from "@/lib/diet/schema";
import { cn } from "@/lib/utils";

const WEEK_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * Suplementos — calendario semanal Lun–Dom con dosis y momento.
 * El check "ya lo tomó" SOLO aplica al día real (mismo day-log que "Hoy").
 */
export default function SupplementsPage() {
  const { diet } = useDiet();
  const { t, l } = useI18n();
  const today = useToday();
  const { doneIds, toggle } = useDayLog(today);

  const todayWeekday = today ? weekdayFromDate(today) : null;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.supplements.title}</h1>
      <p className="-mt-2 text-muted-foreground">{t.supplements.intro}</p>

      <ul className="flex flex-col gap-3">
        {WEEK_ORDER.map((day) => {
          const isToday = day === todayWeekday;
          const daySupplements = diet.supplements.filter((s) =>
            s.days.includes(day),
          );
          return (
            <li
              key={day}
              className={cn(
                "rounded-xl border bg-card px-4 py-3",
                isToday && "border-primary ring-1 ring-primary",
              )}
            >
              <p className="flex items-baseline gap-2">
                <span className="font-heading text-lg font-semibold">
                  {t.weekdays[day]}
                </span>
                {isToday && <TodayBadge>{t.supplements.todayLabel}</TodayBadge>}
              </p>

              {daySupplements.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.supplements.noneThatDay}
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {daySupplements.map((s) => {
                    const checkId = `supplement:${s.id}`;
                    const done = isToday && doneIds.includes(checkId);
                    return (
                      <li key={s.id} className="flex items-start gap-3">
                        {isToday ? (
                          <Checkbox
                            checked={done}
                            onCheckedChange={() => toggle(checkId)}
                            aria-label={fmt(t.supplements.markTaken, {
                              name: l(s.name),
                            })}
                            className="mt-0.5 size-6 rounded-md"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="mt-0.5 size-6 rounded-md border border-dashed"
                          />
                        )}
                        <span
                          className={cn("min-w-0 flex-1", done && "opacity-55")}
                        >
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-semibold">{l(s.name)}</span>
                            {done && (
                              <span className="text-sm font-semibold text-tl-green">
                                {t.supplements.taken}
                              </span>
                            )}
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            {fmt(t.supplements.dose, { dose: l(s.dose) })} ·{" "}
                            {fmt(t.supplements.when, { when: l(s.when) })}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {diet.supplementNotes && (
        <section className="rounded-xl bg-accent px-4 py-3">
          <h2 className="text-lg">{t.supplements.notesTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">
            {l(diet.supplementNotes)}
          </p>
        </section>
      )}
    </div>
  );
}
