"use client";

import { CircleHelp } from "lucide-react";

import { StatusChip } from "@/components/traffic-light/status-chip";
import { fmt, useI18n } from "@/i18n";
import type { LabelText } from "@/i18n/label";
import type { LabelCheck, LabelHit, Verdict } from "@/lib/label/check";

/**
 * El veredicto de una etiqueta (S13 · ADR-019): símbolo + texto + color, los motivos en palabras, el
 * texto leído a la vista y «verifícalo con un adulto». Lo mismo para la foto y para el catálogo (F2).
 * No decide nada: lo que dice sale de `checkLabel`.
 */
export function VerdictChip({
  verdict,
  t,
  unreadableLabel,
}: {
  verdict: Verdict;
  t: LabelText;
  /** Otra palabra para «no pude leerla» (el catálogo dice «sin lista de ingredientes»). */
  unreadableLabel?: string;
}) {
  if (verdict === "unreadable")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold">
        <CircleHelp aria-hidden className="size-4 shrink-0" />
        {unreadableLabel ?? t.verdictUnreadable}
      </span>
    );
  const map = {
    no: ["red", t.verdictNo],
    check: ["yellow", t.verdictCheck],
    ok: ["green", t.verdictOk],
  } as const;
  const [color, label] = map[verdict];
  return <StatusChip color={color} label={label} />;
}

export function hitText(
  hit: LabelHit,
  t: LabelText,
  l: (x: { es: string; en: string }) => string,
) {
  // «Lleva X» si está en los ingredientes; «Puede llevar X» si solo aparece tras «puede contener».
  const has = hit.where === "traces" ? t.mayHave : t.has;
  switch (hit.kind) {
    case "additive":
      return fmt(t.reasonAdditive, { has, seen: hit.seen, name: l(hit.name) });
    case "red":
      return fmt(t.reasonRed, { has, name: l(hit.name) });
    case "restricted":
      return fmt(hit.active ? t.reasonRestricted : t.reasonRestrictedEnded, {
        has,
        name: l(hit.name),
      });
    case "yellow":
      return fmt(t.reasonYellow, {
        has,
        name: l(hit.name),
        limit: l(hit.limit),
      });
    case "allergy":
      return fmt(t.reasonAllergy, { has, name: l(hit.name) });
    case "intolerance":
      return fmt(t.reasonIntolerance, { has, name: l(hit.name) });
    case "similar":
      return fmt(t.reasonSimilar, { seen: hit.seen, name: l(hit.name) });
  }
}

export function LabelResult({
  result,
  text,
  t,
  testId = "label-result",
  lead,
  chipUnreadable,
}: {
  result: LabelCheck;
  /** Lo que se leyó (o el texto del catálogo): siempre a la vista. */
  text: string;
  t: LabelText;
  testId?: string;
  /** Otra entrada para «no pude leerla» (el catálogo dice «no sé qué lleva»). */
  lead?: Partial<Record<Verdict, string>>;
  /** La palabra del chip cuando no se pudo leer (el catálogo: «Sin lista de ingredientes»). */
  chipUnreadable?: string;
}) {
  const { l } = useI18n();
  const leads: Record<Verdict, string> = {
    no: t.leadNo,
    check: t.leadCheck,
    unreadable: t.leadUnreadable,
    ok: t.leadOk,
    ...lead,
  };
  const named = new Set(
    result.hits.flatMap((h) => (h.kind === "additive" ? [h.code] : [])),
  );
  const others = result.codes.filter((c) => !named.has(c));
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border p-4"
      aria-live="polite"
      data-testid={testId}
      data-verdict={result.verdict}
    >
      <div className="flex flex-col gap-2">
        <VerdictChip
          verdict={result.verdict}
          t={t}
          unreadableLabel={chipUnreadable}
        />
        <p className="font-medium">{leads[result.verdict]}</p>
      </div>
      {result.hits.length > 0 && (
        <ul
          className="flex flex-col gap-2 text-sm"
          data-testid={`${testId}-hits`}
        >
          {result.hits.map((h, i) => (
            <li key={i} className="rounded-xl bg-muted px-3 py-2">
              {hitText(h, t, l)}
            </li>
          ))}
        </ul>
      )}
      {result.partial && <p className="text-sm font-medium">{t.partial}</p>}
      {others.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {fmt(t.codesSeen, { codes: others.join(", ") })}
        </p>
      )}
      <p className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
        {t.check}
      </p>
      <details
        className="rounded-xl border p-3"
        data-testid={`${testId}-text`}
        open
      >
        <summary className="min-h-11 cursor-pointer content-center font-semibold">
          {t.readTitle}
        </summary>
        <p className="mt-1 text-sm text-muted-foreground">{t.readNote}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">
          {text.trim() || t.readEmpty}
        </p>
      </details>
    </section>
  );
}
