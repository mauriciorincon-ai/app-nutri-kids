import { readPlanText, type PlanReading } from "@/lib/diet/pdf-reader";
import { extractPdfPages, type PdfJsLike } from "@/lib/diet/pdf-text";

/**
 * Lee en el aparato el PDF que eligió quien cuida (ADR-010).
 * - pdf.js y su worker los sirve la propia app (`/pdfjs/`, copiados en el build y
 *   precacheados por el service worker): ninguna CDN, y abre también sin señal.
 * - Se carga SOLO al elegir un PDF (import diferido, fuera del bundle de Next): el
 *   script inicial de /cargar no crece.
 * - Los bytes del archivo viven solo dentro de esta función: al terminar se sueltan y
 *   del PDF queda únicamente el borrador estructurado (decisión 2 a). Nada a logs.
 */
const PDFJS_URL = "/pdfjs/pdf.min.mjs";
const WORKER_URL = "/pdfjs/pdf.worker.min.mjs";

type PdfJsModule = PdfJsLike & {
  GlobalWorkerOptions: { workerSrc: string };
};

let loading: Promise<PdfJsModule> | null = null;

function loadPdfJs(): Promise<PdfJsModule> {
  loading ??= (
    import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ PDFJS_URL
    ) as Promise<PdfJsModule>
  ).then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = WORKER_URL;
    return mod;
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export type ReadPdfResult =
  | { ok: true; reading: PlanReading }
  | { ok: false; error: "not-pdf" | "no-text" | "unreadable" };

export async function readPdfFile(
  file: File,
  load: () => Promise<PdfJsModule> = loadPdfJs,
): Promise<ReadPdfResult> {
  let bytes: Uint8Array | null = null;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    // Firma «%PDF-»: un archivo que no es PDF no llega a pdf.js.
    if (
      bytes.length < 5 ||
      String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-"
    )
      return { ok: false, error: "not-pdf" };
    const pdfjs = await load();
    const pages = await extractPdfPages(pdfjs, bytes);
    bytes = null;
    if (pages.every((p) => p.items.length === 0))
      return { ok: false, error: "no-text" };
    return { ok: true, reading: readPlanText(pages) };
  } catch {
    return { ok: false, error: "unreadable" };
  } finally {
    bytes = null;
  }
}
