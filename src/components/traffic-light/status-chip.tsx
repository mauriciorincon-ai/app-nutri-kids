"use client";

import { CircleCheck, OctagonX, TriangleAlert } from "lucide-react";

import { useI18n } from "@/i18n";
import type { TrafficColor } from "@/lib/diet/logic";
import { cn } from "@/lib/utils";

/**
 * Pastilla del semáforo — el ÚNICO lugar donde viven sus colores.
 * Regla A11y dura: símbolo + texto siempre; el color solo refuerza.
 */

const STYLES: Record<TrafficColor, { chip: string; Icon: typeof CircleCheck }> =
  {
    green: { chip: "bg-tl-green-surface text-tl-green", Icon: CircleCheck },
    yellow: {
      chip: "bg-tl-yellow-surface text-tl-yellow",
      Icon: TriangleAlert,
    },
    red: { chip: "bg-tl-red-surface text-tl-red", Icon: OctagonX },
  };

export function StatusChip({
  color,
  className,
  label,
}: {
  color: TrafficColor;
  className?: string;
  /** Texto alterno (p.ej. "hasta el 28/09"); default: la palabra del estado. */
  label?: string;
}) {
  const { t } = useI18n();
  const { chip, Icon } = STYLES[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
        chip,
        className,
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {label ?? t.status[color]}
    </span>
  );
}
