import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El cliente del lector de etiquetas en el navegador (S13 · ADR-019): arrancar, leer, parar y
 * preparar la foto. El tesseract real JAMÁS corre aquí: el global, el worker, el bitmap y el
 * lienzo son dobles. Se prueba la plomería y que todo error sale como un código, nunca un texto.
 */

type Fake = {
  createWorker: ReturnType<typeof vi.fn>;
  recognize: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

const w = window as unknown as { Tesseract?: unknown };

function fakeTesseract(): Fake {
  const recognize = vi.fn(async () => ({
    data: { text: "INGREDIENTES: AGUA", confidence: 91 },
  }));
  const terminate = vi.fn(async () => undefined);
  const createWorker = vi.fn(async () => ({ recognize, terminate }));
  return { createWorker, recognize, terminate };
}

async function load() {
  vi.resetModules();
  return import("@/lib/label/ocr-client");
}

beforeEach(() => {
  vi.stubGlobal("Worker", function Worker() {});
});
afterEach(() => {
  delete w.Tesseract;
  document.head.querySelectorAll("script").forEach((s) => s.remove());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("canRead", () => {
  it("pide Worker, WebAssembly y fetch", async () => {
    const m = await load();
    expect(m.canRead()).toBe(true);
    vi.stubGlobal("Worker", undefined);
    expect(m.canRead()).toBe(false);
  });
});

describe("OcrClient.start", () => {
  it("sin lo necesario en el navegador: «unsupported»", async () => {
    vi.stubGlobal("Worker", undefined);
    const m = await load();
    await expect(m.OcrClient.start("lstm")).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("inyecta /ocr/tesseract.min.js una vez y arranca el worker desde /ocr/, sin blob ni caché propia", async () => {
    const m = await load();
    const fake = fakeTesseract();
    const started = m.OcrClient.start("simd-lstm");
    const again = m.OcrClient.start("simd-lstm");
    const scripts = document.head.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toBe(m.OCR_SCRIPT);
    w.Tesseract = fake;
    scripts[0].dispatchEvent(new Event("load"));
    const client = await started;
    await again;
    const [, oem, opts] = fake.createWorker.mock.calls[0];
    expect(oem).toBe(1);
    expect(opts).toMatchObject({
      workerPath: m.OCR_WORKER,
      corePath: "/ocr/core/tesseract-core-simd-lstm.wasm.js",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      cacheMethod: "none",
    });

    // Con el global ya puesto, no se inyecta otra vez.
    await m.OcrClient.start("lstm");
    expect(document.head.querySelectorAll("script")).toHaveLength(1);

    expect(await client.read(new Blob(["x"]))).toEqual({
      text: "INGREDIENTES: AGUA",
      confidence: 91,
    });
    await client.stop();
    expect(fake.terminate).toHaveBeenCalled();
  });

  it("si el script no carga: «download-failed», y el siguiente intento lo vuelve a pedir", async () => {
    const m = await load();
    const first = m.OcrClient.start("lstm");
    document.head.querySelector("script")!.dispatchEvent(new Event("error"));
    await expect(first).rejects.toMatchObject({ code: "download-failed" });
    expect(document.head.querySelectorAll("script")).toHaveLength(0);

    const second = m.OcrClient.start("lstm");
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    document.head.querySelector("script")!.dispatchEvent(new Event("load"));
    // Cargó pero no dejó el global: «init-failed».
    await expect(second).rejects.toMatchObject({ code: "init-failed" });
  });

  it("si el worker reporta un error o falla al crearse: «init-failed», nunca el mensaje", async () => {
    const m = await load();
    const fake = fakeTesseract();
    fake.createWorker.mockImplementationOnce(
      async (_l: string[], _o: number, opts: { errorHandler: () => void }) => {
        opts.errorHandler();
        return { recognize: fake.recognize, terminate: fake.terminate };
      },
    );
    w.Tesseract = fake;
    await expect(m.OcrClient.start("lstm")).rejects.toMatchObject({
      code: "init-failed",
    });
    fake.createWorker.mockRejectedValueOnce(new Error("texto interno"));
    const e = await m.OcrClient.start("lstm").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(m.OcrError);
    expect((e as Error).message).toBe("init-failed");
  });

  it("un worker que no responde no deja «Leyendo…» para siempre: «timeout»", async () => {
    vi.useFakeTimers();
    const m = await load();
    const fake = fakeTesseract();
    fake.createWorker.mockImplementationOnce(() => new Promise(() => {}));
    w.Tesseract = fake;
    const p = m.OcrClient.start("lstm").catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(await p).toMatchObject({ code: "timeout" });
  });
});

describe("OcrClient.read y stop", () => {
  it("un error al leer sale como «read-failed»; un texto vacío o raro no rompe", async () => {
    const m = await load();
    const fake = fakeTesseract();
    w.Tesseract = fake;
    const client = await m.OcrClient.start("lstm");
    fake.recognize.mockRejectedValueOnce(new Error("contenido de la foto"));
    await expect(client.read(new Blob(["x"]))).rejects.toMatchObject({
      code: "read-failed",
    });
    fake.recognize.mockResolvedValueOnce({ data: {} });
    const r = await client.read(new Blob(["x"]));
    expect(r.text).toBe("");
    expect(Number.isNaN(r.confidence)).toBe(true);
    fake.terminate.mockRejectedValueOnce(new Error("ya parado"));
    await expect(client.stop()).resolves.toBeUndefined();
  });

  it("leer que no termina: «timeout»", async () => {
    vi.useFakeTimers();
    const m = await load();
    const fake = fakeTesseract();
    w.Tesseract = fake;
    const client = await m.OcrClient.start("lstm");
    fake.recognize.mockImplementationOnce(() => new Promise(() => {}));
    const p = client.read(new Blob(["x"])).catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(await p).toMatchObject({ code: "timeout" });
  });
});

describe("labelImage: la foto reducida y en gris, en memoria", () => {
  const bitmap = (width: number, height: number) => ({
    width,
    height,
    close: vi.fn(),
  });
  const ctx = () => ({ filter: "", drawImage: vi.fn() });

  it("con OffscreenCanvas: lado mayor a 1600, en gris, PNG, y suelta el bitmap", async () => {
    const m = await load();
    const b = bitmap(4000, 3000);
    const c = ctx();
    const made: number[][] = [];
    vi.stubGlobal("createImageBitmap", vi.fn(async () => b));
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(wd: number, ht: number) {
          made.push([wd, ht]);
        }
        getContext() {
          return c;
        }
        async convertToBlob(o: { type: string }) {
          return new Blob(["png"], { type: o.type });
        }
      },
    );
    const out = await m.labelImage(new Blob(["foto"]));
    expect(made[0]).toEqual([1600, 1200]);
    expect(c.filter).toBe("grayscale(1)");
    expect(out.type).toBe("image/png");
    expect(b.close).toHaveBeenCalled();
  });

  it("una foto chica no se agranda; sin contexto: «read-failed» y el bitmap se suelta igual", async () => {
    const m = await load();
    const b = bitmap(800, 600);
    const made: number[][] = [];
    vi.stubGlobal("createImageBitmap", vi.fn(async () => b));
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(wd: number, ht: number) {
          made.push([wd, ht]);
        }
        getContext() {
          return null;
        }
      },
    );
    await expect(m.labelImage(new Blob(["foto"]))).rejects.toMatchObject({
      code: "read-failed",
    });
    expect(made[0]).toEqual([800, 600]);
    expect(b.close).toHaveBeenCalled();
  });

  it("sin OffscreenCanvas: un <canvas> en memoria; si no da PNG, «read-failed»", async () => {
    const m = await load();
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap(3200, 1600)));
    const c = ctx();
    const real = document.createElement.bind(document);
    let blob: Blob | null = new Blob(["png"], { type: "image/png" });
    const spy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag !== "canvas") return real(tag);
        return {
          getContext: () => c,
          toBlob: (cb: (b: Blob | null) => void) => cb(blob),
        } as unknown as HTMLCanvasElement;
      });
    const out = await m.labelImage(new Blob(["foto"]));
    expect(out.type).toBe("image/png");
    expect(c.filter).toBe("grayscale(1)");
    blob = null;
    await expect(m.labelImage(new Blob(["foto"]))).rejects.toMatchObject({
      code: "read-failed",
    });
    spy.mockImplementation((tag: string) =>
      tag === "canvas"
        ? ({ getContext: () => null } as unknown as HTMLCanvasElement)
        : real(tag),
    );
    await expect(m.labelImage(new Blob(["foto"]))).rejects.toMatchObject({
      code: "read-failed",
    });
    spy.mockRestore();
  });
});
