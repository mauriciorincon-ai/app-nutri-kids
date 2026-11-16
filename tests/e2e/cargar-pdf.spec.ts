import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * S6 «Tu PDF, vuelto app»: PDF → revisar → guardar, sin red (ADR-010).
 * El PDF es el INVENTADO de tests/fixtures (jamás uno real). Se lee en el aparato:
 * ninguna petición lleva el archivo ni sale de la propia app.
 */
const PDF = resolve("tests/fixtures/plan-ejemplo.pdf");
const DEMO = readFileSync(resolve("data/demo-diet.json"), "utf8");
const NOTES_KEY = "nutrikids.profile-notes.v1";
const DRAFT_KEY = "nutrikids.plan-draft.v1";

async function open(page: Page, locale: "es" | "en" = "es") {
  await page.addInitScript((loc) => {
    if (window.localStorage.getItem("nutrikids.prefs.v1")) return;
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: loc, disclaimerSeen: true }),
    );
  }, locale);
  await page.goto("/cargar");
  await page.waitForLoadState("networkidle");
}

async function pickPdf(page: Page) {
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles(PDF);
  await expect(page.getByTestId("review-list")).toBeVisible({
    timeout: 60_000,
  });
}

const SECTION = (page: Page, key: string) =>
  page.locator(`[data-section="${key}"]`);

/** Abre una parte y la marca: «Está bien» si hay datos; si no, «Mi plan no lo trae». */
async function reviewSection(page: Page, key: string) {
  await SECTION(page, key).click();
  await expect(page.getByTestId("review-section")).toBeVisible();
  const ok = page.getByRole("button", { name: "Está bien" });
  if (await ok.isEnabled()) await ok.click();
  else await page.getByRole("button", { name: "Mi plan no lo trae" }).click();
  await expect(page.getByTestId("review-list")).toBeVisible();
}

const KEYS = [
  "validity",
  "restricted",
  "red",
  "additives",
  "alsoAvoid",
  "green",
  "yellow",
  "equivalences",
  "supplements",
  "menu",
  "hydration",
  "goals",
];

async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("PDF → revisar todas las partes → guardar → Hoy y Dieta muestran el plan, sin red hacia fuera", async ({
  page,
}) => {
  const requests: { url: string; method: string; body: boolean }[] = [];
  page.on("request", (r) =>
    requests.push({
      url: r.url(),
      method: r.method(),
      body: (r.postDataBuffer()?.length ?? 0) > 0,
    }),
  );
  await open(page);
  await pickPdf(page);

  // Una parte corregida: se añade un alimento rojo a mano (el rojo fijo no sale del PDF).
  await SECTION(page, "red").click();
  await page.getByRole("button", { name: "Añadir" }).click();
  await page.getByLabel("Nombre").fill("Alimento inventado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("button", { name: "Volver a la lista" }).click();
  await expect(SECTION(page, "red")).toContainText("Corregida");

  for (const k of KEYS.filter((k) => k !== "red")) await reviewSection(page, k);
  await expect(page.getByTestId("progress")).toContainText("12 de 12");
  await page.getByRole("button", { name: "Guardar mi plan" }).click();
  await expect(page.getByTestId("active-source")).toHaveText("tu dieta");

  await page.goto("/");
  await expect(page.locator("main")).not.toBeEmpty();
  await page.goto("/dieta");
  await expect(
    page.getByRole("link", { name: /Ver detalle de/ }).first(),
  ).toBeVisible();
  // El rojo añadido a mano quedó en el plan guardado.
  const saved = await page.evaluate(() =>
    localStorage.getItem("nutrikids.diet.v1"),
  );
  expect(saved).toContain("Alimento inventado");

  const base = new URL(page.url()).origin;
  // Ninguna petición sale de la propia app, ninguna escribe, ninguna lleva el archivo.
  expect(requests.filter((r) => !r.url.startsWith(base))).toEqual([]);
  expect(requests.filter((r) => r.method !== "GET" && r.body)).toEqual([]);
  expect(requests.some((r) => /\.pdf(\?|$)/i.test(r.url))).toBe(false);

  // El PDF no se guardó: ni el borrador queda, ni hay rastro del archivo.
  const dump = await page.evaluate((k) => {
    const all: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      all.push(`${key}=${localStorage.getItem(key)}`);
    }
    return { all: all.join("\n"), draft: localStorage.getItem(k) };
  }, DRAFT_KEY);
  expect(dump.draft).toBeNull();
  expect(dump.all).not.toContain("%PDF");
});

test("leer el PDF no necesita red: con la app ya abierta, el navegador sin conexión sigue leyendo", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.CI,
    "el service worker solo existe en producción: corre con CI=1",
  );
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await pickPdf(page);
  await expect(page.getByTestId("progress")).toContainText("0 de 12");
  await context.setOffline(false);
});

test("una revisión a medias se retoma", async ({ page }) => {
  await open(page);
  await pickPdf(page);
  await reviewSection(page, "validity");
  await expect(page.getByTestId("progress")).toContainText("1 de 12");
  await page.reload();
  await expect(page.getByTestId("resume-review")).toBeVisible();
  await axeClean(page);
  await page.getByRole("button", { name: "Seguir revisando" }).click();
  await expect(page.getByTestId("progress")).toContainText("1 de 12");
  await page.getByRole("button", { name: "Descartar esta revisión" }).click();
  await page.reload();
  await expect(page.getByTestId("resume-review")).toHaveCount(0);
});

test("cargar JSON sigue funcionando y las notas de quien cuida sobreviven al plan del PDF", async ({
  page,
}) => {
  const note = {
    acceptedTextures: [],
    notes: [
      { id: "n1", kind: "other", text: "Nota inventada", at: "2026-11-01" },
    ],
  };
  await page.addInitScript(
    ([k, v]) => {
      if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, v);
    },
    [NOTES_KEY, JSON.stringify(note)] as const,
  );
  await open(page);
  // JSON: pegar la demo inventada.
  await page.getByRole("textbox").first().fill(DEMO);
  await page
    .getByRole("button", { name: /Cargar|Usar/ })
    .first()
    .click();
  await expect(page.getByTestId("active-source")).toBeVisible();
  // PDF encima: las notas siguen.
  await page.goto("/cargar");
  await pickPdf(page);
  for (const k of KEYS) await reviewSection(page, k);
  await page.getByRole("button", { name: "Guardar mi plan" }).click();
  await expect(page.getByTestId("active-source")).toHaveText("tu dieta");
  const stored = await page.evaluate((k) => localStorage.getItem(k), NOTES_KEY);
  expect(stored).toContain("Nota inventada");
});

test("el archivo que no es PDF se dice en llano", async ({ page }) => {
  await open(page);
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
    name: "no.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("esto no es un pdf"),
  });
  await expect(page.locator("p[role=alert]")).toContainText("no es un PDF");
});

test("la revisión en inglés usa los textos en inglés", async ({ page }) => {
  await open(page, "en");
  await pickPdf(page);
  await expect(page.getByTestId("review-list")).toContainText(
    "Review your plan",
  );
  await expect(page.getByTestId("progress")).toContainText("of 12");
});

for (const colorScheme of ["light", "dark"] as const) {
  // El sistema de diseño es solo claro (no hay tema oscuro real): «dark» es la guarda por
  // preferencia del sistema, como en perfil.spec y chat.spec.
  test(`axe limpio en cada estado de la revisión · tema ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);

    // Error: archivo que no es PDF.
    await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
      name: "no.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("no"),
    });
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await axeClean(page);

    await pickPdf(page);
    // Lista, con el guardado bloqueado.
    await expect(page.locator("#rv-save-why")).toBeVisible();
    await axeClean(page);

    // Parte abierta.
    await SECTION(page, "green").click();
    await expect(page.getByTestId("review-section")).toBeVisible();
    await axeClean(page);

    // Parte con «mi plan no lo trae» desactivado (requerida) y formulario con error.
    await page.getByRole("button", { name: "Añadir" }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await axeClean(page);
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Volver a la lista" }).click();

    // Parte corregida (rojo) y parte «mi plan no lo trae» (si el PDF no la trae).
    await SECTION(page, "red").click();
    await page.getByRole("button", { name: "Añadir" }).click();
    await page.getByLabel("Nombre").fill("Alimento inventado");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.getByRole("button", { name: "Volver a la lista" }).click();
    await expect(SECTION(page, "red")).toContainText("Corregida");
    await reviewSection(page, "validity");
    for (const k of KEYS.filter((k) => !["red", "validity"].includes(k)))
      await reviewSection(page, k);
    await axeClean(page);

    // Todo revisado: el guardado se habilita.
    await expect(
      page.getByRole("button", { name: "Guardar mi plan" }),
    ).toBeEnabled();
  });
}
