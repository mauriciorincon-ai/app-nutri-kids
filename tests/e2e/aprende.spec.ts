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
 * Lo que aprende (S15 · ADR-021): adherencia en palabras, lo que se repite, el día de hoy y qué
 * preparar, y lo que va aprendiendo la app. Días INVENTADOS sobre la demo del repo, reloj fijo
 * (lunes 6 de julio, 07:30) y, para la familia, el doble del almacén. Cada estado nuevo pasa por
 * axe en los dos temas reales.
 */

const DAY_MS = 24 * 3600 * 1000;
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * `count` días anotados que terminan ayer. Cada día marca todo lo del plan; en dos de cada tres
 * la merienda se queda sin marcar («algo distinto al plan»). Marcar de más no estorba: solo
 * cuenta lo que el plan espera.
 */
function seededLog(count: number) {
  const ids = [
    "meal:desayuno",
    "meal:media-manana",
    "meal:almuerzo",
    "meal:merienda",
    "meal:cena",
    "supplement:multivitaminico-demo",
    "supplement:omega-demo",
  ];
  const log: Record<string, unknown> = {};
  for (let i = 1; i <= count; i++) {
    const marks: Record<string, unknown> = {};
    for (const id of ids)
      if (!(id === "meal:merienda" && i % 3 !== 0))
        marks[id] = { t: 1, by: "ejemplo", v: { at: "12:00" } };
    log[key(new Date(MON_0730.getTime() - i * DAY_MS))] = { marks, notes: {} };
  }
  return log;
}

async function seed(page: Page, count: number) {
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(
    ([log]) => {
      window.localStorage.setItem(
        "nutrikids.prefs.v1",
        JSON.stringify({ locale: "es", disclaimerSeen: true }),
      );
      if (window.localStorage.getItem("nutrikids.daylog.v3")) return;
      window.localStorage.setItem("nutrikids.daylog.v3", JSON.stringify(log));
    },
    [seededLog(count)],
  );
}

test("con tres semanas anotadas: la semana en palabras, el calendario, lo que se repite y el gemelo con su borrado", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seed(page, 21);
  await page.goto("/aprende");
  await expect(
    page.getByRole("heading", { level: 1, name: "Lo que aprende" }),
  ).toBeVisible();

  // 1 · Adherencia en palabras y conteos: jamás un porcentaje.
  await expect(page.getByTestId("learn-week-line")).toContainText(
    "2 de 6 días anotados dentro del plan",
  );
  await expect(page.getByTestId("learn-week-line")).toContainText(
    "1 sin anotar",
  );
  await expect(page.getByTestId("learn-prev")).toContainText(
    "La semana pasada: 2 de 7 días anotados dentro del plan.",
  );
  await expect(page.getByTestId("learn-hardest")).toContainText(
    /Lo que más cuesta: .+ \(14 de 21 días anotados\)/,
  );
  await expect(page.getByTestId("learn-today")).toContainText("Hoy van");
  await expect(page.locator("main")).not.toContainText("%");

  // 2 · El calendario de cuatro semanas: cada cuadro con símbolo, texto accesible y color.
  const cal = page.getByTestId("learn-calendar");
  await expect(cal.getByTestId("cal-in").first()).toBeVisible();
  await expect(cal.getByTestId("cal-off").first()).toBeVisible();
  await expect(cal.getByTestId("cal-off").first().locator("svg")).toBeVisible();
  await expect(page.getByTestId("learn-calendar-legend")).toContainText(
    "sin anotar",
  );

  // 3 · Lo que se repite: con su conteo, sin causa y sin tocar el plan.
  const radar = page.getByTestId("learn-radar");
  await expect(radar.getByTestId("pattern-slot")).toContainText(
    "14 de 21 días anotados",
  );
  await expect(radar).toContainText("Nada de esto cambia el plan");
  await expect(page.getByTestId("learn-radar-quiet")).toHaveCount(0);

  // 4 · El gemelo: con 21 días anotados ya opina; sin IA y sin salir del teléfono.
  const tw = page.getByTestId("learn-twin");
  await expect(tw).toContainText("Todo pasa en este teléfono");
  await expect(page.getByTestId("twin-learning")).toHaveCount(0);
  await axe(page, "Lo que aprende con tres semanas anotadas");

  // 5 · Borrar lo aprendido: dos pasos, vuelve a cero y no toca lo anotado.
  await page.getByTestId("twin-erase").click();
  await expect(page.getByTestId("twin-erase-ask")).toBeVisible();
  await axe(page, "Lo que aprende, preguntando si borrar");
  await page.getByTestId("twin-erase-yes").click();
  await expect(page.getByTestId("twin-erased")).toBeVisible();
  await expect(page.getByTestId("twin-learning")).toContainText(
    "Aún aprendiendo (0 de 14 días)",
  );
  await expect(page.getByTestId("learn-week-line")).toContainText(
    "2 de 6 días anotados dentro del plan",
  );
  await axe(page, "Lo que aprende tras borrar lo aprendido");
});

test("con pocos días: el radar calla y dice cuántos faltan; el gemelo sigue aprendiendo", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seed(page, 3);
  await page.goto("/aprende");
  await expect(page.getByTestId("learn-radar-quiet")).toContainText(
    "hacen falta 7 días anotados; van 3",
  );
  await expect(page.locator('[data-testid^="pattern-"]')).toHaveCount(0);
  await expect(page.getByTestId("twin-learning")).toContainText(
    "Aún aprendiendo (3 de 14 días)",
  );
  await axe(page, "Lo que aprende con pocos días: radar y gemelo callan");
});

test("el día de hoy: el nivel sube y baja con cada contexto, explica por qué y dice qué preparar", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "es", disclaimerSeen: true }),
    );
  });
  await page.goto("/");
  const card = page.getByTestId("day-card");
  const level = page.getByTestId("day-level");
  await expect(level).toHaveText("Mochila ligera");
  await expect(page.getByTestId("day-why")).toContainText(
    "No hay nada fuera de lo de siempre.",
  );
  await expect(page.getByTestId("day-legend")).toContainText(
    "Mochila con algo más",
  );
  await axe(page, "Hoy con la mochila ligera");

  // Un contexto: la mochila lleva algo más, dice por qué y enlaza lo que ya existe.
  await page.getByTestId("ctx-social").click();
  await expect(page.getByTestId("ctx-social")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("ctx-social")).toContainText("Anotado");
  await expect(level).toHaveText("Mochila con algo más");
  await expect(card).toHaveAttribute("data-level", "mid");
  await expect(page.getByTestId("day-why")).toContainText(
    "Hay un evento con más gente.",
  );
  const prepare = page.getByTestId("day-prepare");
  await expect(prepare.getByRole("link").first()).toBeVisible();
  await axe(page, "Hoy con un evento: mochila con algo más");

  // Dos contextos: mochila llena, y los dos motivos a la vista.
  await page.getByTestId("ctx-away").click();
  await expect(level).toHaveText("Mochila llena");
  await expect(card).toHaveAttribute("data-level", "high");
  await expect(page.getByTestId("day-why")).toContainText("fuera de casa");
  await axe(page, "Hoy con dos contextos: mochila llena");

  // Quitar uno baja un nivel; quitar los dos vuelve a la mochila ligera.
  await page.getByTestId("ctx-social").click();
  await expect(level).toHaveText("Mochila con algo más");
  await page.getByTestId("ctx-away").click();
  await expect(level).toHaveText("Mochila ligera");
  await expect(page.getByTestId("day-prepare")).toHaveCount(0);

  // Sin alarma: el nivel nunca usa el rojo de los alimentos.
  await expect(card).not.toContainText(/alerta|urgente|peligro|riesgo/i);
});

test("dos teléfonos: el padre ve lo que aprende; el cuidador ve el día de hoy, lo anota y no ve lo aprendido", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const a = await phone(browser, baseURL!);
  const b = await phone(browser, baseURL!);
  try {
    const secrets = await createFamily(a, MAMA);
    await finishSecrets(a.page);
    await joinFamily(b, secrets, PAPA);

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

    // La madre abre «Lo que aprende» desde Hoy.
    await a.page.goto("/");
    await expect(
      a.page.getByRole("link", { name: "Lo que aprende" }),
    ).toBeVisible();
    await a.page.goto("/aprende");
    await expect(a.page.getByTestId("learn-week")).toBeVisible();
    await expect(a.page.getByTestId("learn-role-limit")).toHaveCount(0);
    await axe(a.page, "Lo que aprende en el teléfono de la madre");

    // El cuidador ve el día de hoy y puede anotar el contexto; «Lo que aprende» no es suyo.
    await b.page.goto("/");
    await expect(b.page.getByTestId("day-card")).toBeVisible();
    await expect(b.page.getByTestId("ctx-social")).toBeEnabled();
    await expect(
      b.page.getByRole("link", { name: "Lo que aprende" }),
    ).toHaveCount(0);
    await b.page.getByTestId("ctx-social").click();
    await expect(b.page.getByTestId("day-level")).toHaveText(
      "Mochila con algo más",
    );
    // Sin lo aprendido: ni el ajuste del gemelo ni su explicación.
    await expect(b.page.locator('[data-testid^="day-adjusted-"]')).toHaveCount(
      0,
    );
    await axe(b.page, "Hoy del cuidador con el día de hoy");
    await b.page.goto("/aprende");
    await expect(b.page.getByTestId("learn-role-limit")).toContainText(
      "Esta pantalla es para madre o padre",
    );
    await expect(b.page.getByTestId("learn-week")).toHaveCount(0);
    await axe(b.page, "Lo que aprende con rol de cuidador: el límite");

    // Lo que el cuidador anotó llega a la madre, que ve el mismo nivel.
    await a.page.goto("/");
    await reloadUntil(a.page, async () => {
      await expect(a.page.getByTestId("ctx-social")).toHaveAttribute(
        "aria-pressed",
        "true",
        { timeout: 1000 },
      );
    });
    await expect(a.page.getByTestId("day-level")).toHaveText(
      "Mochila con algo más",
    );

    // El servidor solo vio bytes: ni el contexto del día ni su nombre viajan en claro.
    const all = [...a.wire, ...b.wire].join("\n").toLowerCase();
    for (const secret of ['"ctx"', '"social"', "mochila"])
      expect(all).not.toContain(secret);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
