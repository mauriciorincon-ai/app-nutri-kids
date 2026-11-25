// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La cuenta de energía de Nubo (S14 · auditoría): va sobre un degradado que axe no sabe medir, así
 * que se mide aquí con los tokens reales de `globals.css`, en los dos temas (regla 5: AA, 4,5:1).
 */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const source = readFileSync(
  join(process.cwd(), "src/components/adventure/adventure.tsx"),
  "utf8",
);

function block(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
}

function token(scope: string, name: string): [number, number, number] {
  const m = new RegExp(
    `--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`,
  ).exec(scope);
  expect(m, name).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

/** OKLCH → sRGB lineal (Björn Ottosson), recortado al gamut. */
function linear([L, C, hue]: [number, number, number]): number[] {
  const h = (hue * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => Math.min(1, Math.max(0, x)));
}

function contrast(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const [hi, lo] = [y(linear(fg)), y(linear(bg))].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

describe("la cuenta de energía de Nubo", () => {
  it("va en su pastilla de cielo oscuro, no sobre el degradado", () => {
    const nubo = /nubo:\s*\{[\s\S]*?energy:\s*"([^"]+)"/.exec(source);
    expect(nubo).not.toBeNull();
    expect(nubo![1]).toContain("bg-[var(--adv-sky)]");
    expect(nubo![1]).toContain("text-[var(--adv-star)]");
  });

  it.each([
    [":root", "claro"],
    [".dark", "oscuro"],
  ])("en %s (%s) la estrella sobre la pastilla pasa AA", (selector) => {
    const scope = block(selector);
    expect(
      contrast(token(scope, "adv-star"), token(scope, "adv-sky")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
