// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readPdfFile } from "@/lib/pdf/read-pdf";

/**
 * `readPdfFile` con un pdf.js falso: cada salida (no es PDF, sin texto, ilegible, ok)
 * y que un fallo al leer los bytes del archivo no deja la pantalla colgada.
 */
const pdfBytes = new TextEncoder().encode("%PDF-1.7 inventado");
const file = (bytes: Uint8Array | string) =>
  new File([bytes as BlobPart], "x.pdf", { type: "application/pdf" });

const fakeJs = (pages: { items: { str: string }[] }[]) =>
  (async () => ({
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (n: number) => ({
          getViewport: () => ({ height: 800 }),
          getTextContent: async () => ({
            items: pages[n - 1].items.map((i, k) => ({
              str: i.str,
              transform: [1, 0, 0, 1, 10, 700 - k * 14],
              width: 40,
            })),
          }),
          cleanup: () => {},
        }),
      }),
      destroy: async () => {},
    }),
  })) as unknown as Parameters<typeof readPdfFile>[1];

describe("readPdfFile", () => {
  it("un archivo que no es PDF no llega a pdf.js", async () => {
    let loaded = false;
    const r = await readPdfFile(file("esto no es un pdf"), async () => {
      loaded = true;
      throw new Error("no debía cargarse");
    });
    expect(r).toEqual({ ok: false, error: "not-pdf" });
    expect(loaded).toBe(false);
  });

  it("un archivo vacío o muy corto tampoco", async () => {
    expect(await readPdfFile(file(""), fakeJs([]))).toEqual({
      ok: false,
      error: "not-pdf",
    });
  });

  it("un PDF sin texto (escaneado) dice «sin texto»", async () => {
    const r = await readPdfFile(file(pdfBytes), fakeJs([{ items: [] }]));
    expect(r).toEqual({ ok: false, error: "no-text" });
  });

  it("si pdf.js falla al cargar o al abrir, dice «ilegible» y no lanza", async () => {
    const r = await readPdfFile(file(pdfBytes), async () => {
      throw new Error("no cargó");
    });
    expect(r).toEqual({ ok: false, error: "unreadable" });
  });

  it("si leer los bytes del archivo falla (permisos, archivo movido), dice «ilegible»", async () => {
    const broken = {
      arrayBuffer: () => Promise.reject(new Error("permiso")),
    } as unknown as File;
    expect(await readPdfFile(broken, fakeJs([]))).toEqual({
      ok: false,
      error: "unreadable",
    });
  });

  it("un PDF con texto devuelve la lectura (sin rechazar lo que no reconoce)", async () => {
    const r = await readPdfFile(
      file(pdfBytes),
      fakeJs([{ items: [{ str: "Un documento cualquiera" }] }]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reading.unrecognized.length).toBeGreaterThan(0);
  });
});

describe("el pdf.js de la propia app (/pdfjs/), cargado solo al elegir un PDF", () => {
  it("lo carga una vez, le pone su worker de /pdfjs/ y lee; si falla, el siguiente intento lo vuelve a pedir", async () => {
    const { vi } = await import("vitest");
    let calls = 0;
    const pdfjs = (await fakeJs([{ items: [{ str: "Desayuno" }] }])!()) as {
      GlobalWorkerOptions: { workerSrc: string };
    };
    vi.doMock("/pdfjs/pdf.min.mjs", async () => {
      calls += 1;
      if (calls === 1) throw new Error("sin red");
      return pdfjs;
    });
    vi.resetModules();
    const first = await import("@/lib/pdf/read-pdf");
    expect(await first.readPdfFile(file(pdfBytes))).toEqual({
      ok: false,
      error: "unreadable",
    });
    // El mismo módulo, sin recargar: el fallo no queda guardado y el segundo intento lee.
    expect((await first.readPdfFile(file(pdfBytes))).ok).toBe(true);
    expect((await first.readPdfFile(file(pdfBytes))).ok).toBe(true);
    expect(calls).toBe(2);
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe("/pdfjs/pdf.worker.min.mjs");
    vi.doUnmock("/pdfjs/pdf.min.mjs");
  });
});
