import type { RiskLevel } from "@/lib/insights/risk";

/** La mochila que se llena (S15 · ADR-021): ligera, con algo más, llena. Solo dibujo; el texto la acompaña. */
const FILL: Record<RiskLevel, { y: number; h: number }> = {
  low: { y: 34, h: 5 },
  mid: { y: 27, h: 12 },
  high: { y: 20, h: 19 },
};

export function Pack({
  level,
  className,
}: {
  level: RiskLevel;
  className?: string;
}) {
  const f = FILL[level];
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      focusable="false"
    >
      <path
        d="M16 14v-3a8 8 0 0 1 16 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      />
      <rect
        x={10}
        y={14}
        width={28}
        height={28}
        rx={7}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      />
      <rect x={16} y={f.y} width={16} height={f.h} rx={2} fill="currentColor" />
    </svg>
  );
}
