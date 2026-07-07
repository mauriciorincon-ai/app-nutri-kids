"use client";

import { Droplets, Pill } from "lucide-react";

import { ChecklistRow } from "@/components/day-checklist/checklist-row";
import { DaySummary } from "@/components/day-checklist/day-summary";
import { useDayLog, useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { fmt, useI18n } from "@/i18n";
import { buildDayChecklist, type ChecklistItem } from "@/lib/diet/logic";
import { formatTime } from "@/lib/format";

/**
 * Hoy — el checklist del día (outcome secundario del sprint).
 * LCP móvil: el h1 + resumen nacen estáticos (sin motion, sin opacity 0).
 * El contenido depende del día real → se completa al hidratar (skeleton mínimo).
 */
export default function TodayPage() {
  const { diet } = useDiet();
  const { t, l, locale } = useI18n();
  const today = useToday();
  const { doneIds, toggle } = useDayLog(today);

  const checklist = today ? buildDayChecklist(diet, today, doneIds) : null;

  const labelFor = (checkId: string): string => {
    const item = checklist?.items.find((i) => i.checkId === checkId);
    if (!item) return checkId;
    if (item.kind === "meal") return l(item.meal.name);
    if (item.kind === "supplement") return l(item.supplement.name);
    return fmt(t.today.waterGlass, { n: item.index });
  };

  const rowFor = (item: ChecklistItem & { done: boolean }) => {
    if (item.kind === "meal") {
      return (
        <ChecklistRow
          key={item.checkId}
          done={item.done}
          onToggle={() => toggle(item.checkId)}
          title={l(item.meal.name)}
          detail={l(item.meal.content)}
          time={formatTime(item.meal.start, locale)}
          ariaLabel={fmt(item.done ? t.today.markUndone : t.today.markDone, {
            item: l(item.meal.name),
          })}
        />
      );
    }
    if (item.kind === "supplement") {
      return (
        <ChecklistRow
          key={item.checkId}
          done={item.done}
          onToggle={() => toggle(item.checkId)}
          title={l(item.supplement.name)}
          detail={`${l(item.supplement.dose)} · ${l(item.supplement.when)}`}
          ariaLabel={fmt(item.done ? t.today.markUndone : t.today.markDone, {
            item: l(item.supplement.name),
          })}
        />
      );
    }
    return (
      <ChecklistRow
        key={item.checkId}
        done={item.done}
        onToggle={() => toggle(item.checkId)}
        title={fmt(t.today.waterGlass, { n: item.index })}
        ariaLabel={fmt(item.done ? t.today.markUndone : t.today.markDone, {
          item: fmt(t.today.waterGlass, { n: item.index }),
        })}
      />
    );
  };

  const meals = checklist?.items.filter((i) => i.kind === "meal") ?? [];
  const supplements =
    checklist?.items.filter((i) => i.kind === "supplement") ?? [];
  const water = checklist?.items.filter((i) => i.kind === "water") ?? [];

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.today.title}</h1>

      {checklist ? (
        <DaySummary checklist={checklist} labelFor={labelFor} />
      ) : (
        // Cargando: mismo layout, sin motion (skeleton estático)
        <div
          aria-label={t.a11y.loading}
          className="h-14 rounded-xl bg-accent"
        />
      )}

      <section className="flex flex-col gap-2" aria-label={t.today.meals}>
        <h2 className="text-lg text-muted-foreground">{t.today.meals}</h2>
        {meals.length > 0
          ? meals.map(rowFor)
          : Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl border bg-card"
                aria-hidden
              />
            ))}
      </section>

      <section
        className="flex flex-col gap-2"
        aria-label={t.today.supplementCard}
      >
        <h2 className="flex items-center gap-1.5 text-lg text-muted-foreground">
          <Pill aria-hidden className="size-4" />
          {t.today.supplementCard}
        </h2>
        {checklist && supplements.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-4 py-3">
            <p className="font-semibold">{t.today.noSupplementToday}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t.today.noSupplementHint}
            </p>
          </div>
        ) : (
          supplements.map(rowFor)
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label={t.today.water}>
        <h2 className="flex items-center gap-1.5 text-lg text-muted-foreground">
          <Droplets aria-hidden className="size-4" />
          {t.today.water}
        </h2>
        {water.map(rowFor)}
      </section>
    </div>
  );
}
