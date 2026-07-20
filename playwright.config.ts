import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
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
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Chat en modo determinístico: provider `mock` (cero red), IA habilitada.
    // NEXT_PUBLIC_* se inlinea en build → debe estar presente para `pnpm build`.
    env: {
      CHAT_PROVIDER: "mock",
      CHAT_ENABLED: "true",
      NEXT_PUBLIC_CHAT_ENABLED: "true",
    },
  },
});
