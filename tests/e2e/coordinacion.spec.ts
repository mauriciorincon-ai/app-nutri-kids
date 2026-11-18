import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import {
  MAMA,
  MON_0730,
  PAPA,
  axe,
  createFamily,
  finishSecrets,
  joinFamily,
  phone,
  reloadUntil,
} from "./phones";

/**
 * Coordinación (S9 · ADR-013, ADR-014): plan B, días especiales, unir dos planes y el rol
 * que cambia el plan unido. Todo con planes INVENTADOS (la demo del repo y una copia
 * cambiada), fechas con el clock de Playwright y, para la familia, el doble del almacén.
 * Cada estado nuevo pasa por axe en los dos temas.
 */

const DEMO = readFileSync("data/demo-diet.json", "utf8");

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Un segundo plan inventado que choca con la demo de tres maneras: lo que la demo deja en
 * verde (lentejas) este lo prohíbe (gana lo prohibido, solo), y el límite del banano y la
 * porción de las proteínas dicen otra cosa (los elige una madre o un padre).
 */
function secondPlan(): string {
  const b = JSON.parse(DEMO) as Json;
  b.meta.id = "plan-segundo-inventado";
  b.meta.title = {
    es: "Plan del segundo profesional (inventado)",
    en: "Second professional's plan (made up)",
  };
  const proteins = b.trafficLight.green.groups.find(
    (g: Json) => g.id === "proteinas",
  );
  const lentils = proteins.items.find((i: Json) => i.id === "lentejas");
  proteins.items = proteins.items.filter((i: Json) => i.id !== "lentejas");
  proteins.portion = {
    es: "1 porción pequeña, 3 veces al día",
    en: "1 small serving, 3 times a day",
  };
  b.trafficLight.red.items.push({
    id: "lentejas",
    name: lentils.name,
    why: {
      es: "Este profesional las prohíbe por ahora.",
      en: "This professional rules them out for now.",
    },
  });
  const banana = b.trafficLight.yellow.items.find(
    (i: Json) => i.id === "banano",
  );
  banana.limit = { es: "máx. 2 al día", en: "max 2 per day" };
  return JSON.stringify(b);
}

/** Un plan «real» ya cargado (la demo del repo con su marca), sin pasar por la pantalla. */
async function seedRealPlan(page: Page) {
  await page.addInitScript((diet) => {
    if (!window.localStorage.getItem("nutrikids.diet.v1")) {
      window.localStorage.setItem("nutrikids.diet.v1", diet);
      window.localStorage.setItem("nutrikids.source.v1", "real");
    }
  }, DEMO);
}

async function openDay(page: Page, path = "/") {
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "es", disclaimerSeen: true }),
    );
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("plan B", () => {
  test("se acabó algo: con respuesta en el plan, sin ella, y solo con lo que el plan trae", async ({
    page,
  }) => {
    await openDay(page);
    const card = page.getByTestId("plan-b");
    await expect(card).toBeVisible();
    await axe(page, "plan B cerrado");

    await page.getByTestId("planb-out").click();
    await axe(page, "plan B · se acabó algo, sin elegir");

    // El plan trae reemplazos para la manzana: salen solo los suyos (pera, kiwi…).
    await page.getByTestId("planb-food").selectOption("manzana");
    const answer = page.getByTestId("planb-answer");
    await expect(answer).toContainText(/pera/i);
    await expect(answer).toContainText(/kiwi/i);
    await axe(page, "plan B · con respuesta del plan");

    // El plan no trae reemplazos para el banano: lo dice, no inventa ninguno.
    await page.getByTestId("planb-food").selectOption("banano");
    await expect(answer).toContainText(/plan/i);
    await expect(answer).not.toContainText(/pera|kiwi|aguacate/i);
    await axe(page, "plan B · el plan no lo dice");
  });

  test("no hay nevera: el plan marca algunas; la marca del Perfil suma otra", async ({
    page,
  }) => {
    await openDay(page);
    await page.getByTestId("planb-no-fridge").click();
    const answer = page.getByTestId("planb-answer");
    // El plan de ejemplo marca opciones que aguantan sin nevera (S11): salen de entrada.
    await expect(answer).toContainText(/Aguantan sin nevera/);
    await expect(answer).toContainText(/pera/i);
    await expect(answer).not.toContainText(/no dice cuáles/i);
    await axe(page, "plan B · sin nevera, con lo que marca el plan");

    // Quien cuida suma otra que ya sabe que aguanta (en el Perfil).
    await page.goto("/perfil");
    const marks = page.getByTestId("fridge-marks");
    await expect(marks).toBeVisible();
    await axe(page, "perfil · marcas de nevera");
    await marks
      .getByRole("button", { name: /Marcar .*: aguanta sin nevera/ })
      .first()
      .click();
    await expect(
      marks.getByRole("button", { name: /Quitar la marca de/ }).first(),
    ).toBeVisible();
    await axe(page, "perfil · una marca de nevera puesta");

    await page.goto("/");
    await page.getByTestId("planb-no-fridge").click();
    await expect(page.getByTestId("planb-answer")).toContainText(
      /Aguantan sin nevera/,
    );
    await axe(page, "plan B · sin nevera, con la marca de quien cuida");
  });

  test("llegamos tarde: dice qué toca ahora con el plan de la hora", async ({
    page,
  }) => {
    await openDay(page);
    await page.getByTestId("planb-late").click();
    await expect(page.getByTestId("planb-answer")).toBeVisible();
    await axe(page, "plan B · llegamos tarde");
  });
});

test.describe("días especiales", () => {
  for (const id of ["birthday", "restaurant", "emergency", "offered"]) {
    test(`ficha «${id}»: sale del plan, sin red y sin indicación médica`, async ({
      page,
    }) => {
      const outgoing: string[] = [];
      page.on("request", (r) => {
        if (/\/api\//.test(r.url())) outgoing.push(r.url());
      });
      await openDay(page, "/escenarios");
      await axe(page, "escenarios · sin elegir");
      await page.getByTestId(`scenario-${id}`).click();
      const sheet = page.getByTestId("scenario");
      await expect(sheet).toBeVisible();
      await expect(page.getByTestId("scenario-not-medical")).toBeVisible();
      await axe(page, `escenario ${id}`);
      // Ver una ficha no llama a ninguna ruta del servidor.
      expect(outgoing).toEqual([]);
    });
  }

  test("la emergencia no inventa teléfonos: «tu zona» y el contacto que anotó el plan", async ({
    page,
  }) => {
    await openDay(page, "/escenarios");
    await page.getByTestId("scenario-emergency").click();
    await expect(page.getByTestId("scenario-call")).toContainText(
      /servicios de emergencia de tu zona/i,
    );
    await expect(page.getByTestId("scenario-call")).not.toContainText(
      /\d{3}[\s-]?\d{3,}/,
    );
    await expect(page.getByTestId("scenario-card")).toBeVisible();
  });
});

test.describe("varias dietas", () => {
  test("sin segundo plan: lo dice y manda a Cargar", async ({ page }) => {
    await seedRealPlan(page);
    await openDay(page, "/unir");
    await expect(page.getByText("No hay un segundo plan")).toBeVisible();
    await axe(page, "unir · sin segundo plan");
  });

  test("dos planes con un choque de cada tipo: lo prohibido gana solo, el resto lo eliges, se une y cada línea dice de dónde salió", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await seedRealPlan(page);
    await openDay(page, "/cargar");

    // 1 · Agregar el segundo plan desde Cargar (JSON del segundo profesional, inventado).
    await page
      .getByRole("button", { name: "Agregar como segundo plan" })
      .click();
    await page.locator('input[accept="application/json,.json"]').setInputFiles({
      name: "segundo-plan.json",
      mimeType: "application/json",
      buffer: Buffer.from(secondPlan()),
    });
    await page.waitForURL("**/unir");

    // 2 · Lado a lado, lo prohibido (gana solo, con su origen) y los choques por elegir.
    await expect(page.getByTestId("plan-side").first()).toBeVisible();
    await expect(page.getByTestId("merge-red")).toContainText(/Lentejas/i);
    await expect(page.getByTestId("merge-red")).toContainText(/viene del/i);
    await expect(page.getByTestId("merge-conflicts")).toBeVisible();
    await expect(page.getByTestId("merge-do")).toBeDisabled();
    await axe(page, "unir · dos planes, con choques sin elegir");

    // 3 · Los eliges uno por uno: el botón se habilita solo con todo elegido.
    const picks = page.locator('[data-testid^="pick-"][data-testid$="-b"]');
    const total = await picks.count();
    expect(total).toBeGreaterThanOrEqual(2); // límite y porción (más lo que haya)
    for (let i = 0; i < total; i += 1) {
      await page
        .locator('[data-testid^="pick-"][data-testid$="-b"]')
        .nth(i)
        .click();
    }
    await expect(page.getByTestId("merge-status")).toContainText(
      /Todo elegido/,
    );
    await expect(page.getByTestId("merge-do")).toBeEnabled();
    await axe(page, "unir · todo elegido");

    // 4 · Se unen: un solo plan, y cada línea dice de dónde salió.
    await page.getByTestId("merge-do").click();
    await expect(page.getByTestId("merged-lines")).toBeVisible();
    // Ninguna línea enseña su clave interna (food:…, goal:…): siempre un nombre en llano.
    await expect(page.getByTestId("merged-lines")).not.toContainText(
      /\b(food|supplement|meal|goal|allergy|medication):/,
    );
    await axe(page, "unir · plan unido y sus orígenes");

    // La restricción que un plan decía y el otro no se conserva: lentejas, en rojo en la dieta.
    await page.goto("/dieta/lentejas");
    await expect(page.getByTestId("origin-badge")).toBeVisible();
    await expect(page.getByTestId("origin-badge")).toContainText(/prohibido/i);
    await axe(page, "alimento con su origen");
  });

  test("una madre cambia una línea en rojo del plan unido: ve los dos orígenes, confirma una vez y queda en la bitácora; un cuidador no puede", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const a = await phone(browser, baseURL!);
    const b = await phone(browser, baseURL!);
    await seedRealPlan(a.page);
    await seedRealPlan(b.page);

    // La familia: A (madre) crea; B entra y la madre lo confirma como cuidador.
    const secrets = await createFamily(a);
    await finishSecrets(a.page);
    await joinFamily(b, secrets);
    await expect(b.page.getByTestId("family-no-role")).toBeVisible({
      timeout: 15_000,
    });
    const bId = await b.page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("nutrikids.device.v1")!).id as string,
    );
    await a.page.goto("/ajustes");
    await reloadUntil(a.page, async () => {
      await expect(a.page.getByTestId(`family-confirm-${bId}`)).toBeVisible({
        timeout: 1000,
      });
    });
    await a.page.getByTestId(`family-confirm-${bId}`).click();

    // A carga el segundo plan y lo une, eligiendo lo del otro profesional en cada choque.
    await a.page.goto("/cargar");
    await a.page
      .getByRole("button", { name: "Agregar como segundo plan" })
      .click();
    await a.page
      .locator('input[accept="application/json,.json"]')
      .setInputFiles({
        name: "segundo-plan.json",
        mimeType: "application/json",
        buffer: Buffer.from(secondPlan()),
      });
    await a.page.waitForURL("**/unir");
    const total = await a.page
      .locator('[data-testid^="pick-"][data-testid$="-a"]')
      .count();
    for (let i = 0; i < total; i += 1) {
      await a.page
        .locator('[data-testid^="pick-"][data-testid$="-a"]')
        .nth(i)
        .click();
    }
    await a.page.getByTestId("merge-do").click();
    await expect(a.page.getByTestId("merged-lines")).toBeVisible();

    // La madre cambia la línea en rojo (lentejas): ve los dos orígenes, confirma una vez.
    const line = a.page.locator('[data-testid^="line-"]', {
      hasText: /Lentejas/i,
    });
    await expect(line.first()).toBeVisible();
    await line.first().locator('[data-testid^="change-"]').first().click();
    const confirm = a.page.getByTestId("change-confirm");
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(/Cambiar esta línea/);
    await axe(a.page, "cambiar una línea en rojo · confirmación");
    await confirm.locator('[data-testid^="change-ok-"]').click();
    await expect(
      a.page.getByText("Cambio guardado y anotado en la bitácora."),
    ).toBeVisible();
    await axe(a.page, "línea cambiada por una madre");

    // Queda en la bitácora de la familia.
    await a.page.goto("/ajustes");
    await expect(a.page.getByTestId("family-log")).toContainText(
      /cambió una línea del plan unido/,
    );
    await axe(a.page, "bitácora con el cambio de la línea");

    // El cuidador ve el plan unido, pero no tiene con qué cambiarlo.
    await b.page.goto("/unir");
    await reloadUntil(b.page, async () => {
      await expect(b.page.getByTestId("merged-lines")).toBeVisible({
        timeout: 1000,
      });
    });
    await expect(b.page.getByTestId("role-limit")).toBeVisible();
    await expect(b.page.locator('[data-testid^="change-"]')).toHaveCount(0);
    await axe(b.page, "plan unido con rol de cuidador");

    // Nada de esto viajó en claro: ni los nombres ni los alimentos.
    for (const p of [a, b]) {
      expect(p.wire.length).toBeGreaterThan(0);
      for (const sent of p.wire) {
        for (const word of [MAMA, PAPA, "Lentejas", "Banano", "Desayuno"]) {
          expect(sent.toLowerCase()).not.toContain(word.toLowerCase());
        }
      }
    }
  });
});

test.describe("la lista de la familia llena", () => {
  test("el padre lo ve en Compartir con qué hacer, con símbolo y texto, en los dos temas", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const a = await phone(browser, baseURL!);
    const secrets = await createFamily(a);
    expect(secrets.code.length).toBeGreaterThan(0);
    await finishSecrets(a.page);
    await expect(a.page.getByTestId("family-roster-full")).toHaveCount(0);

    // Llenar 120 cambios por la pantalla tardaría; el estado que lo marca (que las pruebas
    // unitarias producen llenando de verdad la cadena) se pone aquí y se recarga.
    await a.page.evaluate(() => {
      const raw = window.localStorage.getItem("nutrikids.family.v1")!;
      const st = JSON.parse(raw);
      st.rosterFull = true;
      window.localStorage.setItem("nutrikids.family.v1", JSON.stringify(st));
    });
    await a.page.goto("/ajustes");
    const banner = a.page.getByTestId("family-roster-full");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("⚠");
    await expect(banner).toContainText(
      /lista de personas de la familia está llena/,
    );
    await expect(banner).toContainText(/crea una nueva/);
    await axe(a.page, "lista de la familia llena");
  });
});
