/**
 * Genera los íconos PWA desde un SVG inline (dev-only, se corre a mano).
 * Uso: node scripts/generate-icons.mjs
 * Diseño: plato cálido con los tres puntos del semáforo — tokens de design-system.md.
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

// safe area maskable: contenido dentro del 80% central
const svg = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${padding ? 0 : 96}" fill="#c2571f"/>
  <circle cx="256" cy="256" r="${padding ? 150 : 176}" fill="#faf7f0"/>
  <circle cx="256" cy="256" r="${padding ? 108 : 128}" fill="none" stroke="#e7d9c6" stroke-width="10"/>
  <circle cx="${padding ? 196 : 186}" cy="256" r="30" fill="#2f7d4f"/>
  <circle cx="256" cy="256" r="30" fill="#b07818"/>
  <circle cx="${padding ? 316 : 326}" cy="256" r="30" fill="#b04a2e"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });

for (const [file, size, maskable] of [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/icon-maskable-192.png", 192, true],
  ["public/icons/icon-maskable-512.png", 512, true],
]) {
  await sharp(Buffer.from(svg(maskable))).resize(size, size).png().toFile(file);
  console.log("OK", file);
}
