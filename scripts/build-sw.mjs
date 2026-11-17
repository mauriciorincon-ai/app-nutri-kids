#!/usr/bin/env node
/**
 * Estampa `public/sw.js` desde `scripts/sw.template.js` (ADR-003).
 * Corre en `prebuild` y `dev`: cada build lleva un id de versión nuevo, así el
 * navegador detecta el SW distinto y la app avisa «hay versión nueva».
 * Contrato (regla 19): la lista de pantallas sale de aquí y un test la compara
 * con las rutas reales de `src/app`.
 */
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
) {
  return template
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
  writeFileSync(join(root, "public/sw.js"), renderSw(template, id));
  copyPdfJs();
  console.log(`sw.js ← ${id} (${SHELL_ROUTES.length} pantallas)`);
}
