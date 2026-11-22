/**
 * El lado de la página del worker que mira la foto (S12 · ADR-018). Ninguna ruta importa el modelo
 * ni su runtime: el worker se crea con una URL literal (`/ia/vision-worker.js`, que el bundler no
 * sigue) y SOLO cuando quien cuida toca «Descargar el modelo». La foto se reduce en un canvas, sus
 * píxeles se TRANSFIEREN al worker (la página se queda sin copia) y el bitmap se cierra: nada la
 * guarda ni la sube.
 */
import model from "./model.json";

export const VISION_WORKER_URL = "/ia/vision-worker.js";
export type Engine = "webgpu" | "wasm";
export type ErrorCode =
  "load-failed" | "analyze-failed" | "blocked-request" | "no-worker";

export type Progress = { file: string; loaded: number; total: number };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
/** `probe` y `load` no llevan id: cada uno tiene su propia clave, así uno no pisa al otro. */
type Key = number | "probe" | "load";

export class VisionClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<Key, Pending>();
  private onProgress: ((p: Progress) => void) | null = null;

  constructor(url = VISION_WORKER_URL) {
    this.worker = new Worker(url, { type: "module" });
    this.worker.onmessage = (e: MessageEvent) => this.receive(e.data ?? {});
    this.worker.onerror = () => this.failAll("load-failed");
  }

  private receive(msg: {
    type?: string;
    id?: number;
    of?: string;
    [k: string]: unknown;
  }) {
    if (msg.type === "progress") {
      this.onProgress?.(msg as unknown as Progress);
      return;
    }
    const key = this.keyOf(msg);
    const p = key === null ? undefined : this.pending.get(key);
    if (!p || key === null) return;
    this.pending.delete(key);
    if (msg.type === "error")
      p.reject(new Error(String(msg.code ?? "analyze-failed")));
    else p.resolve(msg);
  }

  /** A qué petición responde un mensaje: por su id, o por su tipo si no lleva (probe / ready / error de carga). */
  private keyOf(msg: { type?: string; id?: number; of?: string }): Key | null {
    if (typeof msg.id === "number") return msg.id;
    if (msg.type === "probe") return "probe";
    if (msg.type === "ready") return "load";
    if (msg.type === "error") {
      if (msg.of === "probe" || msg.of === "load") return msg.of;
      return this.pending.has("load") ? "load" : "probe";
    }
    return null;
  }

  private failAll(code: ErrorCode) {
    for (const p of this.pending.values()) p.reject(new Error(code));
    this.pending.clear();
  }

  private ask<T>(
    message: object,
    key: Key,
    transfer: Transferable[] = [],
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(key, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.worker.postMessage(
        typeof key === "number" ? { ...message, id: key } : message,
        transfer,
      );
    });
  }

  probe() {
    return this.ask<{ webgpu: boolean; wasm: boolean }>(
      { type: "probe" },
      "probe",
    );
  }

  load(engine: Engine, onProgress: (p: Progress) => void) {
    this.onProgress = onProgress;
    return this.ask<{ engine: Engine; ms: number; runtimeBytes: number }>(
      { type: "load", engine },
      "load",
    );
  }

  /** Los píxeles se transfieren: después de esta llamada la página ya no los tiene. */
  analyze(image: ImageData) {
    const buffer = image.data.buffer;
    return this.ask<{ text: string; ms: number }>(
      {
        type: "analyze",
        image: { width: image.width, height: image.height, data: buffer },
      },
      ++this.seq,
      [buffer],
    );
  }

  terminate() {
    this.failAll("load-failed");
    this.worker.terminate();
  }
}

/** ¿Puede este navegador siquiera intentarlo? (sin worker o sin WebAssembly, no). */
export function canTry(): boolean {
  return typeof Worker === "function" && typeof WebAssembly === "object";
}

/**
 * La foto → píxeles del tamaño que el modelo usa (lado mayor `model.imageEdge`). El bitmap se
 * cierra aquí mismo; el canvas es local y se suelta al salir.
 */
export async function pixelsFromFile(
  file: Blob,
  edge = model.imageEdge,
): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), {
            width: w,
            height: h,
          });
    const ctx = canvas.getContext("2d") as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error("analyze-failed");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } finally {
    bitmap.close();
  }
}
