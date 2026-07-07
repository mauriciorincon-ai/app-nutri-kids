"use client";

import { FlaskConical, HeartHandshake } from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Chip siempre visible de cuál dieta está activa — nadie confunde la demo con la real. */
export function SourceBanner() {
  const { source, ready } = useDiet();
  const { t } = useI18n();

  // Antes de hidratar no afirmamos nada (evita decir "demo" a quien ya cargó su dieta).
  if (!ready)
    return <span className="h-7 w-24 rounded-full bg-muted" aria-hidden />;

  const demo = source === "demo";
  const Icon = demo ? FlaskConical : HeartHandshake;
  return (
    <span
      title={demo ? t.source.demoHint : t.source.realHint}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
        demo
          ? "bg-secondary text-secondary-foreground"
          : "bg-tl-green-surface text-tl-green",
      )}
    >
      <Icon aria-hidden className="size-4" />
      {demo ? t.source.demo : t.source.real}
    </span>
  );
}
