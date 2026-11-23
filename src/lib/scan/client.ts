/**
 * El escáner del súper y el catálogo en el teléfono (S13 · ADR-019). Todo sale de la propia app:
 *  - nada se pide al abrir la pantalla; `downloadScan` baja los archivos SOLO tras el toque, y el
 *    service worker los guarda en sus cachés propias (`nutrikids-scan-*` y `nutrikids-catalog-*`),
 *    así luego escanea y busca sin señal;
 *  - si el navegador trae `BarcodeDetector`, el código se lee con él (sin bajar zxing); si no, lo
 *    lee el worker `/scan/scan-worker.js` con zxing-wasm 3.1.6, con su `.wasm` en `/scan/`;
 *  - el catálogo se consulta en el worker: la página pide `lookup(code)` y `sameCategory(cat)` y
 *    valida cada producto con su schema antes de usarlo;
 *  - la foto del código se reduce en memoria, se lee y se suelta: nunca se guarda ni se envía.
 * Lo que se reporta hacia afuera es un código de error, nunca el código leído ni un producto.
 */
import { catalogMetaSchema, productSchema, type CatalogMeta, type Product } from "@/lib/catalog/schema";

import {
  SCAN_WORKER,
  scanDownloadBytes,
  scanFiles,
} from "./files";

export { CATALOG_URL, SCAN_BASE, SCAN_WORKER } from "./files";
/** El lado mayor de la foto del código: suficiente para las barras finas, sin agotar la memoria. */
export const BARCODE_EDGE = 1280;
const CALL_TIMEOUT_MS = 60_000;

export type ScanErrorCode =
  | "unsupported"
  | "download-failed"
  | "init-failed"
  | "catalog-failed"
  | "decode-failed"
  | "timeout";

export class ScanError extends Error {
  constructor(readonly code: ScanErrorCode) {
    super(code);
  }
}

/** ¿El navegador lee EAN-13 con su propio detector? Entonces zxing no se baja. */
export async function nativeScanner(): Promise<boolean> {
  try {
    const Detector = (globalThis as unknown as {
      BarcodeDetector?: { getSupportedFormats(): Promise<string[]> };
    }).BarcodeDetector;
    if (!Detector) return false;
    return (await Detector.getSupportedFormats()).includes("ean_13");
  } catch {
    return false;
  }
}

export function canScan(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker === "function" &&
    typeof fetch === "function"
  );
}

/** Baja los archivos, en orden, con su avance en bytes. Pasan por el service worker, que los guarda. */
export async function downloadScan(
  onProgress: (loaded: number, total: number) => void,
  native: boolean,
  doFetch: typeof fetch = fetch,
): Promise<void> {
  const files = scanFiles(native);
  const total = scanDownloadBytes(native);
  let loaded = 0;
  onProgress(0, total);
  for (const f of files) {
    let res: Response;
    try {
      res = await doFetch(f);
    } catch {
      throw new ScanError("download-failed");
    }
    if (!res.ok) throw new ScanError("download-failed");
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

type Reply = { id: number; ok: boolean; result?: unknown; error?: string };

export class ScanClient {
  private nextId = 1;
  private pending = new Map<number, (r: Reply) => void>();
  meta: CatalogMeta | null = null;

  private constructor(
    private worker: Worker,
    private native: boolean,
  ) {
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const done = this.pending.get(e.data.id);
      this.pending.delete(e.data.id);
      done?.(e.data);
    };
    worker.onerror = () => {
      for (const done of this.pending.values()) done({ id: 0, ok: false, error: "worker" });
      this.pending.clear();
    };
  }

  /** Arranca el worker y carga el catálogo. */
  static async start(native: boolean): Promise<ScanClient> {
    if (!canScan()) throw new ScanError("unsupported");
    let worker: Worker;
    try {
      worker = new Worker(SCAN_WORKER);
    } catch {
      throw new ScanError("init-failed");
    }
    const client = new ScanClient(worker, native);
    try {
      const meta = catalogMetaSchema.safeParse(await client.call({ op: "load" }));
      if (!meta.success) throw new ScanError("catalog-failed");
      client.meta = meta.data;
      return client;
    } catch (e) {
      await client.stop();
      throw e instanceof ScanError ? e : new ScanError("catalog-failed");
    }
  }

  private call(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<unknown> {
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new ScanError("timeout"));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, (r) => {
        clearTimeout(t);
        if (r.ok) resolve(r.result);
        else
          reject(
            new ScanError(
              r.error === "catalog"
                ? "catalog-failed"
                : message.op === "decode"
                  ? "decode-failed"
                  : "init-failed",
            ),
          );
      });
      this.worker.postMessage({ id, ...message }, transfer);
    });
  }

  /** El producto del catálogo con ese código, ya validado; `null` si no está (o viene mal formado). */
  async lookup(code: string): Promise<{ product: Product | null; found: boolean }> {
    const raw = await this.call({ op: "lookup", code });
    if (raw == null) return { product: null, found: false };
    const parsed = productSchema.safeParse(raw);
    return { product: parsed.success ? parsed.data : null, found: true };
  }

  /** Productos de una categoría (los que traen ingredientes), cada uno validado; los rotos se omiten. */
  async sameCategory(category: string, limit = 400): Promise<Product[]> {
    const raw = await this.call({ op: "sameCategory", category, limit });
    if (!Array.isArray(raw)) return [];
    const out: Product[] = [];
    for (const r of raw) {
      const p = productSchema.safeParse(r);
      if (p.success) out.push(p.data);
    }
    return out;
  }

  /** Lee el código de barras de una foto: con el detector del navegador o con zxing en el worker. */
  async decode(file: Blob): Promise<string | null> {
    const bitmap = await createImageBitmap(file);
    try {
      if (this.native) {
        const Detector = (globalThis as unknown as {
          BarcodeDetector: new (o: { formats: string[] }) => {
            detect(i: ImageBitmap): Promise<{ rawValue: string }[]>;
          };
        }).BarcodeDetector;
        try {
          const found = await new Detector({
            formats: ["ean_13", "ean_8", "upc_a"],
          }).detect(bitmap);
          return found[0]?.rawValue ?? null;
        } catch {
          throw new ScanError("decode-failed");
        }
      }
      const image = barcodeImageData(bitmap);
      const text = await this.call({ op: "decode", image }, [image.data.buffer]);
      return typeof text === "string" ? text : null;
    } finally {
      bitmap.close();
    }
  }

  async stop(): Promise<void> {
    this.worker.terminate();
    this.pending.clear();
  }
}

/** Los píxeles de la foto, reducida a `BARCODE_EDGE` px de lado mayor, en memoria. */
export function barcodeImageData(
  bitmap: ImageBitmap,
  edge = BARCODE_EDGE,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new ScanError("decode-failed");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { data, width, height };
}
