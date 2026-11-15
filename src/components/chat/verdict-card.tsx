"use client";

import { useProfileNotes } from "@/components/use-profile-notes";
import { OptionChip } from "@/components/traffic-light/option-chip";
import { StatusChip } from "@/components/traffic-light/status-chip";
import { fmt, useI18n } from "@/i18n";
import { formatShortDate } from "@/lib/format";
import type { LocalVerdict } from "@/lib/diet/search";
import { orderByTexture } from "@/lib/diet/texture";

/**
 * Tarjeta de veredicto del Camino A (respondida desde el plan, sin IA).
 * Reusa StatusChip (único dueño de los colores del semáforo) y el patrón de
 * chips de equivalencias del detalle de la dieta.
 */
export function VerdictCard({ verdict }: { verdict: LocalVerdict }) {
  const { t, l, locale } = useI18n();
  const { acceptedTextures } = useProfileNotes();

  if (verdict.kind === "additive") {
    const { additive } = verdict;
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {additive.code} · {l(additive.name)}
          </h2>
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
        <h2 className="text-lg font-semibold">{l(status.name)}</h2>
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
              {orderByTexture(eq.use, acceptedTextures).map((u, j) => (
                <OptionChip
                  key={j}
                  name={l(u.name)}
                  texture={u.texture}
                  notAccepted={u.notAccepted}
                />
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}
