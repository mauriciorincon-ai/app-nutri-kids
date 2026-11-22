#!/usr/bin/env node
/**
 * Estampa `public/sw.js` desde `scripts/sw.template.js` (ADR-003).
 * Corre en `prebuild` y `dev`: cada build lleva un id de versión nuevo, así el
 * navegador detecta el SW distinto y la app avisa «hay versión nueva».
 * Contrato (regla 19): la lista de pantallas sale de aquí y un test la compara
 * con las rutas reales de `src/app`.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Pantallas cuyo cascarón se guarda para abrir sin internet. */
export const SHELL_ROUTES = [
  "/",
  "/dieta",
  "/suplementos",
  "/cargar",
  "/ajustes",
  "/perfil",
  "/chat",
  "/historial",
  "/conoce",
  "/escenarios",
  "/unir",
  "/bienestar",
  "/lonchera",
  "/recetas",
  "/viaje",
  "/camara",
  "/camara/cocina",
  "/camara/etiqueta",
];

/** Cascarón del detalle de alimento: sirve de respaldo a `/dieta/<id>` sin visita previa. */
export const DETAIL_SHELL = "/dieta/_";

/**
 * pdf.js y su worker (ADR-010): se sirven desde la propia app (ninguna CDN) y se
 * precachean, así un PDF se lee en el aparato también sin señal. Build «legacy»: la que
 * abre en teléfonos con navegadores de hace unos años.
 */
export const PDFJS_ASSETS = ["/pdfjs/pdf.min.mjs", "/pdfjs/pdf.worker.min.mjs"];

/** Versión de pdf.js instalada: nombra su caché propia (no se vuelve a bajar en cada deploy). */
export function pdfJsVersion() {
  return JSON.parse(
    readFileSync(join(root, "node_modules/pdfjs-dist/package.json"), "utf8"),
  ).version;
}

export function copyPdfJs() {
  const from = join(root, "node_modules/pdfjs-dist/legacy/build");
  const to = join(root, "public/pdfjs");
  mkdirSync(to, { recursive: true });
  for (const asset of PDFJS_ASSETS) {
    const name = asset.split("/").pop();
    copyFileSync(join(from, name), join(to, name));
  }
}

/**
 * El modelo que mira la foto (S12 · ADR-018): el runtime se sirve desde la app (ninguna CDN) y
 * solo se pide tras el toque de «Descargar el modelo». NO se precachea: el SW guarda los `.js` y
 * `.mjs` de `/ia/` al pedirlos la primera vez; el `.wasm` y los pesos los guarda el propio runtime
 * en su caché (`nutrikids-model`), que el SW jamás borra.
 */
export const IA_RUNTIME = [
  "transformers.min.js",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];
export const IA_WORKER = "/ia/vision-worker.js";

export function modelConfig() {
  const raw = JSON.parse(
    readFileSync(join(root, "src/lib/camera/model.json"), "utf8"),
  );
  delete raw._comment;
  return raw;
}

export function transformersVersion() {
  return JSON.parse(
    readFileSync(
      join(root, "node_modules/@huggingface/transformers/package.json"),
      "utf8",
    ),
  ).version;
}

export function renderWorker(template, model = modelConfig()) {
  return template.replace("__MODEL__", () => JSON.stringify(model));
}

/** Nombre de la caché de `/ia/`: cambia si cambia el runtime o el worker estampado. */
export function iaCacheName(worker, version = transformersVersion()) {
  const h = createHash("sha256").update(version).update(worker).digest("hex");
  return `nutrikids-ia-${h.slice(0, 12)}`;
}

/** Donde vive el `dist/` de onnxruntime-web que transformers fija como dependencia (misma versión que el JS empaquetado). */
export function ortDist() {
  const tf = realpathSync(join(root, "node_modules/@huggingface/transformers"));
  const entry = createRequire(join(tf, "package.json")).resolve(
    "onnxruntime-web",
  );
  return dirname(entry);
}

export function copyIa(worker) {
  // transformers.min.js trae ort dentro; su `.wasm` sale de la onnxruntime-web de transformers.
  const tf = realpathSync(join(root, "node_modules/@huggingface/transformers"));
  const from = {
    "transformers.min.js": join(tf, "dist"),
    default: ortDist(),
  };
  const to = join(root, "public/ia");
  mkdirSync(to, { recursive: true });
  for (const name of IA_RUNTIME)
    copyFileSync(join(from[name] ?? from.default, name), join(to, name));
  writeFileSync(join(to, "vision-worker.js"), worker);
}

/**
 * El lector de etiquetas (S13 · ADR-019): tesseract.js, su núcleo WASM (solo LSTM) y los idiomas
 * spa y eng, servidos desde la app (ninguna CDN) y pedidos solo tras el toque de «Descargar el
 * lector». NO se precachean: el SW los guarda en su caché propia al pedirlos la primera vez.
 */
export const OCR_FILES = {
  "tesseract.min.js": "tesseract.js/dist/tesseract.min.js",
  "worker.min.js": "tesseract.js/dist/worker.min.js",
  "core/tesseract-core-relaxedsimd-lstm.wasm.js":
    "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "core/tesseract-core-simd-lstm.wasm.js":
    "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "core/tesseract-core-lstm.wasm.js": "tesseract.js-core/tesseract-core-lstm.wasm.js",
  "lang/spa.traineddata.gz":
    "@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz",
  "lang/eng.traineddata.gz":
    "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
};

/** Resuelve un archivo del lector: tesseract.js-core es dependencia de tesseract.js, no nuestra. */
function ocrSource(rel) {
  if (rel.startsWith("tesseract.js-core/")) {
    const tj = realpathSync(join(root, "node_modules/tesseract.js"));
    const core = dirname(
      createRequire(join(tj, "package.json")).resolve(
        "tesseract.js-core/package.json",
      ),
    );
    return join(core, rel.slice("tesseract.js-core/".length));
  }
  return join(root, "node_modules", rel);
}

export function ocrVersions() {
  const tj = realpathSync(join(root, "node_modules/tesseract.js"));
  const version = (dir) =>
    JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
  const core = dirname(
    createRequire(join(tj, "package.json")).resolve("tesseract.js-core/package.json"),
  );
  return [
    version(tj),
    version(core),
    version(join(root, "node_modules/@tesseract.js-data/spa")),
    version(join(root, "node_modules/@tesseract.js-data/eng")),
  ].join("+");
}

/** Nombre de la caché de `/ocr/`: cambia solo si cambia una versión del lector o de sus idiomas. */
export function ocrCacheName(versions = ocrVersions()) {
  const h = createHash("sha256").update(versions).digest("hex");
  return `nutrikids-ocr-${h.slice(0, 12)}`;
}

export function copyOcr() {
  const to = join(root, "public/ocr");
  for (const [name, rel] of Object.entries(OCR_FILES)) {
    mkdirSync(dirname(join(to, name)), { recursive: true });
    copyFileSync(ocrSource(rel), join(to, name));
  }
}

export function buildId() {
  let sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  if (!sha) {
    try {
      sha = execSync("git rev-parse --short HEAD", {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      sha = "nogit";
    }
  }
  return `${sha}-${Date.now().toString(36)}`;
}

/** El lado del trabajador de los avisos (S8 · ADR-012): se inserta tal cual. */
export function pushModule() {
  // En sw.js `NK_PUSH` sí se usa: la directiva para el archivo suelto sobra allí.
  return readFileSync(join(root, "scripts/sw-push.js"), "utf8")
    .replace(/^\/\/ eslint-disable-next-line .*\n/m, "")
    .trim();
}

export function renderSw(
  template,
  id,
  routes = SHELL_ROUTES,
  pdfVersion = pdfJsVersion(),
  push = pushModule(),
  iaCache = iaCacheName(
    renderWorker(
      readFileSync(join(root, "scripts/vision-worker.template.js"), "utf8"),
    ),
  ),
  ocrCache = ocrCacheName(),
) {
  return template
    .replace("__IA_CACHE__", iaCache)
    .replace("__OCR_CACHE__", ocrCache)
    .replace("/* __PUSH_MODULE__ */", () => push)
    .replace("__DETAIL_SHELL__", JSON.stringify(DETAIL_SHELL))
    .replace("__BUILD_ID__", id)
    .replace("__EXTRA_ASSETS__", JSON.stringify(PDFJS_ASSETS))
    .replace("__PDFJS_VERSION__", pdfVersion)
    .replace("__SHELL_ROUTES__", JSON.stringify(routes));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const template = readFileSync(join(root, "scripts/sw.template.js"), "utf8");
  const id = buildId();
  const worker = renderWorker(
    readFileSync(join(root, "scripts/vision-worker.template.js"), "utf8"),
  );
  writeFileSync(join(root, "public/sw.js"), renderSw(template, id));
  copyPdfJs();
  copyIa(worker);
  copyOcr();
  console.log(`sw.js ← ${id} (${SHELL_ROUTES.length} pantallas)`);
}
