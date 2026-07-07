"use client";

import Link from "next/link";

import { fmt, useI18n } from "@/i18n";
import type { ItemStatus } from "@/lib/diet/logic";
import { formatShortDate } from "@/lib/format";
import { StatusChip } from "./status-chip";

/**
 * Tarjeta de alimento: nombre + estado (símbolo+texto) + la condición en palabras.
 * Toda la tarjeta es tap target (≥44px) hacia el detalle con equivalencias.
 */
export function ItemCard({ status }: { status: ItemStatus }) {
  const { t, l, locale } = useI18n();

  const condition =
    status.kind === "yellow"
      ? l(status.limit)
      : status.kind === "restricted" && status.restrictionActive
        ? fmt(t.status.restrictedUntil, {
            date: formatShortDate(status.until, locale),
          })
        : status.kind === "red" && status.why
          ? l(status.why)
          : null;

  return (
    <Link
      href={`/dieta/${status.id}`}
      aria-label={fmt(t.diet.seeDetail, { name: l(status.name) })}
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="min-w-0">
        <span className="block font-semibold">{l(status.name)}</span>
        {condition && (
          <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
            {condition}
          </span>
        )}
      </span>
      <StatusChip color={status.color} className="shrink-0" />
    </Link>
  );
}
