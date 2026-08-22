import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * El brochure vivo servido en /conoce. Verifica lo que la CI SÍ puede ver:
 * progressive disclosure real, el árbol de accesibilidad, el conteo, las rutas del
 * mapa, cero enlaces de producción — y la rama que en el piloto pasó 12 e2e y
 * Lighthouse 100 estando EN BLANCO: prefers-reduced-motion.
 */

test.describe("brochure /conoce", () => {
  test("carga, declara su estado inicial y trae las 5 tarjetas CERRADAS", async ({
    page,
  }) => {
    const respuesta = await page.goto("/conoce");
    expect(respuesta?.status()).toBe(200);

    await expect(
      page.getByRole("heading", {
        name: "La dieta de tu peque, viva en tu bolsillo.",
      }),
    ).toBeVisible();
    await expect(page.locator("p.sello")).toHaveText("Brochure inicial");

    // Progressive disclosure: nada de capa 2 visible sin abrir su tarjeta.
    const botones = page.getByRole("button", { expanded: false });
    await expect(botones).toHaveCount(5);
    await expect(
      page.getByRole("heading", { name: "El checklist del día" }),
    ).toBeHidden();
  });

  test("el toque abre la tarjeta y sirve su detalle; volver a tocarla la cierra", async ({
    page,
  }) => {
    await page.goto("/conoce");
    const boton = page.getByRole("button", { name: /El día de hoy/ });

    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("heading", { name: "El checklist del día" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "El recordatorio «Ahora mismo»" }),
    ).toBeVisible();

    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("heading", { name: "El checklist del día" }),
    ).toBeHidden();
  });

  test("lo cerrado queda FUERA del árbol de accesibilidad (no basta con ocultarlo)", async ({
    page,
  }) => {
    await page.goto("/conoce");
    // `grid-template-rows: 0fr` engaña al ojo pero un lector de pantalla recitaría
    // TODO el detalle cerrado; axe no lo ve. Se mira el árbol real.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Accessibility.enable");
    const arbol = async () =>
      JSON.stringify(await cdp.send("Accessibility.getFullAXTree"));

    expect(await arbol()).not.toContain("El checklist del día");

    await page.getByRole("button", { name: /El día de hoy/ }).click();
    await expect(
      page.getByRole("heading", { name: "El checklist del día" }),
    ).toBeVisible();
    expect(await arbol()).toContain("El checklist del día");
  });

  test("el pie declara las 19 funcionalidades y el clímax es texto visible", async ({
    page,
  }) => {
    await page.goto("/conoce");

    // El clímax es una escena propia, jamás un acordeón del pie.
    await expect(
      page.getByRole("heading", { name: "Aquí nadie califica a tu hijo" }),
    ).toBeVisible();
    await expect(page.getByText(/Marcar el día no es un examen/)).toBeVisible();

    await expect(page.locator("#conteo-cifra")).toHaveText("19");
    await expect(page.locator(".feature")).toHaveCount(19);
  });

  test("todas las rutas del mapa existen de verdad", async ({
    page,
    request,
  }) => {
    await page.goto("/conoce");
    const rutas = await page
      .locator(".rutas a")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(rutas.length).toBeGreaterThanOrEqual(7);
    for (const ruta of rutas) {
      const r = await request.get(ruta!);
      expect(r.status(), `la ruta ${ruta} del mapa no existe`).toBe(200);
    }
  });

  test("cero enlaces de producción en la pieza servida (regla 17)", async ({
    page,
  }) => {
    await page.goto("/conoce");
    const html = await page.content();
    expect(html).not.toMatch(/vercel\.app|workers\.dev/i);
  });

  test("axe limpio, con el detalle abierto", async ({ page }) => {
    await page.goto("/conoce");
    // Las entradas se desvanecen: axe debe medir el estado ASENTADO, no un frame
    // intermedio (a media animación el contraste calculado es el del fundido).
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /El día de hoy/ }).click();
    await page.getByRole("button", { name: /¿Esto se puede\?/ }).click();
    await page.waitForTimeout(700);
    await page
      .locator("details.fino")
      .first()
      .evaluate((d) => d.setAttribute("open", ""));
    const resultados = await new AxeBuilder({ page }).analyze();
    expect(resultados.violations).toEqual([]);
  });
});

/**
 * La rama que ningún gate automático miraba en el piloto. No basta con que "no se
 * mueva": se AFIRMA visibilidad real (opacidad y tamaño) de los elementos clave de
 * cada escena — un hero con opacity:0 pasa cualquier test que solo mire el DOM.
 */
test.describe("brochure con prefers-reduced-motion", () => {
  // `emulateMedia` explícito ANTES de navegar: en esta versión `test.use({reducedMotion})`
  // dentro de un describe no llegaba al contexto y los tests medían la rama equivocada
  // (lo cazó el guard de abajo, no la CI).
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("la experiencia alterna está COMPLETA: todo visible, cero movimiento", async ({
    page,
  }) => {
    await page.goto("/conoce");

    // Guarda del propio test: si la emulación dejara de aplicarse, este test pasaría
    // a medir la rama equivocada en silencio. Se afirma que la rama es la correcta.
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
      "la emulación de reduced-motion no está activa",
    ).toBe(true);

    const clave = [
      "h1", // portada (candidato LCP)
      "#t-quehace", // capa 1
      "#t-semaforo", // E05
      "#t-garantia", // E06
      "#t-climax", // E07 · el clímax
      "#marcador-cifra", // el número del clímax
      "#conteo-cifra", // el conteo del pie
    ];

    for (const sel of clave) {
      const el = page.locator(sel);
      await expect(el, `${sel} no está visible`).toBeVisible();
      const caja = await el.boundingBox();
      expect(caja?.width, `${sel} tiene ancho 0`).toBeGreaterThan(0);
      expect(caja?.height, `${sel} tiene alto 0`).toBeGreaterThan(0);
      const opacidad = await el.evaluate((n) =>
        Number(getComputedStyle(n as Element).opacity),
      );
      expect(
        opacidad,
        `${sel} es invisible (opacity ${opacidad})`,
      ).toBeGreaterThan(0.9);
    }

    // Los números llegan en su valor final: no se cuentan solos.
    await expect(page.locator("#marcador-cifra")).toHaveText("7");
    await expect(page.locator("#conteo-cifra")).toHaveText("19");

    // Los iconos de trazo están dibujados enteros (no a medio dibujar).
    const sinDibujar = await page
      .locator(".icono svg .trazable")
      .evaluateAll(
        (els) =>
          els.filter((e) => Number(getComputedStyle(e).strokeDashoffset) > 0)
            .length,
      );
    expect(sinDibujar).toBe(0);

    // El «%» del clímax sencillamente no existe bajo reduced-motion.
    const fantasma = await page
      .locator(".fantasma span")
      .evaluate((n) => Number(getComputedStyle(n as Element).opacity));
    expect(fantasma).toBe(0);
  });

  test("las tarjetas siguen abriendo (sin transición) con su contenido completo", async ({
    page,
  }) => {
    await page.goto("/conoce");
    await page
      .getByRole("button", { name: /Pregúntale con tus palabras/ })
      .click();
    const feature = page.getByRole("heading", {
      name: "Respuesta al instante, sin internet",
    });
    await expect(feature).toBeVisible();
    const caja = await feature.boundingBox();
    expect(caja?.height).toBeGreaterThan(0);
  });
});
