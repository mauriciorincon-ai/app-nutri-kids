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
        "src/lib/family/**",
        "src/lib/push/**",
        "src/lib/wellbeing/**",
        // S11: lonchera, recetario, viaje y lo local del día a día (regla 2: > 80 %).
        "src/lib/lunchbox/**",
        "src/lib/recipes/**",
        "src/lib/travel/**",
        "src/lib/day-to-day/**",
        // S12: la cámara (cotejo, prueba, cliente del worker y caché del modelo).
        "src/lib/camera/**",
        // S13: el lector de etiquetas, el catálogo, el escáner y la compra (quedaron fuera al entrar).
        "src/lib/label/**",
        "src/lib/catalog/**",
        "src/lib/scan/**",
        "src/lib/shopping/**",
        // S14: las lecciones y «Qué sí y qué no», el registro de presión y la aventura.
        "src/lib/family-learn/**",
        "src/lib/pressure/**",
        "src/lib/adventure/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // S7: el cifrado y la sincronía de la familia, al 90 % o más.
        "src/lib/family/**": {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        // S8: los avisos (horas, VAPID, firma del disparador, registro), al 90 % o más.
        "src/lib/push/**": {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  },
});
