"use client";

import { Droplets, Pill } from "lucide-react";

import { ChecklistRow } from "@/components/day-checklist/checklist-row";
import { DaySummary } from "@/components/day-checklist/day-summary";
import { useDayLog, useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { fmt, useI18n } from "@/i18n";
import {
  buildDayChecklist,
  waterGlassesTarget,
  type ChecklistItem,
} from "@/lib/diet/logic";
import { formatTime } from "@/lib/format";

type Row = ChecklistItem & { done: boolean };

/**
 * Hoy — el checklist del día (outcome secundario del sprint).
 * LCP móvil: h1, resumen, COMIDAS y AGUA nacen estáticos (no dependen de la
 * fecha → van en el HTML del prerender con la demo). Solo la tarjeta de
 * suplemento espera a conocer el día real del dispositivo (skeleton mínimo).
 */
export default function TodayPage() {
  const { diet } = useDiet();
  const { t, l, locale } = useI18n();
  const today = useToday();
  const { doneIds, toggle } = useDayLog(today);

  // Con fecha real: checklist completo. Sin ella (prerender): comidas + agua
  // estáticas, sin marcas — el HTML inicial ya contiene el candidato LCP.
  const checklist = today ? buildDayChecklist(diet, today, doneIds) : null;

  const mealRows: Row[] =
    checklist?.items.filter((i) => i.kind === "meal") ??
    diet.dailyMenu.map((meal) => ({
      checkId: `meal:${meal.id}`,
      kind: "meal",
      meal,
      done: false,
    }));

  const waterTarget = waterGlassesTarget(diet);
  const waterRows: Row[] =
    checklist?.items.filter((i) => i.kind === "water") ??
    Array.from({ length: waterTarget }, (_, i) => ({
      checkId: `water:${i + 1}`,
      kind: "water",
      index: i + 1,
      total: waterTarget,
      done: false,
    }));

  const supplementRows: Row[] | null = checklist
    ? checklist.items.filter((i) => i.kind === "supplement")
    : null;

  const labelFor = (checkId: string): string => {
    const item = checklist?.items.find((i) => i.checkId === checkId);
    if (!item) return checkId;
    if (item.kind === "meal") return l(item.meal.name);
    if (item.kind === "supplement") return l(item.supplement.name);
    return fmt(t.today.waterGlass, { n: item.index });
  };

  const rowFor = (item: Row) => {
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

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.today.title}</h1>

      {checklist ? (
        <DaySummary checklist={checklist} labelFor={labelFor} />
      ) : (
        // Prerender: mismo texto del estado "sin marcas" (LCP estático, sin salto)
        <section className="rounded-xl bg-accent px-4 py-3 text-accent-foreground">
          <p className="font-heading text-lg font-semibold">
            {t.today.summaryEmpty}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label={t.today.meals}>
        <h2 className="text-lg text-muted-foreground">{t.today.meals}</h2>
        {mealRows.map(rowFor)}
      </section>

      <section
        className="flex flex-col gap-2"
        aria-label={t.today.supplementCard}
      >
        <h2 className="flex items-center gap-1.5 text-lg text-muted-foreground">
          <Pill aria-hidden className="size-4" />
          {t.today.supplementCard}
        </h2>
        {supplementRows === null ? (
          // Aún no conocemos el día del dispositivo (pre-hidratación)
          <div
            aria-label={t.a11y.loading}
            className="h-14 rounded-xl border bg-card"
          />
        ) : supplementRows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-4 py-3">
            <p className="font-semibold">{t.today.noSupplementToday}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t.today.noSupplementHint}
            </p>
          </div>
        ) : (
          supplementRows.map(rowFor)
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label={t.today.water}>
        <h2 className="flex items-center gap-1.5 text-lg text-muted-foreground">
          <Droplets aria-hidden className="size-4" />
          {t.today.water}
        </h2>
        {waterRows.map(rowFor)}
      </section>
    </div>
  );
}
