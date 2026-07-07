import { describe, expect, it } from "vitest";

// Smoke: valida que el runner (jsdom + setup) está operativo. Se retira al llegar tests reales.
describe("test harness", () => {
  it("runs with jsdom and localStorage available", () => {
    window.localStorage.setItem("k", "v");
    expect(window.localStorage.getItem("k")).toBe("v");
  });
});
