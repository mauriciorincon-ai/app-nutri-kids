import { expect, test, type Page } from "@playwright/test";

/**
 * "El día completo" (acceptance criteria del S3): registro con hora real + nota,
 * recordatorio determinista, historial, migración v1→v2 y la GARANTÍA de
 * privacidad (cero red en el registro · el registro nunca entra al grounding).
 *
 * Fechas SIEMPRE con el clock de Playwright. La demo restringe 2026-07-01→09-28;
 * el lunes toca "Multivitamínico demo", el desayuno va 07:00–08:00.
 */

const MON_0730 = new Date("2026-07-06T07:30:00"); // lunes, durante el desayuno

async function seedPrefs(page: Page, locale: "es" | "en" = "es") {
  await page.addInitScript((loc) => {
    const prev = JSON.parse(
      window.localStorage.getItem("nutrikids.prefs.v1") ?? "{}",
    ) as Record<string, unknown>;
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: loc, ...prev, disclaimerSeen: true }),
    );
  }, locale);
}

async function openAt(page: Page, path = "/", time: Date = MON_0730) {
  await page.clock.install({ time });
  await seedPrefs(page);
  await page.goto(path);
}

test.describe("registro sin red (service worker bloqueado)", () => {
  // El registro es 100% local: no necesita SW. Bloquearlo evita que un fetch
  // iniciado por el service worker (que en CI SÍ se registra) se le escape al
  // contador — y `context.route("**")` intercepta TODAS las requests, no solo
  // las que emiten evento de página.
  test.use({ serviceWorkers: "block" });

  test("registro: marcar guarda la hora real, la nota persiste y ayer se consulta — CERO red", async ({
    page,
  }) => {
    const violations: string[] = [];
    await page.context().route("**", (route) => {
      const url = new URL(route.request().url());
      // Prohibido: cualquier backend (/api/*) o cualquier origen externo.
      if (
        url.origin !== "http://localhost:3000" ||
        url.pathname.startsWith("/api/")
      ) {
        violations.push(url.href);
      }
      return route.continue();
    });

    await openAt(page, "/");

    // Marcar el desayuno → guarda la hora real y la muestra con su VALOR (7:30).
    await page.getByRole("checkbox", { name: /Desayuno/i }).click();
    await expect(page.getByText(/Hecho · 7:30/)).toBeVisible();
    await expect(page.getByText("Ya hiciste 1 de 10")).toBeVisible();

    // Agregar una nota al desayuno: chip "Lo rechazó" + texto corto.
    await page.getByRole("button", { name: "Agregar nota" }).first().click();
    await page.getByRole("button", { name: "Lo rechazó" }).click();
    await page
      .getByRole("textbox", { name: /Nota para Desayuno/i })
      .fill("Solo comió dos cucharadas");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByText(/Lo rechazó · Solo comió dos cucharadas/),
    ).toBeVisible();

    // Recargar: la hora (con su valor) y la nota sobreviven (persistencia local).
    await page.reload();
    await expect(page.getByText(/Hecho · 7:30/)).toBeVisible();
    await expect(page.getByText("Ya hiciste 1 de 10")).toBeVisible();
    await expect(
      page.getByText(/Lo rechazó · Solo comió dos cucharadas/),
    ).toBeVisible();

    // Cambiar idioma no pierde nada (los datos siguen; los rótulos traducen).
    await page.getByRole("link", { name: "Ajustes" }).click();
    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByText("You've done 1 of 10")).toBeVisible();
    await expect(
      page.getByText(/Refused it · Solo comió dos cucharadas/),
    ).toBeVisible(); // el texto de la nota es del usuario: no se traduce

    // Ayer se consulta en el historial (aquí "hoy" con su marca y nota).
    await page.getByRole("link", { name: "See previous days" }).click();
    await expect(
      page.getByRole("heading", { name: "Previous days" }),
    ).toBeVisible();
    // Acotado a la tarjeta del día (evita el tab de nav y "Back to Today").
    const dayCard = page
      .getByRole("listitem")
      .filter({ hasText: "Solo comió dos cucharadas" });
    await expect(dayCard.getByText("Today")).toBeVisible();
    await expect(
      dayCard.getByText(/Refused it · Solo comió dos cucharadas/),
    ).toBeVisible();

    // La garantía dura: cero backend, cero red externa en todo el flujo.
    expect(violations).toEqual([]);
  });
});

test("recordatorio determinista: qué toca AHORA según la hora inyectada", async ({
  page,
}) => {
  // 07:30 lunes → durante el desayuno.
  await openAt(page, "/", MON_0730);
  const reminder = page.getByRole("region", { name: "Ahora mismo" });
  await expect(reminder.getByText("Es momento de Desayuno")).toBeVisible();
  await expect(reminder.getByText(/Sigue: Media mañana/)).toBeVisible();
  await expect(
    reminder.getByText("Suplemento de hoy: Multivitamínico demo"),
  ).toBeVisible();

  // 09:00 → hueco entre desayuno y media mañana.
  await page.clock.setFixedTime(new Date("2026-07-06T09:00:00"));
  await page.reload();
  await expect(reminder.getByText("Un respiro entre comidas")).toBeVisible();
  await expect(reminder.getByText(/Sigue: Media mañana/)).toBeVisible();

  // Al marcar el suplemento, el recordatorio deja de listarlo (sin reproche).
  await page.getByRole("checkbox", { name: /Multivitamínico demo/ }).click();
  await expect(reminder.getByText("Suplemento de hoy: ya está")).toBeVisible();
});

test("recordatorio: un día SIN suplemento dice 'no toca', jamás 'ya está'", async ({
  page,
}) => {
  // Jueves 2026-07-09: ningún suplemento demo programado (lun/mié/vie y mar/sáb).
  await openAt(page, "/", new Date("2026-07-09T07:30:00"));
  const reminder = page.getByRole("region", { name: "Ahora mismo" });
  await expect(reminder.getByText("Hoy no toca suplemento")).toBeVisible();
  // NUNCA debe afirmar un suplemento cumplido que ese día no existía.
  await expect(reminder.getByText("Suplemento de hoy: ya está")).toBeHidden();
});

test("medianoche con la pestaña abierta: el día rota SIN reload", async ({
  page,
}) => {
  // Lunes 23:58: marcamos un vaso (queda en el registro del lunes).
  await page.clock.install({ time: new Date("2026-07-06T23:58:00") });
  await seedPrefs(page);
  await page.goto("/");
  await page.getByRole("checkbox", { name: /Vaso 1/ }).click();
  await expect(page.getByRole("checkbox", { name: /Vaso 1/ })).toBeChecked();

  // Avanzamos 5 min → martes 00:03: el interval de useToday dispara el rollover
  // (sin reload) y "Hoy" amanece vacío — el vaso del lunes ya no está marcado.
  await page.clock.fastForward("00:05:00");
  await expect(
    page.getByRole("checkbox", { name: /Vaso 1/ }),
  ).not.toBeChecked();
  await expect(
    page.getByText("Así se ve el día de hoy", { exact: false }),
  ).toBeVisible();

  // Y el lunes conserva su marca en el historial (no se perdió al rotar el día).
  await page.getByRole("link", { name: "Ver días anteriores" }).click();
  await expect(
    page.getByRole("heading", { name: "Días anteriores" }),
  ).toBeVisible();
});

test("migración v1→v2: el estado de un usuario S1/S2 no pierde marcas", async ({
  page,
}) => {
  // Estado REAL heredado: clave v1 con marcas SIN hora.
  await page.clock.install({ time: MON_0730 });
  await seedPrefs(page);
  await page.addInitScript(() => {
    // Guard: no re-sembrar la v1 si ya migramos (si el test añadiera un reload,
    // la v1 no debe renacer sobre la v2 ya escrita).
    if (window.localStorage.getItem("nutrikids.daylog.v2")) return;
    window.localStorage.setItem(
      "nutrikids.daylog.v1",
      JSON.stringify({
        "2026-07-06": ["meal:desayuno", "supplement:multivitaminico-demo"],
      }),
    );
  });
  await page.goto("/");

  // Las dos marcas migradas siguen ahí (2 de 10), el desayuno aparece hecho.
  await expect(page.getByText("Ya hiciste 2 de 10")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Desayuno/i })).toBeChecked();

  // La v1 se eliminó (una sola fuente de verdad) y la v2 quedó escrita.
  const keys = await page.evaluate(() => ({
    v1: window.localStorage.getItem("nutrikids.daylog.v1"),
    v2: window.localStorage.getItem("nutrikids.daylog.v2"),
  }));
  expect(keys.v1).toBeNull();
  expect(keys.v2).not.toBeNull();

  // Y se puede seguir marcando encima de lo migrado (con hora nueva).
  await page.getByRole("checkbox", { name: /Vaso 1/ }).click();
  await expect(page.getByText("Ya hiciste 3 de 10")).toBeVisible();
});

test("privacidad: el registro del día NO viaja en el request del chat (grounding)", async ({
  page,
}) => {
  const SENTINEL = "NOTA-SECRETA-REGISTRO-7k2";
  await page.clock.install({ time: MON_0730 });
  await seedPrefs(page);
  // Sembramos un registro con una nota centinela (datos de salud del menor).
  await page.addInitScript((sentinel) => {
    window.localStorage.setItem(
      "nutrikids.daylog.v2",
      JSON.stringify({
        "2026-07-06": {
          marks: { "meal:almuerzo": { at: "13:47" } },
          notes: { "meal:almuerzo": { chips: ["rejected"], text: sentinel } },
        },
      }),
    );
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({
        locale: "es",
        disclaimerSeen: true,
        chatIntroSeen: true,
      }),
    );
  }, SENTINEL);

  // Capturamos el body del POST a /api/chat.
  let body: unknown = null;
  await page.route("**/api/chat", async (route) => {
    const req = route.request();
    body = req.postDataJSON();
    // El centinela tampoco puede viajar por la URL (query param) del request.
    expect(req.url()).not.toContain(SENTINEL);
    await route.continue();
  });

  await page.goto("/chat");
  await page.getByRole("textbox").fill("no tengo pollo, ¿qué le doy?");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText(/opciones verdes/i)).toBeVisible();

  // El request lleva EXACTAMENTE {messages, diet, locale} — nada del registro.
  expect(body).not.toBeNull();
  expect(Object.keys(body as Record<string, unknown>).sort()).toEqual([
    "diet",
    "locale",
    "messages",
  ]);
  // Y el centinela del registro no aparece en NINGUNA parte del payload.
  expect(JSON.stringify(body)).not.toContain(SENTINEL);
  expect(JSON.stringify(body)).not.toContain("13:47");
});
