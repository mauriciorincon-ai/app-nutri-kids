import { describe, expect, it } from "vitest";

import nextConfig, {
  OCR_WORKER_CSP,
  SCAN_WORKER_CSP,
  VISION_WORKER_CSP,
} from "../../next.config";

/**
 * La cabecera que acota la red del worker de la cámara (S12 · ADR-018): es la que el navegador aplica
 * AUNQUE falle la guardia del propio worker.
 */
describe("cabecera del worker de la cámara", () => {
  it("se aplica solo a los tres workers (cámara, lector y súper) y es la CSP declarada", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map((r) => r.source)).toEqual([
      "/ia/vision-worker.js",
      "/ocr/worker.min.js",
      "/scan/scan-worker.js",
    ]);
    expect(rules[0].headers).toEqual([
      { key: "Content-Security-Policy", value: VISION_WORKER_CSP },
    ]);
  });

  it("connect-src permite solo la app, el Hub y su CDN: ningún comodín abierto ni otro tercero", () => {
    const [directive, ...rest] = VISION_WORKER_CSP.split(";");
    expect(rest).toEqual([]);
    const sources = directive.trim().split(/\s+/);
    expect(sources[0]).toBe("connect-src");
    expect(sources.slice(1).sort()).toEqual(
      [
        "'self'",
        "blob:",
        "data:",
        "https://*.hf.co",
        "https://*.huggingface.co",
        "https://huggingface.co",
      ].sort(),
    );
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    expect(VISION_WORKER_CSP).not.toMatch(/unsafe|http:/);
  });
});

/** El worker del lector de etiquetas (S13 · ADR-019): su red es SOLO la app. */
describe("cabecera del worker del lector", () => {
  it("es la CSP declarada, en la ruta exacta del worker", async () => {
    const rules = await nextConfig.headers!();
    const ocr = rules.find((r) => r.source === "/ocr/worker.min.js");
    expect(ocr?.headers).toEqual([
      { key: "Content-Security-Policy", value: OCR_WORKER_CSP },
    ]);
  });

  it("connect-src permite solo la app: ningún host, ningún esquema de red", () => {
    const [directive, ...rest] = OCR_WORKER_CSP.split(";");
    expect(rest).toEqual([]);
    const sources = directive.trim().split(/\s+/);
    expect(sources[0]).toBe("connect-src");
    expect(sources.slice(1).sort()).toEqual(["'self'", "blob:", "data:"]);
    expect(OCR_WORKER_CSP).not.toMatch(/https?:|\*|unsafe/);
  });
});

/** El worker del súper (S13 · ADR-019): lo escaneado y el catálogo no tienen adónde salir. */
describe("cabecera del worker del súper", () => {
  it("es la CSP declarada, en la ruta exacta del worker", async () => {
    const rules = await nextConfig.headers!();
    const scan = rules.find((r) => r.source === "/scan/scan-worker.js");
    expect(scan?.headers).toEqual([
      { key: "Content-Security-Policy", value: SCAN_WORKER_CSP },
    ]);
  });

  it("connect-src permite solo la app: ningún host, ni blob ni data", () => {
    expect(SCAN_WORKER_CSP).toBe("connect-src 'self'");
    expect(SCAN_WORKER_CSP).not.toMatch(/https?:|\*|unsafe|blob:|data:/);
  });
});
