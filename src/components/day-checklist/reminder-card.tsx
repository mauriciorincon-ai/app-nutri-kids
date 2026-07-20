"use client";

import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";

import { useNow } from "@/components/day-checklist/use-today";
import { trackReminderSeen } from "@/lib/diet/day-events";
import { fmt, useI18n, type Dictionary } from "@/i18n";
import {
  buildReminder,
  type Reminder,
  type SupplementStatus,
} from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import { formatTime } from "@/lib/format";

/**
 * Recordatorio determinista — "qué toca AHORA y qué sigue". Información en el
 * momento correcto, sin push ni permisos. Tono NO coercitivo: informa, jamás
 * reprocha (un suplemento pendiente se enuncia, no se recrimina).
 *
 * Calcula el recordatorio con la HORA real (useNow) DENTRO de la tarjeta: el
 * tick por minuto re-renderiza SOLO este bloque, no toda "Hoy". Pre-hidratación
 * `now` es null → esqueleto de altura fija (no envuelve el candidato LCP).
 */
export function ReminderCard({
  diet,
  doneIds,
}: {
  diet: DietPlan;
  doneIds: string[];
}) {
  const { t, l, locale } = useI18n();
  const now = useNow();
  const reminder = now ? buildReminder(diet, now, doneIds) : null;

  const seen = useRef(false);
  useEffect(() => {
    if (reminder && !seen.current) {
      seen.current = true;
      trackReminderSeen();
    }
  }, [reminder]);

  return (
    <section
      aria-label={t.reminder.heading}
      // min-h reserva la altura del estado lleno (hasta 5 líneas): el paso
      // esqueleto→contenido al hidratar NO empuja el resto de "Hoy" (CLS=0).
      className="min-h-[8.75rem] rounded-xl border border-primary/30 bg-card px-4 py-3"
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

/** Cadena del suplemento por rama del dominio — `switch` exhaustivo: la UI ya no
 *  puede mentir el estado por el orden de unos ternarios (raíz de BUG-S3-1). */
function supplementLine(
  s: SupplementStatus,
  t: Dictionary,
  l: ReturnType<typeof useI18n>["l"],
): string {
  switch (s.kind) {
    case "none-today":
      return t.reminder.noSupplement;
    case "pending":
      return fmt(t.reminder.supplementDue, {
        names: s.pending.map((x) => l(x.name)).join(", "),
      });
    case "all-done":
      return t.reminder.supplementsDone;
  }
}

function ReminderBody({
  reminder,
  t,
  l,
  locale,
}: {
  reminder: Reminder;
  t: Dictionary;
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

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {/* Solo la franja cambia por el TIEMPO → es lo único que se anuncia. Los
          renglones de suplemento/agua ya los anuncia DaySummary al marcar; con
          aria-live aquí también, el lector repetiría cada interacción. */}
      <div aria-live="polite">
        {nowLine && (
          <p className="font-heading text-lg font-semibold leading-tight">
            {nowLine}
          </p>
        )}
        {nextLine && (
          <p className="text-sm text-muted-foreground">{nextLine}</p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {supplementLine(reminder.supplements, t, l)}
      </p>
      <p className="text-sm text-muted-foreground" data-tabular>
        {fmt(t.reminder.water, {
          done: reminder.water.done,
          target: reminder.water.target,
        })}
      </p>
    </div>
  );
}
