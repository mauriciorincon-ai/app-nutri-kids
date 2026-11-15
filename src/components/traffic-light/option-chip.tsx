"use client";

import { useI18n } from "@/i18n";
import type { Texture } from "@/lib/diet/schema";
import { TEXTURE_SYMBOL } from "@/lib/diet/texture";
import { cn } from "@/lib/utils";

/**
 * Una opción de reemplazo del plan. La textura (si el plan la trae) va con símbolo
 * + texto; si hoy cae en una que el niño no acepta, queda marcada con texto y borde
 * punteado — nunca solo con color, y nunca oculta (ADR-009).
 */
export function OptionChip({
  name,
  texture,
  notAccepted,
}: {
  name: string;
  texture?: Texture;
  notAccepted: boolean;
}) {
  const { t } = useI18n();
  return (
    <li
      data-not-accepted={notAccepted ? "true" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-semibold",
        notAccepted
          ? "border border-dashed border-foreground/50 bg-muted text-foreground"
          : "bg-tl-green-surface text-tl-green",
      )}
    >
      {name}
      {texture && (
        <span className="ml-1.5 font-normal">
          <span aria-hidden>{TEXTURE_SYMBOL[texture]}</span>{" "}
          {t.texture[texture]}
        </span>
      )}
      {notAccepted && (
        <span className="ml-1.5 font-normal">· {t.texture.notAccepted}</span>
      )}
    </li>
  );
}
