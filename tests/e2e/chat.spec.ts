import { expect, test, type Page } from "@playwright/test";

/**
 * Chat "habla con tu dieta" (acceptance criteria del S2).
 * Servidor con provider `mock` (playwright.config env) → determinístico, sin red.
 * Los dos caminos: lookup local (sin request a /api/chat) vs pregunta abierta
 * (streaming grounded del mock). Rechazos, kill-switch y no-persistencia.
 */

const MONDAY = new Date("2026-07-06T10:00:00");

async function openChat(page: Page, locale: "es" | "en" = "es") {
  await page.clock.install({ time: MONDAY });
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
  await page.goto("/chat");
}

test("lookup local '¿la manzana se puede?' → veredicto SIN llamar al LLM", async ({
  page,
}) => {
  const chatCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/chat")) chatCalls.push(req.url());
  });

  await openChat(page);
  await page.getByRole("textbox").fill("¿la manzana se puede?");
  await page.getByRole("textbox").press("Enter");

  // Tarjeta de veredicto: rojo + reemplazo + insignia "desde tu plan"
  await expect(page.getByText("Evitar")).toBeVisible();
  await expect(page.getByText("pera", { exact: true })).toBeVisible();
  await expect(page.getByText("Desde tu plan", { exact: false })).toBeVisible();

  // Innegociable: cero requests al LLM
  expect(chatCalls).toHaveLength(0);
});

test("sugerencia local abre veredicto sin red", async ({ page }) => {
  const chatCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/chat")) chatCalls.push(req.url());
  });
  await openChat(page);
  await page.getByRole("button", { name: "¿La manzana se puede?" }).click();
  await expect(page.getByText("Evitar")).toBeVisible();
  expect(chatCalls).toHaveLength(0);
});

test("pregunta abierta → respuesta grounded en streaming (mock) + insignia IA", async ({
  page,
}) => {
  let chatCalled = false;
  page.on("request", (req) => {
    if (req.url().includes("/api/chat")) chatCalled = true;
  });

  await openChat(page);
  await page.getByRole("textbox").fill("no tengo pollo, ¿qué le doy?");
  await page.getByRole("textbox").press("Enter");

  await expect(page.getByText(/opciones verdes/i)).toBeVisible();
  await expect(
    page.getByText("Respuesta de IA", { exact: false }),
  ).toBeVisible();
  expect(chatCalled).toBe(true);
});

test("consejo médico → redirección amable (sin insignia IA)", async ({
  page,
}) => {
  await openChat(page);
  await page.getByRole("textbox").fill("¿le subo la dosis de la B12?");
  await page.getByRole("textbox").press("Enter");

  await expect(page.getByText(/pediatra|nutricionista/i)).toBeVisible();
  await expect(
    page.getByText("Respuesta de IA", { exact: false }),
  ).toBeHidden();
});

test("kill-switch / proveedor caído → aviso honesto; el lookup local sigue", async ({
  page,
}) => {
  await openChat(page);
  // Simula el kill-switch del servidor
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 503, body: '{"error":"chat-disabled"}' }),
  );

  await page.getByRole("textbox").fill("no tengo pollo, ¿qué le doy?");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText(/en pausa/i)).toBeVisible();

  // El Camino A sigue respondiendo aunque la IA esté caída
  await page.getByRole("textbox").fill("¿la manzana se puede?");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText("Evitar")).toBeVisible();
});

test("la conversación NO se persiste: al recargar, el hilo amanece vacío", async ({
  page,
}) => {
  await openChat(page);
  await page.getByRole("textbox").fill("¿la manzana se puede?");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText("Evitar")).toBeVisible();

  await page.reload();
  // Vuelven las sugerencias (hilo vacío), sin rastro de la consulta anterior
  await expect(
    page.getByRole("button", { name: "¿La manzana se puede?" }),
  ).toBeVisible();
  await expect(page.getByText("Evitar")).toBeHidden();
});

test("EN: pregunta abierta responde en inglés (mock locale-aware)", async ({
  page,
}) => {
  await openChat(page, "en");
  await page.getByRole("textbox").fill("I have no chicken, what can I give?");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText(/green options/i)).toBeVisible();
});
