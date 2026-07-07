/**
 * Valida un JSON de dieta contra el schema v1 — dev-only, NO corre en CI.
 * Uso: pnpm tsx scripts/validate-diet.ts <ruta-al-json>
 *
 * Imprime SOLO metadatos (versión, conteos) — nunca contenido. Sirve para
 * verificar que la dieta real (runtime del usuario, fuera del repo) es aceptada.
 */
import { readFileSync } from "node:fs";

import { dietCounts, parseDietJson } from "../src/lib/diet/schema";

const path = process.argv[2];
if (!path) {
  console.error("Uso: pnpm tsx scripts/validate-diet.ts <ruta-al-json>");
  process.exit(2);
}

const result = parseDietJson(readFileSync(path, "utf-8"));
if (!result.ok) {
  console.error(`INVÁLIDA (${result.error}): ${result.detail}`);
  process.exit(1);
}

console.log("VÁLIDA ✓ — conteos:");
console.table(dietCounts(result.diet));
