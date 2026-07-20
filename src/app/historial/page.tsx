"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { fmt, useI18n, type Locale } from "@/i18n";
import {
  getDayRecord,
  listRecordedDays,
  type DayNote,
  type NoteChip,
} from "@/lib/diet/day-log";
import { dateKey } from "@/lib/diet/logic";
import { formatShortDate, formatTime } from "@/lib/format";
import { useHydrated, useLocalStore } from "@/lib/local-store";

const NO_DAYS: string[] = [];

const CHIP_LABEL: Record<
  NoteChip,
  keyof ReturnType<typeof useI18n>["t"]["today"]
> = {
  rejected: "noteChipRejected",
  pain: "noteChipPain",
  craving: "noteChipCraving",
  other: "noteChipOther",
};

/**
 * Días anteriores — historial local, SOLO lectura (no se edita). Lista simple
 * por fecha descendente con las horas reales y las notas. Los datos viven solo
 * en el dispositivo (ADR-007); esta pantalla no envía nada a ningún lado.
 */
export default function HistoryPage() {
  const { diet } = useDiet();
  const { t, l, locale } = useI18n();
  const hydrated = useHydrated();
  const today = useToday();
  const todayKey = today ? dateKey(today) : null;

  const days = useLocalStore(listRecordedDays, NO_DAYS, "");

  const chipText = (chip: NoteChip) => t.today[CHIP_LABEL[chip]];

  const label = (checkId: string): string => {
    const [kind, id] = checkId.split(":");
    if (kind === "meal") {
      const meal = diet.dailyMenu.find((m) => m.id === id);
      return meal ? l(meal.name) : checkId;
    }
    if (kind === "supplement") {
      const sup = diet.supplements.find((s) => s.id === id);
      return sup ? l(sup.name) : checkId;
    }
    if (kind === "water") return fmt(t.today.waterGlass, { n: Number(id) });
    return checkId;
  };

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
      ) : days.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-muted-foreground">
          {t.history.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {days.map((day) => (
            <DayCard
              key={day}
              day={day}
              isToday={day === todayKey}
              record={getDayRecord(new Date(`${day}T12:00:00`))}
              locale={locale}
              label={label}
              chipText={chipText}
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
  locale,
  label,
  chipText,
  t,
}: {
  day: string;
  isToday: boolean;
  record: ReturnType<typeof getDayRecord>;
  locale: Locale;
  label: (checkId: string) => string;
  chipText: (chip: NoteChip) => string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  // Unión de ítems con marca y/o nota, ordenados por hora (sin hora al final).
  const checkIds = [
    ...new Set([...Object.keys(record.marks), ...Object.keys(record.notes)]),
  ].sort((a, b) => {
    const ta = record.marks[a]?.at ?? "99:99";
    const tb = record.marks[b]?.at ?? "99:99";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  return (
    <li className="rounded-xl border bg-card px-4 py-3">
      <p className="flex items-baseline gap-2">
        <span className="font-heading text-lg font-semibold">
          {formatShortDate(day, locale)}
        </span>
        {isToday && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
            {t.history.todayTag}
          </span>
        )}
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {checkIds.map((checkId) => {
          const at = record.marks[checkId]?.at ?? null;
          const marked = checkId in record.marks;
          const note: DayNote | undefined = record.notes[checkId];
          return (
            <li key={checkId} className="text-sm">
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={marked ? "font-medium" : "text-muted-foreground"}
                >
                  {label(checkId)}
                </span>
                {marked && (
                  <time className="shrink-0 text-muted-foreground" data-tabular>
                    {at
                      ? fmt(t.history.at, { time: formatTime(at, locale) })
                      : t.history.timeUnknown}
                  </time>
                )}
              </span>
              {note && (note.chips.length > 0 || note.text) && (
                <span className="mt-0.5 block text-muted-foreground">
                  {t.history.noteLabel}{" "}
                  {[...note.chips.map(chipText), note.text]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
