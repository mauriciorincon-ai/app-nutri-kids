import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Happy path del sprint (acceptance criteria):
 * cargar demo → validar semáforo (¿la manzana se puede?) → Hoy → marcar → amanece vacío.
 * Fechas SIEMPRE controladas con el clock de Playwright (la demo restringe
 * 2026-07-01→2026-09-28 y el lunes toca "Multivitamínico demo").
 */

const MONDAY = new Date("2026-07-06T10:00:00");

async function openApp(page: Page, path = "/", time: Date = MONDAY) {
  await page.clock.install({ time });
  // Saltar el diálogo de primer uso (se prueba aparte)
  await page.addInitScript(() => {
    // Merge: NO pisar el idioma que el propio test haya cambiado (sobrevive reloads)
    const prev = JSON.parse(
      window.localStorage.getItem("nutrikids.prefs.v1") ?? "{}",
    ) as Record<string, unknown>;
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "es", ...prev, disclaimerSeen: true }),
    );
  });
  await page.goto(path);
}

test("primer uso presenta el disclaimer no-médico una sola vez", async ({
  page,
}) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Antes de empezar");
  await dialog.getByRole("button", { name: "Entendido, empezar" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("la app entera funciona con la demo: semáforo → detalle → Hoy → checklist → día nuevo", async ({
  page,
}) => {
  await openApp(page);

  // Hoy con banner demo y resumen vacío
  await expect(
    page.getByRole("heading", { name: "Hoy", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Dieta demo")).toBeVisible();
  await expect(
    page.getByText("Así se ve el día de hoy", { exact: false }),
  ).toBeVisible();

  // ¿La manzana se puede? → rojo, hasta {fecha}, reemplazos (<10s de camino)
  await page.getByRole("link", { name: "Dieta" }).click();
  await page.getByRole("searchbox").fill("manzana");
  const result = page.getByRole("link", { name: /manzana/i });
  await expect(result).toContainText("Evitar");
  await result.click();
  await expect(page.getByRole("heading", { name: "Manzana" })).toBeVisible();
  await expect(page.getByText(/hasta el/)).toBeVisible();
  await expect(page.getByText("pera")).toBeVisible(); // equivalencia

  // Hoy: marcar el suplemento del lunes y un vaso de agua
  // (el suplemento aparece también en el recordatorio "Ahora mismo" desde el S3,
  // por eso apuntamos al CHECKBOX del checklist, cuyo nombre accesible es único).
  await page.getByRole("link", { name: "Hoy" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Multivitamínico demo/ }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Multivitamínico demo/ }).click();
  await expect(page.getByText("Ya hiciste 1 de 10")).toBeVisible();
  await page.getByRole("checkbox", { name: /Vaso 1/ }).click();
  await expect(page.getByText("Ya hiciste 2 de 10")).toBeVisible();
  await expect(page.getByText(/Te falta:/)).toBeVisible();

  // El checklist amanece vacío al día siguiente (martes: toca Omega demo)
  await page.clock.setFixedTime(new Date("2026-07-07T07:30:00"));
  await page.reload();
  await expect(
    page.getByText("Así se ve el día de hoy", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Omega demo/ }),
  ).toBeVisible();
});

test("los suplementos de la semana muestran el día de hoy y comparten el day-log", async ({
  page,
}) => {
  await openApp(page, "/suplementos");
  await expect(
    page.getByRole("heading", { name: "Suplementos de la semana" }),
  ).toBeVisible();
  const monday = page.locator("li", { hasText: "Lunes" }).first();
  await expect(monday).toContainText("hoy");
  await monday.getByRole("checkbox").click();
  await expect(monday.getByText("Ya lo tomó")).toBeVisible();

  // La marca se refleja en Hoy (mismo day-log)
  await page.getByRole("link", { name: "Hoy" }).click();
  await expect(page.getByText("Ya hiciste 1 de 10")).toBeVisible();
});

test("un archivo inválido produce un error legible con qué hacer", async ({
  page,
}) => {
  await openApp(page, "/cargar");
  await page
    .getByRole("textbox", { name: /Pega aquí/ })
    .fill("esto no es una dieta");
  await page.getByRole("button", { name: "Cargar lo pegado" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "archivo" }),
  ).toContainText("no se pudo leer");
});

test("importar una dieta válida termina en resumen; borrar datos vuelve a demo", async ({
  page,
}) => {
  await openApp(page, "/cargar");

  // La "dieta real" del test es la demo con otro id — jamás la dieta del niño.
  const diet = JSON.parse(readFileSync("data/demo-diet.json", "utf-8"));
  diet.meta.id = "familia-e2e-v1";
  await page
    .getByRole("textbox", { name: /Pega aquí/ })
    .fill(JSON.stringify(diet));
  await page.getByRole("button", { name: "Cargar lo pegado" }).click();

  await expect(page.getByText("¡Dieta cargada!")).toBeVisible();
  await expect(
    page.getByText("4 grupos de alimentos permitidos"),
  ).toBeVisible();
  await expect(page.getByText("Tu dieta", { exact: true })).toBeVisible(); // banner cambió

  // Borrar datos con confirmación → vuelve a demo
  await page.getByRole("link", { name: "Ajustes" }).click();
  await page.getByRole("button", { name: "Borrar mis datos" }).click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(
    page.getByText("Datos borrados", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Dieta demo", { exact: true })).toBeVisible();
});

test("el toggle ES/EN cambia toda la UI y el contenido bilingüe", async ({
  page,
}) => {
  await openApp(page, "/ajustes");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Today" })).toBeVisible();

  // Contenido de datos también bilingüe
  await page.getByRole("link", { name: "Diet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The diet" })).toBeVisible();

  // La preferencia sobrevive un reload
  await page.reload();
  await expect(page.getByRole("heading", { name: "The diet" })).toBeVisible();
});
