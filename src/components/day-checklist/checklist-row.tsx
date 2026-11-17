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
  by,
  ariaLabel,
  disabled = false,
}: {
  done: boolean;
  onToggle: () => void;
  title: string;
  detail?: string;
  time?: string;
  /** «Por Mamá»: quién la marcó (solo si hay familia). */
  by?: string;
  ariaLabel: string;
  /** Con un rol que no marca esto (S9): se ve, no se cambia. */
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-14 items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
        disabled ? "cursor-default" : "cursor-pointer",
        done ? "border-transparent bg-muted" : !disabled && "hover:bg-accent",
      )}
    >
      <Checkbox
        id={id}
        checked={done}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label={ariaLabel}
        className="mt-0.5 size-6 rounded-md"
      />
      <span
        className={cn(
          "min-w-0 flex-1 transition-colors",
          done && "text-muted-foreground",
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
        {done && by && (
          <span
            className="mt-0.5 block text-sm font-semibold text-muted-foreground"
            data-testid="checklist-by"
          >
            {by}
          </span>
        )}
      </span>
    </label>
  );
}
