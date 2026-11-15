#!/usr/bin/env node
/**
 * Estampa `public/sw.js` desde `scripts/sw.template.js` (ADR-003).
 * Corre en `prebuild` y `dev`: cada build lleva un id de versión nuevo, así el
 * navegador detecta el SW distinto y la app avisa «hay versión nueva».
 * Contrato (regla 19): la lista de pantallas sale de aquí y un test la compara
 * con las rutas reales de `src/app`.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
  "/chat",
  "/historial",
  "/conoce",
];

/** Cascarón del detalle de alimento: sirve de respaldo a `/dieta/<id>` sin visita previa. */
export const DETAIL_SHELL = "/dieta/_";

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

export function renderSw(template, id, routes = SHELL_ROUTES) {
  return template
    .replace("__DETAIL_SHELL__", JSON.stringify(DETAIL_SHELL))
    .replace("__BUILD_ID__", id)
    .replace("__SHELL_ROUTES__", JSON.stringify(routes));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const template = readFileSync(join(root, "scripts/sw.template.js"), "utf8");
  const id = buildId();
  writeFileSync(join(root, "public/sw.js"), renderSw(template, id));
  console.log(`sw.js ← ${id} (${SHELL_ROUTES.length} pantallas)`);
}
