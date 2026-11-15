import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Chat «pregúntale a la dieta» — código primero (ADR-008, regla dura 5).
 * Todo lo contesta el teléfono con la dieta demo: el lookup, las cuatro
 * preguntas abiertas, los rechazos y «el plan no lo dice». Cero peticiones.
 */

const MONDAY_1015 = new Date("2026-07-06T10:15:00"); // durante «Media mañana»

async function openChat(page: Page, locale: "es" | "en" = "es") {
  await page.clock.install({ time: MONDAY_1015 });
  await page.addInitScript((loc) => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: loc, disclaimerSeen: true, chatIntroSeen: true }),
    );
  }, locale);
  await page.goto("/chat");
  await page.waitForLoadState("networkidle");
}

/** Registra TODA petición desde ahora: el chat no debe hacer ninguna. */
function watchNetwork(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (req) => calls.push(`${req.method()} ${req.url()}`));
  return calls;
}

async function ask(page: Page, question: string) {
  await page.getByRole("textbox").fill(question);
  await page.getByRole("textbox").press("Enter");
}

test("lookup «¿la manzana se puede?» → veredicto del plan, sin red", async ({ page }) => {
  await openChat(page);
  const calls = watchNetwork(page);
  await ask(page, "¿la manzana se puede?");
  await expect(page.getByText("Evitar")).toBeVisible();
  await expect(page.getByText("pera", { exact: true })).toBeVisible();
  await expect(page.getByText("Desde tu plan · sin IA")).toBeVisible();
  expect(calls).toEqual([]);
});

test("las cuatro preguntas abiertas en ES contestan con el plan demo y cero red", async ({
  page,
}) => {
  await openChat(page);
  const calls = watchNetwork(page);

  // 1 · «no tengo X» → reemplazos del plan (pollo → otras proteínas del grupo)
  await ask(page, "No tengo pollo, ¿qué le doy?");
  const a1 = page.locator('[data-answer="replacement"]').last();
  await expect(a1).toContainText("Si no hay pollo");
  await expect(a1).toContainText("Huevos");
  await expect(a1).not.toContainText("Pollo");

  // 2 · «no quiso X» → otras opciones y lo que toca después, sin culpa
  await ask(page, "No quiso el brócoli");
  const a2 = page.locator('[data-answer="refused"]').last();
  await expect(a2).toContainText("no es una falla");
  await expect(a2).toContainText("Zanahoria");
  await expect(a2).toContainText("Lo que sigue");
  await expect(a2).toContainText("Almuerzo");

  // 3 · «¿qué le doy ahora?» → el menú de la franja (10:15 = Media mañana)
  await ask(page, "¿Qué le doy ahora?");
  const a3 = page.locator('[data-answer="meal"]').last();
  await expect(a3).toContainText("Ahora toca Media mañana");

  // 4 · «¿cuánta agua?» → hidratación del plan
  await ask(page, "¿Cuánta agua le doy?");
  const a4 = page.locator('[data-answer="hydration"]').last();
  await expect(a4).toContainText("entre 1,2 y 1,5 litros");

  expect(calls).toEqual([]);
});

test("lo que el plan no dice → «tu plan no lo dice», jamás inventado", async ({ page }) => {
  await openChat(page);
  await ask(page, "No tengo mandarina");
  await expect(page.locator('[data-answer="not-in-plan"]')).toContainText(
    "Tu plan no lo dice. Pregúntale a tu profesional.",
  );
});

test("consejo médico → redirección amable al profesional", async ({ page }) => {
  await openChat(page);
  await ask(page, "¿le subo la dosis de la B12?");
  await expect(page.getByText(/pediatra o nutricionista/i)).toBeVisible();
});

test("la conversación NO se persiste: al recargar, el hilo amanece vacío", async ({ page }) => {
  await openChat(page);
  await ask(page, "¿la manzana se puede?");
  await expect(page.getByText("Evitar")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "¿La manzana se puede?" })).toBeVisible();
  await expect(page.getByText("Evitar")).toBeHidden();
});

test("EN: open questions answer in English from the plan", async ({ page }) => {
  await openChat(page, "en");
  const calls = watchNetwork(page);
  await ask(page, "I don't have chicken, what can I give?");
  await expect(page.locator('[data-answer="replacement"]')).toContainText(
    "If there's no chicken",
  );
  await ask(page, "How much water should he drink?");
  await expect(page.locator('[data-answer="hydration"]')).toContainText("1.2 to 1.5 liters");
  expect(calls).toEqual([]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe limpio con respuestas en el hilo · tema ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await openChat(page);
    await ask(page, "¿la manzana se puede?");
    await ask(page, "No tengo pollo, ¿qué le doy?");
    await ask(page, "No quiso desayunar");
    await ask(page, "¿Cuánta agua le doy?");
    await ask(page, "No tengo mandarina");
    await ask(page, "¿le subo la dosis de la B12?");
    await expect(page.locator('[data-answer="not-in-plan"]')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
