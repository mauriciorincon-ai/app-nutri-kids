import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Gate A11y automático: axe limpio en cada ruta nueva (estándar 6)
 * + navegación por teclado del flujo core.
 */

const MONDAY = new Date("2026-07-06T10:00:00");

async function openApp(page: Page, path: string) {
  await page.clock.install({ time: MONDAY });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "es", disclaimerSeen: true }),
    );
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const ROUTES = [
  "/",
  "/dieta",
  "/dieta/manzana",
  "/suplementos",
  "/cargar",
  "/ajustes",
];

for (const route of ROUTES) {
  test(`axe limpio en ${route}`, async ({ page }) => {
    await openApp(page, route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("axe limpio con el diálogo de primer uso abierto", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("el checklist de Hoy se opera con teclado", async ({ page }) => {
  await openApp(page, "/");
  const firstCheckbox = page.getByRole("checkbox").first();
  await firstCheckbox.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Ya hiciste 1 de 10")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByText("Así se ve el día de hoy", { exact: false }),
  ).toBeVisible();
});
