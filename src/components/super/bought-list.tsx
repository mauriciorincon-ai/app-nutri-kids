"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";

import { hitText, VerdictChip } from "@/components/label/label-result";
import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import type { LabelText } from "@/i18n/label";
import type { SuperText } from "@/i18n/super";
import { checkProduct } from "@/lib/catalog/product";
import type { DietPlan } from "@/lib/diet/schema";
import type { LabelCheck } from "@/lib/label/check";
import type { ScanClient } from "@/lib/scan/client";
import type { Bought } from "@/lib/shopping/store";
import { formatShortDate } from "@/lib/format";

type Now = LabelCheck | "gone" | "unknown";

/**
 * «Lo que compré» (S13 · ADR-019): la lista de este teléfono, revisada CADA VEZ con el plan de hoy
 * (jamás se guarda un veredicto). Si algo ya no va, un aviso calmado con sus motivos; sin alarma.
 */
export function BoughtList({
  items,
  client,
  diet,
  now,
  notes,
  t,
  s,
  canWrite,
  onRemove,
}: {
  items: Bought[];
  /** `null` hasta que el catálogo esté listo: la lista se ve, pero sin veredicto. */
  client: ScanClient | null;
  diet: DietPlan;
  now: Date | null;
  notes: readonly { kind: string; text: string }[];
  t: LabelText;
  s: SuperText;
  canWrite: boolean;
  onRemove: (code: string) => void;
}) {
  const { l, locale } = useI18n();
  const [verdicts, setVerdicts] = useState<Record<string, Now>>({});

  useEffect(() => {
    if (!client || !now || items.length === 0) return;
    let alive = true;
    void (async () => {
      const out: Record<string, Now> = {};
      for (const item of items) {
        try {
          const { product, found } = await client.lookup(item.code);
          out[item.code] = product
            ? checkProduct(product, diet, now, notes)
            : found
              ? "unknown"
              : "gone";
        } catch {
          out[item.code] = "unknown";
        }
      }
      if (alive) setVerdicts(out);
    })();
    return () => {
      alive = false;
    };
  }, [client, items, diet, now, notes]);

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="bought-title"
      data-testid="bought"
    >
      <h2 id="bought-title" className="text-xl">
        {s.boughtTitle}
      </h2>
      <p className="-mt-1 text-sm text-muted-foreground">{s.boughtLead}</p>
      {items.length === 0 ? (
        <p className="text-sm" data-testid="bought-empty">
          {s.boughtEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const v = client ? verdicts[item.code] : undefined;
            const check = v && typeof v === "object" ? v : null;
            const reasons = check
              ? check.hits.map((h) => hitText(h, t, l)).join(" ")
              : "";
            return (
              <li
                key={item.code}
                className="flex flex-col gap-2 rounded-xl border p-3"
                data-testid={`bought-${item.code}`}
                data-verdict={check?.verdict ?? v ?? "pending"}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        item.brand,
                        fmt(s.boughtSince, {
                          date: formatShortDate(item.date, locale),
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label={fmt(s.remove, { name: item.name })}
                      onClick={() => onRemove(item.code)}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </div>
                {!client ? (
                  <p className="text-sm text-muted-foreground">
                    {s.boughtPending}
                  </p>
                ) : v === "gone" ? (
                  <p className="text-sm">{s.boughtGone}</p>
                ) : v === "unknown" ||
                  (check &&
                    check.verdict === "unreadable") ? (
                  <p className="text-sm">{s.boughtUnknown}</p>
                ) : check && check.verdict !== "ok" ? (
                  <div className="flex flex-col gap-1.5">
                    <VerdictChip verdict={check.verdict} t={t} />
                    <p className="flex items-start gap-2 text-sm">
                      <TriangleAlert
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0"
                      />
                      {fmt(
                        check.verdict === "no"
                          ? s.boughtWarnNo
                          : s.boughtWarnCheck,
                        { reasons },
                      )}
                    </p>
                  </div>
                ) : check ? (
                  <div className="flex flex-col gap-1.5">
                    <VerdictChip verdict="ok" t={t} />
                    <p className="text-sm text-muted-foreground">{s.boughtOk}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
