"use client";

import { Layers } from "lucide-react";

import { fmt, useI18n } from "@/i18n";
import type { MergedInfo, MergedLine } from "@/lib/diet/schema";

/** «Plan A» / «Plan B» con el título que el plan trae (el origen de una línea del plan unido). */
export function useOriginName() {
  const { t, l } = useI18n();
  return (merged: MergedInfo, side: "a" | "b") =>
    `${side === "a" ? t.merge.planA : t.merge.planB} (${l(merged.from[side === "a" ? 0 : 1].title)})`;
}

/** Texto del origen de una línea, sin culpa y sin alarma. */
export function useOriginText() {
  const { t } = useI18n();
  const name = useOriginName();
  return (merged: MergedInfo, line: MergedLine): string => {
    const origin =
      line.from === "both" ? t.merge.originBoth : name(merged, line.from);
    switch (line.rule) {
      case "only":
        return fmt(t.merge.originOnly, { origin });
      case "same":
        return t.merge.originSame;
      case "red":
        return fmt(t.merge.originRed, { origin });
      case "picked":
        return fmt(t.merge.originPicked, { origin });
      case "parent":
        return fmt(t.merge.originParent, { origin });
    }
  };
}

/** Pastilla de origen: símbolo + texto (nunca solo color). */
export function OriginBadge({
  merged,
  lineKey,
}: {
  merged: MergedInfo | undefined;
  lineKey: string;
}) {
  const text = useOriginText();
  const line = merged?.lines[lineKey];
  if (!merged || !line) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground"
      data-testid="origin-badge"
    >
      <Layers aria-hidden className="size-3.5 shrink-0" />
      {text(merged, line)}
    </span>
  );
}
