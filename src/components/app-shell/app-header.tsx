"use client";

import { useI18n } from "@/i18n";
import { SourceBanner } from "./source-banner";

/** Encabezado común: marca + banner demo↔real siempre a la vista. */
export function AppHeader() {
  const { t } = useI18n();
  return (
    <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pb-2 pt-5 lg:max-w-2xl">
      <span className="font-heading text-lg font-semibold text-primary">
        {t.app.name}
      </span>
      <SourceBanner />
    </header>
  );
}
