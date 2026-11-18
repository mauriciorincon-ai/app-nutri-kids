import { expect, test, type Page } from "@playwright/test";

import { assertRealTheme } from "./theme";

/**
 * El tema oscuro de verdad (S11, ADR-016): se elige en Ajustes, se recuerda, sigue al teléfono en
 * «Sistema», no parpadea al abrir y no se pierde al cambiar el idioma. Reloj fijo (regla 23).
 */

const MONDAY = new Date("2026-07-06T10:00:00");
const PREFS = "nutrikids.prefs.v1";

async function open(page: Page, path: string, prefs: object = {}) {
  await page.clock.install({ time: MONDAY });
  await page.addInitScript(
    ([key, extra]) => {
      // Solo la primera carga: las recargas del test deben ver lo que la app guardó.
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(
          key,
          JSON.stringify({ locale: "es", disclaimerSeen: true, ...extra }),
        );
      }
    },
    [PREFS, prefs] as const,
  );
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const bar = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((m) =>
      m.getAttribute("content"),
    ),
  );

test("«Sistema» sigue al teléfono, también cuando cambia con la app abierta", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "/");
  await assertRealTheme(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await assertRealTheme(page, "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await assertRealTheme(page, "light");
});

test("Oscuro elegido en Ajustes manda sobre el teléfono, se recuerda y sobrevive al idioma", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "/ajustes");
  await expect(page.getByTestId("theme-system")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("theme-dark").click();
  await expect(page.getByTestId("theme-dark")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await assertRealTheme(page, "dark");
  expect(new Set(await bar(page)).size).toBe(1); // la barra deja de depender del teléfono

  await page.reload();
  await assertRealTheme(page, "dark"); // se recuerda tras recargar

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await assertRealTheme(page, "dark"); // cambiar de idioma no lo pierde
  await page.reload();
  await expect(page.getByTestId("theme-dark")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await assertRealTheme(page, "dark");

  await page.getByTestId("theme-light").click();
  await assertRealTheme(page, "light");
});

test("Claro elegido gana a un teléfono oscuro, y un valor ajeno cae en «Sistema»", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, "/", { theme: "light" });
  await assertRealTheme(page, "light");
  await page.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ locale: "es", disclaimerSeen: true, theme: "azul" }),
      ),
    PREFS,
  );
  await page.reload();
  await assertRealTheme(page, "dark");
});

test("sin destello: la clase ya está puesta cuando el documento termina de leerse", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as Record<string, unknown>).__darkAtDCL =
        document.documentElement.classList.contains("dark");
    });
  });
  await open(page, "/", { theme: "dark" });
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__darkAtDCL,
    ),
  ).toBe(true);
});

test("la guarda del tema delata un tema que no es el pedido (que «dark» no sea el claro otra vez)", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, "/", { theme: "light" }); // el ajuste manda: la página es clara
  await expect(assertRealTheme(page, "dark", 1000)).rejects.toThrow();
});

test("la barra del navegador lleva un color por esquema en «Sistema»", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "/");
  const colors = await bar(page);
  expect(new Set(colors).size).toBe(2);
});
