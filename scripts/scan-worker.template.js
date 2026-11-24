/**
 * El worker del súper (S13 · ADR-019). Corre en el teléfono y hace dos cosas, las dos sin red más
 * allá de la propia app:
 *  - `load` / `lookup` / `sameCategory`: indexa el catálogo de Open Food Facts (ODbL), que el
 *    teléfono ya bajó a `/catalogo/`, y responde por código y por categoría;
 *  - `decode`: lee un código de barras de una imagen con zxing-wasm (solo si el navegador no trae
 *    `BarcodeDetector`), cargado aquí y solo aquí, con su `.wasm` servido desde `/scan/`.
 * Nada de lo escaneado sale: los mensajes llevan códigos y productos públicos, jamás texto de un plan.
 * Su respuesta de error es SOLO un código («catalog», «decode»), nunca el contenido.
 * CSP del archivo: `connect-src 'self'` (next.config.ts).
 */
"use strict";

const CATALOG_URL = "/catalogo/off-co.json";
const ZXING_URL = "/scan/zxing-reader.js";
const WASM_URL = "/scan/zxing_reader.wasm";
const FORMATS = ["EAN13", "EAN8", "UPCA"];

let meta = null;
let byCode = null;
let byCategory = null;
let zxing = null;

async function load() {
  if (byCode) return meta;
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error("catalog");
  const data = await res.json();
  if (!data || !Array.isArray(data.products)) throw new Error("catalog");
  const codes = new Map();
  const cats = new Map();
  for (const p of data.products) {
    if (!p || typeof p.code !== "string") continue;
    codes.set(p.code, p);
    for (const c of Array.isArray(p.cat) ? p.cat : []) {
      const list = cats.get(c);
      if (list) list.push(p);
      else cats.set(c, [p]);
    }
  }
  byCode = codes;
  byCategory = cats;
  meta = {
    generated: String(data.generated || ""),
    license: String(data.license || ""),
    source: String(data.source || ""),
    count: codes.size,
  };
  return meta;
}

/** Un UPC-A (12) y un EAN-13 con un cero delante son el mismo producto. */
function keys(code) {
  if (code.length === 12) return [code, "0" + code];
  if (code.length === 13 && code[0] === "0") return [code, code.slice(1)];
  return [code];
}

function lookup(code) {
  for (const k of keys(String(code))) {
    const p = byCode.get(k);
    if (p) return p;
  }
  return null;
}

/** Productos de una categoría que traen ingredientes (sin ellos no hay cotejo), hasta `limit`. */
function sameCategory(category, limit) {
  const out = [];
  for (const p of byCategory.get(String(category)) || []) {
    if (p.ing) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

async function decode(image) {
  if (!zxing) {
    importScripts(ZXING_URL);
    zxing = self.ZXingWASM;
    await zxing.prepareZXingModule({
      overrides: {
        locateFile: (path, prefix) => (path.endsWith(".wasm") ? WASM_URL : prefix + path),
      },
      fireImmediately: true,
    });
  }
  const found = await zxing.readBarcodes(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    { formats: FORMATS, tryHarder: true, maxNumberOfSymbols: 1 },
  );
  const hit = found.find((r) => r && r.isValid !== false && /^\d+$/.test(r.text));
  return hit ? hit.text : null;
}

self.onmessage = async (event) => {
  const { id, op } = event.data || {};
  try {
    let result;
    if (op === "load") result = await load();
    else if (op === "lookup") {
      await load();
      result = lookup(event.data.code);
    } else if (op === "sameCategory") {
      await load();
      result = sameCategory(event.data.category, Number(event.data.limit) || 100);
    } else if (op === "decode") result = await decode(event.data.image);
    else throw new Error("unknown");
    self.postMessage({ id, ok: true, result });
  } catch (e) {
    const code = e && e.message === "catalog" ? "catalog" : op === "decode" ? "decode" : "unknown";
    self.postMessage({ id, ok: false, error: code });
  }
};
