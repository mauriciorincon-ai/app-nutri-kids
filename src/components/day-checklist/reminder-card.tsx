"use client";

import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";

import { trackReminderSeen } from "@/lib/diet/day-events";
import { fmt, useI18n } from "@/i18n";
import type { Reminder } from "@/lib/diet/logic";
import { formatTime } from "@/lib/format";

/**
 * Recordatorio determinista — "qué toca AHORA y qué sigue". Información en el
 * momento correcto, sin push ni permisos. Tono NO coercitivo: informa, jamás
 * reprocha (un suplemento pendiente se enuncia, no se recrimina).
 *
 * `reminder === null` = aún no conocemos la hora del dispositivo (pre-hidratación):
 * esqueleto estático de altura fija, para no envolver el candidato LCP de "Hoy".
 * `aria-live="polite"` anuncia el bloque cuando aparece o cambia de franja.
 */
export function ReminderCard({ reminder }: { reminder: Reminder | null }) {
  const { t, l, locale } = useI18n();
  const seen = useRef(false);

  useEffect(() => {
    if (reminder && !seen.current) {
      seen.current = true;
      trackReminderSeen();
    }
  }, [reminder]);

  return (
    <section
      aria-live="polite"
      aria-label={t.reminder.heading}
      className="rounded-xl border border-primary/30 bg-card px-4 py-3"
    >
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-primary">
        <Clock aria-hidden className="size-4" />
        {t.reminder.heading}
      </h2>

      {reminder === null ? (
        <p role="status" className="mt-1.5 text-muted-foreground">
          {t.reminder.loading}
        </p>
      ) : (
        <ReminderBody reminder={reminder} t={t} l={l} locale={locale} />
      )}
    </section>
  );
}

function ReminderBody({
  reminder,
  t,
  l,
  locale,
}: {
  reminder: Reminder;
  t: ReturnType<typeof useI18n>["t"];
  l: ReturnType<typeof useI18n>["l"];
  locale: ReturnType<typeof useI18n>["locale"];
}) {
  const { slot } = reminder;

  // Línea principal (qué toca ahora) + línea "sigue" opcional.
  let nowLine = "";
  let nextLine: string | null = null;

  if (slot) {
    if (slot.kind === "before-first") {
      nowLine = fmt(t.reminder.mealBeforeFirst, {
        meal: l(slot.next.name),
        time: formatTime(slot.next.start, locale),
      });
    } else if (slot.kind === "during") {
      nowLine = fmt(t.reminder.mealNow, { meal: l(slot.meal.name) });
      if (slot.next) {
        nextLine = fmt(t.reminder.next, {
          meal: l(slot.next.name),
          time: formatTime(slot.next.start, locale),
        });
      }
    } else if (slot.kind === "between") {
      nowLine = t.reminder.mealBetween;
      nextLine = fmt(t.reminder.next, {
        meal: l(slot.next.name),
        time: formatTime(slot.next.start, locale),
      });
    } else {
      nowLine = fmt(t.reminder.mealAfterLast, { meal: l(slot.prev.name) });
    }
  }

  const supplementLine =
    reminder.supplementsPending.length > 0
      ? fmt(t.reminder.supplementDue, {
          names: reminder.supplementsPending.map((s) => l(s.name)).join(", "),
        })
      : t.reminder.supplementsDone;

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {nowLine && (
        <p className="font-heading text-lg font-semibold leading-tight">
          {nowLine}
        </p>
      )}
      {nextLine && <p className="text-sm text-muted-foreground">{nextLine}</p>}
      <p className="text-sm text-muted-foreground">{supplementLine}</p>
      <p className="text-sm text-muted-foreground" data-tabular>
        {fmt(t.reminder.water, {
          done: reminder.water.done,
          target: reminder.water.target,
        })}
      </p>
    </div>
  );
}
