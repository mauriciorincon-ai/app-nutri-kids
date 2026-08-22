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

/**
 * Baja como baja una persona —ráfaga y pausa— hasta que la tarjeta `i` (0-based) se abra
 * SOLA. La pausa no es decorativa: la tarjeta se abre al detenerte, que es lo único que
 * hace la apertura perceptible (bajando, compite con el movimiento de la página).
 */
async function bajarHastaQueAbra(page: Page, i: number) {
  const boton = page.locator(".tarjeta-boton").nth(i);
  for (let ronda = 0; ronda < 40; ronda++) {
    if ((await boton.getAttribute("aria-expanded")) === "true") return boton;
    for (let paso = 0; paso < 4; paso++) {
      await page.mouse.wheel(0, PASO);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(320); // te detienes a mirar
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

    // La apertura dura lo suficiente para leerse como apertura: con 0.45s se confundía
    // con el propio scroll. Es parte del contrato, no un detalle de estilo.
    const duracion = await page
      .locator(".detalle")
      .first()
      .evaluate((n) => getComputedStyle(n as Element).transitionDuration);
    expect(parseFloat(duracion)).toBeGreaterThanOrEqual(0.6);

    const boton = await bajarHastaQueAbra(page, 0);
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("heading", { name: "El semáforo de alimentos" }),
    ).toBeVisible();

    // Se abre DELANTE DE LOS OJOS: la cabecera cruzó la línea de los dos tercios, así que
    // queda un tercio de pantalla por debajo — el hueco donde se la ve crecer.
    const caja = await page.locator(".tarjeta").first().boundingBox();
    const alto = page.viewportSize()!.height;
    expect(
      caja!.y,
      "la tarjeta se abre demasiado abajo: la apertura ocurre fuera de la vista",
    ).toBeLessThanOrEqual(alto * 0.7);
    expect(
      caja!.y,
      "la tarjeta se abre por encima del filo superior: nadie la ve abrirse",
    ).toBeGreaterThanOrEqual(0);
  });

  test("M1 · la línea de los dos tercios: al 95% y al 80% NO abre; al 60% sí (Velo)", async ({
    page,
  }) => {
    await page.goto("/conoce");
    await page.waitForTimeout(900);

    // Posiciona la cabecera de la primera tarjeta a un % exacto de la altura de pantalla.
    // En dos tiempos (lección de Velo): primero acercarse y dejar que la coreografía de
    // entrada se asiente (su translateY de 18px hace mentir a la caja), luego re-medir y
    // colocar EXACTO — llegando siempre desde arriba, porque abrir exige ir bajando.
    const cabeceraAl = async (pct: number) => {
      for (const ajuste of [60, 0]) {
        await page.evaluate(
          ([p, extra]) => {
            const t = document.querySelector(".tarjeta")!;
            const objetivo =
              t.getBoundingClientRect().top +
              window.scrollY -
              window.innerHeight * p;
            window.scrollTo({
              top: Math.max(0, Math.round(objetivo - extra)),
              left: 0,
              behavior: "instant",
            });
          },
          [pct, ajuste] as const,
        );
        await page.waitForTimeout(ajuste ? 700 : 300);
      }
    };

    const boton = page.locator(".tarjeta-boton").first();
    await cabeceraAl(0.95);
    await expect(boton, "abrió asomando por el borde inferior").toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await cabeceraAl(0.8);
    await expect(boton, "abrió antes de cruzar la línea").toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await cabeceraAl(0.6);
    await expect(boton, "no abrió tras cruzar la línea").toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("M1 · abre en cuanto cruza la línea, AÚN SIN DETENERTE (bajada continua)", async ({
    page,
  }) => {
    await page.goto("/conoce");
    await page.waitForTimeout(900);
    const alto = page.viewportSize()!.height;

    // Bajada continua, sin una sola pausa de lectura: el despliegue no puede depender del
    // reposo (el modelo anterior abría solo al detenerse o en un tick periódico, y las
    // aperturas caían en posiciones arbitrarias — el usuario: «no se percibe»).
    const aperturas = new Map<number, number>();
    let previos = Array(5).fill("false");
    for (let i = 0; i < 170 && aperturas.size < 5; i++) {
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(40);
      const ahora = await estados(page);
      for (let k = 0; k < 5; k++) {
        if (previos[k] === "false" && ahora[k] === "true") {
          const caja = await page.locator(".tarjeta").nth(k).boundingBox();
          aperturas.set(k, caja!.y / alto);
        }
      }
      previos = ahora;
    }
    expect([...aperturas.keys()].sort(), "no abrieron las cinco").toEqual([
      0, 1, 2, 3, 4,
    ]);
    for (const [k, pos] of aperturas) {
      expect(
        pos,
        `T${k + 1} abrió al ${Math.round(pos * 100)}% — lejos de la línea de los dos tercios`,
      ).toBeLessThanOrEqual(0.68);
      expect(pos, `T${k + 1} abrió demasiado arriba`).toBeGreaterThanOrEqual(
        0.45,
      );
    }
  });

  test("M1 · la que quedó atrás bajando ya está recogida (bottom <= 0 ⇒ cerrada)", async ({
    page,
  }) => {
    await page.goto("/conoce");
    await page.waitForTimeout(900);

    const violaciones: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() =>
        window.scrollBy({
          top: Math.round(window.innerHeight * 0.55),
          left: 0,
          behavior: "instant",
        }),
      );
      await page.waitForTimeout(150);
      const malas = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".tarjeta"))
          .map((t, k) => ({
            k,
            fuera: t.getBoundingClientRect().bottom <= 0,
            abierta: t.hasAttribute("data-abierta"),
          }))
          .filter((x) => x.fuera && x.abierta)
          .map((x) => `T${x.k + 1}`),
      );
      violaciones.push(...malas);
      const alFinal = await page.evaluate(
        () =>
          window.pageYOffset + window.innerHeight >=
          document.documentElement.scrollHeight - 4,
      );
      if (alFinal) break;
    }
    expect(
      violaciones,
      "tarjetas que saliste de largo y siguen abiertas",
    ).toEqual([]);
  });

  test("M1 · bajar y subir no mueven ni un renglón de lo visible (sin deriva)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/conoce");
    await page.waitForTimeout(900);

    // Conduce con scrollBy({behavior:"instant"}) — un test que conduce con scrollBy a
    // secas se ANIMA por el scroll-behavior:smooth de la página y mide defectos que ningún
    // dedo puede producir (lección de Velo). Se mide una cabecera VISIBLE, jamás scrollY:
    // el guion ajusta scrollY a propósito al reponer un cierre. Guarda de quietud: se mide
    // tras asentarse las transiciones (una tarjeta a medio desplegarse se mueve por diseño).
    const derivaTrasAsentarse = async () =>
      page.evaluate(async () => {
        let ancla: Element | null = null;
        for (const e of document.querySelectorAll("h2, h3, .feature h4, p")) {
          const r = e.getBoundingClientRect();
          if (r.top > 60 && r.bottom < innerHeight - 60) {
            ancla = e;
            break;
          }
        }
        if (!ancla) return 0;
        const antes = ancla.getBoundingClientRect().top;
        await new Promise((res) => setTimeout(res, 400));
        return ancla.getBoundingClientRect().top - antes;
      });

    const pasoInstant = (px: number) =>
      page.evaluate(
        (d) => window.scrollBy({ top: d, left: 0, behavior: "instant" }),
        px,
      );

    for (let i = 0; i < 12; i++) {
      await pasoInstant(900);
      await page.waitForTimeout(800); // aperturas (0.62s) asentadas
      const deriva = await derivaTrasAsentarse();
      expect(
        Math.abs(deriva),
        `bajando, la página se movió sola ${deriva.toFixed(1)}px`,
      ).toBeLessThanOrEqual(1);
      const alFinal = await page.evaluate(
        () =>
          window.pageYOffset + window.innerHeight >=
          document.documentElement.scrollHeight - 4,
      );
      if (alFinal) break;
    }
    for (let i = 0; i < 14; i++) {
      await pasoInstant(-900);
      await page.waitForTimeout(800);
      const deriva = await derivaTrasAsentarse();
      expect(
        Math.abs(deriva),
        `subiendo, la página se movió sola ${deriva.toFixed(1)}px`,
      ).toBeLessThanOrEqual(1);
      if ((await page.evaluate(() => window.pageYOffset)) === 0) break;
    }
  });

  test("M1 · el ciclo completo: se abre al llegar, se cierra al salir de pantalla, subiendo no abre nada, y al bajar otra vez se despliega", async ({
    page,
  }) => {
    await page.goto("/conoce");

    // Bajando: las CINCO se abren, cada una cuando llegas a ella.
    const abiertasAlgunaVez = new Set<number>();
    for (let ronda = 0; ronda < 45; ronda++) {
      for (let paso = 0; paso < 4; paso++) {
        await page.mouse.wheel(0, PASO);
        await page.waitForTimeout(30);
      }
      await page.waitForTimeout(320);
      (await estados(page)).forEach((v, i) => {
        if (v === "true") abiertasAlgunaVez.add(i);
      });
      const alFinal = await page.evaluate(
        () =>
          window.pageYOffset + window.innerHeight >=
          document.documentElement.scrollHeight - 4,
      );
      if (alFinal) break;
    }
    expect(
      [...abiertasAlgunaVez].sort(),
      "alguna tarjeta nunca se abrió sola al bajar",
    ).toEqual([0, 1, 2, 3, 4]);

    // Y cada una se cerró sola al salir de pantalla: al final no queda ninguna abierta.
    expect(await estados(page)).toEqual(Array(5).fill("false"));

    const abrioSubiendo = await subirDelTodo(page);
    expect(abrioSubiendo, "una tarjeta se abrió mientras subías").toBe(false);
    expect(await estados(page)).toEqual(Array(5).fill("false"));

    // Y al volver a bajar, se despliega de nuevo: el gesto se puede repetir.
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

  test("M1 · la tarjeta sigue abriéndose al llegar, pero SIN transición", async ({
    page,
  }) => {
    await page.goto("/conoce");

    // Mismo mecanismo, misma información: lo que desaparece es la animación. Se probó
    // entregarlas todas abiertas y era peor — un muro de texto donde nadie ve nunca una
    // tarjeta abrirse.
    expect(await estados(page)).toEqual(Array(5).fill("false"));

    const duracion = await page
      .locator(".detalle")
      .first()
      .evaluate((n) => getComputedStyle(n as Element).transitionDuration);
    expect(duracion, "la apertura sigue animándose con reduced-motion").toBe(
      "0s",
    );

    const boton = await bajarHastaQueAbra(page, 0);
    await expect(
      page.getByRole("heading", { name: "El semáforo de alimentos" }),
    ).toBeVisible();
    await expect(page.locator("figure.muestra").first()).toBeVisible();

    // Y tu toque la sigue gobernando.
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
  });
});
