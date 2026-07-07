/**
 * Verificación dev-only: abre la app en Chromium y reporta si el SDK de
 * Sentry se inicializa y dispara peticiones. Uso:
 *   pnpm exec node scripts/check-sentry.mjs <url>
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage();

const sentryRequests = [];
page.on("request", (req) => {
  if (req.url().includes("sentry")) sentryRequests.push(req.url().slice(0, 90));
});

await page.goto(url, { waitUntil: "networkidle" });
// dispara un error como el de la prueba manual
await page.evaluate(() => {
  setTimeout(() => {
    throw new Error("prueba-sentry-nutrikids-script");
  }, 0);
});
await page.waitForTimeout(3000);

const sdk = await page.evaluate(() => ({
  sentryGlobal: typeof window.__SENTRY__ !== "undefined",
  dsnPresent: Boolean(window.__SENTRY__),
}));

console.log("SDK presente (__SENTRY__):", sdk.sentryGlobal);
console.log("Peticiones a *sentry*:", sentryRequests.length);
for (const r of sentryRequests) console.log("  →", r);

await browser.close();
