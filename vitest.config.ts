import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // El gate cubre el motor de la dieta (núcleo: >80% en lib/diet, incluido el
      // motor del chat) y el acento del modelo del aparato (estándar 7). utils/log
      // del kit quedan fuera: se cubren vía componentes y e2e.
      include: [
        "src/lib/diet/**",
        "src/lib/ia/**",
        "src/lib/pdf/**",
        "src/lib/privacy/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
