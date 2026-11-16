import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * Compartir con la familia (S7 · ADR-011), con DOS teléfonos reales (dos contextos) contra
 * el doble del almacén (`FAMILY_STORE=memory` en el webServer): jamás la base real.
 *
 * La garantía dura: sobre CADA petición a la ruta de la familia (cuerpo y encabezados) corre
 * un centinela — ni el nombre del teléfono, ni la frase, ni el texto de una nota, ni el
 * nombre de un alimento viajan en claro. Fechas con el clock de Playwright.
 */

const MON_0730 = new Date("2026-07-06T07:30:00");
const NOTE = "Sentinela quinoa 7391";
const MAMA = "Mamá";
const PAPA = "Papá";

type Phone = {
  context: BrowserContext;
  page: Page;
  /** Lo que salió hacia /api/family: cuerpo + encabezados, para el centinela. */
  wire: string[];
  /** Sin internet hacia el servicio de la familia (el resto de la app sigue cargando). */
  net: { down: boolean };
};

let seq = 0;

/** Un teléfono: contexto propio, IP propia (el límite de creaciones es por IP) y red vigilada. */
async function phone(
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

async function axe(page: Page, scope = "axe") {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    // Un botón que acaba de habilitarse aún transita de color: axe mediría el tono a medias.
    await page.evaluate(() =>
      // Una animación cancelada (el diálogo al cambiar a «menos movimiento») no es un error.
      Promise.all(
        document.getAnimations().map((a) => a.finished.catch(() => null)),
      ),
    );
    const results = await new AxeBuilder({ page }).analyze();
    // Resumen legible: regla, nodo y por qué (el volcado completo de axe tapa la causa).
    const found = results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim()}`).join(" | ")}`,
    );
    expect(found, `${scope} · ${colorScheme}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });
}

async function createFamily(a: Phone, name = MAMA) {
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

async function finishSecrets(page: Page) {
  await page.getByRole("checkbox", { name: /Ya los anoté/ }).check();
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByTestId("family-panel")).toBeVisible();
}

async function joinFamily(
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
  await page.getByLabel("Código", { exact: true }).fill(secrets.code);
  await page.getByLabel("Frase", { exact: true }).fill(secrets.phrase);
  await page.getByLabel(/Nombre de este teléfono/).fill(name);
  await page
    .getByRole("checkbox", { name: /Entiendo qué se comparte/ })
    .check();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByTestId("family-panel")).toBeVisible();
}

/** El centinela: nada de esto puede aparecer en lo que salió hacia el servidor. */
function expectNoPlaintext(phones: Phone[], secrets: string[]) {
  const forbidden = [
    NOTE,
    "quinoa",
    MAMA,
    PAPA,
    "Desayuno",
    "Almuerzo",
    ...secrets,
    ...secrets.map((s) => s.replace(/[-\s]/g, "")),
  ].filter((s) => s.length > 3);
  for (const p of phones) {
    expect(p.wire.length).toBeGreaterThan(0);
    for (const sent of p.wire) {
      for (const word of forbidden) {
        expect(sent.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  }
}

/** Recarga el teléfono hasta que lo que busca llegue (la subida y la bajada son asíncronas). */
async function reloadUntil(page: Page, check: () => Promise<void>) {
  await expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 25_000, intervals: [500, 1000, 1500] });
}

test("el centinela se demuestra fallando: si algo viajara en claro, salta", () => {
  const leaky = (sent: string): Phone => ({ wire: [sent] }) as unknown as Phone;
  expect(() => expectNoPlaintext([leaky(`{"name":"${MAMA}"}`)], [])).toThrow();
  expect(() => expectNoPlaintext([leaky(`{"ct":"${NOTE}"}`)], [])).toThrow();
  expect(() =>
    expectNoPlaintext(
      [leaky("frase ABCD-EFGH-JKMN-PQRS-TVWX")],
      ["ABCD-EFGH-JKMN-PQRS-TVWX"],
    ),
  ).toThrow();
  expect(() => expectNoPlaintext([leaky("opaco: Zm9v")], [])).not.toThrow();
});

test("el servicio de pruebas es el doble en memoria, nunca la base real", async ({
  request,
}) => {
  const res = await request.post("/api/family/health", { data: {} });
  expect(await res.json()).toEqual({ available: true, store: "memory" });
});

test("crear, entrar, marcar en uno y ver en el otro, sin red, sacar a un teléfono y salir — y el servidor jamás ve texto en claro", async ({
  browser,
  baseURL,
}) => {
  const a = await phone(browser, baseURL!);
  const b = await phone(browser, baseURL!);

  // 1 · Crear: consentimiento y secretos, congelados con axe en los dos temas.
  await a.page.goto("/ajustes");
  await expect(a.page.getByTestId("family-create")).toBeEnabled();
  await axe(a.page, "ajustes sin familia");
  await a.page.getByTestId("family-create").click();
  await expect(a.page.getByTestId("family-create-form")).toBeVisible();
  await axe(a.page, "consentimiento");
  const first = await createFamily(a);
  await axe(a.page, "secretos");
  await finishSecrets(a.page);
  await expect(a.page.getByTestId("family-status")).toHaveText("Al día");
  await axe(a.page, "familia creada");

  // 2 · Entrar con el código y la frase en el otro teléfono.
  await joinFamily(b, first);
  await expect(b.page.getByTestId("family-phones")).toContainText(MAMA);
  await axe(b.page, "familia unida");

  // 3 · Marcar el desayuno y una nota en A: B lo ve, con «Por Mamá».
  await a.page.goto("/");
  await a.page.getByRole("checkbox", { name: /Desayuno/i }).click();
  await a.page.getByRole("button", { name: "Agregar nota" }).first().click();
  await a.page.getByRole("textbox", { name: /Nota para Desayuno/i }).fill(NOTE);
  await a.page.getByRole("button", { name: "Guardar" }).click();
  await expect(a.page.getByText(new RegExp(NOTE))).toBeVisible();

  await b.page.goto("/");
  await reloadUntil(b.page, async () => {
    await expect(b.page.getByText(new RegExp(NOTE))).toBeVisible({
      timeout: 1000,
    });
  });
  await expect(b.page.getByText(`Por ${MAMA}`).first()).toBeVisible();
  await expect(b.page.getByText(/Hecho · 7:3\d/)).toBeVisible();
  await axe(b.page, "hoy con lo del otro teléfono");

  // 4 · Sin red: lo de A se guarda aquí, dice cuántos cambios faltan y sube al volver.
  await a.page.goto("/");
  await expect(
    a.page.getByRole("checkbox", { name: /Almuerzo/i }),
  ).toBeVisible();
  a.net.down = true;
  await a.page.getByRole("checkbox", { name: /Almuerzo/i }).click();
  await a.page.getByRole("link", { name: "Ajustes" }).click();
  await expect(a.page.getByTestId("family-status")).toHaveText("Sin conexión", {
    timeout: 8000,
  });
  await expect(a.page.getByTestId("family-pending")).toBeVisible();
  await axe(a.page, "sin red con cambios pendientes");
  a.net.down = false;
  await a.page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(a.page.getByTestId("family-status")).toHaveText("Al día", {
    timeout: 15_000,
  });
  await expect(a.page.getByTestId("family-pending")).toHaveCount(0);

  await b.page.goto("/");
  await reloadUntil(b.page, async () => {
    await expect(
      b.page.getByRole("checkbox", { name: /Almuerzo/i }),
    ).toBeChecked({ timeout: 1000 });
  });

  // 5 · Sacar a Papá: la frase cambia, B queda bloqueado y A muestra la frase nueva.
  await a.page.goto("/ajustes");
  await expect(a.page.getByTestId("family-phones")).toContainText(PAPA, {
    timeout: 15_000,
  });
  await a.page.getByRole("button", { name: `Sacar a ${PAPA}` }).click();
  await expect(
    a.page.getByRole("heading", { name: `¿Sacar a ${PAPA}?` }),
  ).toBeVisible();
  await axe(a.page, "confirmar sacar");
  await a.page
    .getByRole("button", { name: "Cambiar la frase y sacar" })
    .click();
  await expect(a.page.getByTestId("family-phrase")).toBeVisible();
  const second = (await a.page.getByTestId("family-phrase").innerText()).trim();
  expect(second).not.toEqual(first.phrase);
  await axe(a.page, "frase nueva");

  await b.page.goto("/ajustes");
  await reloadUntil(b.page, async () => {
    await expect(b.page.getByTestId("family-status")).toHaveText(
      "Frase cambiada",
      { timeout: 1000 },
    );
  });
  await expect(b.page.getByTestId("family-join-form")).toBeVisible();
  await axe(b.page, "bloqueado: frase cambiada");

  // 6 · B vuelve a entrar con la frase nueva y luego sale; sus datos se quedan.
  await b.page.getByLabel("Frase", { exact: true }).fill(second);
  await b.page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(b.page.getByTestId("family-status")).toHaveText("Al día", {
    timeout: 15_000,
  });
  await b.page.getByRole("button", { name: "Salir de la familia" }).click();
  await axe(b.page, "confirmar salir");
  await b.page.getByRole("button", { name: "Sí, salir" }).click();
  await expect(b.page.getByTestId("family-notice")).toContainText(
    "Saliste de la familia",
  );
  await axe(b.page, "tras salir");
  await b.page.goto("/");
  await expect(
    b.page.getByRole("checkbox", { name: /Desayuno/i }),
  ).toBeChecked();

  // La garantía: ningún texto en claro, ni frase ni nombres, en ninguna petición.
  // (El código de la familia SÍ viaja: es su identificador opaco, no un secreto de contenido.)
  expectNoPlaintext([a, b], [first.phrase, second]);

  await a.context.close();
  await b.context.close();
});

test("«Borrar mis datos» dentro de una familia: avisa, y con la casilla también borra lo compartido de internet", async ({
  browser,
  baseURL,
}) => {
  const a = await phone(browser, baseURL!);
  const b = await phone(browser, baseURL!);
  const first = await createFamily(a);
  await finishSecrets(a.page);

  // Sin la casilla: solo sale este teléfono; la familia sigue en internet.
  await a.page.goto("/ajustes");
  await a.page.getByRole("button", { name: "Borrar mis datos" }).click();
  const box = a.page.getByRole("checkbox", {
    name: /También borrar lo compartido de internet/,
  });
  await expect(box).toBeVisible();
  await expect(box).not.toBeChecked();
  await axe(a.page, "borrar datos en familia");
  await a.page.getByRole("button", { name: "Cancelar" }).click();

  // Con la casilla: se borra la copia de internet y nadie más puede entrar.
  await a.page.getByRole("button", { name: "Borrar mis datos" }).click();
  await box.check();
  await a.page.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(a.page.getByText("Datos borrados.")).toBeVisible();
  await expect(a.page.getByTestId("family-create")).toBeVisible();

  await b.page.goto("/ajustes");
  await expect(b.page.getByTestId("family-join")).toBeEnabled();
  await b.page.getByTestId("family-join").click();
  await b.page.getByLabel("Código", { exact: true }).fill(first.code);
  await b.page.getByLabel("Frase", { exact: true }).fill(first.phrase);
  await b.page.getByLabel(/Nombre de este teléfono/).fill(PAPA);
  await b.page
    .getByRole("checkbox", { name: /Entiendo qué se comparte/ })
    .check();
  await b.page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(b.page.getByRole("alert")).toBeVisible();
  await expect(b.page.getByTestId("family-panel")).toHaveCount(0);
  await a.context.close();
  await b.context.close();
});

test("compartir no responde: se dice, y la app sigue completa", async ({
  browser,
  baseURL,
}) => {
  const a = await phone(browser, baseURL!);
  await a.context.route("**/api/family/health", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "unavailable" }),
    }),
  );
  await a.page.goto("/ajustes");
  // Hasta que se elige crear o entrar, no se pregunta nada a la red.
  await expect(a.page.getByTestId("family-unavailable")).toHaveCount(0);
  await a.page.getByTestId("family-create").click();
  await expect(a.page.getByTestId("family-unavailable")).toBeVisible();
  await expect(a.page.getByTestId("family-create-form")).toHaveCount(0);
  await axe(a.page, "no responde");
  await a.context.close();
});

test("sin internet al abrir Ajustes: dice que hace falta para crear o entrar", async ({
  browser,
  baseURL,
}) => {
  const a = await phone(browser, baseURL!);
  await a.context.route("**/api/family/health", (route) => route.abort());
  await a.page.goto("/ajustes");
  await a.page.getByTestId("family-join").click();
  await expect(a.page.getByTestId("family-offline")).toBeVisible();
  await expect(a.page.getByTestId("family-join-form")).toHaveCount(0);
  await axe(a.page, "sin red al abrir");
  await a.context.close();
});

test("en inglés: crear una familia y entrar, con axe", async ({
  browser,
  baseURL,
}) => {
  const a = await phone(browser, baseURL!, "en");
  await a.page.goto("/ajustes");
  const create = a.page.getByTestId("family-create");
  await expect(create).toBeEnabled();
  await create.click();
  await a.page.getByLabel(/This phone's name/).fill("Mom");
  await a.page.getByRole("checkbox", { name: /I understand what/ }).check();
  await axe(a.page, "create form (en)");
  await a.page.getByRole("button", { name: "Create the family" }).click();
  await expect(a.page.getByTestId("family-secrets")).toBeVisible();
  await axe(a.page, "secrets (en)");
  await a.context.close();
});
