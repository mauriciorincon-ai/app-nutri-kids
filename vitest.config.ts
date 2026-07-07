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
      // El gate de cobertura aplica al motor de la dieta (CLAUDE.md exige >80% en lib/diet).
      // utils/log del kit quedan fuera: se cubren indirectamente vía componentes y e2e.
      include: ["src/lib/diet/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
