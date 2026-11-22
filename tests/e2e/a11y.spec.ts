import { expect, test, type Page } from "@playwright/test";

import { analyze, summarize } from "./theme";

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
  "/chat",
  "/suplementos",
  "/cargar",
  "/ajustes",
  "/historial",
  "/perfil",
  "/escenarios",
  "/unir",
  "/bienestar",
  "/lonchera",
  "/recetas",
  "/viaje",
  "/camara",
  "/camara/cocina",
];

// Los dos temas REALES (S11, ADR-016): `analyze` falla si la página no está en el tema pedido.
for (const colorScheme of ["light", "dark"] as const) {
  for (const route of ROUTES) {
    test(`axe limpio en ${route} · tema ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openApp(page, route);
      const results = await analyze(page, colorScheme);
      expect(summarize(results.violations)).toEqual([]);
    });
  }
}

test("axe limpio en /historial CON días registrados (lista, <time>, notas)", async ({
  page,
}) => {
  // El escaneo por ruta cubre el estado VACÍO; aquí sembramos contenido real
  // (DayCard con hora, marca sin hora y nota con chips) para pasar axe sobre él.
  await page.clock.install({ time: MONDAY });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "es", disclaimerSeen: true }),
    );
    window.localStorage.setItem(
      "nutrikids.daylog.v2",
      JSON.stringify({
        "2026-07-06": {
          marks: {
            "meal:desayuno": { at: "07:15" },
            "water:1": { at: null },
          },
          notes: {
            "meal:desayuno": { chips: ["rejected"], text: "solo un poco" },
          },
        },
        "2026-07-05": { marks: { "meal:cena": { at: "18:40" } }, notes: {} },
      }),
    );
  });
  await page.goto("/historial");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/solo un poco/)).toBeVisible();
  const results = await analyze(page);
  expect(results.violations).toEqual([]);
});

test("axe limpio con el diálogo de primer uso abierto", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  const results = await analyze(page);
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
