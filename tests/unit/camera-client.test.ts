import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VisionClient, canTry, pixelsFromFile } from "@/lib/camera/client";
import model from "@/lib/camera/model.json";
import { deleteModel, modelBytes, modelCached } from "@/lib/camera/model-store";

/** Un worker de mentira: guarda lo que se le manda y deja contestar a mano. */
class FakeWorker {
  static last: FakeWorker | null = null;
  url: string;
  opts: unknown;
  sent: { msg: Record<string, unknown>; transfer: Transferable[] }[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  constructor(url: string, opts: unknown) {
    this.url = url;
    this.opts = opts;
    FakeWorker.last = this;
  }
  postMessage(msg: Record<string, unknown>, transfer: Transferable[] = []) {
    this.sent.push({ msg, transfer });
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
  terminate() {
    this.terminated = true;
  }
}

describe("VisionClient: la página habla con el worker", () => {
  beforeEach(() => vi.stubGlobal("Worker", FakeWorker));
  afterEach(() => vi.unstubAllGlobals());

  it("crea el worker con la URL literal de /ia/ como módulo", () => {
    new VisionClient();
    expect(FakeWorker.last?.url).toBe("/ia/vision-worker.js");
    expect(FakeWorker.last?.opts).toEqual({ type: "module" });
  });

  it("probe y load responden; el progreso llega aparte", async () => {
    const c = new VisionClient();
    const w = FakeWorker.last!;
    const probe = c.probe();
    w.reply({ type: "probe", webgpu: false, wasm: true });
    await expect(probe).resolves.toMatchObject({ wasm: true });

    const seen: unknown[] = [];
    const load = c.load("wasm", (p) => seen.push(p));
    expect(w.sent.at(-1)?.msg).toEqual({ type: "load", engine: "wasm" });
    w.reply({ type: "progress", file: "a.onnx", loaded: 1, total: 2 });
    w.reply({ type: "ready", engine: "wasm", ms: 5, runtimeBytes: 7 });
    await expect(load).resolves.toMatchObject({ engine: "wasm", runtimeBytes: 7 });
    expect(seen).toEqual([{ type: "progress", file: "a.onnx", loaded: 1, total: 2 }]);
  });

  it("analyze TRANSFIERE los píxeles (la página se queda sin copia) y empareja la respuesta por id", async () => {
    const c = new VisionClient();
    const w = FakeWorker.last!;
    const data = new Uint8ClampedArray(16);
    const image = { width: 2, height: 2, data } as unknown as ImageData;
    const job = c.analyze(image);
    const { msg, transfer } = w.sent.at(-1)!;
    expect(msg.type).toBe("analyze");
    expect(transfer).toEqual([data.buffer]);
    w.reply({ type: "result", id: msg.id, text: "eggs", ms: 3 });
    await expect(job).resolves.toEqual({ type: "result", id: msg.id, text: "eggs", ms: 3 });
  });

  it("un error del worker llega como código y rechaza; terminate rechaza lo pendiente", async () => {
    const c = new VisionClient();
    const w = FakeWorker.last!;
    const job = c.analyze({ width: 1, height: 1, data: new Uint8ClampedArray(4) } as unknown as ImageData);
    w.reply({ type: "error", id: w.sent.at(-1)!.msg.id, code: "blocked-request" });
    await expect(job).rejects.toThrow("blocked-request");

    const load = c.load("webgpu", () => {});
    w.onerror?.();
    await expect(load).rejects.toThrow("load-failed");

    const probe = c.probe();
    c.terminate();
    await expect(probe).rejects.toThrow("load-failed");
    expect(w.terminated).toBe(true);
    // Una respuesta que ya nadie espera no rompe nada.
    w.reply({ type: "result", id: 99, text: "x" });
  });

  it("canTry pide Worker y WebAssembly", () => {
    expect(canTry()).toBe(true);
    vi.stubGlobal("Worker", undefined);
    expect(canTry()).toBe(false);
  });
});

describe("pixelsFromFile: la foto se reduce y el bitmap se cierra", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubs(width: number, height: number, ctx: unknown = {}) {
    const bitmap = { width, height, close: vi.fn() };
    const drawn: number[][] = [];
    const context = ctx && {
      drawImage: (_b: unknown, ...a: number[]) => drawn.push(a),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h }),
    };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return context;
        }
      },
    );
    return { bitmap, drawn };
  }

  it("lado mayor al tamaño del modelo, sin agrandar las pequeñas", async () => {
    const { bitmap, drawn } = stubs(2048, 1024);
    const img = await pixelsFromFile(new Blob());
    expect([img.width, img.height]).toEqual([model.imageEdge, model.imageEdge / 2]);
    expect(drawn[0]).toEqual([0, 0, model.imageEdge, model.imageEdge / 2]);
    expect(bitmap.close).toHaveBeenCalledOnce();

    stubs(100, 50);
    const small = await pixelsFromFile(new Blob());
    expect([small.width, small.height]).toEqual([100, 50]);
  });

  it("sin contexto 2D falla como «analyze-failed» y aun así cierra el bitmap", async () => {
    const { bitmap } = stubs(10, 10, null);
    await expect(pixelsFromFile(new Blob())).rejects.toThrow("analyze-failed");
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});

describe("model-store: mirar y borrar lo guardado, jamás descargar", () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeCaches(entries: Record<string, { url: string; len?: number; body?: number }[]>) {
    const store = new Map(Object.entries(entries));
    const api = {
      has: async (n: string) => store.has(n),
      keys: async () => [...store.keys()],
      delete: vi.fn(async (n: string) => store.delete(n)),
      open: async (n: string) => ({
        keys: async () => (store.get(n) ?? []).map((e) => ({ url: e.url })),
        match: async (req: { url: string }) => {
          const e = (store.get(n) ?? []).find((x) => x.url === req.url);
          if (!e) return undefined;
          return {
            headers: { get: () => (e.len ? String(e.len) : null) },
            blob: async () => ({ size: e.body ?? 0 }),
          };
        },
      }),
    };
    vi.stubGlobal("caches", api);
    return { store, api };
  }
  const onnx = (name: string, len?: number, body?: number) => ({
    url: `https://huggingface.co/${model.id}/resolve/${model.revision}/onnx/${name}.onnx`,
    len,
    body,
  });

  it("guardado solo si están los tres pesos de la revisión fijada", async () => {
    fakeCaches({ [model.cacheKey]: [onnx("a"), onnx("b")] });
    expect(await modelCached()).toBe(false);
    fakeCaches({ [model.cacheKey]: [onnx("a"), onnx("b"), onnx("c")] });
    expect(await modelCached()).toBe(true);
    fakeCaches({});
    expect(await modelCached()).toBe(false);
  });

  it("suma el modelo y el runtime, no otras cachés", async () => {
    fakeCaches({
      [model.cacheKey]: [onnx("a", 100), onnx("b", undefined, 50)],
      "nutrikids-ia-abc": [{ url: "/ia/transformers.min.js", len: 7 }],
      "nutrikids-shell-x": [{ url: "/", len: 1000 }],
    });
    expect(await modelBytes()).toBe(157);
  });

  it("borrar quita el modelo y el runtime, y deja el cascarón", async () => {
    const { store } = fakeCaches({
      [model.cacheKey]: [onnx("a")],
      "nutrikids-ia-abc": [],
      "nutrikids-shell-x": [],
    });
    await deleteModel();
    expect([...store.keys()]).toEqual(["nutrikids-shell-x"]);
  });

  it("sin Cache API: no hay modelo, cero bytes y borrar no rompe", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await modelCached()).toBe(false);
    expect(await modelBytes()).toBe(0);
    await expect(deleteModel()).resolves.toBeUndefined();
  });

  it("una caché que falla al leer cuenta como no guardado", async () => {
    vi.stubGlobal("caches", {
      has: async () => {
        throw new Error("x");
      },
      keys: async () => {
        throw new Error("x");
      },
    });
    expect(await modelCached()).toBe(false);
    expect(await modelBytes()).toBe(0);
  });
});
