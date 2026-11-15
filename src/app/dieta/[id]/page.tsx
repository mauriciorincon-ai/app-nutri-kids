"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { OptionChip } from "@/components/traffic-light/option-chip";
import { StatusChip } from "@/components/traffic-light/status-chip";
import { useProfileNotes } from "@/components/use-profile-notes";
import { fmt, useI18n } from "@/i18n";
import { resolveItemStatus } from "@/lib/diet/logic";
import { orderByTexture } from "@/lib/diet/texture";
import { formatShortDate } from "@/lib/format";

/**
 * Detalle de alimento: por qué está en ese color (palabras simples), cuánto,
 * y las equivalencias "si no hay X → usa Y o Z".
 * Ruta 100% dinámica en cliente: la dieta vive en el dispositivo.
 */
export default function ItemDetailPage() {
  // El id sale de la URL del navegador (no de los params del servidor): así el
  // cascarón guardado por el service worker sirve CUALQUIER alimento sin red.
  const pathname = usePathname();
  const rawId = pathname.split("/").filter(Boolean).pop() ?? "";
  const { diet } = useDiet();
  const { acceptedTextures } = useProfileNotes();
  const { t, l, locale } = useI18n();
  const today = useToday();

  const date = today ?? new Date(`${diet.restrictions.validFrom}T12:00:00`);
  const status = resolveItemStatus(diet, decodeURIComponent(rawId), date);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <Link
        href="/dieta"
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-primary"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t.detail.backToDiet}
      </Link>

      {!status ? (
        // Estado vacío diseñado: el alimento no está en el plan
        <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center">
          <p className="text-lg font-semibold">{t.status.notFound}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl">{l(status.name)}</h1>
            <StatusChip color={status.color} />
          </div>

          {status.kind === "restricted" && (
            <section className="rounded-xl bg-tl-red-surface px-4 py-3 text-tl-red">
              <p className="font-semibold">
                {status.restrictionActive
                  ? fmt(t.detail.restrictedNote, {
                      until: fmt(t.status.restrictedUntil, {
                        date: formatShortDate(status.until, locale),
                      }),
                    })
                  : t.status.restrictionEnded}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{l(status.note)}</p>
            </section>
          )}

          {status.kind === "red" && status.why && (
            <section>
              <h2 className="text-lg">{t.detail.whyTitle}</h2>
              <p className="mt-1 leading-relaxed text-foreground/85">
                {l(status.why)}
              </p>
            </section>
          )}

          {status.kind === "yellow" && (
            <section className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-tl-yellow">
              <h2 className="text-lg">{t.detail.limitTitle}</h2>
              <p className="mt-1 font-semibold">{l(status.limit)}</p>
            </section>
          )}

          {status.kind === "green" && (
            <section>
              <h2 className="text-lg">{l(status.group.name)}</h2>
              <p className="mt-1 text-foreground/85">
                {fmt(t.diet.groupPortion, { portion: l(status.group.portion) })}
              </p>
            </section>
          )}

          {status.equivalences.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg">{t.detail.equivalencesTitle}</h2>
              {status.equivalences.map((eq, i) => (
                <div key={i} className="rounded-xl border bg-card px-4 py-3">
                  <p className="font-semibold">{l(eq.title)}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {orderByTexture(eq.use, acceptedTextures).map((u, j) => (
                      <OptionChip
                        key={j}
                        name={l(u.name)}
                        texture={u.texture}
                        notAccepted={u.notAccepted}
                      />
                    ))}
                  </ul>
                  {eq.note && (
                    <p className="mt-2 text-sm leading-snug text-muted-foreground">
                      {l(eq.note)}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
