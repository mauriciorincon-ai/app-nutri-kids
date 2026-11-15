import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

/**
 * /cargar muestra CUÁL dieta está activa (no solo «Dieta activa:» a secas).
 * La «dieta guardada» de la prueba es la demo inventada: jamás datos reales.
 */
const DEMO = readFileSync(resolve("data/demo-diet.json"), "utf8");

for (const [locale, demo, real] of [
  ["es", "la demo", "tu dieta"],
  ["en", "the demo", "your diet"],
] as const) {
  test(`«Dieta activa» dice cuál está activa · ${locale}`, async ({ page }) => {
    await page.addInitScript(
      ([loc, diet]) => {
        window.localStorage.setItem(
          "nutrikids.prefs.v1",
          JSON.stringify({ locale: loc, disclaimerSeen: true }),
        );
        window.localStorage.setItem("nutrikids.diet.v1", diet);
        window.localStorage.setItem("nutrikids.source.v1", "demo");
      },
      [locale, DEMO] as const,
    );
    await page.goto("/cargar");
    const value = page.getByTestId("active-source");
    await expect(value).toHaveText(demo);
    await page
      .getByRole("button", {
        name: locale === "es" ? "Usar tu dieta" : "Use your diet",
      })
      .click();
    await expect(value).toHaveText(real);
  });
}
