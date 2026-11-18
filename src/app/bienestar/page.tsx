"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Droplets } from "lucide-react";

import { useDayLog, useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { useCan } from "@/components/family/use-family";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceRow } from "@/components/wellbeing/choice-row";
import { HabitRow } from "@/components/wellbeing/habit-row";
import {
  useWellbeing,
  useWt,
  wellbeingChanged,
} from "@/components/wellbeing/use-wellbeing";
import { fmt, useI18n } from "@/i18n";
import { getAgeBand, setAgeBand } from "@/lib/diet/profile-notes";
import { setHabit, setWell } from "@/lib/diet/day-log";
import { waterGlassesTarget } from "@/lib/diet/logic";
import { useLocalStore } from "@/lib/local-store";
import { ageRecheckDue } from "@/lib/wellbeing/age";
import { referenceFor } from "@/lib/wellbeing/references";
import {
  HABITS,
  SYMPTOMS,
  SYMPTOM_IDS,
  WELL_NOTE_KEY,
  WELL_NOTE_MAX,
} from "@/lib/wellbeing/values";

/**
 * Bienestar de hoy (S10 · ADR-015): cómo está (palabras simples, sin escala), sus hábitos
 * contra la referencia de su edad (con la fuente a la vista) y el agua. Solo anota: nada se
 * interpreta, se suma ni se compara. Una «reacción» ofrece el plan de emergencia, jamás una
 * indicación.
 */
export default function WellbeingPage() {
  const w = useWt();
  const { t } = useI18n();
  const { diet } = useDiet();
  const can = useCan();
  const today = useToday();
  const { doneIds } = useDayLog(today);
  const day = useWellbeing(today);
  const age = useLocalStore(getAgeBand, null);

  const canWell = can({ k: "well" });
  const canHabit = can({ k: "habit" });
  const canAge = can({ k: "age" });

  /** Si cruzó la medianoche con la pestaña abierta, lo anotado es del día real. */
  const target = () => new Date();

  const reaction = day.well.reaction;
  const waterTarget = waterGlassesTarget(diet);
  const waterDone = doneIds.filter((id) => id.startsWith("water:")).length;
  const recheck = age && today ? ageRecheckDue(age.t, today.getTime()) : false;

  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const note = noteDraft ?? day.well[WELL_NOTE_KEY] ?? "";

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{w.title}</h1>
      <p className="-mt-2 text-muted-foreground">{w.lead}</p>
      <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        {w.notMedical}
      </p>
      {!canWell && !canHabit && (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm">
          {w.readOnly}
        </p>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="well-title">
        <h2 id="well-title" className="text-xl">
          {w.symptomTitle}
        </h2>
        {SYMPTOM_IDS.map((id) => (
          <ChoiceRow
            key={id}
            label={w.symptoms[id]}
            disabled={!canWell || !today}
            value={
              (day.well[id] as (typeof SYMPTOMS)[typeof id][number]) ?? null
            }
            onChange={(v) => {
              setWell(target(), id, v);
              wellbeingChanged();
            }}
            options={SYMPTOMS[id].map((opt) => ({
              id: opt,
              text: (w.symptomOptions[id] as Record<string, string>)[opt],
            }))}
          />
        ))}

        {reaction && reaction !== "none" && (
          <div
            className="rounded-xl bg-mood-tired-surface px-4 py-3 text-mood-tired"
            data-testid="reaction-help"
          >
            <p className="text-sm font-semibold">{w.reactionHelp}</p>
            <Link
              href="/escenarios?e=emergency"
              className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline"
            >
              {w.reactionLink}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            {w.wellNote}
          </span>
          <Textarea
            value={note}
            disabled={!canWell || !today}
            maxLength={WELL_NOTE_MAX}
            rows={2}
            onChange={(e) =>
              setNoteDraft(e.target.value.slice(0, WELL_NOTE_MAX))
            }
          />
          <span className="text-sm text-muted-foreground">
            {w.wellNoteHint}
          </span>
        </label>
        {canWell && (
          <Button
            size="sm"
            className="min-h-11 self-start"
            disabled={noteDraft === null}
            onClick={() => {
              setWell(
                target(),
                WELL_NOTE_KEY,
                note.trim() === "" ? null : note,
              );
              setNoteDraft(null);
              wellbeingChanged();
            }}
          >
            {w.wellNoteSave}
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="habits-title">
        <h2 id="habits-title" className="text-xl">
          {w.habitsTitle}
        </h2>

        <div className="flex flex-col gap-2 rounded-xl bg-accent px-4 py-3 text-accent-foreground">
          <p className="font-semibold">{w.ageTitle}</p>
          {age ? (
            <p className="text-sm">{w.ageBands[age.band]}</p>
          ) : (
            <p className="text-sm">{w.ageNone}</p>
          )}
          {age && recheck && (
            <div data-testid="age-recheck" className="flex flex-col gap-2">
              <p className="text-sm font-semibold">
                {fmt(w.ageRecheck, { band: w.ageBands[age.band] })}
              </p>
              {canAge ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() => {
                      setAgeBand(age.band, Date.now());
                      wellbeingChanged();
                    }}
                  >
                    {w.ageSame}
                  </Button>
                  <Link
                    href="/perfil"
                    className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium"
                  >
                    {w.ageChange}
                  </Link>
                </div>
              ) : (
                <p className="text-sm">{w.ageOnlyParent}</p>
              )}
            </div>
          )}
        </div>

        {HABITS.map((habit) => (
          <HabitRow
            key={`${habit}-${day.habits[habit] ?? "none"}`}
            habit={habit}
            band={age?.band ?? null}
            minutes={day.habits[habit] ?? null}
            disabled={!canHabit || !today}
            reference={referenceFor}
            onSave={(m) => {
              setHabit(target(), habit, m);
              wellbeingChanged();
            }}
          />
        ))}

        <div
          className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3"
          data-testid="habit-water"
        >
          <Droplets
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground"
          />
          <div>
            <p className="font-semibold">{w.waterTitle}</p>
            <p className="text-sm text-muted-foreground">
              {fmt(w.waterLine, { done: waterDone, target: waterTarget })}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{w.refNotVerdict}</p>
      </section>

      <Link
        href="/historial"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        {t.today.historyLink}
        <ChevronRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}
