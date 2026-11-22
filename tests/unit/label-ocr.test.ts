// @vitest-environment node
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OCR_FILES } from "../../scripts/build-sw.mjs";
import ocr from "@/lib/label/ocr.json";
import {
  OCR_BASE,
  OcrError,
  coreVariant,
  downloadOcr,
  ocrDownloadBytes,
  ocrFiles,
} from "@/lib/label/ocr-client";
import { deleteOcr, ocrBytes, ocrCached } from "@/lib/label/ocr-store";

/**
 * El lector de etiquetas (S13 · ADR-019): qué baja el teléfono, de dónde (solo de la app) y cómo se
 * mide y se borra. El lector real (tesseract) JAMÁS corre aquí: se prueba la plomería.
 */
const root = join(__dirname, "../..");

describe("lo que el teléfono baja", () => {
  it("ocr.json coincide byte a byte con lo que build-sw copia, archivo por archivo", () => {
    expect(Object.keys(ocr.files).sort()).toEqual(Object.keys(OCR_FILES).sort());
    for (const [name, bytes] of Object.entries(ocr.files))
      expect(statSync(join(root, "public/ocr", name)).size, name).toBe(bytes);
  });

  it("el núcleo se elige como lo elige tesseract: relaxed SIMD, SIMD o el básico", () => {
    expect(coreVariant(() => true)).toBe("relaxedsimd-lstm");
    let n = 0;
    expect(coreVariant(() => n++ > 0)).toBe("simd-lstm");
    expect(coreVariant(() => false)).toBe("lstm");
    expect(
      coreVariant(() => {
        throw new Error("x");
      }),
    ).toBe("lstm");
  });

  it("baja el código, UN núcleo y los dos idiomas: unos 9 MB, no los 18 de los tres núcleos", () => {
    const files = ocrFiles("simd-lstm");
    expect(files).toEqual([
      "tesseract.min.js",
      "worker.min.js",
      "core/tesseract-core-simd-lstm.wasm.js",
      "lang/spa.traineddata.gz",
      "lang/eng.traineddata.gz",
    ]);
    const mb = ocrDownloadBytes("simd-lstm") / 1e6;
    expect(mb).toBeGreaterThan(8);
    expect(mb).toBeLessThan(10);
  });

  it("el cliente no nombra ninguna CDN ni host: todo sale de /ocr/ de la propia app", () => {
    const src = readFileSync(join(root, "src/lib/label/ocr-client.ts"), "utf8");
    expect(src).not.toMatch(/https?:\/\//);
    expect(src).toContain('workerBlobURL: false');
    expect(src).toContain('cacheMethod: "none"');
    expect(src).toMatch(/workerPath: OCR_WORKER/);
    expect(src).toMatch(/langPath: `\$\{OCR_BASE\}lang`/);
    expect(src).toMatch(/corePath: `\$\{OCR_BASE\}core\//);
    expect(OCR_BASE).toBe("/ocr/");
  });
});

describe("downloadOcr", () => {
  const body = (n: number) =>
    new Response(new Uint8Array(n), { status: 200 });

  it("pide solo archivos de /ocr/, en orden, y reporta el avance hasta el total", async () => {
    const asked: string[] = [];
    const seen: number[] = [];
    await downloadOcr(
      (loaded) => seen.push(loaded),
      "lstm",
      (async (url: string) => {
        asked.push(url);
        return body(1000);
      }) as unknown as typeof fetch,
    );
    expect(asked).toEqual(ocrFiles("lstm").map((f) => OCR_BASE + f));
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(ocrDownloadBytes("lstm"));
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it("sin red o con un error del servidor: un código, nunca un texto", async () => {
    await expect(
      downloadOcr(() => {}, "lstm", (async () => {
        throw new TypeError("offline");
      }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: "download-failed" });
    await expect(
      downloadOcr(() => {}, "lstm", (async () =>
        new Response("", { status: 404 })) as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(OcrError);
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

describe("ocr-store: mirar y borrar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("está guardado solo si su caché tiene TODOS los archivos de este teléfono", async () => {
    const full = new Map(
      ocrFiles("lstm").map((f) => [OCR_BASE + f, new Response("x", { headers: { "content-length": "10" } })]),
    );
    const store: Record<string, Map<string, Response>> = { "nutrikids-ocr-abc": full };
    vi.stubGlobal("caches", fakeCaches(store));
    expect(await ocrCached("lstm")).toBe(true);
    expect(await ocrCached("simd-lstm")).toBe(false);
    expect(await ocrBytes()).toBe(10 * full.size);
  });

  it("borra solo las cachés del lector: el cascarón y el modelo de la cámara se quedan", async () => {
    const store: Record<string, Map<string, Response>> = {
      "nutrikids-ocr-abc": new Map(),
      "nutrikids-shell-1": new Map(),
      "nutrikids-model": new Map(),
    };
    vi.stubGlobal("caches", fakeCaches(store));
    await deleteOcr();
    expect(Object.keys(store).sort()).toEqual(["nutrikids-model", "nutrikids-shell-1"]);
  });

  it("sin CacheStorage: no está, ocupa cero y borrar no falla", async () => {
    expect(await ocrCached("lstm")).toBe(false);
    expect(await ocrBytes()).toBe(0);
    await expect(deleteOcr()).resolves.toBeUndefined();
  });
});
