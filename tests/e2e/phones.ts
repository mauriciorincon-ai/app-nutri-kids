import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { analyze, summarize } from "./theme";

/**
 * Ayudantes de las e2e de Coordinación (S9): dos teléfonos reales (dos contextos) contra el
 * doble del almacén de la familia (`FAMILY_STORE=memory`), jamás la base real. Nombres y
 * planes de prueba, todos inventados.
 */

export const MON_0730 = new Date("2026-07-06T07:30:00");
export const MAMA = "Mamá";
export const PAPA = "Papá";

export type Phone = {
  context: BrowserContext;
  page: Page;
  /** Lo que salió hacia /api/family: cuerpo + encabezados, para el centinela. */
  wire: string[];
  /** Sin internet hacia el servicio de la familia (el resto de la app sigue cargando). */
  net: { down: boolean };
};

let seq = 100;

/** Un teléfono: contexto propio, IP propia (el límite de creaciones es por IP) y red vigilada. */
export async function phone(
  browser: Browser,
  baseURL: string,
  locale: "es" | "en" = "es",
): Promise<Phone> {
  seq += 1;
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: "block",
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${seq % 250}.${octet()}.${octet()}`,
    },
  });
  const wire: string[] = [];
  const net = { down: false };
  await context.route("**/api/family/**", (route) => {
    // «Sin red»: la petición ni sale. (`setOffline` también tumbaría la carga de las
    // pantallas, que en desarrollo no tienen service worker.)
    if (net.down) return route.abort("internetdisconnected");
    const req = route.request();
    wire.push(
      `${req.url()}\n${JSON.stringify(req.headers())}\n${req.postData() ?? ""}`,
    );
    return route.continue();
  });
  const page = await context.newPage();
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript((loc) => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: loc, disclaimerSeen: true }),
    );
  }, locale);
  return { context, page, wire, net };
}

export async function axe(page: Page, scope = "axe") {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    // Un botón que acaba de habilitarse aún transita de color: axe mediría el tono a medias.
    await page.evaluate(async () => {
      // Dos cuadros primero: el cambio de tema arranca sus transiciones de color en el cuadro siguiente,
      // y `getAnimations` aún no las vería (S13: una pasada «light» midió el texto a medio camino).
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      // Una animación cancelada (el diálogo al cambiar a «menos movimiento») no es un error.
      await Promise.all(
        document.getAnimations().map((a) => a.finished.catch(() => null)),
      );
    });
    const found = summarize((await analyze(page, colorScheme)).violations);
    expect(found, `${scope} · ${colorScheme}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });
}

export async function createFamily(a: Phone, name = MAMA) {
  const { page } = a;
  await page.goto("/ajustes");
  const create = page.getByTestId("family-create");
  await expect(create).toBeEnabled();
  await create.click();
  await expect(page.getByTestId("family-create-form")).toBeVisible();
  await page.getByLabel(/Nombre de este teléfono/).fill(name);
  await page
    .getByRole("checkbox", { name: /Entiendo qué se comparte/ })
    .check();
  await page.getByRole("button", { name: "Crear la familia" }).click();
  await expect(page.getByTestId("family-secrets")).toBeVisible();
  const code = (await page.getByTestId("family-code").innerText()).trim();
  const phrase = (await page.getByTestId("family-phrase").innerText()).trim();
  return { code, phrase };
}

export async function finishSecrets(page: Page) {
  await page.getByRole("checkbox", { name: /Ya los anoté/ }).check();
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByTestId("family-panel")).toBeVisible();
}

export async function joinFamily(
  b: Phone,
  secrets: { code: string; phrase: string },
  name = PAPA,
) {
  const { page } = b;
  await page.goto("/ajustes");
  const join = page.getByTestId("family-join");
  await expect(join).toBeEnabled();
  await join.click();
  await expect(page.getByTestId("family-join-form")).toBeVisible();
  await page.getByLabel("Invitación", { exact: true }).fill(secrets.code);
  await page.getByLabel("Frase", { exact: true }).fill(secrets.phrase);
  await page.getByLabel(/Nombre de este teléfono/).fill(name);
  await page
    .getByRole("checkbox", { name: /Entiendo qué se comparte/ })
    .check();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByTestId("family-panel")).toBeVisible();
}

/** Recarga el teléfono hasta que lo que busca llegue (la subida y la bajada son asíncronas). */
export async function reloadUntil(page: Page, check: () => Promise<void>) {
  await expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 25_000, intervals: [500, 1000, 1500] });
}
