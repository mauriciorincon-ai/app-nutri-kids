import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos de cobertura (vitest --coverage)
    "coverage/**",
    // pdf.js y su worker: copia minificada de node_modules que genera el build (S6, ADR-010)
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
