"use client";

import Link from "next/link";
import { ChevronRight, MessageCircleHeart } from "lucide-react";
import { useMemo } from "react";

import { useDiet } from "@/components/diet-provider";
import { useToday } from "@/components/day-checklist/use-today";
import { StatusChip } from "@/components/traffic-light/status-chip";
import { useProfileNotes } from "@/components/use-profile-notes";
import { fmt, useI18n } from "@/i18n";
import { familyText } from "@/i18n/family";
import { LESSON_SOURCES, LESSONS } from "@/lib/family-learn/lessons";
import { familyYesNo } from "@/lib/family-learn/yes-no";

/**
 * «Para la familia» (S14 · ADR-020): las lecciones cortas y la hoja «Qué sí y qué no». Todo sale
 * del repo (las lecciones) o del plan cargado (la hoja); nada viaja. `lib/family-learn` decide.
 */
export function FamilyLearn() {
  const { diet } = useDiet();
  const { locale, l } = useI18n();
  const t = familyText[locale];
  const notes = useProfileNotes();
  const today = useToday();
  const sheet = useMemo(
    () => (today ? familyYesNo(diet, today, notes.notes) : null),
    [diet, today, notes.notes],
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.title}</h1>
      <p className="-mt-2 text-muted-foreground">{t.lead}</p>
      <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        {t.notMedical}
      </p>

      <Link
        href="/familia/presion"
        className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 py-3"
        data-testid="family-pressure-link"
      >
        <MessageCircleHeart
          aria-hidden
          className="size-6 shrink-0 text-primary"
        />
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">{t.pressureLink}</span>
          <span className="text-sm text-muted-foreground">
            {t.pressureLinkLead}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0" />
      </Link>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="yes-no-title"
        data-testid="family-yes-no"
      >
        <h2 id="yes-no-title" className="text-2xl">
          {t.yesNoTitle}
        </h2>
        <p className="-mt-1 text-muted-foreground">
          {fmt(t.yesNoLead, { alias: l(diet.meta.childAlias) })}
        </p>
        {sheet && (
          <>
            <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3">
              <h3 className="flex flex-wrap items-center gap-2 text-lg">
                <StatusChip color="red" label={t.noTitle} />
              </h3>
              {sheet.no.length === 0 ? (
                <p>{t.noNone}</p>
              ) : (
                <ul className="flex flex-col gap-1" data-testid="yes-no-no">
                  {sheet.no.map((n, i) => (
                    <li key={i}>
                      <strong>{l(n.name)}</strong>
                      <span className="text-muted-foreground">
                        {" · "}
                        {t.kinds[n.kind]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {sheet.additives.length > 0 && (
                <>
                  <p className="mt-1 font-semibold">{t.additivesTitle}</p>
                  <ul className="flex flex-col gap-1">
                    {sheet.additives.map((a) => (
                      <li key={a.code}>
                        <strong>{a.code}</strong> · {l(a.name)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    {t.additivesNote}
                  </p>
                </>
              )}
            </div>

            {sheet.ask.length > 0 && (
              <div
                className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
                data-testid="yes-no-ask"
              >
                <h3 className="text-lg">
                  <StatusChip color="yellow" label={t.askTitle} />
                </h3>
                <p>{sheet.ask.map((n) => l(n)).join(", ")}</p>
                <p className="text-sm text-muted-foreground">{t.askNote}</p>
              </div>
            )}

            <div
              className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
              data-testid="yes-no-yes"
            >
              <h3 className="text-lg">
                <StatusChip color="green" label={t.yesTitle} />
              </h3>
              {sheet.yes.map((g, i) => (
                <p key={i}>
                  <strong>{l(g.group)}:</strong>{" "}
                  {g.items.map((n) => l(n)).join(", ")}
                </p>
              ))}
            </div>
            <p className="text-sm">
              {fmt(t.askProfessional, { professional: l(sheet.professional) })}
            </p>
          </>
        )}
      </section>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="lessons-title"
        data-testid="family-lessons"
      >
        <h2 id="lessons-title" className="text-2xl">
          {t.lessonsTitle}
        </h2>
        <p className="-mt-1 text-muted-foreground">{t.lessonsLead}</p>
        {LESSONS.map((lesson) => (
          <details
            key={lesson.id}
            className="rounded-2xl border bg-card px-4 py-3"
            data-testid={`lesson-${lesson.id}`}
          >
            <summary className="flex min-h-11 cursor-pointer flex-col justify-center">
              <span className="text-lg font-semibold">
                {lesson.title[locale]}
              </span>
              <span className="text-sm text-muted-foreground">
                {lesson.gist[locale]}
              </span>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {lesson.points.map((p, i) => (
                <p key={i}>{p[locale]}</p>
              ))}
              <p className="mt-1 font-semibold">{t.sayTitle}</p>
              <ul className="flex flex-col gap-1">
                {lesson.say.map((s, i) => (
                  <li key={i} className="rounded-xl bg-accent px-3 py-2">
                    {s[locale]}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-sm font-semibold">{t.sourcesTitle}</p>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {lesson.sources.map((s) => (
                  <li key={s}>{LESSON_SOURCES[s].cite[locale]}</li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
