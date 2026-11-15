import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Perfil (S5, ADR-009): lo del profesional «según tu plan», lo de quien cuida
 * «anotado por ti», el orden por textura y el chat con sueño, actividad, alergias
 * y medicamentos. Todo con la dieta demo inventada; cero peticiones de red.
 */

const DEMO = readFileSync(resolve("data/demo-diet.json"), "utf8");
const MONDAY_1015 = new Date("2026-07-06T10:15:00");

async function open(page: Page, path: string, locale: "es" | "en" = "es") {
  await page.clock.install({ time: MONDAY_1015 });
  await page.addInitScript((loc) => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({
        locale: loc,
        disclaimerSeen: true,
        chatIntroSeen: true,
      }),
    );
  }, locale);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

function watchNetwork(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (req) => calls.push(`${req.method()} ${req.url()}`));
  return calls;
}

async function ask(page: Page, question: string) {
  await page.getByRole("textbox").fill(question);
  await page.getByRole("textbox").press("Enter");
}

async function acceptSoft(page: Page) {
  await page.goto("/perfil");
  const soft = page.getByRole("button", { name: /Blanda/ });
  await soft.click();
  await expect(soft).toHaveAttribute("aria-pressed", "true");
}

test("el perfil muestra el origen de cada dato y dice lo que el plan no dice", async ({
  page,
}) => {
  await open(page, "/perfil");
  await expect(page.locator("h1")).toHaveText("Perfil de tu peque");
  await expect(page.getByText("Objetivos del profesional")).toBeVisible();
  await expect(page.locator('[data-origin="plan"]').first()).toHaveText(
    "según tu plan",
  );
  await expect(page.locator('[data-origin="you"]').first()).toHaveText(
    "anotado por ti",
  );
  await expect(page.getByText("Dormir entre 10 y 11 horas")).toBeVisible();
  await expect(page.getByText("Mariscos", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicamento demo").first()).toBeVisible();
});

test("lo que anota quien cuida sobrevive a cargar un plan nuevo y no sale del teléfono", async ({
  page,
}) => {
  await open(page, "/perfil");
  const calls = watchNetwork(page);
  await page.getByLabel("Tipo de nota").selectOption("allergy");
  await page.getByLabel(/Tu nota/).fill("Kiwi (nota de prueba)");
  await page.getByRole("button", { name: "Agregar nota" }).click();
  const list = page.getByTestId("profile-notes");
  await expect(list).toContainText("Kiwi (nota de prueba)");
  await expect(page.getByRole("status")).toHaveText("Nota agregada.");

  // Cargar un plan (la demo con otro id): la nota se queda.
  await page.goto("/cargar");
  const diet = JSON.parse(DEMO);
  diet.meta.id = "familia-e2e-perfil";
  await page
    .getByRole("textbox", { name: /Pega aquí/ })
    .fill(JSON.stringify(diet));
  await page.getByRole("button", { name: "Cargar lo pegado" }).click();
  await expect(page.getByText("¡Dieta cargada!")).toBeVisible();
  await page.goto("/perfil");
  await expect(page.getByTestId("profile-notes")).toContainText(
    "Kiwi (nota de prueba)",
  );

  // Quitarla.
  await page.getByRole("button", { name: /Quitar la nota: Kiwi/ }).click();
  await expect(page.getByTestId("profile-notes")).toContainText(
    "Aún no anotaste nada.",
  );
  expect(calls.filter((c) => !c.startsWith("GET"))).toEqual([]);
  expect(calls.filter((c) => c.includes("Kiwi"))).toEqual([]);
});

test("un plan v1 guardado se lee migrado: sin perfil, dice «tu plan no lo dice»", async ({
  page,
}) => {
  const v1 = JSON.parse(DEMO);
  v1.schemaVersion = 1;
  delete v1.profile;
  delete v1.goals;
  // En v1 cada opción es solo el texto {es, en}, sin textura.
  for (const e of v1.equivalences)
    e.use = e.use.map((u: { name: unknown }) => u.name);
  await page.addInitScript((diet) => {
    window.localStorage.setItem("nutrikids.diet.v1", diet);
    window.localStorage.setItem("nutrikids.source.v1", "real");
  }, JSON.stringify(v1));
  await open(page, "/perfil");
  await expect(page.locator("h1")).toHaveText("Perfil de tu peque");
  await expect(page.getByText("Tu plan no lo dice.").first()).toBeVisible();
  // Lo demás del plan sigue ahí: nada se perdió al migrar.
  await expect(page.getByText("Grupos de alimentos")).toBeVisible();
  await page.goto("/dieta/manzana");
  await expect(page.locator("h1")).toBeVisible();
});

test("detalle: las opciones con textura aceptada van primero; las otras, marcadas y a la vista", async ({
  page,
}) => {
  await open(page, "/perfil");
  await acceptSoft(page);
  await page.goto("/dieta/manzana");
  const marked = page.locator('[data-not-accepted="true"]');
  await expect(marked.first()).toContainText("textura que hoy no acepta");
  // Blandas (kiwi, fresas) antes que las picadas (pera, uvas): ninguna desaparece.
  const items = page.locator("li", { hasText: /pera|kiwi|uvas|fresas/i });
  const texts = await items.allInnerTexts();
  const idx = (w: string) =>
    texts.findIndex((t) => t.toLowerCase().includes(w));
  expect(idx("kiwi")).toBeLessThan(idx("pera"));
  expect(idx("fresas")).toBeLessThan(idx("uvas"));
  expect(idx("pera")).toBeGreaterThan(-1);
  expect(idx("uvas")).toBeGreaterThan(-1);
});

test("veredicto y chat: mismo orden y la misma marca, sin red", async ({
  page,
}) => {
  await open(page, "/perfil");
  await acceptSoft(page);
  await page.goto("/chat");
  const calls = watchNetwork(page);
  await ask(page, "¿la manzana se puede?");
  await expect(
    page.getByText("textura que hoy no acepta").first(),
  ).toBeVisible();
  await ask(page, "No tengo manzana");
  await expect(
    page.locator('[data-answer="replacement"]').last(),
  ).toContainText("textura que hoy no acepta");
  expect(calls).toEqual([]);
});

test("el chat contesta sueño, actividad, alergia y medicamentos desde el plan, sin red", async ({
  page,
}) => {
  await open(page, "/chat");
  const calls = watchNetwork(page);

  await ask(page, "¿Cuántas horas debe dormir?");
  await expect(page.locator('[data-answer="sleep"]')).toContainText(
    "Dormir entre 10 y 11 horas",
  );
  await ask(page, "¿Qué actividad le toca?");
  await expect(page.locator('[data-answer="activity"]')).toContainText(
    "Juego activo",
  );
  await ask(page, "¿Es alérgico a los mariscos?");
  await expect(page.locator('[data-answer="allergy"]').last()).toContainText(
    "mariscos",
  );
  await ask(page, "¿Es alérgico al kiwi?");
  await expect(page.locator('[data-answer="allergy"]').last()).toContainText(
    "tu plan no lo dice",
  );
  await ask(page, "¿Qué medicamentos toma?");
  await expect(page.locator('[data-answer="medication"]')).toContainText(
    "Medicamento demo",
  );
  // Un cambio de dosis sigue yendo al profesional.
  await ask(page, "¿le subo la dosis del medicamento?");
  await expect(page.getByText(/pediatra o nutricionista/i)).toBeVisible();
  expect(calls).toEqual([]);
});

test("EN: profile and the new questions answer in English", async ({
  page,
}) => {
  await open(page, "/perfil", "en");
  await expect(page.locator("h1")).toHaveText("Your child's profile");
  await expect(page.locator('[data-origin="plan"]').first()).toHaveText(
    "from your plan",
  );
  await page.goto("/chat");
  await ask(page, "How long should he sleep?");
  await expect(page.locator('[data-answer="sleep"]')).toContainText("10 to 11");
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe limpio: perfil con notas y texturas, detalle y chat nuevo · tema ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await open(page, "/perfil");
    await acceptSoft(page);
    await page.getByLabel(/Tu nota/).fill("Nota de prueba");
    await page.getByRole("button", { name: "Agregar nota" }).click();
    await expect(page.getByTestId("profile-notes")).toContainText(
      "Nota de prueba",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goto("/dieta/manzana");
    await expect(
      page.locator('[data-not-accepted="true"]').first(),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goto("/chat");
    await ask(page, "¿la manzana se puede?");
    await ask(page, "No tengo manzana");
    await ask(page, "¿Cuántas horas debe dormir?");
    await ask(page, "¿Qué actividad le toca?");
    await ask(page, "¿Es alérgico a los mariscos?");
    await ask(page, "¿Es alérgico al kiwi?");
    await ask(page, "¿Qué medicamentos toma?");
    await expect(page.locator('[data-answer="medication"]')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
