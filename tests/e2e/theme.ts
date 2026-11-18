import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Tema real en las e2e (S11, ADR-016). Hasta el S10 las pasadas «dark» eran falsas: la app no
 * tenía tema oscuro y `emulateMedia` repetía el claro. Ahora toda pasada de axe pasa por aquí y
 * FALLA si lo que se mide no es el tema que se dice medir.
 */

export type Scheme = "light" | "dark";

/** Luminancia 0–1 del fondo del <body>, tal como se pinta (el lienzo resuelve oklch). */
async function bodyLuminance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}

/**
 * La página está de verdad en `expected` (por defecto, el esquema que el teléfono emula): la
 * clase de <html>, el `color-scheme` y el fondo coinciden. Si el tema no existiera, el fondo
 * claro delataría la pasada «dark».
 */
export async function assertRealTheme(
  page: Page,
  expected?: Scheme,
  timeout?: number,
) {
  const want: Scheme =
    expected ??
    ((await page.evaluate(
      () => matchMedia("(prefers-color-scheme: dark)").matches,
    ))
      ? "dark"
      : "light");
  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          dark: document.documentElement.classList.contains("dark"),
          scheme: document.documentElement.style.colorScheme,
        })),
      { message: `el documento no está en el tema ${want}`, timeout },
    )
    .toEqual({ dark: want === "dark", scheme: want });
  // El fondo se pinta un instante después de la clase: se espera, no se mide a medias.
  await expect
    .poll(() => bodyLuminance(page), {
      message: `el fondo no es el del tema ${want}`,
      timeout,
    })
    [want === "dark" ? "toBeLessThan" : "toBeGreaterThan"](
      want === "dark" ? 0.25 : 0.85,
    );
}

/** axe sobre la página tal como está, tras comprobar que el tema es el real. */
export async function analyze(page: Page, expected?: Scheme) {
  await assertRealTheme(page, expected);
  return new AxeBuilder({ page }).analyze();
}

/** Resumen legible: regla, nodo y por qué (el volcado completo de axe tapa la causa). */
export function summarize(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations.map(
    (v) =>
      `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim()}`).join(" | ")}`,
  );
}
