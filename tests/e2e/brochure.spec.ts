import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * El brochure vivo servido en /conoce. Verifica lo que la CI SÍ puede ver:
 * la apertura por lectura (delta 1), el árbol de accesibilidad, el conteo, las rutas
 * del mapa, cero enlaces de producción — y la rama que en el piloto pasó 12 e2e y
 * Lighthouse 100 estando EN BLANCO: prefers-reduced-motion.
 */

const PASO = 150; // px por golpe de rueda

const estados = (page: Page) =>
  page
    .locator(".tarjeta-boton")
    .evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-expanded")));

const alturaY = (page: Page) => page.evaluate(() => window.pageYOffset);

/** Baja con la rueda hasta que la tarjeta `i` (0-based) se abra SOLA. */
async function bajarHastaQueAbra(page: Page, i: number) {
  const boton = page.locator(".tarjeta-boton").nth(i);
  for (let paso = 0; paso < 120; paso++) {
    if ((await boton.getAttribute("aria-expanded")) === "true") return boton;
    await page.mouse.wheel(0, PASO);
    await page.waitForTimeout(50);
  }
  throw new Error(`la tarjeta ${i + 1} nunca se abrió sola al bajar`);
}

/** Sube hasta arriba del todo, devolviendo si ALGUNA tarjeta se abrió en el camino. */
async function subirDelTodo(page: Page) {
  let abrioSubiendo = false;
  let previo = await estados(page);
  for (let paso = 0; paso < 200; paso++) {
    await page.mouse.wheel(0, -PASO);
    await page.waitForTimeout(45);
    const ahora = await estados(page);
    if (ahora.some((v, i) => previo[i] === "false" && v === "true"))
      abrioSubiendo = true;
    previo = ahora;
    if ((await alturaY(page)) === 0) break;
  }
  return abrioSubiendo;
}

/** Deja la tarjeta abierta, venga del scroll o del toque (para los tests de contenido). */
async function abrirTarjeta(page: Page, nombre: RegExp) {
  const boton = page.getByRole("button", { name: nombre });
  await boton.scrollIntoViewIfNeeded();
  // Se reintenta a propósito: leer «cerrada» y tocar no es atómico — entre una cosa y la
  // otra el automático puede abrirla y el toque la cerraría. Al primer toque la tarjeta
  // queda en manual y deja de moverse sola, así que esto converge siempre.
  for (let intento = 0; intento < 4; intento++) {
    await page.waitForTimeout(400);
    if ((await boton.getAttribute("aria-expanded")) === "true") break;
    await boton.click();
  }
  await expect(boton).toHaveAttribute("aria-expanded", "true");
  return boton;
}

test.describe("brochure /conoce", () => {
  test("carga, declara su estado inicial y, sin bajar, trae las 5 tarjetas CERRADAS", async ({
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

    // Nada se abre al cargar: el automático solo despierta cuando TÚ bajas. Esto es
    // también lo que mantiene el CLS de la carga en cero.
    const botones = page.getByRole("button", { expanded: false });
    await expect(botones).toHaveCount(5);
    await expect(
      page.getByRole("heading", { name: "El checklist del día" }),
    ).toBeHidden();
  });

  test("M1 · al bajar, la tarjeta se abre SOLA cuando llegas — y se ve abrirse", async ({
    page,
  }) => {
    await page.goto("/conoce");
    const boton = await bajarHastaQueAbra(page, 0);
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("heading", { name: "El semáforo de alimentos" }),
    ).toBeVisible();

    // Se abre DENTRO de cuadro: si el borde superior estuviera pegado al filo inferior,
    // la animación existiría sin que nadie la viera (por eso el tercio se mide contra
    // la zona de lectura y no contra el borde crudo de la pantalla).
    const caja = await page.locator(".tarjeta").first().boundingBox();
    const alto = page.viewportSize()!.height;
    expect(caja!.y).toBeLessThan(alto * 0.85);
    expect(caja!.y).toBeGreaterThan(0);
  });

  test("M1 · subiendo no se abre nada, y al volver arriba quedan cerradas otra vez", async ({
    page,
  }) => {
    await page.goto("/conoce");
    await bajarHastaQueAbra(page, 4); // baja hasta la última: quedan las 5 abiertas
    expect(await estados(page)).toEqual(Array(5).fill("true"));

    const abrioSubiendo = await subirDelTodo(page);
    expect(abrioSubiendo, "una tarjeta se abrió mientras subías").toBe(false);
    expect(await estados(page)).toEqual(Array(5).fill("false"));

    // Y al volver a bajar, se abre de nuevo: el gesto se puede repetir.
    await bajarHastaQueAbra(page, 0);
  });

  test("M1 · tu toque manda: la que cierras a mano no la vuelve a abrir el scroll", async ({
    page,
  }) => {
    await page.goto("/conoce");
    const boton = await bajarHastaQueAbra(page, 0);
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");

    await subirDelTodo(page);
    for (let paso = 0; paso < 30; paso++) {
      await page.mouse.wheel(0, PASO);
      await page.waitForTimeout(40);
    }
    await expect(
      boton,
      "el automático reabrió una tarjeta que el usuario cerró",
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("M2 · cada tarjeta trae la muestra de su pantalla, DIBUJADA (no una captura)", async ({
    page,
  }) => {
    await page.goto("/conoce");
    await expect(page.locator("figure.muestra")).toHaveCount(5);
    // Dibujos, no imágenes: por eso la pieza sigue abriendo sin internet y no puede
    // arrastrar en un píxel nada que no esté escrito aquí.
    await expect(page.locator("figure.muestra img")).toHaveCount(0);
    expect(await page.content()).not.toMatch(/data:image/i);

    const svgs = page.locator("figure.muestra > svg");
    for (let i = 0; i < 5; i++) {
      // El SVG es ilustración; el sentido lo carga el pie, en palabras.
      await expect(svgs.nth(i)).toHaveAttribute("aria-hidden", "true");
      const pie = page.locator("figure.muestra figcaption").nth(i);
      expect((await pie.textContent())!.trim().length).toBeGreaterThan(40);
    }

    // Y lo que retrata es la app de verdad, con el texto de la dieta DEMO.
    await abrirTarjeta(page, /El día de hoy/);
    await expect(
      page.locator("figure.muestra text", { hasText: "Ya hiciste 2 de 10" }),
    ).toBeVisible();
  });

  test("el toque cierra la tarjeta abierta y su detalle deja de servirse", async ({
    page,
  }) => {
    await page.goto("/conoce");
    const boton = await abrirTarjeta(page, /El día de hoy/);
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

    await abrirTarjeta(page, /El día de hoy/);
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
    await abrirTarjeta(page, /El día de hoy/);
    await abrirTarjeta(page, /¿Esto se puede\?/);
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

  test("M1 · el automático NO existe: las 5 llegan abiertas, quietas, y el toque sigue mandando", async ({
    page,
  }) => {
    await page.goto("/conoce");

    // Corte editorial: todo el contenido presente desde el primer momento, sin que
    // nada se abra ni se cierre por bajar.
    expect(await estados(page)).toEqual(Array(5).fill("true"));
    const feature = page.getByRole("heading", {
      name: "Respuesta al instante, sin internet",
    });
    await expect(feature).toBeVisible();
    expect((await feature.boundingBox())?.height).toBeGreaterThan(0);
    await expect(page.locator("figure.muestra").first()).toBeVisible();

    // Bajar no toca ninguna: el scroll no gobierna nada en esta rama.
    for (let paso = 0; paso < 12; paso++) {
      await page.mouse.wheel(0, PASO);
      await page.waitForTimeout(40);
    }
    expect(await estados(page)).toEqual(Array(5).fill("true"));

    // Y tu toque las sigue gobernando.
    const boton = page.getByRole("button", {
      name: /Pregúntale con tus palabras/,
    });
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await expect(feature).toBeHidden();
  });
});
