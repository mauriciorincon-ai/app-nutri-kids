"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import { readerSettingsText } from "@/i18n/reader-settings";
import { deleteOcr, ocrBytes } from "@/lib/label/ocr-store";
import { ODBL_URL } from "@/lib/scan/files";
import { deleteScan, scanBytes } from "@/lib/scan/scan-store";

const total = async () => (await ocrBytes()) + (await scanBytes());

/**
 * «Lector y catálogo» (S13 · ADR-019): dice cuánto ocupan en este teléfono el lector de etiquetas,
 * el escáner y el catálogo, los borra sin tocar nada más, y lleva la atribución que exige la
 * licencia ODbL del catálogo. Solo mira las cachés propias; no descarga nada.
 */
export function ReaderCatalogSection() {
  const { locale } = useI18n();
  const c = readerSettingsText[locale];
  // null = todavía mirando · 0 = nada guardado
  const [bytes, setBytes] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const look = useCallback(async () => {
    setBytes(await total());
  }, []);

  useEffect(() => {
    let alive = true;
    void total().then((n) => alive && setBytes(n));
    return () => {
      alive = false;
    };
  }, []);

  const remove = async () => {
    await Promise.all([deleteOcr(), deleteScan()]);
    setDone(true);
    await look();
  };

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="set-reader"
      data-testid="settings-reader"
    >
      <h2 id="set-reader" className="text-lg">
        {c.title}
      </h2>
      {bytes === null ? (
        <p className="text-sm text-muted-foreground">{c.checking}</p>
      ) : bytes > 0 ? (
        <>
          <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
            {fmt(c.body, { mb: Math.max(1, Math.round(bytes / 1e6)) })}
          </p>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => void remove()}
          >
            <Trash2 aria-hidden className="size-5" />
            {c.button}
          </Button>
        </>
      ) : (
        <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
          {c.none}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-tl-green-surface px-4 py-3 text-sm font-semibold text-tl-green"
        >
          <Check aria-hidden className="size-4 shrink-0" />
          {c.done}
        </p>
      )}
      <p
        className="text-sm leading-relaxed text-muted-foreground"
        data-testid="settings-odbl"
      >
        {c.attribution}{" "}
        <a
          href={ODBL_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
        >
          {c.licenseLink}
        </a>
      </p>
    </section>
  );
}
