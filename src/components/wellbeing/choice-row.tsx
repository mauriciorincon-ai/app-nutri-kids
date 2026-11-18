"use client";

import { cn } from "@/lib/utils";

/**
 * Una pregunta con pocas opciones en palabras simples: botones de alternar (≥ 44 px, con
 * `aria-pressed`). Tocar la elegida la quita si la pregunta es opcional. El elegido se ve por
 * borde, relleno y la marca ✓ (el color nunca va solo).
 */
export function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  optional = true,
}: {
  label: string;
  options: { id: T; text: string }[];
  value: T | null;
  onChange: (next: T | null) => void;
  disabled?: boolean;
  optional?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(active && optional ? null : o.id)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-default",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : cn(
                      "border-border bg-transparent",
                      !disabled && "hover:bg-accent",
                    ),
              )}
            >
              {active && <span aria-hidden>✓ </span>}
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
