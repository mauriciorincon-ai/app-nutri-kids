/**
 * Del PDF al texto, EN EL APARATO (ADR-010). Dos partes:
 *  - `extractPdfPages`: pide a pdf.js los ítems de texto de cada página. El módulo de
 *    pdf.js se INYECTA (el navegador lo carga con `import()` diferido y su worker propio
 *    servido por la app; las pruebas usan la build de Node), así esta función no toca
 *    red, ni CDN, ni fuentes externas: solo lee los bytes que recibe.
 *  - `toLines`: puro. Agrupa ítems en líneas por altura y, dentro de cada línea, en
 *    segmentos por columna (un hueco ancho = otra columna), que es como el lector
 *    reconstruye las tablas: por x, nunca por línea física.
 */

/** Un ítem de texto con su posición en puntos (y crece hacia abajo). */
export type PdfItem = { str: string; x: number; y: number; w: number };
export type PdfPage = { n: number; height: number; items: PdfItem[] };

/** Un tramo de texto continuo dentro de una línea (una celda de una columna). */
export type Seg = { x: number; end: number; text: string };
export type Line = { page: number; y: number; segs: Seg[]; text: string };

/** Lo mínimo de pdf.js que usamos (sirve la build del navegador y la de Node). */
export type PdfJsLike = {
  getDocument(src: {
    data: Uint8Array;
    isEvalSupported?: boolean;
    disableFontFace?: boolean;
    useSystemFonts?: boolean;
    disableAutoFetch?: boolean;
    disableStream?: boolean;
    disableRange?: boolean;
    stopAtErrors?: boolean;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{
        getViewport(o: { scale: number }): { height: number };
        getTextContent(): Promise<{ items: unknown[] }>;
        cleanup?(): void;
      }>;
    }>;
    destroy(): Promise<void>;
  };
};

type RawItem = { str: string; transform: number[]; width: number };

function isRawItem(it: unknown): it is RawItem {
  return (
    typeof it === "object" &&
    it !== null &&
    typeof (it as RawItem).str === "string" &&
    Array.isArray((it as RawItem).transform)
  );
}

/**
 * Lee las páginas del PDF. Los bytes se entregan a pdf.js y, al terminar, el documento
 * se destruye: del archivo solo sobrevive el texto que devuelve (decisión 2 a).
 */
export async function extractPdfPages(
  pdfjs: PdfJsLike,
  data: Uint8Array,
): Promise<PdfPage[]> {
  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
  });
  try {
    const doc = await task.promise;
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const height = page.getViewport({ scale: 1 }).height;
      const content = await page.getTextContent();
      const items: PdfItem[] = [];
      for (const it of content.items) {
        if (!isRawItem(it) || it.str === "") continue;
        items.push({
          str: it.str,
          x: it.transform[4],
          y: height - it.transform[5],
          w: it.width,
        });
      }
      pages.push({ n, height, items });
      page.cleanup?.();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/** Un hueco en blanco más ancho que esto (en pt) separa columnas, no palabras. */
const COLUMN_GAP = 8;
/** Ítems con la línea base a menos de esto (pt) están en la misma línea. */
const SAME_LINE = 2;

/** Agrupa los ítems de una página en líneas y segmentos (puro). */
export function toLines(page: PdfPage): Line[] {
  const sorted = [...page.items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: PdfItem[][] = [];
  for (const it of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].y - it.y) <= SAME_LINE) row.push(it);
    else rows.push([it]);
  }
  const lines: Line[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const segs: Seg[] = [];
    let pendingSpace = false;
    for (const it of row) {
      if (it.str.trim() === "") {
        // Un blanco ancho es un hueco de columna; uno angosto, un espacio entre palabras.
        if (it.w >= COLUMN_GAP) segs.push({ x: NaN, end: NaN, text: "" });
        else pendingSpace = true;
        continue;
      }
      const cur = segs.at(-1);
      const gap = cur && !Number.isNaN(cur.end) ? it.x - cur.end : Infinity;
      if (cur && cur.text !== "" && gap < COLUMN_GAP) {
        cur.text += (pendingSpace || gap > 1.5 ? " " : "") + it.str;
        cur.end = it.x + it.w;
      } else {
        if (cur && cur.text === "") segs.pop();
        segs.push({ x: it.x, end: it.x + it.w, text: it.str });
      }
      pendingSpace = false;
    }
    const clean = segs
      .filter((s) => s.text.trim() !== "")
      .map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ").trim() }));
    if (clean.length === 0) continue;
    lines.push({
      page: page.n,
      y: row[0].y,
      segs: clean,
      text: clean.map((s) => s.text).join(" "),
    });
  }
  return lines;
}
