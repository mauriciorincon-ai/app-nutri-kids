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
 * Bienestar (S10 · ADR-015): cómo llega a la mesa, qué acepta, cómo está y sus hábitos.
 * Solo se anota; la app no interpreta. Datos inventados (la demo del repo), fechas con el clock
 * de Playwright y, para la familia, el doble del almacén. Cada estado nuevo pasa por axe en
 * los dos temas.
 */

const mood = (page: Page, meal: string) =>
  page.getByRole("group", { name: `¿Cómo llega a esta comida? ${meal}` });

test("un teléfono: ánimo, aceptación, cómo está, hábitos con su fuente y el Historial", async ({
  page,
}) => {
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "es", disclaimerSeen: true }),
    );
  });

  // 1 · El semáforo emocional junto a la comida: un toque, símbolo + texto, se quita al repetir.
  await page.goto("/");
  const breakfast = mood(page, "Desayuno");
  await expect(breakfast.getByRole("button")).toHaveCount(5);
  await axe(page, "Hoy con el semáforo emocional");
  await breakfast.getByRole("button", { name: "Cansado" }).click();
  await expect(
    breakfast.getByRole("button", { name: "Cansado" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    breakfast.getByRole("button", { name: "Cansado" }),
  ).toContainText("✓");
  await axe(page, "Hoy con un ánimo elegido");

  // 2 · La bitácora de aceptación de esa comida: se abre bajo demanda.
  await page
    .getByRole("button", { name: "Cómo le fue con los alimentos" })
    .first()
    .click();
  const log = page.getByRole("group", {
    name: "Cómo le fue con los alimentos",
  });
  await expect(log).toBeVisible();
  await log.getByLabel("¿Con qué alimento?").selectOption({ index: 1 });
  await log.getByRole("button", { name: "Lo probó" }).click();
  await log.getByRole("button", { name: "Lo aceptó", exact: true }).click();
  await log.getByRole("checkbox", { name: "Es un alimento nuevo" }).check();
  await axe(page, "bitácora de aceptación llena");
  await log.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(log.getByTestId("food-entries")).toContainText("Lo probó");
  await expect(log).toContainText("Lo ha mirado, tocado o probado 1 vez.");
  await expect(log).toContainText("sin presión");
  await axe(page, "bitácora con una entrada y su contador");

  // 3 · La franja de edad se elige en el Perfil (solo se guarda la franja).
  await page.goto("/perfil");
  const age = page.getByTestId("age-picker");
  await expect(age).toContainText("nunca la fecha de nacimiento");
  await age.getByRole("button", { name: "3–4 años" }).click();
  await expect(age.getByRole("button", { name: /3–4 años/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await axe(page, "Perfil con la franja de edad");

  // 4 · Cómo está hoy: palabras de casa; una reacción solo ofrece el enlace al plan de emergencia.
  await page.goto("/bienestar");
  await expect(page.getByRole("heading", { name: "Bienestar" })).toBeVisible();
  await axe(page, "Bienestar vacío");
  await page
    .getByRole("group", { name: "Energía" })
    .getByRole("button", { name: "Con poca energía" })
    .click();
  await page
    .getByRole("group", { name: "Reacciones" })
    .getByRole("button", { name: "En la piel" })
    .click();
  const help = page.getByTestId("reaction-help");
  await expect(help).toContainText("plan de emergencia");
  await expect(
    help.getByRole("link", { name: /Abrir el plan de emergencia/ }),
  ).toHaveAttribute("href", "/escenarios?e=emergency");
  await page.getByLabel("Nota corta (opcional)").fill("durmió con tos leve");
  await page.getByRole("button", { name: "Guardar nota" }).click();
  await axe(page, "Bienestar con una reacción anotada");

  // 5 · Hábitos contra la referencia de su edad, con la fuente a la vista y sin rojo.
  const sleep = page.getByTestId("habit-sleep");
  await sleep.getByLabel(/Sueño de 24 h \(con siestas\) · Minutos/).fill("660");
  await sleep.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("habit-status-sleep")).toContainText(
    "Dentro de lo que se recomienda",
  );
  await expect(page.getByTestId("habit-source-sleep")).toContainText("AASM");
  const screen = page.getByTestId("habit-screen");
  await screen.getByLabel(/Pantalla \(recreativa\) · Minutos/).fill("150");
  await screen.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("habit-status-screen")).toContainText(
    "Por encima de la referencia",
  );
  await expect(page.getByTestId("habit-source-screen")).toContainText("OMS");
  await expect(page.getByText(/no es un veredicto/i).first()).toBeVisible();
  await axe(page, "Bienestar con hábitos dentro y por encima de la referencia");

  // 5b · También se anota desde la ficha del alimento, y el Historial lo recoge.
  await page.goto("/dieta/pollo");
  await page
    .getByRole("button", { name: "Cómo le fue con los alimentos" })
    .click();
  const fichaLog = page.getByRole("group", {
    name: "Cómo le fue con los alimentos",
  });
  await fichaLog.getByRole("button", { name: "Lo tocó" }).click();
  await fichaLog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(fichaLog.getByTestId("food-entries")).toContainText("Lo tocó");
  await axe(page, "ficha del alimento con la bitácora");

  // 6 · El Historial lo muestra en las mismas palabras y enlaza a Bienestar.
  await page.goto("/historial");
  await expect(
    page.getByRole("link", { name: "Bienestar de hoy" }),
  ).toHaveAttribute("href", "/bienestar");
  const block = page.getByTestId("history-wellbeing");
  await expect(block).toContainText("Desayuno: Cansado");
  await expect(block).toContainText("Reacciones: En la piel");
  await expect(block).toContainText("durmió con tos leve");
  await expect(block).toContainText("Sueño de anoche");
  await axe(page, "Historial con el bienestar del día");
});

test("dos teléfonos y un colegio: cuidador anota, la madre lo ve y el colegio solo su comida", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const a = await phone(browser, baseURL!);
  const b = await phone(browser, baseURL!);
  try {
    const secrets = await createFamily(a, MAMA);
    await finishSecrets(a.page);
    await joinFamily(b, secrets, PAPA);

    // La madre confirma a Papá como cuidador.
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
    await expect(a.page.getByTestId(`family-person-${bId}`)).toContainText(
      "Cuidador",
    );
    await b.page.goto("/ajustes");
    await reloadUntil(b.page, async () => {
      await expect(b.page.getByTestId("family-my-role")).toContainText(
        "Cuidador",
        { timeout: 1000 },
      );
    });

    // Papá (cuidador) anota ánimo y cómo está; la franja de edad no es suya.
    await b.page.goto("/");
    await mood(b.page, "Almuerzo")
      .getByRole("button", { name: "Ansioso" })
      .click();
    await expect(
      mood(b.page, "Almuerzo").getByRole("button", { name: "Ansioso" }),
    ).toHaveAttribute("aria-pressed", "true");
    await b.page.goto("/bienestar");
    await b.page
      .getByRole("group", { name: "Sueño (anoche)" })
      .getByRole("button", { name: "Mal" })
      .click();
    await b.page.goto("/perfil");
    await expect(b.page.getByTestId("age-picker")).toContainText(
      "Solo una madre o un padre elige la franja de edad.",
    );
    await axe(b.page, "Perfil de un cuidador: la franja no se cambia");

    // La madre lo ve en el Historial, con lo que anotó Papá.
    await a.page.goto("/historial");
    await reloadUntil(a.page, async () => {
      await expect(a.page.getByTestId("history-wellbeing")).toContainText(
        "Almuerzo: Ansioso",
        { timeout: 1000 },
      );
    });
    await expect(a.page.getByTestId("history-wellbeing")).toContainText(
      "Sueño (anoche): Mal",
    );
    await axe(a.page, "Historial de la madre con lo anotado por el cuidador");

    // La madre pasa a Papá a colegio, solo para el almuerzo.
    await a.page.goto("/ajustes");
    await a.page.getByTestId(`family-role-edit-${bId}`).click();
    await a.page
      .getByTestId(`family-person-${bId}`)
      .getByRole("radio", { name: /Colegio/ })
      .check();
    await a.page
      .getByTestId(`family-meals-${bId}`)
      .getByLabel("Almuerzo")
      .check();
    await a.page.getByTestId(`family-role-save-${bId}`).click();
    await expect(a.page.getByTestId(`family-person-${bId}`)).toContainText(
      "Colegio",
    );

    // El colegio anota su comida y solo la suya; el resto se ve, no se toca.
    await b.page.goto("/");
    await reloadUntil(b.page, async () => {
      await expect(
        mood(b.page, "Desayuno").getByRole("button", { name: "Feliz" }),
      ).toBeDisabled({ timeout: 1000 });
    });
    await expect(
      mood(b.page, "Almuerzo").getByRole("button", { name: "Feliz" }),
    ).toBeEnabled();
    await expect(
      b.page.getByRole("button", { name: "Cómo le fue con los alimentos" }),
    ).toHaveCount(1);
    await axe(b.page, "Hoy con rol de colegio: solo su comida");
    await b.page.goto("/bienestar");
    await expect(
      b.page
        .getByRole("group", { name: "Energía" })
        .getByRole("button", { name: "Con poca energía" }),
    ).toBeDisabled();
    await expect(b.page.getByText(/lo anotan otras personas/)).toBeVisible();
    await axe(b.page, "Bienestar con rol de colegio: solo lectura");

    // El servidor solo vio bytes: ningún tipo de registro ni palabra de lo anotado.
    const all = [...a.wire, ...b.wire].join("\n").toLowerCase();
    for (const secret of ["ansioso", "anxious", "moods", "habits", "well"]) {
      expect(all).not.toContain(`"${secret}"`);
    }
    expect(all).not.toContain("ansioso");
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
