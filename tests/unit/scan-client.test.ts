// @vitest-environment node
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SCAN_FILES } from "../../scripts/build-sw.mjs";
import {
  ScanClient,
  ScanError,
  barcodeImageData,
  downloadScan,
  nativeScanner,
} from "@/lib/scan/client";
import { CATALOG_URL, SCAN_BASE, scanDownloadBytes, scanFiles } from "@/lib/scan/files";
import { deleteScan, scanBytes, scanCached } from "@/lib/scan/scan-store";
import scan from "@/lib/scan/scan.json";

/**
 * El súper en el teléfono (S13 · ADR-019): qué baja (solo de la app), cómo habla con su worker y
 * cómo se mide y se borra. El escáner real (zxing) y el catálogo real JAMÁS corren aquí.
 */
const root = join(__dirname, "../..");

describe("lo que el teléfono baja", () => {
  it("scan.json coincide byte a byte con lo que build-sw copia, archivo por archivo", () => {
    const sources: Record<string, string> = {
      ...SCAN_FILES,
      "off-co.json": "data/catalog/off-co.json",
    };
    expect(Object.keys(scan.files).sort()).toEqual(Object.keys(sources).sort());
    for (const [name, bytes] of Object.entries(scan.files))
      expect(statSync(join(root, sources[name])).size, name).toBe(bytes);
  });

  it("con detector propio del navegador: solo el worker y el catálogo; sin él, también zxing y su .wasm", () => {
    expect(scanFiles(true)).toEqual(["/scan/scan-worker.js", CATALOG_URL]);
    expect(scanFiles(false)).toEqual([
      "/scan/scan-worker.js",
      CATALOG_URL,
      "/scan/zxing-reader.js",
      "/scan/zxing_reader.wasm",
    ]);
    expect(scanDownloadBytes(false)).toBeGreaterThan(scanDownloadBytes(true));
  });

  it("todo sale de /scan/ y /catalogo/ de la propia app: ni una CDN, ni un host", () => {
    for (const f of [...scanFiles(false)])
      expect(f).toMatch(/^\/(?:scan|catalogo)\/[\w.-]+$/);
    const sources = ["src/lib/scan/client.ts", "src/lib/scan/files.ts", "scripts/scan-worker.template.js"]
      .map((p) => readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))
      .join("\n");
    // Ni un `http(s)://` ni un host fuera de los comentarios, salvo la URL de la licencia (un enlace, no una petición).
    const urls = [...sources.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((m) => m[0]);
    expect(urls).toEqual(["https://opendatacommons.org/licenses/odbl/1-0/"]);
    expect(sources).not.toMatch(/jsdelivr|unpkg|cdnjs|googleapis/);
    expect(SCAN_BASE).toBe("/scan/");
  });

  it("el worker del súper: solo pide el catálogo y el zxing de la app, y su wasm sale de /scan/", () => {
    const w = readFileSync(join(root, "scripts/scan-worker.template.js"), "utf8");
    expect(w).toContain('const CATALOG_URL = "/catalogo/off-co.json"');
    expect(w).toContain('const ZXING_URL = "/scan/zxing-reader.js"');
    expect(w).toContain('const WASM_URL = "/scan/zxing_reader.wasm"');
    // Cada `fetch(` del worker es el del catálogo; nada más sale.
    expect([...w.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1])).toEqual(["CATALOG_URL"]);
    expect(w).not.toMatch(/XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
    // Sus errores son un código, nunca el contenido.
    expect(w).toMatch(/error: code/);
  });
});

describe("downloadScan", () => {
  const body = (n: number) => new Response(new Uint8Array(n), { status: 200 });

  it("pide solo archivos de la app, en orden, y reporta el avance hasta el total", async () => {
    const asked: string[] = [];
    const seen: number[] = [];
    await downloadScan(
      (loaded) => seen.push(loaded),
      false,
      (async (url: string) => {
        asked.push(url);
        return body(1000);
      }) as unknown as typeof fetch,
    );
    expect(asked).toEqual(scanFiles(false));
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(scanDownloadBytes(false));
  });

  it("sin red o con un error del servidor: un código, nunca un texto", async () => {
    await expect(
      downloadScan(() => {}, true, (async () => {
        throw new TypeError("offline");
      }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: "download-failed" });
    await expect(
      downloadScan(() => {}, true, (async () =>
        new Response("", { status: 404 })) as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(ScanError);
  });
});

/** Un Worker de mentira que contesta como el real: sin red, sin zxing, sin catálogo real. */
class FakeWorker {
  static last: FakeWorker;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  sent: Record<string, unknown>[] = [];
  static reply: (m: Record<string, unknown>) => {
    ok: boolean;
    result?: unknown;
    error?: string;
  } = () => ({ ok: true, result: null });
  constructor(public url: string) {
    FakeWorker.last = this;
  }
  postMessage(m: Record<string, unknown>) {
    this.sent.push(m);
    const r = FakeWorker.reply(m);
    queueMicrotask(() => this.onmessage?.({ data: { id: m.id, ...r } } as MessageEvent));
  }
  terminate() {
    this.terminated = true;
  }
}

const META = { generated: "2026-11-22", license: "ODbL-1.0", source: "Open Food Facts", count: 3 };
const PRODUCT = {
  code: "7702535016688",
  name: "Galletas demo",
  brand: "Marca",
  cat: ["snacks"],
  ing: "harina, agua, sal",
  add: [],
  alg: [],
  tr: [],
};

describe("ScanClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  const start = async (reply: (typeof FakeWorker)["reply"]) => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", () => undefined);
    FakeWorker.reply = reply;
    return ScanClient.start(true);
  };

  it("arranca el worker de la app y carga el catálogo; la licencia viene validada", async () => {
    const c = await start((m) => ({ ok: true, result: m.op === "load" ? META : null }));
    expect(FakeWorker.last.url).toBe("/scan/scan-worker.js");
    expect(c.meta).toEqual(META);
  });

  it("un catálogo que no es ODbL o viene mal formado no arranca", async () => {
    await expect(
      start(() => ({ ok: true, result: { ...META, license: "otra" } })),
    ).rejects.toMatchObject({ code: "catalog-failed" });
    expect(FakeWorker.last.terminated).toBe(true);
    await expect(start(() => ({ ok: false, error: "catalog" }))).rejects.toMatchObject({
      code: "catalog-failed",
    });
  });

  it("lookup: un producto válido pasa; uno malformado es «está, pero no sé qué lleva»; uno ausente, no está", async () => {
    let next: unknown = PRODUCT;
    const c = await start((m) => ({ ok: true, result: m.op === "load" ? META : next }));
    expect(await c.lookup(PRODUCT.code)).toEqual({ product: PRODUCT, found: true });
    next = { ...PRODUCT, add: ["no-es-un-aditivo"] };
    expect(await c.lookup(PRODUCT.code)).toEqual({ product: null, found: true });
    next = null;
    expect(await c.lookup(PRODUCT.code)).toEqual({ product: null, found: false });
  });

  it("sameCategory: descarta los productos rotos y solo devuelve los válidos", async () => {
    const c = await start((m) => ({
      ok: true,
      result: m.op === "load" ? META : [PRODUCT, { code: "x" }, { ...PRODUCT, code: "96385074" }],
    }));
    const out = await c.sameCategory("snacks");
    expect(out.map((p) => p.code)).toEqual([PRODUCT.code, "96385074"]);
  });

  it("lo que sale hacia el worker es un código, una categoría o una imagen: nunca un plan", async () => {
    const c = await start((m) => ({ ok: true, result: m.op === "load" ? META : [] }));
    await c.lookup(PRODUCT.code);
    await c.sameCategory("snacks");
    for (const m of FakeWorker.last.sent) {
      expect(Object.keys(m).every((k) => ["id", "op", "code", "category", "limit", "image"].includes(k))).toBe(true);
    }
  });

  it("decodifica con el detector del navegador si lo hay, y sin zxing", async () => {
    const c = await start((m) => ({ ok: true, result: m.op === "load" ? META : null }));
    vi.stubGlobal("createImageBitmap", async () => ({ width: 10, height: 10, close() {} }));
    vi.stubGlobal(
      "BarcodeDetector",
      class {
        async detect() {
          return [{ rawValue: "7702535016688" }];
        }
      },
    );
    expect(await c.decode(new Blob(["x"]))).toBe("7702535016688");
    // Nada fue al worker para decodificar.
    expect(FakeWorker.last.sent.some((m) => m.op === "decode")).toBe(false);
  });

  it("detecta si el navegador lee EAN-13 por su cuenta", async () => {
    expect(await nativeScanner()).toBe(false);
    vi.stubGlobal("BarcodeDetector", { getSupportedFormats: async () => ["qr_code"] });
    expect(await nativeScanner()).toBe(false);
    vi.stubGlobal("BarcodeDetector", { getSupportedFormats: async () => ["ean_13", "qr_code"] });
    expect(await nativeScanner()).toBe(true);
  });

  it("sin Worker, el súper dice que no puede: un código, no un error crudo", async () => {
    await expect(ScanClient.start(true)).rejects.toMatchObject({ code: "unsupported" });
  });

  it("reduce la foto del código a 1280 px de lado mayor, en memoria", () => {
    const calls: Record<string, number> = {};
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage: (_b: unknown, _x: number, _y: number, w: number, h: number) => {
              calls.w = w;
              calls.h = h;
            },
            getImageData: (_x: number, _y: number, w: number, h: number) => ({
              data: new Uint8ClampedArray(w * h * 4),
            }),
          };
        },
      }),
    });
    const img = barcodeImageData({ width: 4000, height: 3000 } as ImageBitmap);
    expect([img.width, img.height]).toEqual([1280, 960]);
    expect(calls).toEqual({ w: 1280, h: 960 });
    expect(barcodeImageData({ width: 640, height: 480 } as ImageBitmap).width).toBe(640);
  });
});

/** Una CacheStorage mínima en memoria. */
function fakeCaches(store: Record<string, Map<string, Response>>) {
  const open = async (name: string) => {
    store[name] ??= new Map();
    const m = store[name];
    return {
      match: async (req: string | Request) =>
        m.get(typeof req === "string" ? req : new URL(req.url).pathname)?.clone(),
      keys: async () => [...m.keys()].map((k) => new Request(`http://app${k}`)),
    };
  };
  return {
    keys: async () => Object.keys(store),
    open,
    delete: async (name: string) => delete store[name],
  };
}

describe("scan-store: mirar y borrar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("está guardado solo si sus cachés tienen TODOS los archivos de este teléfono", async () => {
    const store: Record<string, Map<string, Response>> = {
      "nutrikids-scan-abc": new Map(
        ["/scan/scan-worker.js"].map((f) => [f, new Response("x", { headers: { "content-length": "10" } })]),
      ),
      "nutrikids-catalog-def": new Map([
        [CATALOG_URL, new Response("x", { headers: { "content-length": "30" } })],
      ]),
    };
    vi.stubGlobal("caches", fakeCaches(store));
    expect(await scanCached(true)).toBe(true);
    expect(await scanCached(false)).toBe(false);
    expect(await scanBytes()).toBe(40);
  });

  it("borra solo el escáner y el catálogo: el cascarón, el lector y el modelo de la cámara se quedan", async () => {
    const store: Record<string, Map<string, Response>> = {
      "nutrikids-scan-abc": new Map(),
      "nutrikids-catalog-def": new Map(),
      "nutrikids-ocr-abc": new Map(),
      "nutrikids-shell-1": new Map(),
      "nutrikids-model": new Map(),
    };
    vi.stubGlobal("caches", fakeCaches(store));
    await deleteScan();
    expect(Object.keys(store).sort()).toEqual([
      "nutrikids-model",
      "nutrikids-ocr-abc",
      "nutrikids-shell-1",
    ]);
  });

  it("sin CacheStorage: no está, ocupa cero y borrar no falla", async () => {
    expect(await scanCached(true)).toBe(false);
    expect(await scanBytes()).toBe(0);
    await expect(deleteScan()).resolves.toBeUndefined();
  });
});
