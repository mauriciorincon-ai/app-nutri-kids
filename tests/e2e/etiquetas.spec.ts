import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request,
} from "@playwright/test";

import { MON_0730, axe } from "./phones";

/**
 * La etiqueta y el súper (S13 · ADR-019). Ni el lector de texto ni el escáner REALES corren aquí:
 * `context.route` sirve un `/ocr/tesseract.min.js` y un `/scan/scan-worker.js` simulados que contestan
 * con listas fijas, y el catálogo es un fixture INVENTADO (nada de Open Food Facts ni de una familia).
 * Reloj fijo (lunes 2026-07-06 07:30), la dieta demo del repo, cada estado nuevo por axe en los dos
 * temas reales y la promesa de privacidad medida con la red: antes del toque, 0 peticiones al lector
 * y al catálogo; tras el toque, solo GET a la app; al leer y al escanear, 0.
 */

test.use({ serviceWorkers: "block" });

// Un PNG de 1×1: lo único que hace falta es que `createImageBitmap` lo decodifique.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// Códigos inventados con su dígito de control GTIN válido.
const NO_VA = "7702000000013"; // lleva el aditivo E999 del plan
const APTO = "7702000000020"; // misma categoría, nada que choque
const REVISA = "7702000000037"; // lleva banano (amarillo en el plan)
const SIN_LISTA = "7702000000044"; // el catálogo no trae sus ingredientes
const TRAZAS = "7702000000051"; // trazas de camarón (alergia del plan)
const AUSENTE = "7702000000068"; // válido, pero no está en el catálogo
const MAL_DIGITO = "7702000000010"; // el dígito de control no cuadra

const CATALOG = {
  generated: "2026-11-01",
  license: "ODbL-1.0",
  source: "fixture inventado de la prueba",
  products: [
    {
      code: NO_VA,
      name: "Galletas Sol de ejemplo",
      brand: "Sol",
      cat: ["Snacks", "Galletas"],
      ing: "Harina de trigo, azúcar, sal, colorante E-999",
      add: ["E999"],
      alg: [],
      tr: [],
    },
    {
      code: APTO,
      name: "Galletas Luna de ejemplo",
      brand: "Luna",
      cat: ["Snacks", "Galletas"],
      ing: "Harina de arroz, agua, aceite de girasol, sal marina",
      add: [],
      alg: [],
      tr: [],
    },
    {
      code: REVISA,
      name: "Avena Alba de ejemplo",
      brand: "Alba",
      cat: ["Cereales", "Avena"],
      ing: "Avena, banano, agua, canela",
      add: [],
      alg: [],
      tr: [],
    },
    {
      code: SIN_LISTA,
      name: "Crema sin lista de ejemplo",
      brand: "Nube",
      cat: ["Untables"],
      ing: "",
      add: [],
      alg: [],
      tr: [],
    },
    {
      code: TRAZAS,
      name: "Arroz Mar de ejemplo",
      brand: "Mar",
      cat: ["Granos", "Arroz"],
      ing: "Arroz, agua, sal. Puede contener trazas de camarón.",
      add: [],
      alg: [],
      tr: [],
    },
  ],
};

type Seen = { url: string; method: string; body: string | null };

/** Toda petición que sale (página y workers), para probar qué viaja y cuándo. */
function watch(context: BrowserContext, origin: string) {
  const log: Seen[] = [];
  context.on("request", (r: Request) =>
    log.push({ url: r.url(), method: r.method(), body: r.postData() }),
  );
  return {
    log,
    mark: () => log.length,
    since: (i: number) => log.slice(i),
    external: (list: Seen[]) =>
      list.filter(
        (r) =>
          !r.url.startsWith(origin) &&
          !r.url.startsWith("data:") &&
          !r.url.startsWith("blob:"),
      ),
  };
}

const isReaderUrl = (u: string) =>
  /\/(ocr|scan|catalogo)\//.test(new URL(u).pathname);

/** El lector simulado: lo que `/ocr/tesseract.min.js` dejaría en `window.Tesseract`, con lecturas fijas. */
async function fakeReader(
  context: BrowserContext,
  reads: { text: string; confidence: number }[],
) {
  // Todo lo demás de `/ocr/` (worker, núcleo, idiomas) son bytes sin sentido: el lector falso no los usa.
  await context.route("**/ocr/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      body: "x",
    }),
  );
  const body = `
    (function () {
      var reads = ${JSON.stringify(reads)};
      var n = 0;
      window.Tesseract = {
        createWorker: async function () {
          return {
            recognize: async function () {
              if (window.__ocrGate) await window.__ocrGate;
              var r = reads[n++ % reads.length];
              return { data: { text: r.text, confidence: r.confidence } };
            },
            terminate: async function () {},
          };
        },
      };
    })();`;
  await context.route("**/ocr/tesseract.min.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body }),
  );
}

/** El worker del súper simulado: mismo protocolo que `scripts/scan-worker.template.js`, con el catálogo del fixture. */
async function fakeScanner(context: BrowserContext) {
  await context.route("**/scan/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      body: "x",
    }),
  );
  const body = `
    const PRODUCTS = ${JSON.stringify(CATALOG.products)};
    const META = ${JSON.stringify({ generated: CATALOG.generated, license: CATALOG.license, source: CATALOG.source, count: CATALOG.products.length })};
    self.onmessage = (e) => {
      const { id, op } = e.data || {};
      const ok = (result) => self.postMessage({ id, ok: true, result });
      if (op === "load") ok(META);
      else if (op === "lookup") ok(PRODUCTS.find((p) => p.code === e.data.code) || null);
      else if (op === "sameCategory")
        ok(PRODUCTS.filter((p) => p.ing && p.cat.includes(e.data.category)).slice(0, e.data.limit || 100));
      else self.postMessage({ id, ok: false, error: "unknown" });
    };`;
  await context.route("**/scan/scan-worker.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body }),
  );
  await context.route("**/catalogo/off-co.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(CATALOG),
    }),
  );
}

async function open(
  page: Page,
  path: string,
  opts: { codes?: string[]; bought?: unknown[] } = {},
) {
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(
    ([cfg]) => {
      if (!window.localStorage.getItem("nutrikids.prefs.v1"))
        window.localStorage.setItem(
          "nutrikids.prefs.v1",
          JSON.stringify({ locale: "es", disclaimerSeen: true }),
        );
      if (
        cfg.bought.length &&
        !window.localStorage.getItem("nutrikids.bought.v1")
      )
        window.localStorage.setItem(
          "nutrikids.bought.v1",
          JSON.stringify(cfg.bought),
        );
      if (cfg.codes.length) {
        // El detector del navegador, simulado: lee de una cola de códigos, sin tocar la foto.
        const queue = [...cfg.codes];
        (window as unknown as Record<string, unknown>).BarcodeDetector = class {
          static async getSupportedFormats() {
            return ["ean_13", "ean_8", "upc_a"];
          }
          async detect() {
            const v = queue.shift();
            return v ? [{ rawValue: v, format: "ean_13" }] : [];
          }
        };
      }
    },
    [{ codes: opts.codes ?? [], bought: opts.bought ?? [] }] as const,
  );
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const labelPhoto = (page: Page) =>
  page.getByTestId("label-pick").setInputFiles({
    name: "etiqueta.png",
    mimeType: "image/png",
    buffer: PNG,
  });
const superPhoto = (page: Page) =>
  page
    .getByTestId("super-pick")
    .setInputFiles({ name: "codigo.png", mimeType: "image/png", buffer: PNG });

test.describe("Leer una etiqueta", () => {
  test("el lector se baja solo tras el toque, y leer no usa la red; cada veredicto dice por qué", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const ctx = page.context();
    await fakeReader(ctx, [
      {
        text: "INGREDIENTES: harina de trigo, azúcar, sal, colorante E-999. Puede contener trazas de camarón.",
        confidence: 91,
      },
      { text: "Ingredientes: agua, avena, banano, canela", confidence: 90 },
      {
        text: "Ingredientes: arroz, agua, aceite de girasol, sal marina",
        confidence: 93,
      },
      { text: "xq z7 ## ~~ ;;", confidence: 31 },
    ]);
    const net = watch(ctx, baseURL!);
    await open(page, "/camara/etiqueta");

    // ── Antes del toque: la pantalla dice qué pasa y NADA toca el lector ni a un tercero.
    await expect(
      page.getByRole("heading", { name: "Leer una etiqueta", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Descargar el lector" }),
    ).toBeVisible();
    expect(net.log.filter((r) => isReaderUrl(r.url))).toEqual([]);
    expect(net.external(net.log)).toEqual([]);
    await axe(page, "etiqueta · antes de descargar");

    // ── El toque: solo GET a la app, sin cuerpo.
    const tap = net.mark();
    await page.getByRole("button", { name: "Descargar el lector" }).click();
    await expect(page.getByTestId("label-ready")).toBeVisible();
    const tapped = net.since(tap);
    expect(tapped.filter((r) => isReaderUrl(r.url)).length).toBeGreaterThan(0);
    for (const r of tapped) {
      expect(r.method, r.url).toBe("GET");
      expect(r.body, r.url).toBeNull();
    }
    expect(net.external(tapped)).toEqual([]);
    await axe(page, "etiqueta · lista");

    // ── Leyendo: 0 peticiones, y el estado «Leyendo…» pasa por axe.
    await page.waitForLoadState("networkidle");
    const before = net.mark();
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__ocrGate = new Promise(
        (r) => {
          (window as unknown as Record<string, unknown>).__ocrRelease = r;
        },
      );
    });
    await labelPhoto(page);
    await expect(page.getByRole("status")).toContainText("Leyendo la etiqueta");
    await axe(page, "etiqueta · leyendo");
    await page.evaluate(() =>
      (window as unknown as Record<string, () => void>).__ocrRelease(),
    );

    // ── 1. No va: aditivo del plan escrito como «E-999» y trazas de una alergia.
    const result = page.getByTestId("label-result");
    await expect(result).toHaveAttribute("data-verdict", "no");
    await expect(result).toContainText("No va");
    await expect(result).toContainText(/E-?999/);
    await expect(result).toContainText(/camar|marisco/i);
    await expect(page.getByTestId("label-result-text")).toContainText(
      "colorante E-999",
    );
    await expect(result).toContainText("Verifícalo con un adulto");
    await axe(page, "etiqueta · no va");

    // ── 2. Revisa: el banano es amarillo en el plan.
    await page
      .getByRole("button", { name: "Leer otra etiqueta" })
      .click()
      .catch(() => undefined);
    await labelPhoto(page);
    await expect(result).toHaveAttribute("data-verdict", "check");
    await expect(result).toContainText("Revisa");
    await expect(result).toContainText("Verifícalo con un adulto");
    await axe(page, "etiqueta · revisa");

    // ── 3. No vi nada que choque: solo con una lectura limpia.
    await labelPhoto(page);
    await expect(result).toHaveAttribute("data-verdict", "ok");
    await expect(result).toContainText("No vi nada que choque");
    await expect(page.getByTestId("label-result-text")).toContainText(
      "aceite de girasol",
    );
    await axe(page, "etiqueta · no vi nada que choque");

    // ── 4. Un texto mal leído JAMÁS da «apto»: «No pude leerla».
    await labelPhoto(page);
    await expect(result).toHaveAttribute("data-verdict", "unreadable");
    await expect(result).toContainText("No pude leerla");
    await expect(result).not.toContainText("No vi nada que choque");
    await axe(page, "etiqueta · no pude leerla");

    // ── Durante toda la lectura: ni una petición del lector, ni con cuerpo, ni externa.
    const during = net.since(before);
    expect(during.filter((r) => isReaderUrl(r.url))).toEqual([]);
    expect(during.filter((r) => r.body)).toEqual([]);
    expect(net.external(during)).toEqual([]);
    // La foto no se guarda en el formulario.
    expect(
      await page
        .getByTestId("label-pick")
        .evaluate((el: HTMLInputElement) => el.files?.length ?? 0),
    ).toBe(0);
  });
});

test.describe("El modo súper", () => {
  test("el catálogo se baja solo tras el toque; escanear no usa la red; marcas aptas, no está y lo que compré", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const ctx = page.context();
    await fakeScanner(ctx);
    const net = watch(ctx, baseURL!);
    await open(page, "/camara/super", {
      codes: [NO_VA, SIN_LISTA, TRAZAS, REVISA, AUSENTE],
    });

    // ── Antes del toque: el catálogo no se pide y nada sale.
    await expect(
      page.getByRole("heading", { name: "Modo súper", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Descargar el catálogo" }),
    ).toBeVisible();
    await expect(page.getByTestId("super-odbl")).toContainText(
      "Open Food Facts",
    );
    expect(net.log.filter((r) => isReaderUrl(r.url))).toEqual([]);
    expect(net.external(net.log)).toEqual([]);
    await axe(page, "súper · antes de descargar");

    // ── El toque: solo GET a la app.
    const tap = net.mark();
    await page.getByRole("button", { name: "Descargar el catálogo" }).click();
    await expect(page.getByTestId("super-ready")).toBeVisible();
    const tapped = net.since(tap);
    expect(
      tapped.filter((r) => r.url.includes("/catalogo/off-co.json")).length,
    ).toBeGreaterThan(0);
    for (const r of tapped) {
      expect(r.method, r.url).toBe("GET");
      expect(r.body, r.url).toBeNull();
    }
    expect(net.external(tapped)).toEqual([]);
    await expect(page.getByText(/Catálogo del .*: 5 productos/)).toBeVisible();
    await axe(page, "súper · listo");

    // ── Escanear: de aquí en adelante, 0 peticiones.
    await page.waitForLoadState("networkidle");
    const before = net.mark();

    // 1. No va, con las marcas aptas de su categoría.
    await superPhoto(page);
    await expect(page.getByTestId("super-product")).toContainText(
      "Galletas Sol de ejemplo",
    );
    const result = page.getByTestId("super-result");
    await expect(result).toHaveAttribute("data-verdict", "no");
    await expect(result).toContainText(/E-?999/);
    const apt = page.getByTestId("super-apt");
    await expect(apt).toContainText("Marcas que sí van con tu plan");
    await expect(page.getByTestId("super-apt-item")).toHaveCount(1);
    await expect(apt).toContainText("Galletas Luna de ejemplo");
    // Un producto que no va jamás sale entre los aptos.
    await expect(apt).not.toContainText("Galletas Sol de ejemplo");
    await axe(page, "súper · no va con marcas aptas");

    // Lo anoto: queda en «lo que compré» con su aviso calmado.
    await page.getByTestId("super-add").click();
    await expect(page.getByTestId("super-add")).toBeDisabled();
    const boughtNo = page.getByTestId(`bought-${NO_VA}`);
    await expect(boughtNo).toHaveAttribute("data-verdict", "no");
    await expect(boughtNo).toContainText(
      "Esto que compraste no va con tu plan",
    );
    await expect(boughtNo).toContainText("Verifícalo con un adulto");
    await axe(page, "súper · lo que compré con su aviso");

    // 2. «No sé qué lleva»: el catálogo no trae la lista; manda a la foto de la etiqueta.
    await superPhoto(page);
    await expect(page.getByTestId("super-result")).toHaveAttribute(
      "data-verdict",
      "unreadable",
    );
    await expect(page.getByTestId("super-result")).toContainText(
      /no sé qué lleva/i,
    );
    await expect(page.getByTestId("super-to-label")).toBeVisible();
    await axe(page, "súper · no sé qué lleva");

    // 3. Trazas de una alergia del plan: no va.
    await superPhoto(page);
    await expect(page.getByTestId("super-result")).toHaveAttribute(
      "data-verdict",
      "no",
    );
    await expect(page.getByTestId("super-result")).toContainText(
      /camar|marisco/i,
    );

    // 4. Revisa.
    await superPhoto(page);
    await expect(page.getByTestId("super-result")).toHaveAttribute(
      "data-verdict",
      "check",
    );
    await axe(page, "súper · revisa");

    // 5. Un código válido que el catálogo no tiene: lleva a la foto de la etiqueta.
    await superPhoto(page);
    const notFound = page.getByTestId("super-notfound");
    await expect(notFound).toContainText(
      "Este producto no está en el catálogo",
    );
    await expect(page.getByTestId("super-to-label")).toBeVisible();
    await axe(page, "súper · no está en el catálogo");

    // 6. Escribir el código: uno mal escrito se rechaza, uno bueno se busca.
    const code = page.getByTestId("super-code");
    await code.fill("12345");
    await page.getByTestId("super-code-go").click();
    await expect(page.getByTestId("super-bad-code")).toContainText(
      "8, 12 o 13 números",
    );
    await code.fill(MAL_DIGITO);
    await page.getByTestId("super-code-go").click();
    await expect(page.getByTestId("super-bad-code")).toContainText(
      "no es válido",
    );
    await axe(page, "súper · código mal escrito");
    await code.fill(APTO);
    await page.getByTestId("super-code-go").click();
    await expect(page.getByTestId("super-result")).toHaveAttribute(
      "data-verdict",
      "ok",
    );
    await expect(page.getByTestId("super-result")).toContainText(
      "No vi nada que choque",
    );
    await expect(page.getByTestId("super-result")).toContainText(
      "Verifícalo con un adulto",
    );
    await axe(page, "súper · no vi nada que choque");

    // ── Escanear y buscar: ni una petición del lector, del catálogo ni de un tercero, y ninguna con cuerpo.
    const during = net.since(before);
    expect(during.filter((r) => isReaderUrl(r.url))).toEqual([]);
    expect(during.filter((r) => r.body)).toEqual([]);
    expect(net.external(during)).toEqual([]);

    // Lo que compré: solo el código, el nombre, la marca y la fecha; jamás el veredicto.
    const stored = JSON.parse(
      (await page.evaluate(() => localStorage.getItem("nutrikids.bought.v1")))!,
    );
    expect(stored).toEqual([
      {
        code: NO_VA,
        name: "Galletas Sol de ejemplo",
        brand: "Sol",
        date: "2026-07-06",
      },
    ]);
  });

  test("lo que compré se revisa de nuevo con el plan de hoy, y sin catálogo lo dice", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    await fakeScanner(ctx);
    const net = watch(ctx, baseURL!);
    await open(page, "/camara/super", {
      bought: [
        {
          code: NO_VA,
          name: "Galletas Sol de ejemplo",
          brand: "Sol",
          date: "2026-07-01",
        },
        {
          code: APTO,
          name: "Galletas Luna de ejemplo",
          brand: "Luna",
          date: "2026-07-02",
        },
      ],
    });
    // Sin catálogo preparado: la lista se ve y dice qué falta, sin avisar de nada falso.
    const list = page.getByTestId("bought");
    await expect(list).toContainText("Galletas Sol de ejemplo");
    await expect(list).toContainText("Prepara el catálogo");
    await axe(page, "súper · lo que compré sin catálogo");
    expect(net.log.filter((r) => isReaderUrl(r.url))).toEqual([]);

    await page.getByRole("button", { name: "Descargar el catálogo" }).click();
    await expect(page.getByTestId("super-ready")).toBeVisible();
    await expect(page.getByTestId(`bought-${NO_VA}`)).toHaveAttribute(
      "data-verdict",
      "no",
    );
    await expect(page.getByTestId(`bought-${NO_VA}`)).toContainText(
      "Esto que compraste no va con tu plan",
    );
    await expect(page.getByTestId(`bought-${APTO}`)).toHaveAttribute(
      "data-verdict",
      "ok",
    );
    await axe(page, "súper · lo que compré revisado");

    // Quitar uno: sale de la lista y del teléfono.
    await page
      .getByRole("button", { name: "Quitar Galletas Sol de ejemplo" })
      .click();
    await expect(page.getByTestId(`bought-${NO_VA}`)).toHaveCount(0);
    const stored = JSON.parse(
      (await page.evaluate(() => localStorage.getItem("nutrikids.bought.v1")))!,
    );
    expect(stored.map((p: { code: string }) => p.code)).toEqual([APTO]);
  });
});

test.describe("Ajustes: lector y catálogo", () => {
  test("mide lo guardado, lo borra sin tocar lo que compré, y trae la atribución ODbL", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const ctx = page.context();
    await fakeReader(ctx, [
      { text: "Ingredientes: agua, sal", confidence: 90 },
    ]);
    await fakeScanner(ctx);
    const net = watch(ctx, baseURL!);
    await open(page, "/ajustes", {
      bought: [
        {
          code: APTO,
          name: "Galletas Luna de ejemplo",
          brand: "Luna",
          date: "2026-07-02",
        },
      ],
    });

    // Sin nada descargado: lo dice y la sección no pidió nada.
    const section = page.getByTestId("settings-reader");
    await expect(section).toContainText(
      "No hay ni lector ni catálogo guardados",
    );
    await expect(page.getByTestId("settings-odbl")).toContainText(
      "Open Food Facts, bajo la licencia ODbL",
    );
    expect(net.log.filter((r) => isReaderUrl(r.url))).toEqual([]);
    await axe(page, "ajustes · sin lector ni catálogo");

    // Lo que el service worker guardaría tras las descargas (aquí el SW está bloqueado): se siembra a mano.
    await page.evaluate(async () => {
      const big = () => new Response(new Uint8Array(3_000_000));
      await (
        await caches.open("nutrikids-ocr-prueba")
      ).put("/ocr/worker.min.js", big());
      await (
        await caches.open("nutrikids-scan-prueba")
      ).put("/scan/scan-worker.js", big());
      await (
        await caches.open("nutrikids-catalog-prueba")
      ).put("/catalogo/off-co.json", big());
    });
    await page.reload();
    await expect(section).toContainText(/Ocupan unos \d+ MB en este teléfono/);
    await axe(page, "ajustes · con lector y catálogo");

    // Borrar: sin tocar el plan ni lo que compré.
    await page
      .getByRole("button", { name: "Borrar el lector y el catálogo" })
      .click();
    // Pide confirmación: «Cancelar» no borra nada.
    await expect(section).toContainText(
      "Tu plan, tu registro y lo que compraste se quedan",
    );
    await axe(page, "ajustes · confirmar borrado");
    await section.getByRole("button", { name: "Cancelar" }).click();
    await expect(section).toContainText(/Ocupan unos \d+ MB en este teléfono/);
    expect(
      await page.evaluate(async () =>
        (await caches.keys()).filter((k) =>
          /^nutrikids-(ocr|scan|catalog)-/.test(k),
        ),
      ),
    ).toHaveLength(3);
    await page
      .getByRole("button", { name: "Borrar el lector y el catálogo" })
      .click();
    await section.getByRole("button", { name: "Sí, borrar" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Lector y catálogo borrados." }),
    ).toBeVisible();
    await expect(section).toContainText(
      "No hay ni lector ni catálogo guardados",
    );
    await axe(page, "ajustes · borrado");
    expect(
      await page.evaluate(async () =>
        (await caches.keys()).filter((k) =>
          /^nutrikids-(ocr|scan|catalog)-/.test(k),
        ),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.getItem("nutrikids.bought.v1")),
    ).toContain(APTO);
  });
});
