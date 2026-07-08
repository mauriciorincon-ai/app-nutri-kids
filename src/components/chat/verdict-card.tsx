"use client";

import { StatusChip } from "@/components/traffic-light/status-chip";
import { fmt, useI18n } from "@/i18n";
import { formatShortDate } from "@/lib/format";
import type { LocalVerdict } from "@/lib/diet/search";

/**
 * Tarjeta de veredicto del Camino A (respondida desde el plan, sin IA).
 * Reusa StatusChip (único dueño de los colores del semáforo) y el patrón de
 * chips de equivalencias del detalle de la dieta.
 */
export function VerdictCard({ verdict }: { verdict: LocalVerdict }) {
  const { t, l, locale } = useI18n();

  if (verdict.kind === "additive") {
    const { additive } = verdict;
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">
            {additive.code} · {l(additive.name)}
          </h3>
          <StatusChip color="red" label={t.chat.additiveTitle} />
        </div>
        <p className="mt-1.5 text-sm text-foreground/80">
          {fmt(t.chat.additiveFoundIn, { where: l(additive.foundIn) })}
        </p>
      </div>
    );
  }

  const { status } = verdict;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{l(status.name)}</h3>
        <StatusChip color={status.color} />
      </div>

      {status.kind === "restricted" && (
        <p className="mt-1.5 text-sm font-medium text-tl-red">
          {status.restrictionActive
            ? fmt(t.chat.restrictedUntil, {
                date: formatShortDate(status.until, locale),
              })
            : t.chat.restrictionEnded}
        </p>
      )}
      {status.kind === "red" && status.why && (
        <p className="mt-1.5 text-sm text-foreground/80">{l(status.why)}</p>
      )}
      {status.kind === "yellow" && (
        <p className="mt-1.5 text-sm font-medium text-tl-yellow">
          {l(status.limit)}
        </p>
      )}
      {status.kind === "green" && (
        <p className="mt-1.5 text-sm text-foreground/80">
          {fmt(t.diet.groupPortion, { portion: l(status.group.portion) })}
        </p>
      )}

      {status.equivalences.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">{t.chat.replacementsTitle}</p>
          {status.equivalences.map((eq, i) => (
            <ul key={i} className="mt-2 flex flex-wrap gap-2">
              {eq.use.map((u, j) => (
                <li
                  key={j}
                  className="rounded-full bg-tl-green-surface px-3 py-1.5 text-sm font-semibold text-tl-green"
                >
                  {l(u)}
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}
