import { expect, test, type Page } from "@playwright/test";

import demoDiet from "../../data/demo-diet.json";

import { MON_0730, axe } from "./phones";

/**
 * El día a día (S11 · ADR-017): lonchera, recetario y modo viaje. Datos inventados (la demo del
 * repo), reloj fijo de Playwright (lunes 2026-07-06) y cada estado nuevo por axe en los dos temas
 * reales. Nada de red real: la familia no se enciende aquí.
 */

/**
 * Planes de prueba (la demo inventada, tocada): «no-fridge» sin ninguna marca de «aguanta sin
 * nevera»; «eggs-red» con los huevos en rojo (para que el recetario oculte lo que los lleva).
 */
type Plan = "no-fridge" | "eggs-red";

async function open(
  page: Page,
  path: string,
  locale: "es" | "en" = "es",
  plan?: Plan,
) {
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(
    ([loc, mode, demo]) => {
      // Solo la primera carga: las recargas del test deben ver lo que la app guardó.
      if (window.localStorage.getItem("nutrikids.prefs.v1")) return;
      window.localStorage.setItem(
        "nutrikids.prefs.v1",
        JSON.stringify({ locale: loc, disclaimerSeen: true }),
      );
      if (!mode) return;
      const diet = JSON.parse(JSON.stringify(demo));
      if (mode === "no-fridge") {
        const strip = (o: unknown) => {
          if (Array.isArray(o)) o.forEach(strip);
          else if (o && typeof o === "object") {
            delete (o as Record<string, unknown>).keepsWithoutFridge;
            Object.values(o).forEach(strip);
          }
        };
        strip(diet);
      } else {
        for (const g of diet.trafficLight.green.groups)
          g.items = g.items.filter((i: { id: string }) => i.id !== "huevos");
        diet.trafficLight.red.items.push({
          id: "huevos",
          name: { es: "Huevos", en: "Eggs" },
          why: {
            es: "Por ahora los evita el plan.",
            en: "The plan avoids them for now.",
          },
        });
      }
      window.localStorage.setItem("nutrikids.diet.v1", JSON.stringify(diet));
      window.localStorage.setItem("nutrikids.source.v1", "real");
    },
    [locale, plan ?? "", demoDiet] as const,
  );
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("Lonchera", () => {
  test("opciones del plan que aguantan sin nevera, empacar, comer, compras y etiqueta con QR de texto", async ({
    page,
  }) => {
    // Varias pasadas de axe en dos temas: en el runner de la CI no caben en los 30 s por defecto.
    test.setTimeout(90_000);
    await open(page, "/lonchera");
    await expect(
      page.getByRole("heading", { name: "Lonchera", level: 1 }),
    ).toBeVisible();

    // 1 · Solo lo que el plan marca; jamás rojo, restricción vigente ni alergia.
    const options = page.getByTestId("lunch-options");
    await expect(options).toContainText(/zanahoria/i);
    await expect(options).toContainText(/pera/i);
    await expect(options).toContainText(/kiwi/i);
    await expect(options).toContainText("Lo marca el plan");
    // Se miran los NOMBRES de las opciones (el «en vez de snacks» es de dónde viene un reemplazo).
    const names = await options
      .locator("li > div:first-child > span:first-child")
      .allInnerTexts();
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const never of [
      /snacks/i,
      /gaseosas/i,
      /dulces/i,
      /manzana/i,
      /mariscos/i,
    ])
      expect(
        names.filter((n) => never.test(n)),
        String(never),
      ).toEqual([]);
    await axe(page, "lonchera · opciones");

    // 2 · Empacar → se lo comió, con símbolo + texto; se recuerda tras recargar.
    await page.getByRole("button", { name: /Empacar .*pera/i }).click();
    // Lo empacado se suma a las compras de la semana (lo que ya se comió, no).
    await expect(page.getByTestId("lunch-shopping")).toContainText(/pera/i);
    const packed = page.getByTestId("lunch-packed");
    await expect(packed).toContainText("Empacado");
    await axe(page, "lonchera · algo empacado");
    await page.getByRole("button", { name: "Se lo comió" }).first().click();
    await expect(packed).toContainText("Se lo comió");
    await axe(page, "lonchera · algo comido");
    await page.reload();
    await expect(page.getByTestId("lunch-packed")).toContainText("Se lo comió");

    // 3 · Compras de la semana: lo que ya se comió sale de la lista.
    await expect(page.getByTestId("lunch-shopping")).toHaveCount(0);
    await expect(page.getByText(/Cuando empaques algo/)).toBeVisible();

    // 4 · Etiqueta: texto con lo que no puede comer, sin enlaces; el nombre solo si un padre lo escribe.
    const sheet = page.getByTestId("lunch-label-sheet");
    await expect(sheet).toContainText(/mariscos/i);
    await expect(sheet).toContainText(/sorbitol/i);
    await expect(sheet).not.toContainText(/https?:|www\./i);
    await page.getByLabel(/Nombre en la etiqueta/).fill("Mateo");
    await page.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(sheet).toContainText("Mateo");
    await sheet.scrollIntoViewIfNeeded();
    await expect(
      sheet.getByRole("img", { name: /Código QR con el texto/ }),
    ).toBeVisible();
    await axe(page, "lonchera · etiqueta con QR y nombre");

    // 5 · Impresión: la hoja se ve y lo demás se esconde.
    await page.emulateMedia({ media: "print" });
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("lunch-options")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Imprimir etiqueta" }),
    ).toBeHidden();
    await page.emulateMedia({ media: "screen" });
  });

  test("en inglés: la lonchera y su etiqueta salen en inglés", async ({
    page,
  }) => {
    await open(page, "/lonchera", "en");
    await expect(
      page.getByRole("heading", { name: "Lunchbox", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("lunch-options")).toContainText(/carrot/i);
    await expect(page.getByTestId("lunch-label-sheet")).toContainText(
      /shellfish/i,
    );
    await axe(page, "lunchbox · EN");
  });

  test("un plan sin marcas lo dice y manda al Perfil, sin inventar", async ({
    page,
  }) => {
    await open(page, "/lonchera", "es", "no-fridge");
    const none = page.getByTestId("lunch-no-marks");
    await expect(none).toContainText(
      "Tu plan no marca nada que aguante sin nevera",
    );
    await expect(page.getByTestId("lunch-options")).toHaveCount(0);
    await expect(
      none.getByRole("link", { name: /Ir al perfil/ }),
    ).toBeVisible();
    await axe(page, "lonchera · plan sin marcas");
  });
});

test.describe("Lonchera · tope del día", () => {
  test("con el día lleno no se puede empacar más y se dice por qué (texto y axe en los dos temas)", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      if (window.localStorage.getItem("nutrikids.daylog.v3")) return;
      const lunch: Record<string, unknown> = {};
      for (let i = 0; i < 14; i++)
        lunch[`ejemplo-${i}`] = { v: "packed", t: 1, by: "ejemplo" };
      window.localStorage.setItem(
        "nutrikids.daylog.v3",
        JSON.stringify({ "2026-07-06": { marks: {}, notes: {}, lunch } }),
      );
    });
    await open(page, "/lonchera");
    const full = page.getByTestId("lunch-full");
    await expect(full).toContainText("14 cosas anotadas");
    const pack = page
      .getByTestId("lunch-options")
      .getByRole("button", { name: /^Empacar / })
      .first();
    await expect(pack).toHaveAttribute("aria-disabled", "true");
    await pack.click({ force: true });
    // Nada cambió: sigue sin estado «Empacado» en esa fila y el botón sigue ahí.
    await expect(pack).toBeVisible();
    await expect(
      page.getByTestId("lunch-options").getByText("Empacado"),
    ).toHaveCount(0);
    await axe(page, "lonchera · día lleno");
  });
});

test.describe("Recetas", () => {
  test("revisadas contra el plan: ocultas con su causa, abrir una, filtros, despensa y recetas propias", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, "/recetas", "es", "eggs-red");
    await expect(
      page.getByRole("heading", { name: "Recetas", level: 1 }),
    ).toBeVisible();

    // 1 · El recetario revisado: hay recetas y cada una lleva su estado con símbolo + texto.
    const list = page.getByTestId("recipe-list");
    await expect(list.getByRole("listitem").first()).toBeVisible();
    await expect(list).toContainText(
      /Con lo de tu plan|Con medida|no está en tu plan/i,
    );
    await axe(page, "recetas · lista");

    // 2 · Lo que el plan evita no aparece, y se dice por qué.
    await page
      .getByRole("button", { name: "Ver por qué algunas no se muestran" })
      .click();
    const hidden = page.getByTestId("recipe-hidden");
    await expect(hidden).toContainText(/huevos.*tu plan lo evita/i);
    await axe(page, "recetas · las que no se muestran");

    // 3 · Abrir una: ingredientes y pasos (cargan al abrir).
    const first = list.getByRole("listitem").first();
    await first.getByRole("button", { name: "Ver receta" }).click();
    await expect(
      first.getByRole("heading", { name: "Ingredientes" }),
    ).toBeVisible();
    await expect(first.getByRole("heading", { name: "Pasos" })).toBeVisible();
    await axe(page, "recetas · una receta abierta");
    await first.getByRole("button", { name: "Cerrar" }).click();

    // 4 · Filtro de tiempo: solo las rápidas.
    const before = await list.getByRole("listitem").count();
    await page
      .getByRole("group", { name: "Tiempo" })
      .getByRole("button", { name: "Rápidas" })
      .click();
    await expect(
      page
        .getByRole("group", { name: "Tiempo" })
        .getByRole("button", { name: "Rápidas" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await list.getByRole("listitem").count()).toBeLessThanOrEqual(
      before,
    );
    await axe(page, "recetas · filtro rápidas");

    // 5 · Con lo que tengo: marcar y ver qué sale; se recuerda tras recargar.
    await page
      .getByRole("button", { name: "¿Qué cocino con lo que tengo?" })
      .click();
    const pantry = page.getByTestId("pantry");
    await pantry.getByRole("button", { name: /^pollo$/i }).click();
    await pantry.getByRole("button", { name: /^arroz$/i }).click();
    await expect(
      page
        .getByText(
          /Puedes hacerlas ya|Con un reemplazo de tu plan|Casi: te falta poco/,
        )
        .first(),
    ).toBeVisible();
    await axe(page, "recetas · con lo que tengo");
    await page.reload();
    await page
      .getByRole("button", { name: "¿Qué cocino con lo que tengo?" })
      .click();
    await expect(
      page.getByTestId("pantry").getByRole("button", { name: /^pollo$/i }),
    ).toHaveAttribute("aria-pressed", "true");

    // 6 · Receta propia: se revisa contra el plan; lo que el plan evita se dice, no se esconde.
    await page.getByLabel("Nombre de la receta").fill("Mi merienda de prueba");
    await page
      .getByLabel("Ingredientes (uno por línea)")
      .fill("Snacks de paquete\nZanahoria");
    await page.getByRole("button", { name: "Guardar receta" }).click();
    const own = page.getByTestId("own-list");
    await expect(own).toContainText("Mi merienda de prueba");
    await expect(own).toContainText(/tu plan evita/i);
    await axe(page, "recetas · una receta propia que el plan evita");

    // 7 · Sin nombre ni ingredientes no guarda y avisa.
    await page.getByRole("button", { name: "Guardar receta" }).click();
    await expect(
      page.getByText(/Falta el nombre o al menos un ingrediente/),
    ).toBeVisible();
    await axe(page, "recetas · aviso de receta propia incompleta");
  });

  test("en inglés: las recetas salen en inglés", async ({ page }) => {
    await open(page, "/recetas", "en");
    await expect(
      page.getByRole("heading", { name: "Recipes", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("recipe-list")).toContainText(/Quick|min/);
    await axe(page, "recipes · EN");
  });
});

test.describe("Modo viaje", () => {
  test("lista para llevar desde el plan, día de viaje y documento ES+EN sin salir del teléfono", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, "/viaje");
    await expect(
      page.getByRole("heading", { name: "Modo viaje", level: 1 }),
    ).toBeVisible();

    // Lo que sale de la red desde aquí: nada (el documento se arma en el teléfono).
    const origin = new URL(page.url()).origin;
    const outgoing: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(origin) || url.includes("/api/")) outgoing.push(url);
    });

    // 1 · Checklist desde el plan: comida que aguanta, suplementos, lo que no puede.
    const checklist = page.getByTestId("travel-checklist");
    await expect(checklist).toBeVisible();
    await expect(checklist).toContainText(/zanahoria|pera|kiwi/i);
    await axe(page, "viaje · checklist");

    // 2 · Marcar lo guardado: símbolo + texto y se recuerda tras recargar.
    const box = checklist.getByRole("checkbox").first();
    await box.check();
    await expect(box).toBeChecked();
    await axe(page, "viaje · algo marcado");
    await page.reload();
    await expect(
      page.getByTestId("travel-checklist").getByRole("checkbox").first(),
    ).toBeChecked();

    // 3 · Carretera o avión: cambia el texto del día de viaje; las franjas son las del plan.
    const modes = page.getByRole("group", { name: "¿Cómo viajan?" });
    await modes.getByRole("button", { name: "Avión" }).click();
    await expect(modes.getByRole("button", { name: "Avión" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText(/En avión: ten a mano/)).toBeVisible();
    await expect(page.getByTestId("travel-slots")).toBeVisible();
    await axe(page, "viaje · avión");

    // 4 · El documento: dos idiomas, con el aviso de datos de salud, sin enlaces ni peticiones.
    const doc = page.getByTestId("travel-doc");
    await expect(doc).toContainText("Ficha de alimentación para viaje");
    await expect(doc).toContainText("Food sheet for travel");
    await expect(doc).toContainText(/mariscos/i);
    await expect(doc).toContainText(/shellfish/i);
    await expect(doc).not.toContainText(/https?:|www\./i);
    await expect(page.getByTestId("travel-doc-privacy")).toContainText(
      "datos de salud",
    );
    await axe(page, "viaje · documento");

    // 5 · Impresión: solo la hoja.
    await page.emulateMedia({ media: "print" });
    await expect(doc).toBeVisible();
    await expect(page.getByTestId("travel-checklist")).toBeHidden();
    await page.emulateMedia({ media: "screen" });

    expect(outgoing, "nada del viaje sale del teléfono").toEqual([]);
  });

  test("en inglés: el modo viaje sale en inglés", async ({ page }) => {
    await open(page, "/viaje", "en");
    await expect(
      page.getByRole("heading", { name: "Travel mode", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("travel-doc")).toContainText(
      "Food sheet for travel",
    );
    await axe(page, "travel · EN");
  });
});

test("Hoy enseña los tres accesos y llegan a sus pantallas", async ({
  page,
}) => {
  await open(page, "/");
  const nav = page.getByRole("navigation", { name: "Para el día a día" });
  await expect(nav).toBeVisible();
  // El rótulo de la fila se VE (la guía y el manual lo nombran): no es solo un aria-label.
  await expect(
    nav.getByText("Para el día a día", { exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: /Lonchera/ }).click();
  await expect(page).toHaveURL(/\/lonchera$/);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Para el día a día" })
    .getByRole("link", { name: /Recetas/ })
    .click();
  await expect(page).toHaveURL(/\/recetas$/);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Para el día a día" })
    .getByRole("link", { name: /viaje/i })
    .click();
  await expect(page).toHaveURL(/\/viaje$/);
});
