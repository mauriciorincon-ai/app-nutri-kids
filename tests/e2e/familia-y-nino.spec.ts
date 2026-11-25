import { expect, test, type Page } from "@playwright/test";

import {
  MAMA,
  MON_0730,
  axe,
  createFamily,
  finishSecrets,
  joinFamily,
  phone,
  reloadUntil,
} from "./phones";

/**
 * «Familia y niño» (S14 · ADR-020): las lecciones y «Qué sí y qué no», el registro de presión con
 * dos teléfonos (madre ve todo, cuidador solo lo suyo, G-Plan 1a) y la aventura del niño con su
 * modo niño y la salida del adulto (G-Plan 2a). Datos inventados (la demo del repo), reloj fijo
 * y, para la familia, el doble del almacén. Cada estado nuevo pasa por axe en los dos temas.
 */

async function open(page: Page) {
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: "es", disclaimerSeen: true }),
    );
  });
}

const group = (page: Page, name: string) => page.getByRole("group", { name });

/** Anota una oferta: el primer alimento de la lista, el lugar y la respuesta que se pidan. */
async function note(page: Page, place: string, answer: string) {
  const form = page.getByTestId("pressure-form");
  const choose = async (name: string, option: string | null) => {
    const row = group(page, name);
    const button = option
      ? row.getByRole("button", { name: option })
      : row.getByRole("button").first();
    // Lo elegido queda marcado entre anotaciones: tocarlo otra vez lo quitaría.
    if ((await button.getAttribute("aria-pressed")) !== "true")
      await button.click();
  };
  await choose("¿Qué le ofrecieron?", null);
  await choose("¿Dónde fue?", place);
  await choose("¿Cómo se respondió?", answer);
  await form.getByTestId("pressure-save").click();
  await expect(page.getByTestId("pressure-strategy")).toBeVisible();
}

const WORDS = [
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];

/** Lee la suma del diálogo del adulto (escrita en palabras) y devuelve su resultado. */
async function solve(page: Page) {
  const text = await page
    .getByTestId("adult-exit-dialog")
    .getByText(/Cuánto es/)
    .innerText();
  const [a, b] = [...text.matchAll(/es (\S+) más (\S+)\?/g)]
    .flatMap((m) => [m[1], m[2]])
    .map((w) => WORDS.indexOf(w) + 6);
  return String(a + b);
}

/** Mantiene pulsada la salida del adulto los dos segundos que pide. */
async function holdExit(page: Page) {
  const button = page.getByTestId("adult-exit");
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(2100);
}

const energy = async (page: Page) =>
  Number(
    await page.getByTestId("adventure-energy").getAttribute("data-energy"),
  );

test("las lecciones, «Qué sí y qué no» y el camino desde Hoy", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await open(page);

  await page.goto("/");
  const links = page.getByTestId("family-links");
  // Tres de la familia y el niño (S14) y «Lo que aprende» (S15, solo madre o padre: aquí, sin familia).
  await expect(links.getByRole("link")).toHaveCount(4);
  await expect(links.getByRole("link").last()).toContainText("Lo que aprende");
  await axe(page, "Hoy con «Para la familia»");
  await links.getByRole("link").first().click();
  await page.waitForURL("**/familia");

  const lessons = page.getByTestId("family-lessons");
  await expect(lessons.locator("details")).toHaveCount(5);
  await axe(page, "familia · lecciones cerradas");
  await page.getByTestId("lesson-not-a-prize").locator("summary").click();
  await expect(page.getByTestId("lesson-not-a-prize")).toContainText(
    "De dónde sale",
  );
  await axe(page, "familia · una lección abierta");

  // «Qué sí y qué no»: todo sale del plan, sin cifras.
  await expect(page.getByTestId("yes-no-no")).toBeVisible();
  await expect(page.getByTestId("yes-no-yes")).toBeVisible();
  // Sin cantidades: las únicas cifras son los códigos de aditivos que trae el plan (E999).
  const sheet = await page.getByTestId("family-yes-no").innerText();
  expect(sheet.replace(/\bE\d+\b/g, "")).not.toMatch(/\d/);
  await expect(page.getByTestId("yes-no-ask")).toContainText(
    "Pregúntale a quien lo cuida",
  );
});

test("un teléfono: anotar, la estrategia del lugar y lo que se repite", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await open(page);
  await page.goto("/familia/presion");
  await axe(page, "presión · vacía");

  // Sin elegir todo, no guarda y lo dice.
  await page.getByTestId("pressure-save").click();
  await expect(page.getByText("Elige qué le ofrecieron")).toBeVisible();

  await note(page, "En una fiesta", "Con un «no, gracias» tranquilo");
  await expect(page.getByTestId("pressure-strategy")).toContainText(
    "Para la próxima vez",
  );
  await expect(page.getByTestId("pressure-safe")).toBeVisible();
  await axe(page, "presión · estrategia");
  // Con una sola no hay patrón que nombrar.
  await expect(page.getByTestId("pressure-pattern")).toContainText(
    "Este mes nada se repite",
  );

  await note(page, "En una fiesta", "Se cambió por algo de su plan");
  await expect(page.getByTestId("pressure-pattern")).toContainText(
    "2 veces este mes",
  );
  await expect(page.getByTestId("pressure-list").locator("li")).toHaveCount(2);
  await axe(page, "presión · lo que se repite");

  // Quitar lo propio.
  await page
    .getByTestId("pressure-list")
    .getByRole("button", { name: /^Quitar/ })
    .first()
    .click();
  await expect(page.getByTestId("pressure-list").locator("li")).toHaveCount(1);
});

test("dos teléfonos: la madre ve todo y el patrón; el cuidador solo lo suyo (1a)", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const a = await phone(browser, baseURL!);
  const b = await phone(browser, baseURL!);

  const secrets = await createFamily(a, MAMA);
  await finishSecrets(a.page);
  await joinFamily(b, secrets);
  await expect(b.page.getByTestId("family-no-role")).toBeVisible({
    timeout: 15_000,
  });
  const bId = await b.page.evaluate(
    () => JSON.parse(localStorage.getItem("nutrikids.device.v1")!).id as string,
  );
  await a.page.goto("/ajustes");
  await reloadUntil(a.page, async () => {
    await expect(a.page.getByTestId(`family-confirm-${bId}`)).toBeVisible({
      timeout: 1000,
    });
  });
  await a.page.getByTestId(`family-confirm-${bId}`).click();
  // La confirmación firma el roster en segundo plano: sin esperarla, salir de la pantalla la corta.
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

  // La madre anota en el colegio; el cuidador, en una fiesta.
  await a.page.goto("/familia/presion");
  await note(a.page, "En el colegio", "Con un «no, gracias» tranquilo");
  await b.page.goto("/familia/presion");
  await note(b.page, "En una fiesta", "Con un «no, gracias» tranquilo");

  // La madre recibe lo del cuidador, con el patrón.
  await reloadUntil(a.page, async () => {
    await expect(a.page.getByTestId("pressure-list")).toContainText(
      "En una fiesta",
      { timeout: 1000 },
    );
  });
  await expect(a.page.getByTestId("pressure-list")).toContainText(
    "En el colegio",
  );
  await expect(a.page.getByTestId("pressure-pattern")).toBeVisible();
  await axe(a.page, "presión · madre ve todo");

  // El cuidador solo ve lo de su teléfono, y lo dice; ni lista ajena ni patrón.
  for (let i = 0; i < 3; i += 1) {
    await b.page.reload();
    await b.page.waitForTimeout(700);
  }
  await expect(b.page.getByTestId("pressure-list")).toContainText(
    "En una fiesta",
  );
  await expect(b.page.getByTestId("pressure-list")).not.toContainText(
    "En el colegio",
  );
  await expect(b.page.getByTestId("pressure-list")).toContainText(
    "Ves lo que anotó este teléfono",
  );
  await expect(b.page.getByTestId("pressure-pattern")).toHaveCount(0);
  await axe(b.page, "presión · cuidador ve lo suyo");

  // Nada de lo anotado viaja en claro.
  const wire = [...a.wire, ...b.wire].join("\n");
  expect(wire).not.toContain("En el colegio");
  expect(wire).not.toContain("calm-no");
});

test("la aventura: la energía sube con un hábito y con probar, no con comer; el niño elige su mundo; el modo niño no sale sin el adulto", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await open(page);

  await page.goto("/aventura");
  await expect(page.getByTestId("adventure")).toBeVisible();
  expect(await energy(page)).toBe(0);
  await axe(page, "aventura · día vacío");

  // Un hábito (sueño) sube la energía una vez.
  await page.goto("/perfil");
  await page
    .getByTestId("age-picker")
    .getByRole("button", { name: "3–4 años" })
    .click();
  await page.goto("/bienestar");
  const sleep = page.getByTestId("habit-sleep");
  await sleep.getByLabel(/Sueño de 24 h \(con siestas\) · Minutos/).fill("660");
  await sleep.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("habit-status-sleep")).toBeVisible();
  await page.goto("/aventura");
  await expect.poll(() => energy(page)).toBe(1);
  await expect(page.getByTestId("tile-sleep")).toHaveAttribute(
    "data-done",
    "true",
  );

  // Comer, aceptar o rechazar no la mueve.
  await page.goto("/");
  await page
    .getByRole("button", { name: "Cómo le fue con los alimentos" })
    .first()
    .click();
  const log = page.getByRole("group", {
    name: "Cómo le fue con los alimentos",
  });
  await log.getByLabel("¿Con qué alimento?").selectOption({ index: 1 });
  await log.getByRole("button", { name: "Lo aceptó", exact: true }).click();
  await log.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(log.getByTestId("food-entries")).toBeVisible();
  await page.goto("/aventura");
  expect(await energy(page)).toBe(1);

  // Un alimento nuevo, mirado o probado, sí cuenta como exploración.
  await page.goto("/");
  await page
    .getByRole("button", { name: "Cómo le fue con los alimentos" })
    .first()
    .click();
  const log2 = page.getByRole("group", {
    name: "Cómo le fue con los alimentos",
  });
  await log2.getByLabel("¿Con qué alimento?").selectOption({ index: 2 });
  await log2.getByRole("button", { name: "Lo miró" }).click();
  await log2.getByRole("checkbox", { name: "Es un alimento nuevo" }).check();
  await log2.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(log2.getByTestId("food-entries")).toBeVisible();
  await page.goto("/aventura");
  await expect.poll(() => energy(page)).toBe(2);

  // El niño elige su mundo; la energía es la misma.
  const world = page.getByTestId("adventure");
  await expect(world).toHaveAttribute("data-world", "brote");
  await page.getByTestId("world-lumo").click();
  await expect(world).toHaveAttribute("data-world", "lumo");
  await expect(page.getByTestId("world-lumo")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await energy(page)).toBe(2);
  await axe(page, "aventura · Lumo");
  await page.getByTestId("world-nubo").click();
  await expect(world).toHaveAttribute("data-world", "nubo");
  expect(await energy(page)).toBe(2);
  await axe(page, "aventura · Nubo");

  // La cocina es lo único que toca el niño: una vez por día.
  await page.getByTestId("tile-kitchen").getByRole("button").click();
  await expect(page.getByTestId("tile-kitchen")).toHaveAttribute(
    "data-done",
    "true",
  );
  expect(await energy(page)).toBe(3);
  await expect(
    page.getByTestId("tile-kitchen").getByRole("button"),
  ).toHaveCount(0);

  // Modo niño: lo enciende un adulto; sin plan, sin Ajustes y sin salida fácil.
  await expect(page.getByTestId("adventure-adult")).toBeVisible();
  await page.getByTestId("kid-mode-on").click();
  await expect(world).toHaveAttribute("data-kid-mode", "on");
  await expect(page.getByTestId("adventure-adult")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await axe(page, "aventura · modo niño");

  // Ni escribiendo otra ruta ni con Atrás se sale.
  await page.goto("/ajustes");
  await page.waitForURL("**/aventura");
  await page.goto("/dieta");
  await page.waitForURL("**/aventura");
  await page.goBack();
  await page.waitForURL("**/aventura");
  await expect(world).toHaveAttribute("data-kid-mode", "on");

  // Un toque suelto no abre nada; con la pulsación larga, la suma mal escrita tampoco sale.
  await page.getByTestId("adult-exit").click();
  await expect(page.getByTestId("adult-exit-dialog")).toHaveCount(0);
  await holdExit(page);
  await expect(page.getByTestId("adult-exit-dialog")).toBeVisible();
  await axe(page, "aventura · salida del adulto");
  await page.getByTestId("adult-exit-input").fill("1");
  await page.getByTestId("adult-exit-confirm").click();
  await expect(page.getByTestId("adult-exit-dialog")).toBeVisible();
  await page.waitForURL("**/aventura");

  // La suma bien resuelta devuelve el teléfono al adulto, y la energía sigue donde estaba.
  await page.getByTestId("adult-exit-input").fill(await solve(page));
  await page.getByTestId("adult-exit-confirm").click();
  await expect(world).toHaveAttribute("data-kid-mode", "off");
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/aventura");
  expect(await energy(page)).toBe(3);
});
