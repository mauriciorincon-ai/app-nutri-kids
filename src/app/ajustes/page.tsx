"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fmt, useI18n, type Locale } from "@/i18n";
import { clearAllData } from "@/lib/diet/storage";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Ajustes: idioma ES/EN, dieta cargada, borrar datos (confirmación) y disclaimer completo. */
export default function SettingsPage() {
  const { diet, source, refresh } = useDiet();
  const { t, l, locale, setLocale } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleared, setCleared] = useState(false);

  const onClear = () => {
    clearAllData();
    refresh();
    setConfirmOpen(false);
    setCleared(true);
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      <h1 className="text-3xl">{t.settings.title}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t.settings.language}</h2>
        <div
          className="flex gap-2"
          role="group"
          aria-label={t.settings.language}
        >
          {(
            [
              { key: "es", label: t.settings.languageEs },
              { key: "en", label: t.settings.languageEn },
            ] as const
          ).map(({ key, label }) => (
            <Button
              key={key}
              variant={locale === key ? "default" : "outline"}
              aria-pressed={locale === key}
              className={cn(
                "min-h-11 flex-1",
                locale !== key && "bg-transparent",
              )}
              onClick={() => setLocale(key as Locale)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t.settings.dietVersion}</h2>
        <p className="rounded-xl border bg-card px-4 py-3 text-sm">
          {source === "demo"
            ? t.settings.dietVersionDemo
            : fmt(t.settings.dietVersionInfo, {
                title: l(diet.meta.title),
                date: formatShortDate(diet.meta.issuedAt, locale),
              })}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t.settings.clearTitle}</h2>
        <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
          {t.settings.clearBody}
        </p>
        {cleared && (
          <p
            role="status"
            className="rounded-xl bg-tl-green-surface px-4 py-3 text-sm font-semibold text-tl-green"
          >
            {t.settings.clearedToast}
          </p>
        )}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="lg" className="w-full">
              <Trash2 aria-hidden className="size-5" />
              {t.settings.clearButton}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">
                {t.settings.clearConfirmTitle}
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed">
                {t.settings.clearConfirmBody}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button variant="destructive" size="lg" onClick={onClear}>
                {t.settings.clearConfirmYes}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setConfirmOpen(false)}
              >
                {t.settings.clearConfirmNo}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t.settings.disclaimerTitle}</h2>
        <p className="rounded-xl bg-accent px-4 py-3 text-sm leading-relaxed text-accent-foreground">
          {t.disclaimer.full}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {l(diet.meta.disclaimer)}
        </p>
      </section>
    </div>
  );
}
