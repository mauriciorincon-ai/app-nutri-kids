import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * El brochure tiene DOS vidas y UNA sola fuente de verdad:
 *   · `docs/BROCHURE.html` — el canónico (abre con doble clic, sin internet).
 *   · `public/conoce.html` — la copia que sirve la ruta pública /conoce.
 *
 * Este script copia la primera sobre la segunda antes de cada build (`prebuild`).
 * Un test unitario afirma que son byte-idénticas: si alguien edita solo una, la CI
 * se pone roja en vez de publicar dos versiones distintas de la misma pieza.
 */

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origen = resolve(raiz, "docs/BROCHURE.html");
const destino = resolve(raiz, "public/conoce.html");

const bytes = readFileSync(origen);
mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origen, destino);

console.log(
  `[sync-brochure] docs/BROCHURE.html → public/conoce.html (${bytes.length} bytes)`,
);
