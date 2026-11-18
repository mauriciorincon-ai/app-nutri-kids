"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, ChevronRight, House, Package, Printer, X } from "lucide-react";

import { useToday } from "@/components/day-checklist/use-today";
import { useCan, useFamily } from "@/components/family/use-family";
import { StatusChip } from "@/components/traffic-light/status-chip";
import { Button } from "@/components/ui/button";
import {
  useWellbeingDays,
  wellbeingChanged,
} from "@/components/wellbeing/use-wellbeing";
import { fmt, useI18n } from "@/i18n";
import { getLunchName, setLunchName, NAME_MAX } from "@/lib/day-to-day/store";
import { getWellbeing, setLunch } from "@/lib/diet/day-log";
import { dateKey } from "@/lib/diet/logic";
import type { LocalizedText } from "@/lib/diet/schema";
import { buildLabel } from "@/lib/lunchbox/label";
import {
  lunchOptions,
  refusedFoodIds,
  type LunchHeld,
  type LunchItem,
} from "@/lib/lunchbox/engine";
import { shoppingList } from "@/lib/lunchbox/shopping";
import { useLocalStore } from "@/lib/local-store";
import { cn } from "@/lib/utils";
import type { LunchState } from "@/lib/wellbeing/values";

import { useLunchDt, useReviewInput } from "./use-dt";
import { WhenInView } from "./when-in-view";

// El QR (y su librería) se cargan solo aquí, solo en la pantalla de la lonchera.
const LunchQr = dynamic(() => import("./lunch-qr"), { ssr: false });

const DAYS = 7;
const EMPTY_WEEK: { day: string; lunch: Record<string, LunchState> }[] = [];

const STATE_ICON = { packed: Package, eaten: Check, back: House } as const;

/** Lonchera (S11 · ADR-017): opciones del plan que aguantan sin nevera, qué se empacó y se comió, compras y etiqueta. */
export function Lunchbox() {
  const d = useLunchDt();
  const { l, locale } = useI18n();
  const today = useToday();
  const can = useCan();
  const family = useFamily();
  const [offset, setOffset] = useState(0);

  const days = useMemo(
    () =>
      today
        ? Array.from(
            { length: DAYS },
            (_, i) =>
              new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() + i,
                12,
              ),
          )
        : [],
    [today],
  );
  const date = days[offset] ?? null;
  const input = useReviewInput(date);

  const wellbeingDays = useWellbeingDays();
  const refused = useMemo(() => refusedFoodIds(wellbeingDays), [wellbeingDays]);
  const week = useLocalStore(
    () => days.map((x) => ({ day: dateKey(x), lunch: getWellbeing(x).lunch })),
    EMPTY_WEEK,
    today ? dateKey(today) : "",
  );
  const lunchName = useLocalStore(getLunchName, null);

  const options = useMemo(
    () =>
      input && date
        ? lunchOptions({ ...input, refused })
        : { kind: "no-marks" as const, held: [] as LunchHeld[] },
    [input, date, refused],
  );

  // Los nombres de todo lo que se puede llevar en la semana (para las compras y para lo ya empacado).
  const names = useMemo(() => {
    const m = new Map<string, LocalizedText>();
    if (!input) return m;
    for (const x of days) {
      const o = lunchOptions({ ...input, now: x, refused });
      if (o.kind === "options") for (const i of o.items) m.set(i.key, i.name);
      for (const h of o.held) m.set(h.key, h.name);
    }
    return m;
  }, [input, days, refused]);

  if (!today || !date || !input) {
    return <p className="text-muted-foreground">{d.common.planLoading}</p>;
  }

  const dayLunch = week[offset]?.lunch ?? {};
  const school = family.phase !== "off" && family.role === "school";
  const schoolHasSlot = !school || (family.meals?.length ?? 0) > 0;
  const canWrite = can({ k: "lunch" }) && !school;
  const shopping = shoppingList(week, names);
  const packedKeys = Object.keys(dayLunch).filter((k) => names.has(k));

  const set = (key: string, state: LunchState | null) => {
    setLunch(date, key, state);
    wellbeingChanged();
  };

  const dayLabel = (x: Date, i: number) =>
    i === 0
      ? d.lunch.today
      : x.toLocaleDateString(locale, { weekday: "short", day: "numeric" });

  if (!schoolHasSlot)
    return (
      <div className="flex flex-col gap-4">
        <Head />
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm">
          {d.lunch.schoolNoSlot}
        </p>
      </div>
    );

  const printable: Pick<LunchItem, "name">[] = packedKeys.map((k) => ({
    name: names.get(k)!,
  }));
  const label = buildLabel({
    diet: input.diet,
    now: date,
    notes: input.notes,
    items: printable,
    childName: lunchName,
  });

  return (
    <div className="flex flex-col gap-5 pb-6">
      <Head />
      {!canWrite && (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm">
          {d.lunch.readOnly}
        </p>
      )}

      <div
        role="group"
        aria-label={d.lunch.dayLabel}
        className="flex flex-wrap gap-1.5"
        data-no-print
      >
        {days.map((x, i) => (
          <button
            key={dateKey(x)}
            type="button"
            aria-pressed={i === offset}
            onClick={() => setOffset(i)}
            className={cn(
              "min-h-11 rounded-full border px-3 text-sm font-medium",
              i === offset
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent",
            )}
          >
            {i === offset && <span aria-hidden>✓ </span>}
            {dayLabel(x, i)}
          </button>
        ))}
      </div>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="lunch-options"
        data-no-print
      >
        <h2 id="lunch-options" className="text-xl">
          {d.lunch.optionsTitle}
        </h2>
        <p className="-mt-2 text-sm text-muted-foreground">
          {d.lunch.optionsLead}
        </p>

        {options.kind === "no-marks" ? (
          <div
            className="flex flex-col gap-2 rounded-xl bg-accent px-4 py-3 text-accent-foreground"
            data-testid="lunch-no-marks"
          >
            <p className="font-semibold">{d.lunch.noMarksTitle}</p>
            <p className="text-sm">{d.lunch.noMarksBody}</p>
            <Link
              href="/perfil"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline"
            >
              {d.lunch.noMarksLink}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </div>
        ) : options.items.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-3 text-sm">
            {d.lunch.emptyToday}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="lunch-options">
            {options.items.map((i) => (
              <OptionRow
                key={i.key}
                item={i}
                state={dayLunch[i.key]}
                canWrite={canWrite}
                onSet={(s) => set(i.key, s)}
              />
            ))}
          </ul>
        )}

        {options.held.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="lunch-held">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {d.lunch.heldTitle}
            </h3>
            <ul className="text-sm text-muted-foreground">
              {options.held.map((h) => (
                <li key={h.key}>
                  {fmt(d.lunch.heldLine, {
                    name: l(h.name),
                    why:
                      h.reason === "texture"
                        ? d.lunch.heldTexture
                        : d.lunch.heldRefused,
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section
        className="flex flex-col gap-2"
        aria-labelledby="lunch-packed"
        data-no-print
      >
        <h2 id="lunch-packed" className="text-xl">
          {d.lunch.packedTitle}
        </h2>
        {packedKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{d.lunch.packedEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="lunch-packed">
            {packedKeys.map((k) => {
              const state = dayLunch[k];
              const Icon = STATE_ICON[state];
              return (
                <li
                  key={k}
                  className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2"
                  aria-label={fmt(d.lunch.stateAria, {
                    name: l(names.get(k)!),
                    state: d.lunch.states[state],
                  })}
                >
                  <Icon aria-hidden className="size-4" />
                  <span className="font-medium">{l(names.get(k)!)}</span>
                  <span className="text-sm text-muted-foreground">
                    {d.lunch.states[state]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        className="flex flex-col gap-2"
        aria-labelledby="lunch-shopping"
        data-no-print
      >
        <h2 id="lunch-shopping" className="text-xl">
          {d.lunch.shoppingTitle}
        </h2>
        <p className="-mt-1 text-sm text-muted-foreground">
          {d.lunch.shoppingLead}
        </p>
        {shopping.length === 0 ? (
          <p className="text-sm">{d.lunch.shoppingEmpty}</p>
        ) : (
          <ul className="list-disc pl-5" data-testid="lunch-shopping">
            {shopping.map((s) => (
              <li key={s.key}>
                {fmt(
                  s.days === 1 ? d.lunch.shoppingOne : d.lunch.shoppingMany,
                  { name: l(s.name), n: s.days },
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="lunch-label">
        <h2 id="lunch-label" className="text-xl" data-no-print>
          {d.lunch.labelTitle}
        </h2>
        <p className="-mt-2 text-sm text-muted-foreground" data-no-print>
          {d.lunch.labelLead}
        </p>
        <NameField
          key={lunchName ?? ""}
          saved={lunchName}
          canWrite={can({ k: "lunch-label" }) && !school}
        />
        <div
          data-print-sheet
          data-testid="lunch-label-sheet"
          className="flex flex-wrap items-start gap-4 rounded-xl border bg-card px-4 py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            {label.lines.map((line, i) => (
              <p key={i} className={i === 0 ? "font-semibold" : undefined}>
                {line}
              </p>
            ))}
          </div>
          <WhenInView
            placeholder={<div aria-hidden className="size-44 shrink-0" />}
          >
            <LunchQr
              text={label.text}
              alt={d.lunch.labelQrAlt}
              building={d.lunch.labelBuilding}
              failed={d.lunch.labelQrError}
            />
          </WhenInView>
        </div>
        {label.cut && (
          <p className="text-sm text-muted-foreground" data-no-print>
            {d.lunch.labelCut}
          </p>
        )}
        <div className="flex flex-col gap-1" data-no-print>
          <Button
            className="min-h-11 self-start"
            onClick={() => window.print()}
          >
            <Printer aria-hidden />
            {d.lunch.labelPrint}
          </Button>
          <p className="text-sm text-muted-foreground">
            {d.lunch.labelPrintHint}
          </p>
        </div>
      </section>

      <p className="text-sm text-muted-foreground" data-no-print>
        {d.common.offline}
      </p>
    </div>
  );
}

function Head() {
  const d = useLunchDt();
  return (
    <>
      <h1 className="text-3xl" data-no-print>
        {d.lunch.title}
      </h1>
      <p className="-mt-2 text-muted-foreground" data-no-print>
        {d.lunch.lead}
      </p>
      <p
        className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground"
        data-no-print
      >
        {d.common.notMedical}
      </p>
    </>
  );
}

function OptionRow({
  item,
  state,
  canWrite,
  onSet,
}: {
  item: LunchItem;
  state: LunchState | undefined;
  canWrite: boolean;
  onSet: (s: LunchState | null) => void;
}) {
  const d = useLunchDt();
  const { l } = useI18n();
  const Icon = state ? STATE_ICON[state] : null;
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{l(item.name)}</span>
        <StatusChip color={item.color} />
      </div>
      <p className="text-sm text-muted-foreground">
        {item.by === "plan" ? d.lunch.byPlan : d.lunch.byAdult}
        {item.from ? ` · ${fmt(d.lunch.fromLine, { from: l(item.from) })}` : ""}
      </p>
      {item.limit && (
        <p className="text-sm">
          {fmt(d.lunch.limitLine, { limit: l(item.limit) })}
        </p>
      )}
      {state && Icon && (
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon aria-hidden className="size-4" />
          {d.lunch.states[state]}
        </p>
      )}
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {!state && (
            <Button
              size="sm"
              className="min-h-11"
              aria-label={fmt(d.lunch.packAria, { name: l(item.name) })}
              onClick={() => onSet("packed")}
            >
              <Package aria-hidden />
              {d.lunch.pack}
            </Button>
          )}
          {state === "packed" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => onSet("eaten")}
              >
                <Check aria-hidden />
                {d.lunch.markEaten}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => onSet("back")}
              >
                <House aria-hidden />
                {d.lunch.markBack}
              </Button>
            </>
          )}
          {state && (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => onSet(null)}
            >
              <X aria-hidden />
              {d.lunch.clear}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function NameField({
  saved,
  canWrite,
}: {
  saved: string | null;
  canWrite: boolean;
}) {
  const d = useLunchDt();
  const [draft, setDraft] = useState(saved ?? "");
  if (!canWrite)
    return (
      <p className="text-sm text-muted-foreground" data-no-print>
        {d.lunch.labelNameOnlyParent}
      </p>
    );
  return (
    <div className="flex flex-col gap-1" data-no-print>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted-foreground">
          {d.lunch.labelNameLabel}
        </span>
        <input
          type="text"
          value={draft}
          maxLength={NAME_MAX}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-11 rounded-lg border bg-background px-3"
          autoComplete="off"
        />
      </label>
      <p className="text-sm text-muted-foreground">{d.lunch.labelNameHint}</p>
      <Button
        size="sm"
        className="min-h-11 self-start"
        disabled={draft.trim() === (saved ?? "")}
        onClick={() => {
          setLunchName(draft);
          wellbeingChanged();
        }}
      >
        {d.lunch.labelNameSave}
      </Button>
    </div>
  );
}
