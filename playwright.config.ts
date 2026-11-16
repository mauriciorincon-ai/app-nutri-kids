import { generateKeyPairSync, randomBytes } from "node:crypto";

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

/**
 * Llaves de PRUEBA de los avisos (S8 · ADR-012): VAPID y la firma del disparador. Nacen aquí,
 * en cada corrida, y viajan por el entorno (el proceso del servidor y los de las pruebas las
 * heredan): ninguna llave, real o de prueba, vive en el repo, y jamás se usan las reales.
 */
function testKeys() {
  if (process.env.E2E_VAPID_PUBLIC) return;
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  process.env.E2E_VAPID_PUBLIC = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x!, "base64url"),
    Buffer.from(jwk.y!, "base64url"),
  ]).toString("base64url");
  process.env.E2E_VAPID_PRIVATE = jwk.d!;
  process.env.E2E_QSTASH_CURRENT = randomBytes(24).toString("base64url");
  process.env.E2E_QSTASH_NEXT = randomBytes(24).toString("base64url");
}
testKeys();

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
      // Los avisos (S8): llaves de prueba y el emisor doble (con `memory` no sale a la red).
      VAPID_PUBLIC_KEY: process.env.E2E_VAPID_PUBLIC!,
      VAPID_PRIVATE_KEY: process.env.E2E_VAPID_PRIVATE!,
      VAPID_SUBJECT: "mailto:e2e@example.org",
      QSTASH_CURRENT_SIGNING_KEY: process.env.E2E_QSTASH_CURRENT!,
      QSTASH_NEXT_SIGNING_KEY: process.env.E2E_QSTASH_NEXT!,
    },
  },
});
