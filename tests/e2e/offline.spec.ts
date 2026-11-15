import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * «La dieta responde sin internet» (S4): tras una visita con señal, TODAS las
 * pantallas abren sin red y el chat contesta. Y el aviso de versión nueva.
 *
 * El SW solo se registra en producción: estas pruebas corren en la CI (build + start)
 * o localmente con `CI=1`. Sin eso se SALTAN y se dice (un skip no es verde).
 */
test.skip(
  !process.env.CI,
  "el service worker solo existe en producción: corre con CI=1",
);

const SCREENS: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /./ },
  { path: "/dieta", heading: /./ },
  { path: "/suplementos", heading: /./ },
  { path: "/cargar", heading: /./ },
  { path: "/ajustes", heading: /./ },
  { path: "/chat", heading: /./ },
  { path: "/historial", heading: /./ },
];

async function firstVisit(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({
        locale: "es",
        disclaimerSeen: true,
        chatIntroSeen: true,
      }),
    );
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // El SW termina de precachear y toma el control (clients.claim).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  // El precache es parte de la instalación: ya está completo al estar activo.
}

test("sin internet: cada pantalla abre y se hidrata; el chat contesta", async ({
  page,
  context,
}) => {
  await firstVisit(page);
  await context.setOffline(true);

  for (const { path } of SCREENS) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    // Hidratada de verdad: la navegación inferior (cliente) marca la página activa.
    await expect(page.getByRole("navigation").first()).toBeVisible();
  }

  // El chat sin red contesta con el plan.
  await page.goto("/chat");
  const input = page.getByRole("textbox");
  await input.fill("No tengo pollo, ¿qué le doy?");
  await input.press("Enter");
  await expect(page.locator('[data-answer="replacement"]')).toContainText(
    "Si no hay pollo",
  );

  // Un alimento no visitado (/dieta/<id>) sin red redirige a la lista, no al dinosaurio.
  await page.goto("/dieta/algo-que-no-visite");
  await expect(page).toHaveURL(/\/dieta$/);
  await expect(page.locator("h1")).toBeVisible();
});

/**
 * Simula un deploy nuevo: registra el mismo SW con otra URL de script, que para el
 * navegador es una versión distinta del mismo scope (se instala y queda en espera).
 */
async function publishNewVersion(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?v=nueva-e2e");
  });
}

test("versión nueva: avisa, no recarga a la fuerza y actualiza solo si se acepta", async ({
  page,
}) => {
  await firstVisit(page);
  const notice = page.getByTestId("sw-update-notice");
  await expect(notice).toHaveCount(0);

  // Marca de la página viva: si algo la recargara, la marca se perdería.
  await page.evaluate(() => {
    (window as unknown as { __viva: boolean }).__viva = true;
  });
  await publishNewVersion(page);

  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Hay una versión nueva");
  // Sigue en la misma página, sin recargar, aunque el SW nuevo ya esté esperando.
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => (window as unknown as { __viva?: boolean }).__viva),
  ).toBe(true);

  // «Ahora no» lo cierra sin tocar nada.
  await notice.getByRole("button", { name: "Ahora no" }).click();
  await expect(notice).toHaveCount(0);
});

test("versión nueva: «Actualizar» activa la versión y recarga una vez", async ({
  page,
}) => {
  await firstVisit(page);
  await publishNewVersion(page);
  const notice = page.getByTestId("sw-update-notice");
  await expect(notice).toBeVisible();
  const reload = page.waitForEvent("load");
  await notice.getByRole("button", { name: "Actualizar" }).click();
  await reload;
  await expect(page.getByTestId("sw-update-notice")).toHaveCount(0);
});

test("versión nueva en inglés", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "en", disclaimerSeen: true, chatIntroSeen: true }),
    );
  });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await publishNewVersion(page);
  const notice = page.getByTestId("sw-update-notice");
  await expect(notice).toContainText("There is a new version of Nutrikids");
  await expect(notice.getByRole("button", { name: "Update" })).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe limpio con el aviso de versión visible · tema ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await firstVisit(page);
    await publishNewVersion(page);
    await expect(page.getByTestId("sw-update-notice")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
