// @vitest-environment node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * GHSA-fc5q-39xc-vjpf (picomatch <= 4.0.7, ReDoS) no tiene versión arreglada publicada; el repo
 * la paga con `patches/picomatch@*.patch` (pnpm-workspace.yaml · patchedDependencies). Esta prueba
 * sigue la cadena REAL de dependencias de cada ruta (no la carpeta de pnpm, que guarda copias
 * viejas) y falla si alguna copia que de verdad se carga vuelve a tardar.
 */

const root = join(__dirname, "..", "..");

/** Carpeta `node_modules` que contiene a un paquete (pnpm deja sus dependencias como hermanas). */
function siblings(pkgDir: string): string {
  return pkgDir.slice(0, pkgDir.lastIndexOf("/node_modules/") + 14);
}

function follow(chain: string[]): string {
  let dir = realpathSync(join(root, "node_modules", chain[0]));
  for (const dep of chain.slice(1))
    dir = realpathSync(join(siblings(dir), dep));
  return dir;
}

const CHAINS = [
  ["@sentry/nextjs", "@rollup/plugin-commonjs", "picomatch"],
  [
    "@sentry/nextjs",
    "@rollup/plugin-commonjs",
    "@rollup/pluginutils",
    "picomatch",
  ],
  ["@sentry/nextjs", "@rollup/plugin-commonjs", "fdir", "picomatch"],
  ["shadcn", "@dotenvx/dotenvx", "picomatch"],
  ["shadcn", "fast-glob", "micromatch", "picomatch"],
  [
    "eslint-config-next",
    "@next/eslint-plugin-next",
    "fast-glob",
    "micromatch",
    "picomatch",
  ],
];

type Picomatch = { isMatch: (s: string, p: string) => boolean };

/** Patrones del aviso y sus parientes: antes, 40 caracteres tardaban minutos. */
const RISKY = [
  "+(*a)",
  "*(*a)",
  "+(*)",
  "*(*)",
  "+([a-z]*)",
  "+(a*|b)",
  "*(*a|b)",
];
const INPUTS = [
  "a".repeat(40) + "/",
  "ab".repeat(20) + "/",
  "a".repeat(40) + "b",
];

describe("picomatch parchado (GHSA-fc5q-39xc-vjpf)", () => {
  const copies = [...new Set(CHAINS.map(follow))];

  it("cada copia cargada es una copia parchada", () => {
    expect(copies.length).toBeGreaterThan(0);
    for (const dir of copies)
      expect(dir).toMatch(/picomatch@[\d.]+_patch_hash=/);
  });

  it.each(copies)("sin retroceso exponencial: %s", (dir) => {
    const pm = createRequire(join(dir, "package.json"))(dir) as Picomatch;
    for (const pattern of RISKY)
      for (const input of INPUTS) {
        const start = performance.now();
        pm.isMatch(input, pattern);
        expect(
          performance.now() - start,
          `${pattern} con ${input.length} caracteres`,
        ).toBeLessThan(100);
      }
  });

  it.each(copies)("los patrones de siempre siguen igual: %s", (dir) => {
    const pm = createRequire(join(dir, "package.json"))(dir) as Picomatch;
    expect(pm.isMatch("src/a/b.ts", "src/**/*.ts")).toBe(true);
    expect(pm.isMatch("a.ts", "*.js")).toBe(false);
    expect(pm.isMatch("abab", "*(a|b)")).toBe(true);
    expect(pm.isMatch("foo.js", "@(foo|bar).js")).toBe(true);
    // Una rama con «*»: se quita la repetición, el resultado no cambia.
    expect(pm.isMatch("xxa", "+(*a)")).toBe(true);
    expect(pm.isMatch("xxb", "+(*a)")).toBe(false);
    expect(pm.isMatch("abc", "+(*)c")).toBe(true);
    expect(pm.isMatch("my/folder (Work, Accts)", "*/*(W*, *)*")).toBe(true);
  });
});
