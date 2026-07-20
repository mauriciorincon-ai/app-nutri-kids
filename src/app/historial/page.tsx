"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { NoteSummary } from "@/components/day-checklist/note-summary";
import { useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { TodayBadge } from "@/components/today-badge";
import { fmt, useI18n, type Dictionary, type Locale } from "@/i18n";
import {
  listDayEntries,
  listRecordedEntries,
  type DayRecord,
  type RecordedDay,
} from "@/lib/diet/day-log";
import { dateKey, resolveCheckTarget } from "@/lib/diet/logic";
import type { DietPlan } from "@/lib/diet/schema";
import { formatShortDate, formatTime } from "@/lib/format";
import { useHydrated, useLocalStore } from "@/lib/local-store";

const NO_ENTRIES: RecordedDay[] = [];

/**
 * Días anteriores — historial local, SOLO lectura (no se edita). Lista simple
 * por fecha descendente con las horas reales y las notas. Los datos viven solo
 * en el dispositivo (ADR-007); esta pantalla no envía nada a ningún lado.
 */
export default function HistoryPage() {
  const { diet } = useDiet();
  const { t, locale } = useI18n();
  const hydrated = useHydrated();
  const today = useToday();
  const todayKey = today ? dateKey(today) : null;

  // Una sola lectura del store (no getDayRecord por día en el render).
  const entries = useLocalStore(listRecordedEntries, NO_ENTRIES, "");

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.history.title}</h1>
      <p className="-mt-2 text-muted-foreground">{t.history.intro}</p>

      {!hydrated ? (
        <div
          role="status"
          aria-label={t.a11y.loading}
          className="h-20 rounded-xl border bg-card"
        />
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-muted-foreground">
          {t.history.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map(({ day, record }) => (
            <DayCard
              key={day}
              day={day}
              isToday={day === todayKey}
              record={record}
              diet={diet}
              locale={locale}
              t={t}
            />
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.history.back}
      </Link>
    </div>
  );
}

function DayCard({
  day,
  isToday,
  record,
  diet,
  locale,
  t,
}: {
  day: string;
  isToday: boolean;
  record: DayRecord;
  diet: DietPlan;
  locale: Locale;
  t: Dictionary;
}) {
  const { l } = useI18n();

  // Rótulo del ítem resuelto contra la dieta ACTIVA; si el id es de una dieta
  // anterior (ya no existe), un texto legible — jamás el checkId crudo.
  const label = (checkId: string): string => {
    const target = resolveCheckTarget(diet, checkId);
    if (!target) return t.history.unknownItem;
    if (target.kind === "meal") return l(target.meal.name);
    if (target.kind === "supplement") return l(target.supplement.name);
    return fmt(t.today.waterGlass, { n: target.index });
  };

  return (
    <li className="rounded-xl border bg-card px-4 py-3">
      <p className="flex items-baseline gap-2">
        <span className="font-heading text-lg font-semibold">
          {formatShortDate(day, locale)}
        </span>
        {isToday && <TodayBadge>{t.history.todayTag}</TodayBadge>}
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {listDayEntries(record).map(({ checkId, at, marked, note }) => (
          <li key={checkId} className="text-sm">
            <span className="flex items-baseline justify-between gap-2">
              <span
                className={marked ? "font-medium" : "text-muted-foreground"}
              >
                {label(checkId)}
              </span>
              {marked && (
                <time
                  dateTime={at ?? undefined}
                  className="shrink-0 text-muted-foreground"
                  data-tabular
                >
                  {at
                    ? fmt(t.history.at, { time: formatTime(at, locale) })
                    : t.history.timeUnknown}
                </time>
              )}
            </span>
            {note && (note.chips.length > 0 || note.text) && (
              <span className="mt-0.5 block text-muted-foreground">
                {t.history.noteLabel} <NoteSummary note={note} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
