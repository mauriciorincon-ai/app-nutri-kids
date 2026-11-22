/**
 * El lector de etiquetas en el teléfono (S13 · ADR-019). tesseract.js lee la foto DENTRO del
 * aparato: la foto y el texto no salen. Todo se sirve desde `/ocr/` (ninguna CDN):
 *  - nada se pide al abrir la pantalla; `downloadOcr` baja los archivos SOLO tras el toque, y el
 *    service worker los guarda en su caché propia (`nutrikids-ocr-*`), así luego lee sin señal;
 *  - el script principal se inyecta con una URL literal: ningún chunk de la app lo importa;
 *  - el worker corre desde su URL real (jamás `blob:`, lección del S12) con su CSP `connect-src`
 *    cerrada a la app; los idiomas no se guardan aparte (`cacheMethod: "none"`): una sola caché.
 * Lo que se reporta hacia afuera es un código de error, nunca el texto leído.
 */
import ocr from "./ocr.json";

export const OCR_BASE = "/ocr/";
export const OCR_SCRIPT = "/ocr/tesseract.min.js";
export const OCR_WORKER = "/ocr/worker.min.js";
/** El lado mayor de la foto que se lee: suficiente para la letra chica, sin agotar la memoria. */
export const OCR_EDGE = 2000;
/** Tiempos límite: un worker que no responde no deja la pantalla en «Leyendo…» para siempre. */
const INIT_TIMEOUT_MS = 90_000;
const READ_TIMEOUT_MS = 90_000;

export type OcrErrorCode =
  "unsupported" | "download-failed" | "init-failed" | "read-failed" | "timeout";

export class OcrError extends Error {
  constructor(readonly code: OcrErrorCode) {
    super(code);
  }
}

export type CoreVariant = "relaxedsimd-lstm" | "simd-lstm" | "lstm";

/** Las mismas pruebas que usa tesseract.js (wasm-feature-detect) para elegir su núcleo. */
const SIMD = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8,
  0, 65, 0, 253, 15, 253, 98, 11,
]);
const RELAXED_SIMD = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1,
  13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11,
]);

export function coreVariant(
  validate: (b: Uint8Array) => boolean = (b) =>
    typeof WebAssembly === "object" && WebAssembly.validate(b as BufferSource),
): CoreVariant {
  try {
    if (validate(RELAXED_SIMD)) return "relaxedsimd-lstm";
    if (validate(SIMD)) return "simd-lstm";
  } catch {
    // Sin WebAssembly.validate: el núcleo básico.
  }
  return "lstm";
}

/** Lo que este teléfono baja: el código, SU núcleo y los dos idiomas. */
export function ocrFiles(variant: CoreVariant = coreVariant()): string[] {
  return [
    "tesseract.min.js",
    "worker.min.js",
    `core/tesseract-core-${variant}.wasm.js`,
    ...ocr.langs.map((l) => `lang/${l}.traineddata.gz`),
  ];
}

const sizes = ocr.files as Record<string, number>;

/** Bytes que este teléfono baja (se muestran ANTES del toque). */
export function ocrDownloadBytes(variant: CoreVariant = coreVariant()): number {
  return ocrFiles(variant).reduce((sum, f) => sum + (sizes[f] ?? 0), 0);
}

export function canRead(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker === "function" &&
    typeof WebAssembly === "object" &&
    typeof fetch === "function"
  );
}

/**
 * Baja los archivos del lector, en orden, con su avance en bytes. Pasa por el service worker, que
 * los guarda; si ya estaban, salen de su caché sin red.
 */
export async function downloadOcr(
  onProgress: (loaded: number, total: number) => void,
  variant: CoreVariant = coreVariant(),
  doFetch: typeof fetch = fetch,
): Promise<void> {
  const files = ocrFiles(variant);
  const total = ocrDownloadBytes(variant);
  let loaded = 0;
  onProgress(0, total);
  for (const f of files) {
    let res: Response;
    try {
      res = await doFetch(OCR_BASE + f);
    } catch {
      throw new OcrError("download-failed");
    }
    if (!res.ok) throw new OcrError("download-failed");
    const reader = res.body?.getReader();
    if (!reader) {
      loaded += (await res.arrayBuffer()).byteLength;
      onProgress(Math.min(loaded, total), total);
      continue;
    }
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      onProgress(Math.min(loaded, total), total);
    }
  }
  onProgress(total, total);
}

/** Lo mínimo de tesseract.js que se usa (el global que deja `tesseract.min.js`). */
type TesseractWorker = {
  recognize(
    image: Blob,
  ): Promise<{ data: { text: string; confidence: number } }>;
  terminate(): Promise<unknown>;
};
type TesseractGlobal = {
  createWorker(
    langs: string[],
    oem: number,
    options: Record<string, unknown>,
  ): Promise<TesseractWorker>;
};
/** OEM.LSTM_ONLY: solo la red LSTM (los núcleos copiados son los «-lstm»). */
const LSTM_ONLY = 1;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new OcrError("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

let scriptLoad: Promise<TesseractGlobal> | null = null;

/** Inyecta `/ocr/tesseract.min.js` una sola vez. */
function loadScript(): Promise<TesseractGlobal> {
  const w = window as unknown as { Tesseract?: TesseractGlobal };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  scriptLoad ??= new Promise<TesseractGlobal>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = OCR_SCRIPT;
    s.async = true;
    s.onload = () =>
      w.Tesseract ? resolve(w.Tesseract) : reject(new OcrError("init-failed"));
    s.onerror = () => {
      scriptLoad = null;
      s.remove();
      reject(new OcrError("download-failed"));
    };
    document.head.appendChild(s);
  });
  return scriptLoad;
}

export type Reading = { text: string; confidence: number };

export class OcrClient {
  private constructor(private worker: TesseractWorker) {}

  /** Arranca el lector (script, worker, núcleo e idiomas, todo desde `/ocr/`). */
  static async start(variant: CoreVariant = coreVariant()): Promise<OcrClient> {
    if (!canRead()) throw new OcrError("unsupported");
    const T = await loadScript();
    let failed = false;
    try {
      const worker = await withTimeout(
        T.createWorker(ocr.langs, LSTM_ONLY, {
          workerPath: OCR_WORKER,
          corePath: `${OCR_BASE}core/tesseract-core-${variant}.wasm.js`,
          langPath: `${OCR_BASE}lang`,
          workerBlobURL: false,
          cacheMethod: "none",
          gzip: true,
          // El worker reporta su avance y sus errores: aquí no se registra nada del contenido.
          logger: () => {},
          errorHandler: () => {
            failed = true;
          },
        }),
        INIT_TIMEOUT_MS,
      );
      if (failed) throw new OcrError("init-failed");
      return new OcrClient(worker);
    } catch (e) {
      throw e instanceof OcrError ? e : new OcrError("init-failed");
    }
  }

  async read(image: Blob): Promise<Reading> {
    try {
      const { data } = await withTimeout(
        this.worker.recognize(image),
        READ_TIMEOUT_MS,
      );
      return {
        text: String(data?.text ?? ""),
        confidence: Number(data?.confidence),
      };
    } catch (e) {
      throw e instanceof OcrError ? e : new OcrError("read-failed");
    }
  }

  async stop(): Promise<void> {
    try {
      await this.worker.terminate();
    } catch {
      // Ya estaba detenido.
    }
  }
}

/**
 * La foto, reducida a `edge` px de lado mayor y en gris, como PNG en memoria. Nunca se guarda ni
 * se sube: se lee y se suelta.
 */
export async function labelImage(file: Blob, edge = OCR_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    if (typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new OcrError("read-failed");
      ctx.filter = "grayscale(1)";
      ctx.drawImage(bitmap, 0, 0, w, h);
      return await canvas.convertToBlob({ type: "image/png" });
    }
    const canvas = Object.assign(document.createElement("canvas"), {
      width: w,
      height: h,
    });
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new OcrError("read-failed");
    ctx.filter = "grayscale(1)";
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new OcrError("read-failed"))),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}
