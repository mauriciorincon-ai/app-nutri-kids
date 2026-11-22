import { describe, expect, it } from "vitest";

import nextConfig, { VISION_WORKER_CSP } from "../../next.config";

/**
 * La cabecera que acota la red del worker de la cámara (S12 · ADR-018): es la que el navegador aplica
 * AUNQUE falle la guardia del propio worker.
 */
describe("cabecera del worker de la cámara", () => {
  it("se aplica solo al worker y es la CSP declarada", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/ia/vision-worker.js");
    expect(rules[0].headers).toEqual([
      { key: "Content-Security-Policy", value: VISION_WORKER_CSP },
    ]);
  });

  it("connect-src permite solo la app, el Hub y su CDN: ningún comodín abierto ni otro tercero", () => {
    const [directive, ...rest] = VISION_WORKER_CSP.split(";");
    expect(rest).toEqual([]);
    const sources = directive.trim().split(/\s+/);
    expect(sources[0]).toBe("connect-src");
    expect(sources.slice(1).sort()).toEqual(
      [
        "'self'",
        "blob:",
        "data:",
        "https://*.hf.co",
        "https://*.huggingface.co",
        "https://huggingface.co",
      ].sort(),
    );
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    expect(VISION_WORKER_CSP).not.toMatch(/unsafe|http:/);
  });
});
