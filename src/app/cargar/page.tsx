"use client";

import { useRef, useState } from "react";
import { CircleCheck, FileUp, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { useDiet } from "@/components/diet-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmt, useI18n } from "@/i18n";
import {
  hasStoredRealDiet,
  importDiet,
  switchToDemo,
  switchToReal,
  type ImportResult,
} from "@/lib/diet/storage";
import { cn } from "@/lib/utils";

type UiState =
  | { phase: "idle" }
  | { phase: "validating" }
  | { phase: "error"; error: Extract<ImportResult, { ok: false }>["error"] }
  | { phase: "success"; counts: Extract<ImportResult, { ok: true }>["counts"] };

/**
 * Cargar la dieta — file picker + método alterno de pegar (plan B para el
 * teléfono). Validación zod con errores en español llano y resumen de carga.
 */
export default function LoadPage() {
  const { source, refresh, ready } = useDiet();
  const { t } = useI18n();
  const [state, setState] = useState<UiState>({ phase: "idle" });
  const [pasted, setPasted] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const runImport = (text: string) => {
    setState({ phase: "validating" });
    // La validación es síncrona y rápida; el estado "validating" existe como
    // feedback si el archivo llega lento desde el picker del teléfono.
    const result = importDiet(text);
    if (result.ok) {
      refresh();
      setState({ phase: "success", counts: result.counts });
      setPasted("");
    } else {
      setState({ phase: "error", error: result.error });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setState({ phase: "validating" });
    try {
      runImport(await file.text());
    } catch {
      // El picker del teléfono puede fallar al leer (permisos, archivo movido)
      setState({ phase: "error", error: "invalid-json" });
    }
  };

  const errorMessage = (
    error: Extract<UiState, { phase: "error" }>["error"],
  ) =>
    error === "invalid-json"
      ? t.load.errorInvalidJson
      : error === "invalid-schema"
        ? t.load.errorInvalidSchema
        : t.load.errorNoStorage;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.load.title}</h1>

      {state.phase === "success" ? (
        <section
          className="rounded-xl bg-tl-green-surface px-4 py-4 text-tl-green"
          role="status"
        >
          <p className="flex items-center gap-2 font-heading text-xl font-semibold">
            <CircleCheck aria-hidden className="size-5" />
            {t.load.successTitle}
          </p>
          <p className="mt-1 text-sm">{t.load.successBody}</p>
          <ul
            className="mt-2 list-inside list-disc text-sm font-semibold"
            data-tabular
          >
            <li>{fmt(t.load.countGroups, { n: state.counts.greenGroups })}</li>
            <li>
              {fmt(t.load.countRestricted, { n: state.counts.restrictedFoods })}
            </li>
            <li>{fmt(t.load.countAdditives, { n: state.counts.additives })}</li>
            <li>
              {fmt(t.load.countSupplements, { n: state.counts.supplements })}
            </li>
            <li>{fmt(t.load.countMeals, { n: state.counts.meals })}</li>
          </ul>
          <Button asChild size="lg" className="mt-4 w-full">
            <Link href="/">{t.load.goToday}</Link>
          </Button>
        </section>
      ) : (
        <>
          {/* Estado vacío que explica cómo conseguir el archivo */}
          <section className="rounded-xl border border-dashed bg-card px-4 py-5 text-center">
            <p className="font-heading text-lg font-semibold">
              {ready && hasStoredRealDiet()
                ? t.load.activeSource
                : t.load.emptyTitle}
            </p>
            {!(ready && hasStoredRealDiet()) && (
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t.load.emptyBody}
              </p>
            )}
            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={state.phase === "validating"}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp aria-hidden className="size-5" />
              {state.phase === "validating"
                ? t.load.validating
                : t.load.pickFile}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label={t.load.pickFile}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </section>

          {state.phase === "error" && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-tl-red-surface px-4 py-3 text-sm font-semibold leading-relaxed text-tl-red"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {errorMessage(state.error)}
            </p>
          )}

          {/* Método alterno: pegar (riesgo identificado: file picker torpe en el teléfono) */}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg">{t.load.orPaste}</h2>
            <p className="-mt-1 text-sm text-muted-foreground">
              {t.load.pasteHint}
            </p>
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={t.load.pastePlaceholder}
              rows={5}
              className="bg-card font-mono text-xs"
            />
            <Button
              variant="secondary"
              size="lg"
              disabled={
                pasted.trim().length === 0 || state.phase === "validating"
              }
              onClick={() => runImport(pasted)}
            >
              {t.load.importPasted}
            </Button>
          </section>
        </>
      )}

      {/* Selector demo↔real cuando hay dieta guardada */}
      {ready && hasStoredRealDiet() && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3">
          <p className="text-sm font-semibold text-muted-foreground">
            {t.load.activeSource}
          </p>
          <div
            className="flex gap-2"
            role="group"
            aria-label={t.load.activeSource}
          >
            {(
              [
                { key: "demo", label: t.load.useDemo, action: switchToDemo },
                { key: "real", label: t.load.useReal, action: switchToReal },
              ] as const
            ).map(({ key, label, action }) => (
              <Button
                key={key}
                variant={source === key ? "default" : "outline"}
                aria-pressed={source === key}
                className={cn("flex-1", source !== key && "bg-transparent")}
                onClick={() => {
                  action();
                  refresh();
                  setState({ phase: "idle" });
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
