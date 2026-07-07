"use client";

import Link from "next/link";
import { Stethoscope } from "lucide-react";

import { useI18n } from "@/i18n";

/**
 * Disclaimer no-médico permanente — elemento del sistema de diseño, no letra
 * pequeña (regla dura 3). Visible en toda pantalla, enlaza a la versión completa.
 */
export function DisclaimerFooter() {
  const { t } = useI18n();
  return (
    <p className="mx-auto flex max-w-md items-center justify-center gap-1.5 px-4 py-3 text-center text-sm text-muted-foreground">
      <Stethoscope aria-hidden className="size-4 shrink-0" />
      <Link href="/ajustes" className="underline-offset-2 hover:underline">
        {t.disclaimer.short}
      </Link>
    </p>
  );
}
