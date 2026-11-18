"use client";

import { memo, useDeferredValue, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Droplets, Pill } from "lucide-react";

import { ChecklistRow } from "@/components/day-checklist/checklist-row";
import { DaySummary } from "@/components/day-checklist/day-summary";
import { NoteEditor } from "@/components/day-checklist/note-editor";
import { ReminderCard } from "@/components/day-checklist/reminder-card";
import { useDayLog, useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { RoleLimit } from "@/components/family/role-limit";
import { useCan, useWho } from "@/components/family/use-family";
import { FamilyNotices } from "@/components/notices/family-notices";
import { PlanBCard } from "@/components/plan-b/plan-b-card";
import { FoodLogSlot } from "@/components/wellbeing/food-log-slot";
import { MoodChips } from "@/components/wellbeing/mood-chips";
import {
  useWellbeing,
  useWt,
  wellbeingChanged,
} from "@/components/wellbeing/use-wellbeing";
import { fmt, useI18n } from "@/i18n";
import {
  buildDayChecklist,
  checkIdFor,
  dateKey,
  waterGlassesTarget,
  type ChecklistItem,
} from "@/lib/diet/logic";
import { setMood } from "@/lib/diet/day-log";
import { formatTime } from "@/lib/format";
import { acceptableFoods } from "@/lib/wellbeing/foods";

type Row = ChecklistItem & { done: boolean };

/**
 * Hoy — el checklist del día + registro (hora real, nota) + recordatorio.
 * LCP móvil: h1, resumen, COMIDAS y AGUA nacen estáticos (no dependen de la
 * fecha → van en el HTML del prerender con la demo). El recordatorio y la
 * tarjeta de suplemento esperan a conocer la hora/día real del dispositivo
 * (esqueleto mínimo, sin envolver el candidato LCP).
 */
export default function TodayPage() {
  // La fecha del aparato llega al hidratar y useSyncExternalStore re-pintaría Hoy entera
  // de golpe, en una tarea larga (TBT, S10). Diferida, Hoy se re-pinta en segundo plano y
  // a trozos; aquí solo se re-pinta este envoltorio, que no cambia nada (TodayView es memo).
  const today = useDeferredValue(useToday());
  return <TodayView today={today} />;
}

const TodayView = memo(function TodayView({ today }: { today: Date | null }) {
  const { diet } = useDiet();
  const { t, l, locale } = useI18n();
  const who = useWho();
  const can = useCan();
  const { record, doneIds, toggle, saveNote } = useDayLog(today);
  const w = useWt();
  const wellbeing = useWellbeing(today);
  // Solo cambian con la dieta: no se rehacen en cada render de Hoy.
  const mealOptions = useMemo(
    () => diet.dailyMenu.map((m) => ({ id: m.id, name: m.name })),
    [diet],
  );
  const foodOptions = useMemo(() => acceptableFoods(diet), [diet]);

  // Con fecha real: checklist completo. Sin ella (prerender): comidas + agua
  // estáticas, sin marcas — el HTML inicial ya contiene el candidato LCP.
  const checklist = today ? buildDayChecklist(diet, today, doneIds) : null;

  const mealRows: Row[] =
    checklist?.items.filter((i) => i.kind === "meal") ??
    diet.dailyMenu.map((meal) => ({
      checkId: checkIdFor("meal", meal.id),
      kind: "meal",
      meal,
      done: false,
    }));

  const waterTarget = waterGlassesTarget(diet);
  const waterRows: Row[] =
    checklist?.items.filter((i) => i.kind === "water") ??
    Array.from({ length: waterTarget }, (_, i) => ({
      checkId: checkIdFor("water", i + 1),
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

  /** Hora que se muestra en la fila: programada si falta, o la real al marcarse. */
  const doneTimeLabel = (
    checkId: string,
    done: boolean,
  ): string | undefined => {
    if (!done) return undefined;
    const at = record.marks[checkId]?.at;
    return at
      ? fmt(t.today.doneAt, { time: formatTime(at, locale) })
      : t.today.doneNoTime;
  };

  const mealRow = (item: Row & { kind: "meal" }) => {
    const done = item.done;
    const time = done
      ? doneTimeLabel(item.checkId, done)
      : formatTime(item.meal.start, locale);
    return (
      <div key={item.checkId}>
        <ChecklistRow
          done={done}
          onToggle={() => toggle(item.checkId)}
          disabled={!can({ k: "mark", check: item.checkId })}
          title={l(item.meal.name)}
          detail={l(item.meal.content)}
          time={time}
          by={who(record.marks[item.checkId]?.by)}
          ariaLabel={fmt(done ? t.today.markUndone : t.today.markDone, {
            item: l(item.meal.name),
          })}
        />
        <MoodChips
          mealName={l(item.meal.name)}
          value={wellbeing.moods[item.checkId] ?? null}
          disabled={!can({ k: "mood", check: item.checkId })}
          onPick={(mood) => {
            if (!today) return;
            setMood(new Date(), item.checkId, mood);
            wellbeingChanged();
          }}
        />
        {/* La nota se renderiza SIEMPRE (también en el prerender) para reservar
            su altura → cero CLS al hidratar. Pre-hidratación `saveNote` es no-op
            (no hay día) y no hay nota que mostrar. key por día: al cruzar
            medianoche con la pestaña abierta, el editor se remonta con la nota
            del día nuevo (no arrastra la de ayer). */}
        <NoteEditor
          key={today ? dateKey(today) : "static"}
          mealName={l(item.meal.name)}
          note={record.notes[item.checkId] ?? null}
          by={who(record.notes[item.checkId]?.by)}
          onSave={(note) => saveNote(item.checkId, note)}
          readOnly={!can({ k: "day-note", check: item.checkId })}
        />
        {today && can({ k: "food", meal: item.meal.id }) && (
          <FoodLogSlot
            today={today}
            meals={mealOptions}
            foods={foodOptions}
            mealId={item.meal.id}
            canWrite={(id) => can({ k: "food", meal: id })}
          />
        )}
      </div>
    );
  };

  const supplementRow = (item: Row & { kind: "supplement" }) => (
    <ChecklistRow
      key={item.checkId}
      done={item.done}
      onToggle={() => toggle(item.checkId)}
      disabled={!can({ k: "mark", check: item.checkId })}
      title={l(item.supplement.name)}
      detail={`${l(item.supplement.dose)} · ${l(item.supplement.when)}`}
      time={doneTimeLabel(item.checkId, item.done)}
      by={who(record.marks[item.checkId]?.by)}
      ariaLabel={fmt(item.done ? t.today.markUndone : t.today.markDone, {
        item: l(item.supplement.name),
      })}
    />
  );

  const waterRow = (item: Row & { kind: "water" }) => (
    <ChecklistRow
      key={item.checkId}
      done={item.done}
      onToggle={() => toggle(item.checkId)}
      disabled={!can({ k: "mark", check: item.checkId })}
      title={fmt(t.today.waterGlass, { n: item.index })}
      by={who(record.marks[item.checkId]?.by)}
      ariaLabel={fmt(item.done ? t.today.markUndone : t.today.markDone, {
        item: fmt(t.today.waterGlass, { n: item.index }),
      })}
    />
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.today.title}</h1>

      <ReminderCard diet={diet} doneIds={doneIds} />

      <FamilyNotices today={today} />

      <RoleLimit />

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
        {mealRows.map((item) => (item.kind === "meal" ? mealRow(item) : null))}
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
            role="status"
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
          supplementRows.map((item) =>
            item.kind === "supplement" ? supplementRow(item) : null,
          )
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label={t.today.water}>
        <h2 className="flex items-center gap-1.5 text-lg text-muted-foreground">
          <Droplets aria-hidden className="size-4" />
          {t.today.water}
        </h2>
        {waterRows.map((item) =>
          item.kind === "water" ? waterRow(item) : null,
        )}
      </section>

      <PlanBCard />

      <Link
        href="/bienestar"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        {w.open}
        <ChevronRight aria-hidden className="size-4" />
      </Link>

      <nav
        aria-labelledby="day-to-day-label"
        className="flex flex-wrap items-center gap-x-4"
        data-testid="day-to-day-links"
      >
        <span
          id="day-to-day-label"
          className="w-full text-sm font-semibold text-muted-foreground"
        >
          {t.today.dayToDayLabel}
        </span>
        {(
          [
            ["/lonchera", t.today.dayToDayLunchbox],
            ["/recetas", t.today.dayToDayRecipes],
            ["/viaje", t.today.dayToDayTravel],
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {label}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ))}
      </nav>

      <Link
        href="/perfil"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        {t.today.profileLink}
        <ChevronRight aria-hidden className="size-4" />
      </Link>

      <Link
        href="/historial"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        {t.today.historyLink}
        <ChevronRight aria-hidden className="size-4" />
      </Link>

      <Link
        href="/escenarios"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        {t.scenarios.link}
        <ChevronRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
});
