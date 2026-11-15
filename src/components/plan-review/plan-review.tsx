"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Minus,
  Pencil,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { fmt, useI18n, type Dictionary } from "@/i18n";
import {
  REQUIRED_KEYS,
  REVIEW_KEYS,
  SECTIONS,
  WEEKDAYS,
  absentBlock,
  isComplete,
  markSection,
  pageOf,
  pendingKeys,
  removeRow,
  rowsOf,
  upsertRow,
  wasUnrecognized,
  type FieldSpec,
  type Mark,
  type ReviewKey,
  type ReviewState,
  type Row,
  type Values,
} from "@/lib/diet/plan-review";
import { cn } from "@/lib/utils";

/**
 * «Revisa tu plan» (ADR-010, decisión 1 a): la lista de partes con su estado y, al abrir
 * una, lo que se leyó con su página. Cada parte se confirma, se corrige o se marca «mi plan
 * no lo trae»; lo que el lector no encontró se completa a mano aquí mismo.
 * Todo estado lleva símbolo + texto + color. La lógica vive en lib/diet/plan-review.
 */

type L = Dictionary["load"];
const sectionName = (t: L, k: ReviewKey) => t[`sec_${k}` as keyof L];
const fieldName = (t: L, k: string) => t[`f_${k}` as keyof L];

const MARK_VIEW: Record<
  Mark,
  { icon: typeof Circle; label: keyof L; tone: string }
> = {
  pending: {
    icon: Circle,
    label: "markPending",
    tone: "border border-foreground/40 text-foreground",
  },
  ok: {
    icon: CircleCheck,
    label: "markOk",
    tone: "bg-tl-green-surface text-tl-green",
  },
  corrected: {
    icon: Pencil,
    label: "markCorrected",
    tone: "bg-tl-yellow-surface text-tl-yellow",
  },
  absent: {
    icon: Minus,
    label: "markAbsent",
    tone: "bg-muted text-muted-foreground",
  },
};

function MarkChip({ mark }: { mark: Mark }) {
  const { t } = useI18n();
  const v = MARK_VIEW[mark];
  const Icon = v.icon;
  return (
    <span
      data-mark={mark}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        v.tone,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {t.load[v.label]}
    </span>
  );
}

const INPUT =
  "min-h-11 w-full rounded-lg border border-input bg-card px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-tl-red aria-invalid:ring-2 aria-invalid:ring-tl-red/30 md:text-sm";

function FieldInput({
  spec,
  sectionKey,
  value,
  invalid,
  onChange,
}: {
  spec: FieldSpec;
  sectionKey: ReviewKey;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const id = `rv-${sectionKey}-${spec.key}`;
  const label = fieldName(t.load, spec.key);
  if (spec.kind === "days") {
    const on = value.split(",").filter(Boolean);
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-semibold">{label}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const sel = on.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={sel}
                className={cn(
                  "min-h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold",
                  sel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card",
                )}
                onClick={() =>
                  onChange(
                    WEEKDAYS.filter((x) =>
                      x === d ? !sel : on.includes(x),
                    ).join(","),
                  )
                }
              >
                {sel ? "✓ " : ""}
                {t.weekdays[d].slice(0, 3)}
              </button>
            );
          })}
        </div>
        {invalid && <FieldError />}
      </fieldset>
    );
  }
  const type =
    spec.kind === "time" ? "time" : spec.kind === "date" ? "date" : "text";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={spec.kind === "number" ? "decimal" : undefined}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-err` : undefined}
        className={INPUT}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && <FieldError id={`${id}-err`} />}
    </div>
  );
}

function FieldError({ id }: { id?: string }) {
  const { t } = useI18n();
  return (
    <p
      id={id}
      className="flex items-center gap-1.5 text-sm font-semibold text-tl-red"
    >
      <TriangleAlert aria-hidden className="size-4 shrink-0" />
      {t.load.fieldsError}
    </p>
  );
}

function RowForm({
  sectionKey,
  initial,
  onSubmit,
  onCancel,
}: {
  sectionKey: ReviewKey;
  initial: Values;
  onSubmit: (values: Values) => string[] | null;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<Values>(initial);
  const [bad, setBad] = useState<string[]>([]);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        const errors = onSubmit(values);
        if (errors) setBad(errors);
      }}
    >
      {SECTIONS[sectionKey].fields.map((spec) => (
        <FieldInput
          key={spec.key}
          spec={spec}
          sectionKey={sectionKey}
          value={values[spec.key] ?? ""}
          invalid={bad.includes(spec.key)}
          onChange={(v) => setValues((p) => ({ ...p, [spec.key]: v }))}
        />
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1">
          {t.load.saveRow}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="flex-1 bg-transparent"
          onClick={onCancel}
        >
          {t.load.cancel}
        </Button>
      </div>
    </form>
  );
}

function rowTitle(row: Row, key: ReviewKey, t: Dictionary): string {
  const v = row.values;
  const days = (v.days ?? "")
    .split(",")
    .filter(Boolean)
    .map((d) => t.weekdays[d as (typeof WEEKDAYS)[number]]?.slice(0, 3))
    .join(" ");
  const parts =
    key === "supplements"
      ? [v.name, days, v.dose, v.when]
      : key === "menu"
        ? [`${v.start}–${v.end}`, v.name, v.content]
        : key === "hydration"
          ? [`${v.min}–${v.max} L`, v.habit]
          : SECTIONS[key].fields.map((f) => v[f.key]);
  return parts.filter(Boolean).join(" · ");
}

function SectionView({
  state,
  sectionKey,
  onChange,
  onBack,
}: {
  state: ReviewState;
  sectionKey: ReviewKey;
  onChange: (s: ReviewState) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [sectionKey]);
  // `null` = cerrado · `""` = añadiendo · id = editando esa fila
  const [editing, setEditing] = useState<string | null>(null);

  const rows = rowsOf(state, sectionKey);
  const spec = SECTIONS[sectionKey];
  const block = absentBlock(state, sectionKey);
  const required = REQUIRED_KEYS.includes(sectionKey);
  const unrecognized = wasUnrecognized(state, sectionKey);
  const mark = state.marks[sectionKey];
  const hint =
    sectionKey === "red"
      ? t.load.hint_red
      : sectionKey === "restricted"
        ? t.load.hint_restricted
        : null;
  const canAdd = !(spec.single && rows.length > 0);
  const emptyValues = Object.fromEntries(
    spec.fields.map((f) => [f.key, ""]),
  ) as Values;

  const submit = (id: string | null) => (values: Values) => {
    const r = upsertRow(state, sectionKey, id, values);
    if (!r.ok) return r.bad;
    onChange(r.state);
    setEditing(null);
    return null;
  };

  const confirm = () => {
    const r = markSection(state, sectionKey, "ok");
    if (r.ok) {
      onChange(r.state);
      onBack();
    }
  };
  const absent = () => {
    const r = markSection(state, sectionKey, "absent");
    if (r.ok) {
      onChange(r.state);
      onBack();
    }
  };

  return (
    <section className="flex flex-col gap-4" data-testid="review-section">
      <Button variant="ghost" className="-ml-2 self-start" onClick={onBack}>
        <ChevronLeft aria-hidden className="size-4" />
        {t.load.back}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 ref={heading} tabIndex={-1} className="text-2xl outline-none">
          {sectionName(t.load, sectionKey)}
        </h2>
        <MarkChip mark={mark} />
      </div>
      {hint && (
        <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
      )}
      {unrecognized && rows.length === 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm font-semibold leading-relaxed text-tl-yellow">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.load.unrecognizedNote}
        </p>
      )}
      {!unrecognized && rows.length === 0 && editing === null && (
        <p className="text-sm text-muted-foreground">{t.load.emptyNote}</p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const page = pageOf(state, sectionKey, row.id);
          const title = rowTitle(row, sectionKey, t);
          return (
            <li key={row.id}>
              {editing === row.id ? (
                <RowForm
                  sectionKey={sectionKey}
                  initial={row.values}
                  onSubmit={submit(row.id)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3">
                  <p className="text-base leading-snug">{title}</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {page !== undefined
                      ? fmt(t.load.pageLabel, { n: page })
                      : t.load.addedByYou}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent"
                      aria-label={fmt(t.load.editLabel, { name: title })}
                      onClick={() => setEditing(row.id)}
                    >
                      <Pencil aria-hidden className="size-4" />
                      {t.load.edit}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent"
                      aria-label={fmt(t.load.removeLabel, { name: title })}
                      onClick={() => {
                        onChange(removeRow(state, sectionKey, row.id));
                        setEditing(null);
                      }}
                    >
                      <Minus aria-hidden className="size-4" />
                      {t.load.remove}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing === "" ? (
        <RowForm
          sectionKey={sectionKey}
          initial={emptyValues}
          onSubmit={submit(spec.single ? "single" : null)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        canAdd && (
          <Button variant="secondary" size="lg" onClick={() => setEditing("")}>
            <Plus aria-hidden className="size-4" />
            {t.load.add}
          </Button>
        )
      )}

      <div className="flex flex-col gap-2 border-t pt-4">
        <Button
          size="lg"
          disabled={rows.length === 0}
          aria-describedby={rows.length === 0 ? "rv-ok-why" : undefined}
          onClick={confirm}
        >
          <CircleCheck aria-hidden className="size-5" />
          {t.load.confirmButton}
        </Button>
        {rows.length === 0 && (
          <p id="rv-ok-why" className="text-sm text-muted-foreground">
            {t.load.confirmEmpty}
          </p>
        )}
        <Button
          size="lg"
          variant="outline"
          className="bg-transparent"
          disabled={block !== null}
          aria-describedby={block ? "rv-absent-why" : undefined}
          onClick={absent}
        >
          <Minus aria-hidden className="size-5" />
          {t.load.absentButton}
        </Button>
        {block && (
          <p id="rv-absent-why" className="text-sm text-muted-foreground">
            {required ? t.load.absentRequired : t.load.absentHasContent}
          </p>
        )}
      </div>
    </section>
  );
}

export function PlanReview({
  state,
  onChange,
  onSave,
  onDiscard,
  saveFailed,
}: {
  state: ReviewState;
  onChange: (s: ReviewState) => void;
  onSave: () => void;
  onDiscard: () => void;
  saveFailed: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<ReviewKey | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    // Al volver de una parte, el foco regresa al título de la lista (no al inicio de la página).
    if (first.current) {
      first.current = false;
      return;
    }
    if (open === null) listHeading.current?.focus();
  }, [open]);

  if (open !== null)
    return (
      <SectionView
        state={state}
        sectionKey={open}
        onChange={onChange}
        onBack={() => setOpen(null)}
      />
    );

  const pending = pendingKeys(state);
  const missing = REQUIRED_KEYS.filter((k) => rowsOf(state, k).length === 0);
  const complete = isComplete(state);
  const done = REVIEW_KEYS.length - pending.length;

  return (
    <section className="flex flex-col gap-4" data-testid="review-list">
      <h2 ref={listHeading} tabIndex={-1} className="text-2xl outline-none">
        {t.load.reviewTitle}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.load.reviewIntro}
      </p>
      <p className="text-sm font-semibold" data-tabular data-testid="progress">
        {fmt(t.load.reviewProgress, {
          done,
          total: REVIEW_KEYS.length,
        })}
      </p>
      <ul className="flex flex-col gap-2">
        {REVIEW_KEYS.map((k) => {
          const n = rowsOf(state, k).length;
          return (
            <li key={k}>
              <button
                type="button"
                data-section={k}
                aria-label={fmt(t.load.sectionOpen, {
                  name: sectionName(t.load, k),
                })}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left"
                onClick={() => setOpen(k)}
              >
                <span className="flex flex-col gap-1.5">
                  <span className="font-heading text-base font-semibold leading-snug">
                    {sectionName(t.load, k)}
                  </span>
                  <MarkChip mark={state.marks[k]} />
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  {n > 0 && (
                    <span className="text-sm font-semibold" data-tabular>
                      {n}
                    </span>
                  )}
                  <ChevronRight aria-hidden className="size-4" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {saveFailed && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-tl-red-surface px-4 py-3 text-sm font-semibold leading-relaxed text-tl-red"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.load.saveFailed}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          disabled={!complete}
          aria-describedby={complete ? undefined : "rv-save-why"}
          onClick={onSave}
        >
          {t.load.savePlan}
        </Button>
        {!complete && (
          <p id="rv-save-why" className="text-sm text-muted-foreground">
            {pending.length > 0
              ? fmt(t.load.saveBlocked, { n: pending.length })
              : fmt(t.load.saveBlockedRequired, {
                  names: missing.map((k) => sectionName(t.load, k)).join(", "),
                })}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t.load.reviewPrivacy}</p>
        <Button
          variant="ghost"
          className="self-start text-muted-foreground"
          onClick={onDiscard}
        >
          {t.load.resumeDiscard}
        </Button>
      </div>
    </section>
  );
}
