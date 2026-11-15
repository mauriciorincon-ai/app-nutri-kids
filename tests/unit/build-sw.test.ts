// @vitest-environment node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DETAIL_SHELL,
  SHELL_ROUTES,
  renderSw,
} from "../../scripts/build-sw.mjs";

const root = join(__dirname, "../..");
const template = readFileSync(join(root, "scripts/sw.template.js"), "utf8");

/** Rutas estáticas reales: cada carpeta de src/app con page.tsx (sin las dinámicas). */
function appRoutes(): string[] {
  const dir = join(root, "src/app");
  const routes = ["/"];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && existsSync(join(dir, e.name, "page.tsx")))
      routes.push(`/${e.name}`);
  }
  return routes;
}

describe("contrato service worker ↔ app (regla 19)", () => {
  it("precachea el cascarón de TODAS las pantallas (y /conoce, que es un rewrite)", () => {
    expect([...SHELL_ROUTES].sort()).toEqual(
      [...appRoutes(), "/conoce"].sort(),
    );
  });

  it("el detalle de alimento tiene su cascarón y el SW lo precachea y lo usa de respaldo", () => {
    expect(existsSync(join(root, "src/app/dieta/[id]/page.tsx"))).toBe(true);
    expect(DETAIL_SHELL).toBe("/dieta/_");
    const out = renderSw(template, "x");
    expect(out).toContain(
      `const DETAIL_SHELL = ${JSON.stringify(DETAIL_SHELL)}`,
    );
    expect(out).toContain("[...SHELL_ROUTES, DETAIL_SHELL]");
    expect(out).not.toContain("__DETAIL_SHELL__");
  });

  it("estampa versión y pantallas, sin dejar marcadores", () => {
    const out = renderSw(template, "abc1234-xyz");
    expect(out).toContain('const VERSION = "abc1234-xyz"');
    expect(out).toContain(JSON.stringify(SHELL_ROUTES));
    expect(out).not.toContain("__BUILD_ID__");
    expect(out).not.toContain("__SHELL_ROUTES__");
  });

  it("dos builds distintos dan SW distintos (si no, el navegador no avisa)", () => {
    expect(renderSw(template, "a-1")).not.toBe(renderSw(template, "a-2"));
  });

  it("la versión nueva espera: ni skipWaiting al instalar ni recarga forzada", () => {
    const code = template
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const install = code.slice(
      code.indexOf('addEventListener("install"'),
      code.indexOf('addEventListener("activate"'),
    );
    expect(install).not.toContain("skipWaiting");
    expect(code).not.toMatch(/\.reload\(/);
  });

  it("el mensaje de aceptar es el mismo en el SW y en la página", () => {
    const page = readFileSync(
      join(root, "src/components/app-shell/sw-register.tsx"),
      "utf8",
    );
    const m = /SKIP_WAITING_MESSAGE = "([A-Z_]+)"/.exec(page);
    expect(m?.[1]).toBe("SKIP_WAITING");
    expect(template).toContain(`type === "${m?.[1]}"`);
  });
});
