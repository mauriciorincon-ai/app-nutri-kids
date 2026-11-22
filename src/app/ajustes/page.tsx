"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { FamilySection } from "@/components/family/family-section";
import { PushSection } from "@/components/push/push-section";
import { CameraModelSection } from "@/components/settings/camera-model-section";
import { errorText } from "@/components/family/parts";
import { useFamily } from "@/components/family/use-family";
import { Button } from "@/components/ui/button";
import { fmt, useI18n, type Locale } from "@/i18n";
import {
  clearAllData,
  loadPrefs,
  savePrefs,
  type ThemePref,
} from "@/lib/diet/storage";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import { deleteModel } from "@/lib/camera/model-store";
import { getFamily } from "@/lib/family/controller";
import { getPush } from "@/lib/push/controller";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// El diálogo se baja al pulsar «Borrar mis datos», no al abrir Ajustes.
const ClearDataDialog = dynamic(
  () => import("@/components/settings/clear-data-dialog"),
  { ssr: false },
);

/** Ajustes: idioma ES/EN, tema, dieta cargada, borrar datos (confirmación) y disclaimer completo. */
export default function SettingsPage() {
  const { diet, source, refresh } = useDiet();
  const { t, l, locale, setLocale } = useI18n();
  const theme = useLocalStore(() => loadPrefs().theme, "system");
  // `loadPrefs()` primero: guardar solo el tema borraría el idioma (y al revés).
  const setTheme = (next: ThemePref) => {
    savePrefs({ ...loadPrefs(), theme: next });
    notifyLocalStore();
  };
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dialogMounted, setDialogMounted] = useState(false);
  const [cleared, setCleared] = useState(false);

  const family = useFamily();
  const inFamily = family.phase !== "off";
  const [alsoShared, setAlsoShared] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const onClear = async () => {
    setClearError(null);
    // Primero la familia: se espera a que acabe cualquier sincronización en curso, para que no
    // reescriba el estado de una familia de la que ya salimos. Con la casilla, también se borra
    // la copia de internet; si eso falla (sin red), no se borra nada y se dice.
    if (inFamily) {
      const r = alsoShared
        ? await getFamily().destroy()
        : await getFamily().leave();
      // Sin las claves de esta familia («no-family») no hay con qué borrar la copia de internet:
      // se sale igual (su copia la borra otro teléfono con «Borrar lo compartido»).
      if (!r.ok && r.reason !== "no-family") {
        setClearError(errorText(t, r.reason));
        return;
      }
      if (!r.ok) await getFamily().leave();
    }
    // Los avisos, justo antes de borrar: necesitan su token para quitar la suscripción del
    // servidor, y `clearAllData` lo olvida. Si la familia falló arriba, no se llega aquí y nada
    // queda a medias. Sin red, la dirección caduca sola (el navegador ya la quitó).
    await getPush().disable();
    // El modelo de la cámara también es de este teléfono: se va con el resto.
    await deleteModel().catch(() => undefined);
    clearAllData();
    refresh();
    setConfirmOpen(false);
    setAlsoShared(false);
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
              {locale === key && <span aria-hidden>✓ </span>}
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t.settings.theme}</h2>
        <div
          className="flex gap-2"
          role="group"
          aria-label={t.settings.theme}
          data-testid="theme-group"
        >
          {(
            [
              { key: "system", label: t.settings.themeSystem },
              { key: "light", label: t.settings.themeLight },
              { key: "dark", label: t.settings.themeDark },
            ] as const
          ).map(({ key, label }) => (
            <Button
              key={key}
              variant={theme === key ? "default" : "outline"}
              aria-pressed={theme === key}
              data-testid={`theme-${key}`}
              className={cn(
                "min-h-11 flex-1",
                theme !== key && "bg-transparent",
              )}
              onClick={() => setTheme(key)}
            >
              {theme === key && <span aria-hidden>✓ </span>}
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t.settings.profileTitle}</h2>
        <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
          {t.settings.profileBody}
        </p>
        <Link
          href="/perfil"
          className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
        >
          {t.settings.profileLink}
        </Link>
      </section>

      <FamilySection />

      <PushSection />

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

      <CameraModelSection />

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
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          aria-haspopup="dialog"
          onClick={() => {
            setDialogMounted(true);
            setConfirmOpen(true);
          }}
        >
          <Trash2 aria-hidden className="size-5" />
          {t.settings.clearButton}
        </Button>
        {dialogMounted && (
          <ClearDataDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            inFamily={inFamily}
            alsoShared={alsoShared}
            onAlsoShared={setAlsoShared}
            error={clearError}
            onConfirm={() => void onClear()}
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t.settings.aiTitle}</h2>
        <p className="rounded-xl border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {t.settings.aiBody}
        </p>
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
