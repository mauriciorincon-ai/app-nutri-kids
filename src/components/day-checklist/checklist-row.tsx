"use client";

import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Fila marcable del checklist del día. Checkbox ≥44px de área táctil.
 * Al marcar, el texto se ATENÚA (no se tacha): marcar no es eliminar.
 */
export function ChecklistRow({
  done,
  onToggle,
  title,
  detail,
  time,
  ariaLabel,
}: {
  done: boolean;
  onToggle: () => void;
  title: string;
  detail?: string;
  time?: string;
  ariaLabel: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
        done ? "border-transparent bg-muted" : "hover:bg-accent",
      )}
    >
      <Checkbox
        id={id}
        checked={done}
        onCheckedChange={onToggle}
        aria-label={ariaLabel}
        className="mt-0.5 size-6 rounded-md"
      />
      <span
        className={cn(
          "min-w-0 flex-1 transition-opacity",
          done && "opacity-55",
        )}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{title}</span>
          {time && (
            <time
              className="shrink-0 text-sm text-muted-foreground"
              data-tabular
            >
              {time}
            </time>
          )}
        </span>
        {detail && (
          <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
    </label>
  );
}
