"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  CircleDashed,
  Clock,
  Contrast,
  Leaf,
  Lock,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";

import { useNow } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import {
  useAgeBandId,
  useInsightDays,
  useJoiners,
  useLearnText,
  usePressureEntries,
  useTwinSince,
  useViewer,
} from "@/components/learn/use-learn";
import { notifyLocalStore } from "@/lib/local-store";
import { fmt, useI18n } from "@/i18n";
import type { LearnText } from "@/i18n/learn";
import { fill } from "@/i18n/learn";
import { formatShortDate } from "@/lib/format";
import {
  checkIdFor,
  dateKey,
  resolveItemStatus,
  weekdayFromDate,
} from "@/lib/diet/logic";
import type { DietPlan, LocalizedText } from "@/lib/diet/schema";
import { adherence, calendar } from "@/lib/insights/adherence";
import { keyToDate, type DayStatus } from "@/lib/insights/days";
import { radar, RADAR_MIN_DAYS, type RadarPattern } from "@/lib/insights/radar";
import { twin } from "@/lib/insights/twin";
import { eraseTwin } from "@/lib/insights/twin-store";
import { seesAll } from "@/lib/pressure/pattern";
import { cn } from "@/lib/utils";

const STATUS_ICON = { in: Check, off: Contrast, none: CircleDashed } as const;
const STATUS_TONE: Record<DayStatus, string> = {
  in: "border-mood-happy bg-mood-happy-surface",
  off: "border-mood-anxious bg-mood-anxious-surface",
  none: "border-dotted bg-card",
};
const STATUSES: DayStatus[] = ["in", "off", "none"];

/**
 * Lo que aprende (S15 · ADR-021 · G-Plan 1a y 2a): cómo va el plan en palabras y conteos, lo que
 * se repite y lo que va aprendiendo. Solo madre o padre (o un teléfono sin familia) lo ve; quien
 * cuida ese día ve «El día de hoy» en Hoy. Jamás dice por qué pasa algo: cuenta coincidencias.
 */
export default function LearnPage() {
  const t = useLearnText();
  const viewer = useViewer();
  const allowed = seesAll(viewer);
  return (
    <div className="flex flex-col gap-5 pb-6">
      <Link
        href="/"
        className="-mb-2 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.back}
      </Link>
      <h1 className="text-3xl">{t.title}</h1>
      {allowed ? (
        <Learned />
      ) : (
        <p
          role="status"
          data-testid="learn-role-limit"
          className="rounded-xl border bg-card px-4 py-3 text-sm leading-relaxed"
        >
          ℹ {t.roleLimit}
        </p>
      )}
    </div>
  );
}

function slotName(
  diet: DietPlan,
  checkId: string,
  l: (x: LocalizedText) => string,
) {
  const meal = diet.dailyMenu.find((m) => checkIdFor("meal", m.id) === checkId);
  if (meal) return l(meal.name);
  const sup = diet.supplements.find(
    (s) => checkIdFor("supplement", s.id) === checkId,
  );
  return sup ? l(sup.name) : checkId;
}

function Learned() {
  const t = useLearnText();
  const { t: main, l, locale } = useI18n();
  const { diet } = useDiet();
  const now = useNow();
  const viewer = useViewer();
  const days = useInsightDays();
  const pressure = usePressureEntries(viewer);
  const since = useTwinSince();
  const band = useAgeBandId();
  const joiners = useJoiners();
  const [asking, setAsking] = useState(false);
  const [erased, setErased] = useState(false);

  const view = useMemo(() => {
    if (!now) return null;
    return {
      adh: adherence(diet, days, pressure, now),
      cal: calendar(diet, days, pressure, now),
      rad: radar(diet, days, pressure, now),
      twin: twin({ diet, days, pressure, since, band, joiners, now }),
    };
  }, [now, diet, days, pressure, since, band, joiners]);

  if (!now || !view) {
    return (
      <div
        role="status"
        aria-label={main.a11y.loading}
        className="h-40 rounded-xl border bg-card"
      />
    );
  }
  const { adh, cal, rad, twin: tw } = view;
  const name = (id: string) => slotName(diet, id, l);
  const food = (id: string) => {
    const s = resolveItemStatus(diet, id, now);
    return s ? l(s.name) : id;
  };
  const groupName = (id: string) => {
    const g = diet.trafficLight.green.groups.find((x) => x.id === id);
    return g ? l(g.name) : id;
  };

  const weekday = (day: string) =>
    t.weekdayShort[weekdayFromDate(keyToDate(day))];
  const dayWord = (day: string) => formatShortDate(day, locale);

  const patternText = (p: RadarPattern): string => {
    switch (p.kind) {
      case "slot":
        return fill(t.slot, { name: name(p.checkId), hits: p.hits, of: p.of });
      case "weekday":
        return fill(t.weekday, {
          weekday: t.weekdays[p.weekday],
          hits: p.hits,
          of: p.of,
        });
      case "place":
        return fill(t.place, {
          place: t.places[p.place],
          hits: p.hits,
          of: p.of,
        });
      case "signal":
        return fill(t.signal, {
          signal: t.signals[p.signal],
          food: food(p.foodId),
          hits: p.hits,
          of: p.of,
        });
    }
  };
  const groups: {
    key: keyof LearnText["groups"];
    icon: typeof Clock;
    kinds: RadarPattern["kind"][];
  }[] = [
    { key: "when", icon: Clock, kinds: ["slot", "weekday"] },
    { key: "where", icon: MapPin, kinds: ["place"] },
    { key: "what", icon: Leaf, kinds: ["signal"] },
  ];

  const erase = () => {
    eraseTwin(dateKey(now));
    notifyLocalStore();
    setAsking(false);
    setErased(true);
  };

  return (
    <>
      <p className="-mt-2 text-muted-foreground">{t.lead}</p>

      {/* — Esta semana: un hilo de siete cuentas, y las palabras — */}
      <section
        aria-labelledby="learn-week"
        className="flex flex-col gap-2"
        data-testid="learn-week"
      >
        <h2 id="learn-week" className="text-xl">
          {t.weekTitle}
        </h2>
        <ol
          className="relative flex justify-between px-1"
          aria-label={t.weekTitle}
        >
          {adh.week.days.map((d) => {
            const Icon = STATUS_ICON[d.status];
            return (
              <li
                key={d.day}
                className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
                aria-label={fill(t.calendarDay, {
                  day: dayWord(d.day),
                  status: t.status[d.status],
                })}
                data-testid={`bead-${d.status}`}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-8 place-items-center rounded-full border-[3px] text-foreground",
                    STATUS_TONE[d.status],
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span aria-hidden>{weekday(d.day)}</span>
              </li>
            );
          })}
        </ol>
        <p data-testid="learn-week-line" className="font-semibold">
          {adh.week.recorded === 0
            ? t.weekEmpty
            : fill(t.weekLine, {
                inPlan: adh.week.inPlan,
                recorded: adh.week.recorded,
              })}
          {adh.week.unrecorded > 0 && adh.week.recorded > 0 ? (
            <span className="font-normal">
              {" · "}
              {fill(t.unrecorded, { count: adh.week.unrecorded })}
            </span>
          ) : null}
        </p>
        <p data-testid="learn-hardest">
          {adh.hardest
            ? fill(t.hardest, {
                name: name(adh.hardest.checkId),
                misses: adh.hardest.misses,
                of: adh.hardest.of,
              })
            : t.hardestNone}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="learn-prev">
          {adh.prev.recorded === 0
            ? t.prevEmpty
            : fill(t.prevLine, {
                inPlan: adh.prev.inPlan,
                recorded: adh.prev.recorded,
              })}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="learn-today">
          {fill(t.todayLine, { done: adh.today.done, total: adh.today.total })}
        </p>

        {/* El calendario de cuatro semanas (de la dirección B, en los colores de la C) */}
        <h3 className="mt-2 text-base font-semibold">{t.calendarTitle}</h3>
        <div
          role="grid"
          aria-label={t.calendarTitle}
          className="flex flex-col gap-1"
          data-testid="learn-calendar"
        >
          <div role="row" className="grid grid-cols-7 gap-1">
            {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map(
              (wd) => (
                <span
                  key={wd}
                  role="columnheader"
                  className="text-center text-xs text-muted-foreground"
                >
                  {t.weekdayShort[wd]}
                </span>
              ),
            )}
          </div>
          {cal.map((week, w) => (
            <div key={w} role="row" className="grid grid-cols-7 gap-1">
              {week.map((c, i) => {
                if (!c)
                  return (
                    <span
                      key={i}
                      role="gridcell"
                      aria-hidden
                      className="aspect-square"
                    />
                  );
                const Icon = STATUS_ICON[c.status];
                return (
                  <span
                    key={c.day}
                    role="gridcell"
                    aria-label={fill(t.calendarDay, {
                      day: dayWord(c.day),
                      status: t.status[c.status],
                    })}
                    data-testid={`cal-${c.status}`}
                    className={cn(
                      "grid aspect-square place-items-center rounded-lg border",
                      STATUS_TONE[c.status],
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t.calendarHint}</p>
        <ul
          aria-label={t.legendCalendar}
          className="flex flex-wrap gap-x-4 gap-y-1"
          data-testid="learn-calendar-legend"
        >
          {STATUSES.map((s) => {
            const Icon = STATUS_ICON[s];
            return (
              <li key={s} className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 place-items-center rounded-full border-2",
                    STATUS_TONE[s],
                  )}
                >
                  <Icon className="size-3" />
                </span>
                {t.status[s]}
              </li>
            );
          })}
        </ul>
      </section>

      {/* — Lo que se repite — */}
      <section
        aria-labelledby="learn-radar"
        className="flex flex-col gap-3"
        data-testid="learn-radar"
      >
        <h2 id="learn-radar" className="text-xl">
          {t.radarTitle}
        </h2>
        {rad.quiet ? (
          <p data-testid="learn-radar-quiet">
            {fmt(t.radarQuiet, { min: RADAR_MIN_DAYS, count: rad.recorded })}
          </p>
        ) : rad.patterns.length === 0 ? (
          <p data-testid="learn-radar-none">{t.radarNone}</p>
        ) : (
          groups.map((g) => {
            const items = rad.patterns.filter((p) => g.kinds.includes(p.kind));
            if (items.length === 0) return null;
            const Icon = g.icon;
            return (
              <div key={g.key} className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon aria-hidden className="size-4" />
                  {t.groups[g.key]}
                </h3>
                <ul className="flex flex-col gap-2">
                  {items.map((p, i) => (
                    <li
                      key={`${p.kind}-${i}`}
                      data-testid={`pattern-${p.kind}`}
                      className="grid grid-cols-[44px_1fr] items-center gap-3 rounded-2xl border bg-card p-3"
                    >
                      <span
                        aria-hidden
                        className="grid size-11 place-items-center rounded-full"
                        style={{
                          background: `conic-gradient(var(--mood-anxious) 0 ${Math.round((p.hits / p.of) * 100)}%, var(--border) 0)`,
                        }}
                      >
                        <span className="grid size-8 place-items-center rounded-full bg-card text-[10px] font-bold leading-none">
                          {p.hits}/{p.of}
                        </span>
                      </span>
                      <div className="flex flex-col gap-1">
                        <p>{patternText(p)}</p>
                        {p.kind === "signal" ? (
                          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MessageCircle
                              aria-hidden
                              className="mt-0.5 size-4 shrink-0"
                            />
                            {p.signal === "reaction"
                              ? t.signalReactionNote
                              : t.signalNote}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
        <p className="text-sm text-muted-foreground">{t.radarFooter}</p>
      </section>

      {/* — Lo que va aprendiendo — */}
      <section
        aria-labelledby="learn-twin"
        className="flex flex-col gap-3"
        data-testid="learn-twin"
      >
        <h2 id="learn-twin" className="text-xl">
          {t.twinTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{t.twinLead}</p>
        {tw.learning ? (
          <div className="flex flex-col gap-1" data-testid="twin-learning">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles aria-hidden className="size-4" />
              {fmt(t.twinLearning, { noted: tw.noted, needed: tw.needed })}
            </p>
            <p className="text-sm text-muted-foreground">
              {fmt(t.twinLearningHint, { needed: tw.needed })}
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-base font-semibold">{t.twinFactorsTitle}</h3>
            {tw.factors.some((f) => f.effect !== "none") ? (
              <ul className="flex flex-col gap-2" data-testid="twin-factors">
                {tw.factors
                  .filter((f) => f.effect !== "none")
                  .map((f) => (
                    <li key={f.factor} className="flex items-start gap-2">
                      <Sparkles
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>
                        {fmt(f.effect === "up" ? t.factorUp : t.factorDown, {
                          factor: t.factorNames[f.factor],
                          withOff: f.withOff,
                          withDays: f.withDays,
                          withoutOff: f.withoutOff,
                          withoutDays: f.withoutDays,
                        })}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p data-testid="twin-no-factors">{t.twinNoFactors}</p>
            )}

            <h3 className="text-base font-semibold">{t.acceptsTitle}</h3>
            {tw.accepts.length > 0 ? (
              <ul className="flex flex-col gap-2" data-testid="twin-accepts">
                {tw.accepts.map((a) => (
                  <li
                    key={`${a.kind}-${a.id}`}
                    className="flex items-start gap-2"
                  >
                    <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {a.kind === "group"
                        ? fill(t.acceptGroup, {
                            name: groupName(a.id),
                            hits: a.hits,
                            of: a.of,
                          })
                        : a.kind === "texture"
                          ? fill(t.acceptTexture, {
                              name:
                                (main.texture as Record<string, string>)[
                                  a.id
                                ]?.toLowerCase() ?? a.id,
                              hits: a.hits,
                              of: a.of,
                            })
                          : fill(t.acceptPresentation, {
                              name:
                                (t.presentations as Record<string, string>)[
                                  a.id
                                ] ?? a.id,
                              hits: a.hits,
                              of: a.of,
                            })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="twin-accepts-none">{t.acceptsNone}</p>
            )}

            {tw.tries.length > 0 ? (
              <div className="flex flex-col gap-1" data-testid="twin-tries">
                <h3 className="text-base font-semibold">{t.triesTitle}</h3>
                {[...new Set(tw.tries.map((x) => x.groupId))].map((gid) => (
                  <p key={gid}>
                    {fill(t.triesLine, {
                      group: groupName(gid),
                      foods: tw.tries
                        .filter((x) => x.groupId === gid)
                        .map((x) => food(x.foodId))
                        .join(", "),
                    })}
                  </p>
                ))}
                <p className="text-sm text-muted-foreground">{t.triesFooter}</p>
              </div>
            ) : null}
          </>
        )}

        {asking ? (
          <div
            role="group"
            aria-label={t.eraseButton}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3"
            data-testid="twin-erase-ask"
          >
            <p className="text-sm">{t.eraseAsk}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={erase}
                data-testid="twin-erase-yes"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold"
              >
                <Lock aria-hidden className="size-4" />
                {t.eraseYes}
              </button>
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm"
              >
                {t.eraseNo}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setErased(false);
              setAsking(true);
            }}
            data-testid="twin-erase"
            className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl border px-4 text-sm font-semibold"
          >
            <Lock aria-hidden className="size-4" />
            {t.eraseButton}
          </button>
        )}
        {erased ? (
          <p role="status" className="text-sm" data-testid="twin-erased">
            {t.eraseDone}
          </p>
        ) : null}
      </section>
    </>
  );
}
