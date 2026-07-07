"use client";

import { fmt, useI18n } from "@/i18n";
import type { DayChecklist } from "@/lib/diet/logic";

/**
 * Resumen "qué ya hice / qué falta" — lista práctica, no calificación:
 * sin porcentajes, sin colores de alarma, sin juicio.
 */
export function DaySummary({
  checklist,
  labelFor,
}: {
  checklist: DayChecklist;
  labelFor: (checkId: string) => string;
}) {
  const { t } = useI18n();
  const pending = checklist.items.filter((i) => !i.done);

  const headline =
    checklist.doneCount === 0
      ? t.today.summaryEmpty
      : checklist.doneCount === checklist.totalCount
        ? t.today.summaryAllDone
        : fmt(t.today.summaryDone, {
            done: checklist.doneCount,
            total: checklist.totalCount,
          });

  return (
    <section
      aria-live="polite"
      className="rounded-xl bg-accent px-4 py-3 text-accent-foreground"
    >
      <p className="font-heading text-lg font-semibold" data-tabular>
        {headline}
      </p>
      {pending.length > 0 && checklist.doneCount > 0 && (
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          {t.today.pendingLabel}{" "}
          {pending.map((i) => labelFor(i.checkId)).join(" · ")}
        </p>
      )}
    </section>
  );
}
