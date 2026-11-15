"use client";

import { useRef, useState } from "react";
import { CircleCheck, FileText, FileUp, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { useDiet } from "@/components/diet-provider";
import { Button } from "@/components/ui/button";
import { PlanReview } from "@/components/plan-review/plan-review";
import { Textarea } from "@/components/ui/textarea";
import { fmt, useI18n } from "@/i18n";
import {
  clearPlanDraft,
  loadPlanDraft,
  savePlanDraft,
} from "@/lib/diet/plan-draft";
import {
  buildPlan,
  startReview,
  type ReviewState,
} from "@/lib/diet/plan-review";
import {
  hasStoredRealDiet,
  importDiet,
  storeDiet,
  switchToDemo,
  switchToReal,
  type ImportResult,
} from "@/lib/diet/storage";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import { readPdfFile } from "@/lib/pdf/read-pdf";
import { cn } from "@/lib/utils";

type UiState =
  | { phase: "idle" }
  | { phase: "validating" }
  | { phase: "reading" }
  | {
      phase: "error";
      error:
        | Extract<ImportResult, { ok: false }>["error"]
        | "not-pdf"
        | "no-text"
        | "unreadable";
    }
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
  const pdfInput = useRef<HTMLInputElement>(null);
  // La revisión del PDF: el borrador guardado es la verdad; `local` cubre un guardado
  // fallido (cuota llena) para no perder lo que se está revisando.
  const saved = useLocalStore(loadPlanDraft, null);
  const [resumed, setResumed] = useState(false);
  const [local, setLocal] = useState<ReviewState | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const review = local ?? (resumed ? saved : null);
  const busy = state.phase === "validating" || state.phase === "reading";

  const commit = (next: ReviewState) => {
    setLocal(next);
    setSaveFailed(false);
    savePlanDraft(next);
    notifyLocalStore();
  };

  const discard = () => {
    clearPlanDraft();
    setLocal(null);
    setResumed(false);
    notifyLocalStore();
  };

  const onPdf = async (file: File | undefined) => {
    if (!file) return;
    setState({ phase: "reading" });
    const result = await readPdfFile(file);
    if (!result.ok) {
      setState({ phase: "error", error: result.error });
      return;
    }
    setState({ phase: "idle" });
    commit(startReview(result.reading, new Date()));
  };

  const savePlan = () => {
    if (!review) return;
    const plan = buildPlan(review);
    if (!plan.ok) return setSaveFailed(true);
    const stored = storeDiet(plan.diet, "diet-saved-from-pdf");
    if (!stored.ok) return setState({ phase: "error", error: stored.error });
    clearPlanDraft();
    setLocal(null);
    setResumed(false);
    refresh();
    notifyLocalStore();
    setState({ phase: "success", counts: stored.counts });
  };

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
        : error === "not-pdf"
          ? t.load.errorNotPdf
          : error === "no-text"
            ? t.load.errorNoText
            : error === "unreadable"
              ? t.load.errorUnreadable
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
      ) : review ? (
        <PlanReview
          state={review}
          onChange={commit}
          onSave={savePlan}
          onDiscard={discard}
          saveFailed={saveFailed}
        />
      ) : (
        <>
          {saved && (
            <section
              className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-4"
              data-testid="resume-review"
            >
              <p className="font-heading text-lg font-semibold">
                {t.load.resumeTitle}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t.load.resumeBody}
              </p>
              <Button size="lg" onClick={() => setResumed(true)}>
                {t.load.resumeContinue}
              </Button>
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={discard}
              >
                {t.load.resumeDiscard}
              </Button>
            </section>
          )}
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
              disabled={busy}
              onClick={() => pdfInput.current?.click()}
            >
              <FileText aria-hidden className="size-5" />
              {state.phase === "reading" ? t.load.reading : t.load.pickPdf}
            </Button>
            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label={t.load.pickPdf}
              onChange={(e) => {
                void onPdf(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {t.load.pdfHint}
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-3 w-full"
              disabled={busy}
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
              disabled={pasted.trim().length === 0 || busy}
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
            {t.load.activeSource}{" "}
            <span data-testid="active-source">
              {source === "real" ? t.load.activeReal : t.load.activeDemo}
            </span>
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
