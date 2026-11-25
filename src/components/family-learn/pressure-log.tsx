"use client";

import Link from "next/link";
import { ChevronLeft, Repeat, Trash2 } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { useDiet } from "@/components/diet-provider";
import { useToday } from "@/components/day-checklist/use-today";
import { useFamily } from "@/components/family/use-family";
import { useProfileNotes } from "@/components/use-profile-notes";
import { Button } from "@/components/ui/button";
import { ChoiceRow } from "@/components/wellbeing/choice-row";
import { fmt, useI18n } from "@/i18n";
import { pressureText } from "@/i18n/pressure";
import { getDeviceId } from "@/lib/device";
import { dateKey } from "@/lib/diet/logic";
import { buildScenario } from "@/lib/diet/scenarios";
import { offerables, offeredName } from "@/lib/pressure/offer";
import {
  pressurePattern,
  seesAll,
  visibleEntries,
} from "@/lib/pressure/pattern";
import {
  addPressure,
  readPressure,
  removePressure,
  subscribePressure,
  type PressureStore,
} from "@/lib/pressure/store";
import { STRATEGIES } from "@/lib/pressure/strategies";
import {
  ANSWERS,
  newEntryId,
  OTHER_PERSON,
  OUTSIDE_PLAN,
  PLACES,
  type Answer,
  type Place,
} from "@/lib/pressure/values";

const EMPTY: PressureStore = { own: [], others: {} };
const read = () => readPressure();
const server = () => EMPTY;

/**
 * «Cuando le ofrecen algo» (S14 · ADR-020 · G-Plan 1a). Anotar sin texto libre (quién es un
 * teléfono de la familia u «otra persona»; qué es un id del plan), la estrategia del lugar y,
 * para madre o padre (o sin familia), el registro completo y lo que se repite. Nada de esto va a
 * la bitácora de la familia, a los registros de la app ni a Sentry.
 */
export function PressureLog() {
  const { diet } = useDiet();
  const { locale, l } = useI18n();
  const t = pressureText[locale];
  const view = useFamily();
  const notes = useProfileNotes();
  const today = useToday();
  const store = useSyncExternalStore(subscribePressure, read, server);

  const inFamily = view.phase !== "off";
  const role = view.role;
  const all = seesAll({ inFamily, role });
  const ownId = inFamily ? view.ownId : null;

  const [who, setWho] = useState<string | null>(OTHER_PERSON);
  const [what, setWhat] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [missing, setMissing] = useState(false);
  const [savedPlace, setSavedPlace] = useState<Place | null>(null);

  const offers = useMemo(() => offerables(diet), [diet]);
  const safe = useMemo(
    () =>
      today ? buildScenario("offered", diet, today, notes.notes).safe : [],
    [diet, today, notes.notes],
  );
  const entries = useMemo(
    () => visibleEntries(store, { inFamily, role }),
    [store, inFamily, role],
  );
  const pattern = useMemo(
    () => (all && today ? pressurePattern(entries, today.getTime()) : null),
    [all, entries, today],
  );

  const memberName = (id: string) =>
    view.members.find((m) => m.id === id)?.name ??
    view.phones.find((p) => p.id === id)?.name;
  const whatName = (id: string) => {
    const n = offeredName(diet, id);
    return n ? l(n) : t.whatOutside;
  };

  const save = () => {
    if (!today || !who || !what || !place || !answer) {
      setMissing(true);
      return;
    }
    const now = Date.now();
    addPressure({
      id: newEntryId(),
      t: now,
      date: dateKey(today),
      by: ownId ?? getDeviceId(),
      who,
      what,
      place,
      answer,
    });
    setMissing(false);
    setSavedPlace(place);
    setWhat(null);
    setAnswer(null);
  };

  const strategy = savedPlace ? STRATEGIES[savedPlace] : null;
  const own = new Set(store.own.map((e) => e.id));

  return (
    <div className="flex flex-col gap-5 pb-6">
      <Link
        href="/familia"
        prefetch={false}
        className="-mb-2 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.pBack}
      </Link>
      <h1 className="text-3xl">{t.pTitle}</h1>
      <p className="-mt-2 text-muted-foreground">{t.pLead}</p>

      <section
        className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-4"
        aria-labelledby="pressure-form"
        data-testid="pressure-form"
      >
        <h2 id="pressure-form" className="text-xl">
          {t.formTitle}
        </h2>
        <ChoiceRow
          label={t.whoQ}
          optional={false}
          value={who}
          onChange={setWho}
          options={[
            { id: OTHER_PERSON, text: t.whoOther },
            ...view.members
              .filter((m) => !m.self)
              .map((m) => ({ id: m.id, text: m.name })),
          ]}
        />
        <ChoiceRow
          label={t.whatQ}
          value={what}
          onChange={setWhat}
          options={[
            ...offers.map((o) => ({
              id: o.id,
              text: `${l(o.name)} · ${t.offerKinds[o.kind]}`,
            })),
            { id: OUTSIDE_PLAN, text: t.whatOutside },
          ]}
        />
        <ChoiceRow
          label={t.placeQ}
          value={place}
          onChange={setPlace}
          options={PLACES.map((p) => ({ id: p, text: t.places[p] }))}
        />
        <ChoiceRow
          label={t.answerQ}
          value={answer}
          onChange={setAnswer}
          options={ANSWERS.map((a) => ({ id: a, text: t.answers[a] }))}
        />
        {missing && (
          <p role="status" className="text-sm font-medium">
            {t.missing}
          </p>
        )}
        <Button
          type="button"
          onClick={save}
          className="min-h-11 self-start"
          data-testid="pressure-save"
        >
          {t.save}
        </Button>
        <p className="text-sm text-muted-foreground">{t.privacy}</p>
      </section>

      {strategy && (
        <section
          className="flex flex-col gap-2 rounded-2xl border bg-card px-4 py-4"
          aria-labelledby="pressure-strategy"
          data-testid="pressure-strategy"
        >
          <p role="status" className="font-semibold">
            {t.saved}
          </p>
          <h2 id="pressure-strategy" className="text-xl">
            {t.strategyTitle} · {strategy.title[locale]}
          </h2>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {strategy.steps.map((s, i) => (
              <li key={i}>{s[locale]}</li>
            ))}
          </ol>
          <p className="mt-1 font-semibold">{t.sayAdultTitle}</p>
          <p className="rounded-xl bg-accent px-3 py-2">
            {strategy.sayAdult[locale]}
          </p>
          <p className="mt-1 font-semibold">{t.offerTitle}</p>
          <p data-testid="pressure-safe">
            {safe.length ? safe.map((s) => l(s.name)).join(", ") : t.offerNone}
          </p>
        </section>
      )}

      {pattern && (
        <section
          className="flex flex-col gap-2 rounded-2xl border bg-card px-4 py-4"
          aria-labelledby="pressure-pattern"
          data-testid="pressure-pattern"
        >
          <h2 id="pressure-pattern" className="flex items-center gap-2 text-xl">
            <Repeat aria-hidden className="size-5" />
            {t.patternTitle}
          </h2>
          <p>
            {pattern.top
              ? fmt(t.patternTop, {
                  count: String(pattern.top.count),
                  what: whatName(pattern.top.what),
                  place: t.places[pattern.top.place].toLocaleLowerCase(locale),
                })
              : t.patternNone}
          </p>
          {pattern.byPlace.length > 0 && (
            <>
              <p className="text-sm font-semibold">{t.patternPlaces}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {pattern.byPlace.map((p) => (
                  <li key={p.place}>
                    {t.places[p.place]} · {p.count}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section
        className="flex flex-col gap-2"
        aria-labelledby="pressure-list"
        data-testid="pressure-list"
      >
        <h2 id="pressure-list" className="text-xl">
          {t.listTitle}
        </h2>
        {!all && <p className="text-sm text-muted-foreground">{t.mineOnly}</p>}
        {entries.length === 0 ? (
          <p className="text-muted-foreground">{t.listEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 rounded-xl border bg-card px-3 py-2"
              >
                <span className="flex flex-1 flex-col">
                  <strong>{whatName(e.what)}</strong>
                  <span className="text-sm">
                    {t.places[e.place]} · {t.answers[e.answer]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {e.date}
                    {inFamily &&
                      ` · ${fmt(t.byLine, {
                        name: own.has(e.id)
                          ? t.thisPhone
                          : (memberName(e.by) ?? t.whoOther),
                      })}`}
                  </span>
                </span>
                {own.has(e.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 min-w-11"
                    aria-label={`${t.remove}: ${whatName(e.what)}`}
                    onClick={() => removePressure(e.id)}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
