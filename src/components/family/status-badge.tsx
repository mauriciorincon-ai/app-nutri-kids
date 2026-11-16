"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/i18n";
import type { FamilyPhase } from "@/lib/family/controller";
import { cn } from "@/lib/utils";

const LOOK: Record<
  Exclude<FamilyPhase, "off">,
  { icon: LucideIcon; tone: string }
> = {
  idle: { icon: CheckCircle2, tone: "bg-tl-green-surface text-tl-green" },
  syncing: { icon: RefreshCw, tone: "bg-muted text-foreground" },
  offline: { icon: WifiOff, tone: "bg-tl-yellow-surface text-tl-yellow" },
  locked: { icon: Lock, tone: "bg-tl-red-surface text-tl-red" },
  unavailable: {
    icon: AlertTriangle,
    tone: "bg-tl-yellow-surface text-tl-yellow",
  },
  full: { icon: AlertTriangle, tone: "bg-tl-yellow-surface text-tl-yellow" },
  error: { icon: AlertTriangle, tone: "bg-tl-red-surface text-tl-red" },
};

const LABEL = {
  idle: "statusIdle",
  syncing: "statusSyncing",
  offline: "statusOffline",
  locked: "statusLocked",
  unavailable: "statusUnavailable",
  full: "statusFull",
  error: "statusError",
} as const;

const BODY = {
  idle: "bodyIdle",
  syncing: "bodySyncing",
  offline: "bodyOffline",
  locked: "bodyLocked",
  unavailable: "bodyUnavailable",
  full: "bodyFull",
  error: "bodyError",
} as const;

/** Estado de la sincronía: símbolo + palabra + color, y una línea que lo explica. */
export function StatusBadge({ phase }: { phase: Exclude<FamilyPhase, "off"> }) {
  const { t } = useI18n();
  const { icon: Icon, tone } = LOOK[phase];
  return (
    <div role="status" className={cn("rounded-xl px-4 py-3", tone)}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="size-5 shrink-0" />
        <span data-testid="family-status">{t.family[LABEL[phase]]}</span>
      </p>
      <p className="mt-1 text-sm leading-snug">{t.family[BODY[phase]]}</p>
    </div>
  );
}
