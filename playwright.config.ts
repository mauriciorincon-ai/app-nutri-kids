import { defineConfig, devices } from "@playwright/test";

/**
 * Puerto configurable + verificación de IDENTIDAD del servidor.
 *
 * `reuseExistingServer` local es cómodo, pero si otro proyecto ya tiene tomado el
 * puerto, Playwright lo reutiliza y la suite entera corre contra OTRA app: 60 tests
 * en rojo sin una sola pista, o —peor— en verde. Pasó dos veces el 2026-08-22.
 * Ahora: `E2E_PORT` mueve la suite a un puerto libre y `tests/e2e/global-setup.ts`
 * exige que quien conteste sea Nutrikids antes de correr nada.
 */
const PORT = Number(process.env.E2E_PORT ?? 3600);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      // Móvil primero: la mamá usa la app en su teléfono (360–420px)
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // El job e2e del CI no hace build previo → en CI se construye aquí; local usa dev server
    command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // El chat no tiene variables (ADR-008: código primero, cero red). `FAMILY_STORE=memory`
    // (S7): la ruta de la familia usa el doble en memoria, JAMÁS la base real, aunque haya
    // variables de Upstash en el entorno o en `.env.local`.
    env: {
      PORT: String(PORT),
      FAMILY_STORE: "memory",
    },
  },
});
