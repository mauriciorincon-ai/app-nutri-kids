import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request,
} from "@playwright/test";

import demoDiet from "../../data/demo-diet.json";
import model from "../../src/lib/camera/model.json";

import { MON_0730, axe } from "./phones";

/**
 * La cámara (S12 · ADR-018). El worker REAL jamás corre aquí: `context.route("**\/ia/vision-worker.js")`
 * sirve uno simulado que contesta con listas fijas, y los pesos «del Hub» los sirve la propia prueba.
 * Reloj fijo (lunes 2026-07-06 07:30), datos inventados (la demo del repo), cada estado nuevo por axe
 * en los dos temas reales y la promesa de privacidad medida con la red: antes del toque, 0 peticiones
 * al modelo o a terceros; tras el toque, solo `/ia/` y el Hub; durante el análisis, 0.
 */

test.use({ serviceWorkers: "block" });

// Un PNG de 1×1: lo único que hace falta es que `createImageBitmap` lo decodifique.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const HUB = "https://huggingface.co";
const HUB_FILE = `${HUB}/${model.id}/resolve/${model.revision}/onnx/decoder_model_merged_q4.onnx`;

type Fake = {
  /** Lo que el modelo «dice», una entrada por foto (da la vuelta). */
  texts?: string[];
  webgpu?: boolean;
  wasm?: boolean;
  failLoad?: boolean;
  failAnalyze?: boolean;
};

/** El worker simulado: mismo protocolo que `scripts/vision-worker.template.js`, sin modelo. */
async function fakeWorker(context: BrowserContext, f: Fake = {}) {
  const body = `
    const CFG = ${JSON.stringify({
      texts: f.texts ?? ["chicken, carrot, tomato, ginger"],
      webgpu: f.webgpu ?? true,
      wasm: f.wasm ?? true,
      failLoad: !!f.failLoad,
      failAnalyze: !!f.failAnalyze,
      hub: HUB_FILE,
    })};
    let n = 0;
    self.onmessage = async (e) => {
      const m = e.data || {};
      if (m.type === "probe") {
        self.postMessage({ type: "probe", webgpu: CFG.webgpu, wasm: CFG.wasm });
      } else if (m.type === "load") {
        if (CFG.failLoad) { self.postMessage({ type: "error", code: "load-failed" }); return; }
        self.postMessage({ type: "progress", file: "decoder.onnx", loaded: 60e6, total: 179e6 });
        try { await fetch(CFG.hub); } catch {}
        self.postMessage({ type: "progress", file: "decoder.onnx", loaded: 179e6, total: 179e6 });
        self.postMessage({ type: "ready", engine: m.engine, ms: 1200, runtimeBytes: 0 });
      } else if (m.type === "analyze") {
        await new Promise((r) => setTimeout(r, 150));
        if (CFG.failAnalyze) { self.postMessage({ type: "error", id: m.id, code: "analyze-failed" }); return; }
        self.postMessage({ type: "result", id: m.id, text: CFG.texts[n++ % CFG.texts.length], ms: 900 });
      }
    };`;
  await context.route("**/ia/vision-worker.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body }),
  );
}

/** El «Hub» de la prueba: sirve unos bytes y, si se pide, se queda esperando a que la prueba lo suelte. */
async function fakeHub(context: BrowserContext, hold = false) {
  let release: () => void = () => undefined;
  const gate = hold
    ? new Promise<void>((r) => {
        release = r;
      })
    : Promise.resolve();
  await context.route(`${HUB}/**`, async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      headers: { "access-control-allow-origin": "*" },
      body: "weights",
    });
  });
  return release;
}

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

type Plan = "eggs-red";

async function open(
  page: Page,
  opts: {
    plan?: Plan;
    notes?: { kind: string; text: string }[];
    pantry?: string[];
    noWorker?: boolean;
    modelCached?: boolean;
    path?: string;
  } = {},
) {
  await page.clock.install({ time: MON_0730 });
  await page.addInitScript(
    ([cfg, demo]) => {
      if (window.localStorage.getItem("nutrikids.prefs.v1")) return;
      window.localStorage.setItem(
        "nutrikids.prefs.v1",
        JSON.stringify({ locale: "es", disclaimerSeen: true }),
      );
      if (cfg.plan === "eggs-red") {
        const diet = JSON.parse(JSON.stringify(demo));
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
        window.localStorage.setItem("nutrikids.diet.v1", JSON.stringify(diet));
        window.localStorage.setItem("nutrikids.source.v1", "real");
      }
      if (cfg.notes.length) {
        window.localStorage.setItem(
          "nutrikids.profile-notes.v1",
          JSON.stringify({
            acceptedTextures: [],
            notes: cfg.notes.map(
              (n: { kind: string; text: string }, i: number) => ({
                id: `n${i}`,
                ...n,
                at: "2026-07-06",
              }),
            ),
          }),
        );
      }
      if (cfg.pantry.length)
        window.localStorage.setItem(
          "nutrikids.pantry.v1",
          JSON.stringify(cfg.pantry),
        );
      if (cfg.noWorker)
        Object.defineProperty(window, "Worker", { value: undefined });
      if (cfg.modelCached) {
        // Los tres pesos de la revisión fijada, ya guardados (lo que deja una descarga anterior).
        void caches.open(cfg.cacheKey).then(async (c) => {
          for (const f of [
            "embed_tokens",
            "vision_encoder",
            "decoder_model_merged",
          ])
            await c.put(
              `${cfg.hubBase}/${f}.onnx`,
              new Response(new Uint8Array(2_000_000)),
            );
        });
      }
    },
    [
      {
        plan: opts.plan ?? "",
        notes: opts.notes ?? [],
        pantry: opts.pantry ?? [],
        noWorker: !!opts.noWorker,
        modelCached: !!opts.modelCached,
        cacheKey: model.cacheKey,
        hubBase: `${HUB}/${model.id}/resolve/${model.revision}/onnx`,
      },
      demoDiet,
    ] as const,
  );
  await page.goto(opts.path ?? "/camara");
  await page.waitForLoadState("networkidle");
}

const photo = (page: Page) =>
  page
    .getByTestId("camera-pick")
    .setInputFiles({ name: "plato.png", mimeType: "image/png", buffer: PNG });

/** Descarga + preparación hasta «Listo para mirar fotos». */
async function ready(page: Page, label = "Descargar el modelo") {
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByTestId("camera-ready")).toBeVisible();
}

test.describe("La cámara", () => {
  test("antes del toque no sale nada; el modelo se baja solo tras el toque, y el análisis no usa la red", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const ctx = page.context();
    await fakeWorker(ctx, { texts: ["chicken, carrot, tomato, ginger"] });
    const release = await fakeHub(ctx, true);
    const net = watch(ctx, baseURL!);
    await open(page);

    // ── Antes del toque: la pantalla dice qué pasa y NADA toca el modelo ni a un tercero.
    await expect(
      page.getByRole("heading", { name: "Cámara", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("camera-model")).toContainText(/unos 179 MB/);
    await expect(page.getByText("no se guarda ni se envía")).toBeVisible();
    expect(net.log.filter((r) => r.url.includes("/ia/"))).toEqual([]);
    expect(net.external(net.log)).toEqual([]);
    await axe(page, "cámara · antes de descargar");

    // ── El toque: descargando. Solo el worker de la app y el Hub, solo GET y sin cuerpo.
    const tap = net.mark();
    await page.getByRole("button", { name: "Descargar el modelo" }).click();
    await expect(page.getByRole("status")).toContainText(
      /Descargando el modelo… \d+ de unos 179 MB/,
    );
    await axe(page, "cámara · descargando");
    release();
    await expect(page.getByTestId("camera-ready")).toBeVisible();
    for (const r of net.since(tap)) {
      expect(r.method, r.url).toBe("GET");
      expect(r.body, r.url).toBeNull();
      expect(
        r.url.startsWith(baseURL!) || r.url.startsWith(`${HUB}/`),
        r.url,
      ).toBe(true);
    }
    expect(
      net.since(tap).filter((r) => r.url.startsWith(`${HUB}/`)).length,
    ).toBeGreaterThan(0);
    await expect(page.getByTestId("camera-ready")).toContainText(
      "Listo para mirar fotos",
    );
    await axe(page, "cámara · lista");

    // ── Durante el análisis: 0 peticiones, y la foto no se guarda en el formulario.
    await page.waitForLoadState("networkidle");
    const before = net.mark();
    await photo(page);
    await expect(page.getByTestId("camera-seen")).toBeVisible();
    expect(net.since(before)).toEqual([]);
    expect(
      await page
        .getByTestId("camera-pick")
        .evaluate((el: HTMLInputElement) => el.files?.length ?? 0),
    ).toBe(0);

    // ── Lo que vio: lo conocido para confirmar, lo desconocido solo se muestra.
    const seen = page.getByTestId("camera-seen");
    await expect(seen).toContainText("chicken");
    await expect(seen).toContainText("Verifícalo con un adulto");
    await expect(seen).toContainText("Vio esto, pero la app no lo conoce");
    await expect(seen).toContainText("ginger");
    // Nada entra a la despensa sin el toque de quien cuida.
    expect(
      await page.evaluate(() => localStorage.getItem("nutrikids.pantry.v1")),
    ).toBeNull();
    await expect(page.getByTestId("camera-save")).toBeDisabled();

    // ── Mirar el plato: cada alimento con símbolo + texto, jamás un verde inventado.
    const plate = page.getByTestId("camera-plate");
    await expect(plate).toBeVisible();
    await expect(
      plate.locator('li[data-state="green"]').filter({ hasText: "chicken" }),
    ).toContainText("Está en tu plan");
    await expect(page.getByTestId("camera-groups")).toContainText(
      /En la foto no vio:|tu plan nombra/,
    );
    await axe(page, "cámara · lo que vio y el plato");

    // ── Confirmar: solo lo tocado se escribe, y lleva a «qué cocinar».
    await page.getByRole("button", { name: "Lo tengo en casa: pollo" }).click();
    await expect(page.getByTestId("camera-save")).toContainText(
      "Guardar en la despensa (1)",
    );
    await page.getByTestId("camera-save").click();
    await expect(page).toHaveURL(/\/camara\/cocina$/);
    expect(
      JSON.parse(
        (await page.evaluate(() =>
          localStorage.getItem("nutrikids.pantry.v1"),
        ))!,
      ),
    ).toEqual(["pollo"]);
    await expect(page.getByTestId("camera-cook")).toContainText(
      /Tu despensa: pollo/,
    );
    await expect(
      page.getByText("Verifícalo con un adulto: el modelo puede equivocarse."),
    ).toBeVisible();
    await axe(page, "cocina · con lo confirmado");
    // La foto jamás viajó: ninguna petición con cuerpo en toda la visita.
    expect(net.log.filter((r) => r.body)).toEqual([]);
  });

  test("si el modelo dice muchas cosas se muestran las primeras y el resto se cuenta", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    await fakeWorker(ctx, {
      texts: [
        "kiwi, mango, papaya, guava, lychee, plum, pear, peach, grape, melon, lemon, lime, cherry, apricot, quince",
      ],
    });
    await fakeHub(ctx);
    watch(ctx, baseURL!);
    await open(page);
    await ready(page);
    await photo(page);
    await expect(page.getByTestId("camera-seen")).toContainText(
      /Y \d+ más que no se muestran\./,
    );
    await axe(page, "cámara · muchos nombres, el resto se cuenta");
  });

  test("el worker real llega con su cabecera: la red solo a la app y al Hub", async ({
    request,
  }) => {
    const res = await request.get("/ia/vision-worker.js");
    expect(res.ok()).toBe(true);
    const csp = res.headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/^connect-src /);
    expect(csp).toContain("'self'");
    expect(csp).toContain("https://huggingface.co");
    // Nada abierto: ni comodín solo, ni cualquier https, ni un tercero.
    expect(csp.split(/\s+/)).not.toContain("*");
    expect(csp.split(/\s+/)).not.toContain("https:");
    expect(csp).not.toMatch(/jsdelivr|unpkg|cdnjs|googleapis/);
    // Y el worker estampado no trae ninguna dirección escrita de terceros.
    expect(await res.text()).not.toMatch(/https?:\/\//);
  });

  test("el panel «Cómo va el motor»: marcar ✓/✗ y copiar sin foto", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
    await fakeWorker(ctx, { texts: ["chicken, carrot"] });
    await fakeHub(ctx);
    watch(ctx, baseURL!);
    await open(page);
    await ready(page);
    await photo(page);
    await expect(page.getByTestId("camera-seen")).toBeVisible();

    const trial = page.getByTestId("camera-trial");
    await trial.locator("summary").click();
    await expect(trial).toContainText("WebGPU");
    await trial
      .getByRole("button", { name: "Está en la foto: chicken", exact: true })
      .click();
    await trial
      .getByRole("button", { name: "No está en la foto: carrot", exact: true })
      .click();
    await expect(
      trial.getByRole("button", {
        name: "Está en la foto: chicken",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await axe(page, "cámara · panel del motor abierto");

    await trial.getByRole("button", { name: "Copiar resultados" }).click();
    await expect(trial.getByRole("button", { name: "Copiado" })).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("Prueba de la cámara");
    expect(clip).toMatch(/WebGPU/);
    // Texto plano de cifras: ni foto ni datos en el portapapeles.
    expect(clip).not.toMatch(/data:|base64|blob:/);
  });

  test("un rojo, una alergia anotada y una cosa inventada: el código manda, no el modelo", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    await fakeWorker(ctx, {
      // «peanuts» no está en el catálogo pero choca con lo anotado; «dragon fruit» no existe en nada.
      texts: ["eggs, kiwi, peanuts, chicken, dragon fruit"],
    });
    await fakeHub(ctx);
    watch(ctx, baseURL!);
    await open(page, {
      plan: "eggs-red",
      notes: [
        { kind: "allergy", text: "kiwi" },
        { kind: "allergy", text: "peanuts" },
      ],
    });
    await ready(page);
    await photo(page);

    const plate = page.getByTestId("camera-plate");
    await expect(plate).toBeVisible();
    await expect(
      plate.locator('li[data-state="red"]').filter({ hasText: "eggs" }),
    ).toContainText("Tu plan lo evita");
    await expect(
      plate.locator('li[data-state="allergy"]').filter({ hasText: "kiwi" }),
    ).toContainText("Choca con lo anotado como alergia o intolerancia");
    await expect(
      plate.locator('li[data-state="green"]').filter({ hasText: "chicken" }),
    ).toBeVisible();
    await expect(page.getByTestId("camera-plate-allergy")).toContainText(
      "peanuts",
    );
    await expect(page.getByTestId("camera-plate-allergy")).toContainText(
      "Consúltalo con un adulto",
    );
    // Lo inventado no se vuelve verde ni entra a ningún grupo: solo se muestra.
    await expect(page.getByTestId("camera-seen")).toContainText("dragon fruit");
    await expect(plate).not.toContainText("dragon fruit");
    await axe(page, "plato · un rojo, una alergia y una cosa inventada");
  });

  test("la comida se puede cambiar y cada una se lee contra su propio menú", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    await fakeWorker(ctx, { texts: ["chicken, rice"] });
    await fakeHub(ctx);
    watch(ctx, baseURL!);
    await open(page);
    await ready(page);
    await photo(page);
    const plate = page.getByTestId("camera-plate");
    await expect(plate).toBeVisible();
    await page.getByTestId("camera-plate-meal").selectOption("almuerzo");
    await expect(page.getByTestId("camera-groups")).toContainText(
      /tu plan nombra/i,
    );
    await page.getByTestId("camera-plate-meal").selectOption("media-manana");
    await expect(page.getByTestId("camera-groups")).toBeVisible();
    await axe(page, "plato · otra comida elegida");
  });

  test("respaldo 1: un teléfono sin worker dice que no puede y deja marcar a mano", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, { noWorker: true });
    const cant = page.getByTestId("camera-cant");
    await expect(cant).toBeVisible();
    await expect(cant).toContainText("Este teléfono no puede usar el modelo");
    const manual = page.getByTestId("camera-manual");
    await expect(manual).toHaveJSProperty("open", true);
    await axe(page, "cámara · sin modelo, a mano");

    await manual
      .getByRole("button", { name: "Elegir: pollo", exact: true })
      .click();
    await manual
      .getByRole("button", { name: "Elegir: arroz", exact: true })
      .click();
    await manual.getByRole("button", { name: /Usar lo elegido \(2\)/ }).click();
    await expect(page.getByTestId("camera-seen")).toContainText("pollo");
    // Lo marcado a mano no pasó por un modelo: el aviso lo dice así, no «el modelo puede equivocarse».
    await expect(page.getByTestId("camera-seen")).toContainText(
      "esto lo leyó el código contra tu plan, no una foto",
    );
    await expect(page.getByTestId("camera-seen")).not.toContainText(
      "el modelo puede equivocarse",
    );
    await expect(page.getByTestId("camera-plate")).toBeVisible();
    await expect(
      page
        .getByTestId("camera-plate")
        .locator('li[data-state="green"]')
        .filter({ hasText: "pollo" }),
    ).toBeVisible();
    await axe(page, "cámara · a mano, lo elegido leído");
  });

  test("respaldo 2: ni WebGPU ni WASM, o un modelo que no carga, ofrecen lo mismo sin romper nada", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    watch(ctx, baseURL!);
    // Ni WebGPU ni WASM: el probe lo dice y la pantalla pasa a «no puede».
    await fakeWorker(ctx, { webgpu: false, wasm: false });
    await open(page);
    await page.getByRole("button", { name: "Descargar el modelo" }).click();
    await expect(page.getByTestId("camera-cant")).toBeVisible();

    // El modelo no carga (ni en WebGPU ni en WASM): aviso con salida, a mano abierto.
    await ctx.unroute("**/ia/vision-worker.js");
    await fakeWorker(ctx, { failLoad: true });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Descargar el modelo" }).click();
    const alert = page.locator("[role=alert]:not(#__next-route-announcer__)");
    await expect(alert).toContainText("No se pudo preparar el modelo");
    await expect(
      alert.getByRole("link", { name: "Marcar a mano en Recetas" }),
    ).toBeVisible();
    await expect(page.getByTestId("camera-manual")).toHaveJSProperty(
      "open",
      true,
    );
    await expect(
      page.getByRole("button", { name: "Volver a intentar" }),
    ).toBeVisible();
    await axe(page, "cámara · el modelo falló");
  });

  test("una foto que no se pudo mirar lo dice sin culpa y deja probar otra", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    await fakeWorker(ctx, { failAnalyze: true });
    await fakeHub(ctx);
    watch(ctx, baseURL!);
    await open(page);
    await ready(page);
    await photo(page);
    await expect(
      page.locator("[role=alert]:not(#__next-route-announcer__)"),
    ).toContainText("No se pudo mirar esa foto");
    await expect(
      page.getByRole("button", { name: "Elegir de la galería" }),
    ).toBeEnabled();
    await axe(page, "cámara · foto que no se pudo mirar");
  });

  test("con el modelo ya guardado se prepara sin descargar nada", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const ctx = page.context();
    await fakeWorker(ctx);
    await fakeHub(ctx);
    const net = watch(ctx, baseURL!);
    await open(page, { modelCached: true });
    await expect(page.getByTestId("camera-model")).toContainText(
      "Ya está guardado en este teléfono",
    );
    const tap = net.mark();
    await page.getByRole("button", { name: "Preparar el modelo" }).click();
    await expect(page.getByTestId("camera-ready")).toBeVisible();
    // El worker simulado igual pide su archivo; lo que cuenta aquí es que la pantalla no dice «descargando».
    await photo(page);
    await expect(page.getByTestId("camera-seen")).toBeVisible();
    await page.getByTestId("camera-trial").locator("summary").click();
    await expect(page.getByTestId("camera-trial")).toContainText(
      "ya estaba en el teléfono",
    );
    expect(net.since(tap).every((r) => r.method === "GET")).toBe(true);
  });

  test("la despensa vacía de «qué cocinar» lo dice y vuelve a la cámara", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.clock.install({ time: MON_0730 });
    await page.addInitScript(() =>
      window.localStorage.setItem(
        "nutrikids.prefs.v1",
        JSON.stringify({ locale: "es", disclaimerSeen: true }),
      ),
    );
    await page.goto("/camara/cocina");
    await expect(page.getByTestId("camera-cook-empty")).toContainText(
      "Tu despensa está vacía",
    );
    await axe(page, "cocina · despensa vacía");
    await page.getByRole("link", { name: "Volver a la cámara" }).click();
    await expect(page).toHaveURL(/\/camara$/);
  });

  test("con una despensa que no da receta, el código cocina una idea revisada contra el plan", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, { path: "/camara/cocina", pantry: ["pollo", "brocoli"] });
    const cook = page.getByTestId("camera-cook");
    await expect(cook).toContainText("Tu despensa: pollo, brócoli");
    const templates = page.getByTestId("camera-cook-templates");
    await expect(templates).toContainText("Una idea con lo que tienes");
    const saute = page.getByTestId("camera-template-saute");
    await expect(saute).toContainText("Salteado");
    await expect(saute).toContainText("Cómo se hace");
    // La idea lleva su estado con símbolo y palabra, jamás cantidades.
    await expect(saute).toContainText(/Con lo de tu plan|Con medida/);
    await axe(page, "cocina · una idea hecha por el código");
  });

  test("un huevo en rojo en el plan: ninguna receta ni idea lo lleva", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, {
      path: "/camara/cocina",
      plan: "eggs-red",
      pantry: ["huevos", "pollo", "zanahoria"],
    });
    const cook = page.getByTestId("camera-cook");
    await expect(cook).toBeVisible();
    // La despensa dice lo que quien cuida marcó; ninguna receta ni idea (las filas) lleva el huevo.
    await expect(cook.locator("li").filter({ hasText: /huevo/i })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("camera-template-omelette")).toHaveCount(0);
    // Y la pantalla lo dice: el plan lo evita, así que no se usa.
    await expect(page.getByTestId("camera-cook-avoided")).toContainText(
      "Tu plan lo evita, así que no se usa: huevos.",
    );
    await expect(page.getByTestId("camera-cook-avoided-allergy")).toHaveCount(
      0,
    );
    await axe(page, "cocina · un rojo en la despensa");
  });

  test("una alergia anotada por familia («lactosa») deja fuera el queso y lo dice", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, {
      path: "/camara/cocina",
      notes: [{ kind: "intolerance", text: "lactosa" }],
      pantry: ["queso", "pollo", "arroz"],
    });
    const cook = page.getByTestId("camera-cook");
    await expect(cook).toBeVisible();
    await expect(page.getByTestId("camera-cook-avoided-allergy")).toContainText(
      "Choca con lo anotado como alergia o intolerancia, así que no se usa: queso fresco.",
    );
    await expect(cook.locator("li").filter({ hasText: /queso/i })).toHaveCount(
      0,
    );
    await axe(page, "cocina · una familia de alérgenos anotada");
  });

  test("una receta con algo que el plan no nombra lo dice con símbolo y palabra, y no sale verde", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, {
      path: "/camara/cocina",
      pantry: ["brocoli", "aguacate"],
    });
    const cook = page.getByTestId("camera-cook");
    await expect(cook).toContainText("Algo no está en tu plan");
    await expect(cook).toContainText(
      "No está en tu plan: aguacate. Pregúntale a tu profesional si puede.",
    );
    // La receta que lleva el aguacate no sale en verde: su fila dice «Algo no está en tu plan».
    const row = cook.locator("li").filter({ hasText: "Brócoli al vapor" });
    await expect(row).toContainText("Algo no está en tu plan");
    await expect(row).not.toContainText("Con lo de tu plan");
    await axe(page, "cocina · algo que el plan no nombra");
  });
});

test.describe("Ajustes · el modelo de la cámara", () => {
  test("sin modelo lo dice; con modelo dice cuánto ocupa, lo borra y «Borrar mis datos» también", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.clock.install({ time: MON_0730 });
    await page.addInitScript(
      ([key]) => {
        window.localStorage.setItem(
          "nutrikids.prefs.v1",
          JSON.stringify({ locale: "es", disclaimerSeen: true }),
        );
        // Solo la primera carga: el modelo guardado de la prueba no reaparece tras borrarlo.
        if (window.sessionStorage.getItem("seeded")) return;
        window.sessionStorage.setItem("seeded", "1");
        void caches
          .open(key)
          .then((c) =>
            c.put(
              "https://example.invalid/m.onnx",
              new Response(new Uint8Array(3_000_000)),
            ),
          );
      },
      [model.cacheKey] as const,
    );
    await page.goto("/ajustes");
    const section = page.getByTestId("settings-model");
    await expect(section).toContainText("Ocupa unos 3 MB");
    await axe(page, "ajustes · modelo guardado");

    await section.getByRole("button", { name: "Borrar el modelo" }).click();
    await expect(section).toContainText("Modelo borrado.");
    await expect(section).toContainText(
      "No hay ningún modelo guardado en este teléfono.",
    );
    expect(await page.evaluate((k) => caches.has(k), model.cacheKey)).toBe(
      false,
    );
    await axe(page, "ajustes · modelo borrado");

    // «Borrar mis datos» también se lleva el modelo.
    await page.evaluate(
      (k) =>
        caches
          .open(k)
          .then((c) =>
            c.put(
              "https://example.invalid/m2.onnx",
              new Response(new Uint8Array(1_000_000)),
            ),
          ),
      model.cacheKey,
    );
    await page.getByRole("button", { name: "Borrar mis datos" }).click();
    await page.getByRole("button", { name: "Sí, borrar" }).click();
    await expect(
      page.getByText("Datos borrados", { exact: false }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate((k) => caches.has(k), model.cacheKey))
      .toBe(false);
  });
});
