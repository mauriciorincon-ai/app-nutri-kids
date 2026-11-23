#!/usr/bin/env node
/**
 * Gate S12 · ADR-018: el modelo de la cámara y su runtime NO entran en ninguna ruta. Viven solo en
 * `public/ia/` (copiados por `scripts/build-sw.mjs`) y los carga el worker tras el toque de quien
 * cuida. Desde el S13 (ADR-019) cubre también el lector de etiquetas (`public/ocr/`), el lector de códigos de barras (`public/scan/`) y el catálogo de productos (`public/catalogo/`). Recorre los chunks del build (`.next/static` y `.next/server`) y falla si alguno trae
 * rastros del runtime. Un build vacío no es verde: sin chunks que mirar, falla.
 *
 * Uso: node scripts/check-model-isolation.mjs [--dir .next]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const dir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : ".next";

/** Lo que solo existe dentro del runtime del modelo (transformers.js + onnxruntime-web). */
export const MARKERS = [
  "onnxruntime-web",
  "ort-wasm-simd-threaded",
  "AutoModelForVision2Seq",
  "InferenceSession",
  "@huggingface/transformers",
  // S13 · ADR-019: el lector de etiquetas (tesseract.js, su worker y su núcleo).
  "createScheduler",
  "TesseractCore",
  "tesseract.js-core",
  "PSM_AUTO_OSD",
  // S13 · ADR-019 (F2): el lector de códigos de barras (zxing-wasm) y el catálogo de productos
  // (dato de Open Food Facts, ODbL), que viven en `public/scan/` y `public/catalogo/`.
  // Los nombres de la API (`prepareZXingModule`…) los borra la minificación del build de producción
  // (lo demostró `demo-rojo`: el gate pasaba con zxing dentro de una ruta). Sobreviven los textos
  // propios de la librería, que ningún archivo nuestro lleva.
  "Pharmazentralnummer",
  "Cannot pass non-string to std::string",
  "prepareZXingModule",
  "countries_tags_en=colombia",
];

function* files(root) {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(m?js|cjs)$/.test(e.name)) yield p;
  }
}

const roots = ["static", "server"].map((d) => join(dir, d)).filter((d) => existsSync(d) && statSync(d).isDirectory());
if (roots.length === 0) {
  console.error(`model-isolation: no hay build en ${dir} (corre «pnpm build» antes)`);
  process.exit(1);
}

let scanned = 0;
const hits = [];
for (const root of roots)
  for (const f of files(root)) {
    scanned++;
    const text = readFileSync(f, "utf8");
    for (const m of MARKERS) if (text.includes(m)) hits.push(`${relative(dir, f)} · ${m}`);
  }

if (scanned === 0) {
  console.error("model-isolation: 0 chunks mirados — un build vacío no es verde");
  process.exit(1);
}
if (hits.length) {
  console.error(`model-isolation: el runtime del modelo entró en ${hits.length} chunk(s) de las rutas:`);
  for (const h of hits.slice(0, 20)) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`model-isolation: ${scanned} chunks, 0 rastros del modelo en las rutas`);
