"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera as CameraIcon,
  Download,
  ImageUp,
  RotateCcw,
} from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { useToday } from "@/components/day-checklist/use-today";
import { Button } from "@/components/ui/button";
import { useProfileNotes } from "@/components/use-profile-notes";
import { fmt, useI18n } from "@/i18n";
import { commonText } from "@/i18n/day-to-day/common";
import { labelText } from "@/i18n/label";
import { checkLabel } from "@/lib/label/check";
import {
  OcrClient,
  canRead,
  downloadOcr,
  labelImage,
  ocrDownloadBytes,
  type Reading,
} from "@/lib/label/ocr-client";
import { ocrCached } from "@/lib/label/ocr-store";

import { LabelResult } from "./label-result";

type Phase = "checking" | "cant" | "idle" | "loading" | "ready" | "failed";

const mb = (bytes: number) => Math.max(1, Math.round(bytes / 1e6));

/**
 * Leer una etiqueta (S13 · ADR-019). El lector SOLO lee: devuelve texto, y `checkLabel` lo coteja con
 * el plan. La foto entra por el selector del sistema (sin permiso de cámara de la página), se reduce en
 * memoria, se lee en este teléfono y se suelta: nada la guarda ni la envía. La única red es la descarga
 * del lector, solo tras el toque; después lee sin señal.
 */
export function LabelReader() {
  const { locale } = useI18n();
  const t = labelText[locale];
  const common = commonText[locale];
  const { diet } = useDiet();
  const today = useToday();
  const notes = useProfileNotes();

  const [phase, setPhase] = useState<Phase>("checking");
  const [cached, setCached] = useState(false);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const client = useRef<OcrClient | null>(null);
  const takeRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const total = useMemo(
    () => (phase === "checking" ? 0 : ocrDownloadBytes()),
    [phase],
  );

  useEffect(() => {
    let alive = true;
    const able = canRead();
    void (able ? ocrCached() : Promise.resolve(false)).then((yes) => {
      if (!alive) return;
      setCached(yes);
      setPhase(able ? "idle" : "cant");
    });
    return () => {
      alive = false;
      void client.current?.stop();
      client.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    setPhase("loading");
    setDone(0);
    try {
      if (!cached) await downloadOcr((loaded) => setDone(loaded));
      await client.current?.stop();
      client.current = await OcrClient.start();
      setCached(true);
      setPhase("ready");
    } catch {
      client.current = null;
      setPhase("failed");
    }
  }, [cached]);

  const read = useCallback(async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (!file || !client.current) return;
    setBusy(true);
    setReadFailed(false);
    setReading(null);
    try {
      const image = await labelImage(file);
      setReading(await client.current.read(image));
    } catch {
      setReadFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const result = useMemo(
    () =>
      reading && today
        ? checkLabel({
            text: reading.text,
            confidence: reading.confidence,
            diet,
            now: today,
            notes: notes.notes,
          })
        : null,
    [reading, today, diet, notes.notes],
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.title}</h1>
      <p className="-mt-2 text-muted-foreground">{t.lead}</p>
      <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        {common.notMedical}
      </p>

      {phase === "cant" && (
        <section
          className="flex flex-col gap-2 rounded-2xl border p-4"
          aria-labelledby="label-cant"
          data-testid="label-cant"
        >
          <h2 id="label-cant" className="text-xl">
            {t.cantTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.cantBody}</p>
          <Link
            href="/dieta"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            {t.searchLink}
          </Link>
        </section>
      )}

      {(phase === "idle" || phase === "loading" || phase === "failed") && (
        <section
          className="flex flex-col gap-3 rounded-2xl border p-4"
          aria-labelledby="label-reader"
          data-testid="label-reader"
        >
          <h2 id="label-reader" className="text-xl">
            {t.readerTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {cached ? t.readerCached : fmt(t.readerLead, { mb: mb(total) })}
          </p>
          {phase === "failed" && (
            <div role="alert" className="flex flex-col gap-1">
              <p className="font-semibold">{t.failedTitle}</p>
              <p className="text-sm text-muted-foreground">{t.failedBody}</p>
              <Link
                href="/dieta"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
              >
                {t.searchLink}
              </Link>
            </div>
          )}
          {phase === "loading" ? (
            <p role="status" className="text-sm font-medium">
              {cached || done === 0
                ? t.preparing
                : fmt(t.downloading, {
                    done: Math.min(mb(total), Math.round(done / 1e6)),
                    mb: mb(total),
                  })}
            </p>
          ) : (
            <Button
              className="min-h-11 self-start"
              onClick={() => void start()}
            >
              <Download aria-hidden />
              {phase === "failed" ? t.retry : cached ? t.prepare : t.download}
            </Button>
          )}
        </section>
      )}

      {phase === "ready" && (
        <section
          className="flex flex-col gap-3"
          aria-labelledby="label-photo"
          data-testid="label-ready"
        >
          <h2 id="label-photo" className="text-xl">
            {t.ready}
          </h2>
          <p className="-mt-1 text-sm text-muted-foreground">{t.tip}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              disabled={busy}
              onClick={() => takeRef.current?.click()}
            >
              {result ? <RotateCcw aria-hidden /> : <CameraIcon aria-hidden />}
              {result ? t.another : t.takePhoto}
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => pickRef.current?.click()}
            >
              <ImageUp aria-hidden />
              {t.pickPhoto}
            </Button>
          </div>
          <input
            ref={takeRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="label-take"
            onChange={(e) => void read(e.currentTarget)}
          />
          <input
            ref={pickRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="label-pick"
            onChange={(e) => void read(e.currentTarget)}
          />
          {busy && (
            <p role="status" className="text-sm font-medium">
              {t.reading}
            </p>
          )}
          {readFailed && (
            <p role="alert" className="text-sm">
              {t.readFailed}
            </p>
          )}
          {result && reading && (
            <LabelResult result={result} text={reading.text} t={t} />
          )}
        </section>
      )}

      <Link
        href="/camara"
        prefetch={false}
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
      >
        {t.back}
      </Link>
    </div>
  );
}
