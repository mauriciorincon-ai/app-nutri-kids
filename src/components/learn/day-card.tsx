"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check, ChevronRight, Circle } from "lucide-react";

import { useNow } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { useCan, useFamily } from "@/components/family/use-family";
import {
  useWellbeing,
  wellbeingChanged,
} from "@/components/wellbeing/use-wellbeing";
import { fmt } from "@/i18n";
import { getDayRecord, setCtx, type DayRecord } from "@/lib/diet/day-log";
import { dateKey } from "@/lib/diet/logic";
import {
  dayRisk,
  PREPARE_HREF,
  type RiskFactor,
  type RiskLevel,
} from "@/lib/insights/risk";
import { adjustFor, twin } from "@/lib/insights/twin";
import { useLocalStore } from "@/lib/local-store";
import { seesAll } from "@/lib/pressure/pattern";
import { CTX_KEYS, type CtxId } from "@/lib/wellbeing/values";
import { cn } from "@/lib/utils";

import { Pack } from "./pack";
import {
  useAgeBandId,
  useInsightDays,
  useJoiners,
  useLearnText,
  usePressureEntries,
  useTwinSince,
  useViewer,
} from "./use-learn";

const NO_RECORD: DayRecord = { marks: {}, notes: {} };
const LEVELS: RiskLevel[] = ["low", "mid", "high"];

/**
 * El día de hoy y qué preparar (S15 · ADR-021 · G-Plan 2a): lo ve quien cuida ese día, con el
 * porqué en palabras y lo que conviene tener a mano. Un nivel sin alarma —una mochila que se
 * llena, en ciruela, jamás el rojo de los alimentos— y siempre con símbolo + texto + color.
 * Madre y padre además ven cómo lo aprendido movió el nivel; los demás, solo los factores base.
 */
export function DayCard({ today }: { today: Date | null }) {
  const t = useLearnText();
  const now = useNow();
  const { diet } = useDiet();
  const can = useCan();
  const viewer = useViewer();
  const view = useFamily();
  const band = useAgeBandId();
  const joiners = useJoiners();
  const wellbeing = useWellbeing(today);
  const record = useLocalStore(
    () => (today ? getDayRecord(today) : NO_RECORD),
    NO_RECORD,
    today ? dateKey(today) : "",
  );
  const days = useInsightDays();
  const since = useTwinSince();
  const pressure = usePressureEntries(viewer);
  const learnsHere = seesAll(viewer);

  const learned = useMemo(
    () =>
      learnsHere && now
        ? twin({ diet, days, pressure, since, band, joiners, now })
        : null,
    [learnsHere, now, diet, days, pressure, since, band, joiners],
  );

  // Antes de hidratar (el prerender) se dibuja el estado base —nada anotado, sin edad—: es el
  // mismo que verá quien abre Hoy por primera vez, así la tarjeta no empuja nada al hidratar.
  const risk = dayRisk(
    { band, wellbeing, record, joiners, at: now?.getTime() ?? 0 },
    adjustFor(viewer, learned),
  );
  const writable = can({ k: "ctx" }) && (view.phase === "off" || !!view.role);

  const toggle = (key: CtxId) => {
    if (!today) return;
    setCtx(today, key, !wellbeing.ctx[key]);
    wellbeingChanged();
  };
  const why = (f: RiskFactor) =>
    f === "new" && !wellbeing.ctx.new ? t.computedNew : t.why[f];

  return (
    <section
      aria-labelledby="day-card-title"
      data-testid="day-card"
      data-level={risk.level}
      className="flex flex-col gap-3 rounded-2xl border-2 border-mood-anxious bg-card px-4 py-4"
    >
      <h2 id="day-card-title" className="text-lg text-muted-foreground">
        {t.dayTitle}
      </h2>

      <div className="flex items-center gap-3">
        <Pack
          level={risk.level}
          className="size-14 shrink-0 text-mood-anxious"
        />
        <div>
          <p
            className="font-heading text-lg font-semibold"
            data-testid="day-level"
          >
            {t.levels[risk.level]}
          </p>
          <p className="text-sm text-muted-foreground">
            {t.levelHints[risk.level]}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t.whyTitle}</h3>
        {risk.factors.length === 0 ? (
          <p className="text-sm" data-testid="day-why">
            {t.whyNone}
          </p>
        ) : (
          <ul
            className="flex list-disc flex-col gap-0.5 pl-5 text-sm"
            data-testid="day-why"
          >
            {risk.factors.map((f) => (
              <li key={f}>{why(f)}</li>
            ))}
          </ul>
        )}
        {risk.sleep === "no-band" || risk.sleep === "no-sleep" ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="day-sleep-missing"
          >
            {t.sleepMissing[risk.sleep]}
          </p>
        ) : null}
        {learned && !learned.learning
          ? risk.factors
              .filter((f) => risk.adjusted[f] !== undefined)
              .map((f) => {
                const row = learned.factors.find((x) => x.factor === f)!;
                return (
                  <p
                    key={f}
                    className="text-sm text-muted-foreground"
                    data-testid={`day-adjusted-${f}`}
                  >
                    {fmt(
                      risk.adjusted[f] === 1 ? t.adjustedUp : t.adjustedDown,
                      {
                        factor: t.factorNames[f],
                        withOff: row.withOff,
                        withDays: row.withDays,
                      },
                    )}
                  </p>
                );
              })
          : null}
      </div>

      {risk.prepare.length > 0 ? (
        <div className="flex flex-col" data-testid="day-prepare">
          <h3 className="text-sm font-semibold">{t.prepareTitle}</h3>
          <ul className="flex flex-col">
            {risk.prepare.map((p) => (
              <li key={p} className="border-t border-dashed first:border-t-0">
                <Link
                  href={PREPARE_HREF[p]}
                  prefetch={false}
                  className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <span className="flex-1">{t.prepare[p]}</span>
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5" data-testid="day-ctx">
        <h3 className="text-sm font-semibold">{t.ctxTitle}</h3>
        <ul className="flex flex-col gap-1.5">
          {CTX_KEYS.map((key) => {
            const on = !!wellbeing.ctx[key];
            const body = (
              <>
                {on ? (
                  <Check aria-hidden className="size-4 shrink-0" />
                ) : (
                  <Circle aria-hidden className="size-4 shrink-0" />
                )}
                <span className="flex-1 text-left">{t.ctx[key]}</span>
                <span className="text-sm text-muted-foreground">
                  {on ? t.ctxOn : t.ctxOff}
                </span>
              </>
            );
            const cls = cn(
              "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm",
              on ? "border-mood-anxious bg-mood-anxious-surface" : "bg-card",
            );
            return (
              <li key={key}>
                {writable ? (
                  <button
                    type="button"
                    aria-pressed={on}
                    data-testid={`ctx-${key}`}
                    onClick={() => toggle(key)}
                    className={cn(cls, "font-medium")}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={cls} data-testid={`ctx-${key}`}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className="flex flex-col gap-1.5 border-t border-dashed pt-3"
        data-testid="day-legend"
      >
        <h3 className="text-xs font-semibold text-muted-foreground">
          {t.legendTitle}
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LEVELS.map((lv) => (
            <li key={lv} className="flex items-center gap-1.5 text-xs">
              <Pack level={lv} className="size-6 text-mood-anxious" />
              {t.levels[lv]}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">{t.lead}</p>
    </section>
  );
}
