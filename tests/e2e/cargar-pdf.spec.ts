import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { analyze } from "./theme";

/**
 * S6 «Tu PDF, vuelto app»: PDF → revisar → guardar, sin red (ADR-010).
 * El PDF es el INVENTADO de tests/fixtures (jamás uno real). Se lee en el aparato:
 * ninguna petición lleva el archivo ni sale de la propia app.
 */
const PDF = resolve("tests/fixtures/plan-ejemplo.pdf");
const DEMO = readFileSync(resolve("data/demo-diet.json"), "utf8");
const NOTES_KEY = "nutrikids.profile-notes.v1";
const DRAFT_KEY = "nutrikids.plan-draft.v1";

async function open(page: Page, locale: "es" | "en" = "es") {
  await page.addInitScript((loc) => {
    if (window.localStorage.getItem("nutrikids.prefs.v1")) return;
    window.localStorage.setItem(
      "nutrikids.prefs.v1",
      JSON.stringify({ locale: loc, disclaimerSeen: true }),
    );
  }, locale);
  await page.goto("/cargar");
  await page.waitForLoadState("networkidle");
}

async function pickPdf(page: Page) {
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles(PDF);
  await expect(page.getByTestId("review-list")).toBeVisible({
    timeout: 60_000,
  });
}

const SECTION = (page: Page, key: string) =>
  page.locator(`[data-section="${key}"]`);

/** Abre una parte y la marca: «Está bien» si hay datos; si no, «Mi plan no lo trae». */
async function reviewSection(page: Page, key: string) {
  await SECTION(page, key).click();
  await expect(page.getByTestId("review-section")).toBeVisible();
  const ok = page.getByRole("button", { name: "Está bien" });
  if (await ok.isEnabled()) await ok.click();
  else await page.getByRole("button", { name: "Mi plan no lo trae" }).click();
  await expect(page.getByTestId("review-list")).toBeVisible();
}

const KEYS = [
  "validity",
  "restricted",
  "red",
  "additives",
  "alsoAvoid",
  "green",
  "yellow",
  "equivalences",
  "supplements",
  "menu",
  "hydration",
  "goals",
];

/** Un PDF mínimo y válido; `text` null = sin capa de texto (como uno escaneado). */
function tinyPdf(text: string | null): Buffer {
  const content = text
    ? `BT /F1 14 Tf 40 700 Td (${text}) Tj ET`
    : "0 0 100 100 re f";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

async function pickBuffer(page: Page, buffer: Buffer) {
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
    name: "plan.pdf",
    mimeType: "application/pdf",
    buffer,
  });
}

/** Reescribe el borrador guardado (todo «está bien») para armar estados difíciles de alcanzar. */
async function seedDraft(
  page: Page,
  edit: (draft: Record<string, unknown>) => void,
) {
  await page.evaluate(
    ([key, src]) => {
      const d = JSON.parse(localStorage.getItem(key) as string);
      for (const k of Object.keys(d.marks)) d.marks[k] = "ok";
      new Function("d", src)(d);
      localStorage.setItem(key, JSON.stringify(d));
    },
    [DRAFT_KEY, `(${edit.toString()})(d)`] as const,
  );
}

async function axeClean(page: Page) {
  const results = await analyze(page);
  expect(results.violations).toEqual([]);
}

test("lo leído del PDF llega a la revisión: cada comida con su contenido, el nombre centrado entero, la ligadura restaurada", async ({
  page,
}) => {
  await open(page);
  await pickPdf(page);
  const look = async (key: string, want: string[], not: RegExp[] = []) => {
    await SECTION(page, key).click();
    const section = page.getByTestId("review-section");
    for (const w of want) await expect(section).toContainText(w);
    for (const n of not) await expect(section).not.toContainText(n);
    await page.getByRole("button", { name: "Volver a la lista" }).click();
  };
  await look(
    "menu",
    [
      "Arepa de maíz con aguacate y huevo de codorniz · Opción 2: avena con pera en trozos · Opción 3: casabe con queso",
      "Fruta con semillas de girasol · Opción 2: maíz inflado con banano",
    ],
    [/queso Fruta|codorniz Fruta/],
  );
  await look("additives", ["Brillo Simulado Doble (BSD)"]);
  await look("alsoAvoid", [
    "Colorantes artificiales de bolsa",
    "Pastas con flúor añadido",
  ]);
});

test("PDF → revisar todas las partes → guardar → Hoy y Dieta muestran el plan, sin red hacia fuera", async ({
  page,
}) => {
  const requests: { url: string; method: string; body: boolean }[] = [];
  // En el contexto (no solo la página): también ve lo que piden el worker y el service worker.
  page.context().on("request", (r) =>
    requests.push({
      url: r.url(),
      method: r.method(),
      body: (r.postDataBuffer()?.length ?? 0) > 0,
    }),
  );
  await open(page);
  await pickPdf(page);

  // Una parte corregida: se añade un alimento rojo a mano (el rojo fijo no sale del PDF).
  await SECTION(page, "red").click();
  await page.getByRole("button", { name: "Añadir" }).click();
  await page.getByLabel("Nombre").fill("Alimento inventado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("button", { name: "Volver a la lista" }).click();
  await expect(SECTION(page, "red")).toContainText("Corregida");

  for (const k of KEYS.filter((k) => k !== "red")) await reviewSection(page, k);
  await expect(page.getByTestId("progress")).toContainText("12 de 12");
  await page.getByRole("button", { name: "Guardar mi plan" }).click();
  await expect(page.getByTestId("active-source")).toHaveText("tu dieta");

  await page.goto("/");
  await expect(page.locator("main")).not.toBeEmpty();
  await page.goto("/dieta");
  await expect(
    page.getByRole("link", { name: /Ver detalle de/ }).first(),
  ).toBeVisible();
  // El rojo añadido a mano quedó en el plan guardado.
  const saved = await page.evaluate(() =>
    localStorage.getItem("nutrikids.diet.v1"),
  );
  expect(saved).toContain("Alimento inventado");

  const base = new URL(page.url()).origin;
  // Ninguna petición sale de la propia app, ninguna escribe, ninguna lleva el archivo.
  expect(requests.filter((r) => !r.url.startsWith(base))).toEqual([]);
  expect(requests.filter((r) => r.method !== "GET" && r.body)).toEqual([]);
  expect(requests.some((r) => /\.pdf(\?|$)/i.test(r.url))).toBe(false);

  // El PDF no se guardó: ni el borrador queda, ni hay rastro del archivo.
  const dump = await page.evaluate((k) => {
    const all: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      all.push(`${key}=${localStorage.getItem(key)}`);
    }
    return { all: all.join("\n"), draft: localStorage.getItem(k) };
  }, DRAFT_KEY);
  expect(dump.draft).toBeNull();
  expect(dump.all).not.toContain("%PDF");
});

test("leer el PDF no necesita red: con la app ya abierta, el navegador sin conexión sigue leyendo", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.CI,
    "el service worker solo existe en producción: corre con CI=1",
  );
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await pickPdf(page);
  await expect(page.getByTestId("progress")).toContainText("0 de 12");
  await context.setOffline(false);
});

test("una revisión a medias se retoma", async ({ page }) => {
  await open(page);
  await pickPdf(page);
  await reviewSection(page, "validity");
  await expect(page.getByTestId("progress")).toContainText("1 de 12");
  await page.reload();
  await expect(page.getByTestId("resume-review")).toBeVisible();
  await axeClean(page);
  await page.getByRole("button", { name: "Seguir revisando" }).click();
  await expect(page.getByTestId("progress")).toContainText("1 de 12");
  await page.getByRole("button", { name: "Descartar esta revisión" }).click();
  await page.reload();
  await expect(page.getByTestId("resume-review")).toHaveCount(0);
});

test("cargar JSON sigue funcionando y las notas de quien cuida sobreviven al plan del PDF", async ({
  page,
}) => {
  const note = {
    acceptedTextures: [],
    notes: [
      { id: "n1", kind: "other", text: "Nota inventada", at: "2026-11-01" },
    ],
  };
  await page.addInitScript(
    ([k, v]) => {
      if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, v);
    },
    [NOTES_KEY, JSON.stringify(note)] as const,
  );
  await open(page);
  // JSON: pegar la demo inventada.
  await page.getByRole("textbox").first().fill(DEMO);
  await page
    .getByRole("button", { name: /Cargar|Usar/ })
    .first()
    .click();
  await expect(page.getByTestId("active-source")).toBeVisible();
  // PDF encima: las notas siguen.
  await page.goto("/cargar");
  await pickPdf(page);
  for (const k of KEYS) await reviewSection(page, k);
  await page.getByRole("button", { name: "Guardar mi plan" }).click();
  await expect(page.getByTestId("active-source")).toHaveText("tu dieta");
  const stored = await page.evaluate((k) => localStorage.getItem(k), NOTES_KEY);
  expect(stored).toContain("Nota inventada");
});

test("el archivo que no es PDF se dice en llano", async ({ page }) => {
  await open(page);
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
    name: "no.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("esto no es un pdf"),
  });
  await expect(page.locator("p[role=alert]")).toContainText("no es un PDF");
});

test("la revisión en inglés usa los textos en inglés", async ({ page }) => {
  await open(page, "en");
  await pickPdf(page);
  await expect(page.getByTestId("review-list")).toContainText(
    "Review your plan",
  );
  await expect(page.getByTestId("progress")).toContainText("of 12");
});

for (const colorScheme of ["light", "dark"] as const) {
  // Los dos temas reales (S11): `analyze` falla si la página no está en el tema que se mide.
  test(`axe limpio en cada estado de la revisión · tema ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await open(page);

    // Error: archivo que no es PDF.
    await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
      name: "no.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("no"),
    });
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await axeClean(page);

    await pickPdf(page);
    // Lista, con el guardado bloqueado.
    await expect(page.locator("#rv-save-why")).toBeVisible();
    await axeClean(page);

    // Parte abierta.
    await SECTION(page, "green").click();
    await expect(page.getByTestId("review-section")).toBeVisible();
    await axeClean(page);

    // Parte con «mi plan no lo trae» desactivado (requerida) y formulario con error.
    await page.getByRole("button", { name: "Añadir" }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await axeClean(page);
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Volver a la lista" }).click();

    // Parte corregida (rojo) y parte «mi plan no lo trae» (si el PDF no la trae).
    await SECTION(page, "red").click();
    await page.getByRole("button", { name: "Añadir" }).click();
    await page.getByLabel("Nombre").fill("Alimento inventado");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.getByRole("button", { name: "Volver a la lista" }).click();
    await expect(SECTION(page, "red")).toContainText("Corregida");
    await reviewSection(page, "validity");
    for (const k of KEYS.filter((k) => !["red", "validity"].includes(k)))
      await reviewSection(page, k);
    await axeClean(page);

    // Todo revisado: el guardado se habilita.
    await expect(
      page.getByRole("button", { name: "Guardar mi plan" }),
    ).toBeEnabled();
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe limpio: otra forma de PDF, sin texto, guardado fallido y fila no leída · tema ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await open(page);

    // PDF sin capa de texto: error en llano.
    await pickBuffer(page, tinyPdf(null));
    await expect(page.locator("p[role=alert]")).toContainText("texto");
    await axeClean(page);

    // Otra forma: no se rechaza, dice qué no reconoció y se completa a mano.
    await pickBuffer(page, tinyPdf("Un documento cualquiera"));
    await expect(page.getByTestId("review-list")).toBeVisible({
      timeout: 60_000,
    });
    await SECTION(page, "menu").click();
    await expect(page.getByText("No encontramos esta parte")).toBeVisible();
    await axeClean(page);
    // «Mi plan no lo trae» desactivado con su razón (menú es necesario).
    await expect(
      page.getByRole("button", { name: "Mi plan no lo trae" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Volver a la lista" }).click();

    // Guardado que no se puede armar: aviso visible.
    await seedDraft(page, (d) => {
      const draft = d.draft as {
        menu: { start: string }[];
        green: unknown[];
        hydration?: unknown;
      };
      draft.menu = [
        {
          id: "x",
          start: "99:99",
          end: "99:99",
          name: { es: "x", en: "x" },
          content: { es: "x", en: "x" },
        } as never,
      ];
      draft.green = [
        {
          id: "g",
          name: { es: "g", en: "g" },
          portion: { es: "p", en: "p" },
          items: [{ id: "i", name: { es: "i", en: "i" } }],
        },
      ];
      draft.hydration = {
        targetLitersMin: 1,
        targetLitersMax: 2,
        habit: { es: "h", en: "h" },
      };
    });
    await page.reload();
    await page.getByRole("button", { name: "Seguir revisando" }).click();
    await page.getByRole("button", { name: "Guardar mi plan" }).click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await axeClean(page);

    // Una fila que el lector no pudo leer: aviso para cotejar con el PDF.
    await seedDraft(page, (d) => {
      d.skipped = { green: 2 };
    });
    await page.reload();
    await page.getByRole("button", { name: "Seguir revisando" }).click();
    await SECTION(page, "green").click();
    await expect(page.getByRole("note")).toContainText("2 fila");
    await axeClean(page);
  });

  test(`axe limpio: sin espacio para guardar el avance ni el plan · tema ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await open(page);
    await pickPdf(page);
    // Cuota llena: el borrador y luego el plan no se pueden escribir.
    await page.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.startsWith("nutrikids.plan-draft") || k === "nutrikids.diet.v1")
          throw new DOMException("quota", "QuotaExceededError");
        return real.call(this, k, v);
      };
    });
    await reviewSection(page, "validity");
    await expect(
      page.getByRole("status").filter({ hasText: "avance" }),
    ).toBeVisible();
    await axeClean(page);
    for (const k of KEYS.filter((k) => k !== "validity")) {
      if (k === "red") {
        await SECTION(page, "red").click();
        await page.getByRole("button", { name: "Mi plan no lo trae" }).click();
      } else await reviewSection(page, k);
    }
    await page.getByRole("button", { name: "Guardar mi plan" }).click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await axeClean(page);
  });
}

test("los botones de la revisión miden al menos 44 px y el foco no se pierde", async ({
  page,
}) => {
  await open(page);
  await pickPdf(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button:not([disabled])")]
      .filter((b) => b.getBoundingClientRect().height < 44)
      .map((b) => b.textContent?.trim()),
  );
  expect(small).toEqual([]);

  await SECTION(page, "alsoAvoid").click();
  await expect(page.getByRole("heading", { level: 2 })).toBeFocused();
  await page.getByRole("button", { name: "Añadir" }).click();
  // El foco pasa al primer campo del formulario…
  await expect(page.getByLabel("Nombre")).toBeFocused();
  await page.getByLabel("Nombre").fill("Algo inventado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  // …y al cerrarlo vuelve al título de la parte.
  await expect(page.getByRole("heading", { level: 2 })).toBeFocused();
  const tiny = await page.evaluate(() =>
    [...document.querySelectorAll("button:not([disabled])")]
      .filter((b) => b.getBoundingClientRect().height < 44)
      .map((b) => b.textContent?.trim()),
  );
  expect(tiny).toEqual([]);
  await page.getByRole("button", { name: /^Quitar Algo inventado/ }).click();
  await expect(page.getByRole("heading", { level: 2 })).toBeFocused();
});
