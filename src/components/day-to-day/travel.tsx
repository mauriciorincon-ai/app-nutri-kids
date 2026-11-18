"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

import { useToday } from "@/components/day-checklist/use-today";
import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import { dayToDayText } from "@/i18n/day-to-day";
import {
  getLunchName,
  getTravelChecks,
  toggleTravelCheck,
} from "@/lib/day-to-day/store";
import type { LocalizedText } from "@/lib/diet/schema";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import {
  buildTravel,
  TRAVEL_MODES,
  type MedicalDoc,
  type TravelMode,
} from "@/lib/travel/engine";
import { cn } from "@/lib/utils";

import { useDt, useReviewInput } from "./use-dt";

const EMPTY_CHECKS: string[] = [];

/** Modo viaje (S11 · ADR-017): lista desde el plan, el día de viaje y el documento en dos idiomas. */
export function Travel() {
  const d = useDt();
  const { l } = useI18n();
  const today = useToday();
  const input = useReviewInput(today);
  const checks = useLocalStore(getTravelChecks, EMPTY_CHECKS);
  const childName = useLocalStore(getLunchName, null);
  const [mode, setMode] = useState<TravelMode>("road");

  const travel = useMemo(
    () => (input ? buildTravel({ ...input, mode, childName }) : null),
    [input, mode, childName],
  );
  if (!today || !travel)
    return <p className="text-muted-foreground">{d.common.planLoading}</p>;

  const check = (id: string, text: string) => {
    const on = checks.includes(id);
    return (
      <li key={id}>
        <label className="flex min-h-11 items-start gap-3 py-1">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={on}
            aria-label={fmt(d.travel.checkAria, { item: text })}
            onChange={() => {
              toggleTravelCheck(id);
              notifyLocalStore();
            }}
          />
          <span className={cn(on && "text-muted-foreground line-through")}>
            {text}
          </span>
        </label>
      </li>
    );
  };
  const list = (
    title: string,
    none: string,
    rows: [string, string][],
    id: string,
  ) => (
    <section className="flex flex-col gap-1" aria-labelledby={id}>
      <h3 id={id} className="font-semibold">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{none}</p>
      ) : (
        <ul>{rows.map(([k, text]) => check(k, text))}</ul>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl" data-no-print>
        {d.travel.title}
      </h1>
      <p className="-mt-2 text-muted-foreground" data-no-print>
        {d.travel.lead}
      </p>
      <p
        className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground"
        data-no-print
      >
        {d.common.notMedical}
      </p>

      <div
        role="group"
        aria-label={d.travel.modeLabel}
        className="flex flex-col gap-1"
        data-no-print
      >
        <p className="text-sm font-semibold text-muted-foreground">
          {d.travel.modeLabel}
        </p>
        <div className="flex gap-1.5">
          {TRAVEL_MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium",
                mode === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {mode === m && <span aria-hidden>✓ </span>}
              {d.travel.modes[m]}
            </button>
          ))}
        </div>
      </div>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="trv-check"
        data-no-print
        data-testid="travel-checklist"
      >
        <h2 id="trv-check" className="text-xl">
          {d.travel.checklistTitle}
        </h2>
        <p className="-mt-2 text-sm text-muted-foreground">
          {d.travel.checklistHint}
        </p>
        {list(
          d.travel.foodsTitle,
          d.travel.foodsNone,
          travel.foods.map((f) => [`food:${f.es}`, l(f)]),
          "trv-foods",
        )}
        {list(
          d.travel.supplementsTitle,
          d.travel.supplementsNone,
          travel.supplements.map((s) => [
            `sup:${s.id}`,
            fmt(d.travel.supplementLine, {
              name: l(s.name),
              dose: l(s.dose),
              when: l(s.when),
            }),
          ]),
          "trv-sup",
        )}
        {list(
          d.travel.medsTitle,
          d.travel.medsNone,
          travel.medications.map((m, i) => [
            `med:${i}:${m.name.es}`,
            [l(m.name), m.dose ? l(m.dose) : null, m.when ? l(m.when) : null]
              .filter(Boolean)
              .join(" · "),
          ]),
          "trv-med",
        )}
        <section className="flex flex-col gap-1" aria-labelledby="trv-avoid">
          <h3 id="trv-avoid" className="font-semibold">
            {d.travel.avoidTitle}
          </h3>
          {travel.avoid.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {d.travel.avoidNone}
            </p>
          ) : (
            <p className="text-sm">{travel.avoid.map(l).join(", ")}</p>
          )}
        </section>
        <ul>{check("doc", d.travel.docItem)}</ul>
      </section>

      <section
        className="flex flex-col gap-2"
        aria-labelledby="trv-plan"
        data-no-print
      >
        <h2 id="trv-plan" className="text-xl">
          {d.travel.planTitle}
        </h2>
        <p className="-mt-1 text-sm text-muted-foreground">
          {mode === "road" ? d.travel.roadLead : d.travel.airLead}
        </p>
        <ul className="flex flex-col gap-2" data-testid="travel-slots">
          {travel.slots.map((m) => (
            <li key={m.id} className="rounded-xl border bg-card px-3 py-2">
              <p className="font-semibold">
                {fmt(d.travel.slotLine, {
                  name: l(m.name),
                  start: m.start,
                  end: m.end,
                })}
              </p>
              <p className="text-sm">{l(m.content)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="trv-doc">
        <h2 id="trv-doc" className="text-xl" data-no-print>
          {d.travel.docTitle}
        </h2>
        <p className="-mt-2 text-sm text-muted-foreground" data-no-print>
          {d.travel.docLead}
        </p>
        <p
          className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground"
          data-no-print
          data-testid="travel-doc-privacy"
        >
          {d.travel.docPrivacy}
        </p>
        <p className="text-sm text-muted-foreground" data-no-print>
          {d.travel.docNameNote}
        </p>
        <div
          data-print-sheet
          data-testid="travel-doc"
          className="flex flex-col gap-4 rounded-xl border bg-card px-4 py-4"
        >
          <DocBlock doc={travel.doc} lang="es" />
          <hr />
          <DocBlock doc={travel.doc} lang="en" />
        </div>
        <div className="flex flex-col gap-1" data-no-print>
          <Button
            className="min-h-11 self-start"
            onClick={() => window.print()}
          >
            <Printer aria-hidden />
            {d.travel.docPrint}
          </Button>
          <p className="text-sm text-muted-foreground">
            {d.travel.docPrintHint}
          </p>
        </div>
      </section>

      <p className="text-sm text-muted-foreground" data-no-print>
        {d.common.offline}
      </p>
    </div>
  );
}

/** Una cara del documento, en SU idioma (no en el de la pantalla): la hoja lleva los dos. */
function DocBlock({ doc, lang }: { doc: MedicalDoc; lang: "es" | "en" }) {
  const t = dayToDayText[lang].travel.doc;
  const none = t.notWritten;
  const row = (label: string, value: string | null) => (
    <p className="text-sm">
      <span className="font-semibold">{label}: </span>
      {value || none}
    </p>
  );
  const join = (xs: LocalizedText[]) =>
    xs.length ? xs.map((x) => x[lang]).join(", ") : null;
  return (
    <div lang={lang} className="flex flex-col gap-1">
      <h3 className="text-lg font-semibold">{t.title}</h3>
      {row(t.date, doc.date)}
      {doc.name && row(t.name, doc.name)}
      {row(t.condition, doc.condition ? doc.condition[lang] : null)}
      {row(t.allergies, join(doc.allergies))}
      {row(t.intolerances, join(doc.intolerances))}
      {row(
        t.medications,
        doc.medications.length
          ? doc.medications
              .map((m) =>
                [
                  m.name[lang],
                  m.dose ? `${t.dose}: ${m.dose[lang]}` : null,
                  m.when ? `${t.when}: ${m.when[lang]}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              )
              .join("; ")
          : null,
      )}
      {row(t.avoid, join(doc.avoid))}
      {row(
        t.supplements,
        doc.supplements.length
          ? doc.supplements
              .map((s) => `${s.name[lang]} (${s.dose[lang]}, ${s.when[lang]})`)
              .join("; ")
          : null,
      )}
      {row(t.source, doc.source[lang])}
      <p className="text-xs">{t.footer}</p>
    </div>
  );
}
