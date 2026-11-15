import type { DietPlan, DietPlanV1 } from "./schema";

/**
 * Migración pura v1 → v2 (ADR-009). No pierde nada: copia cada campo de la v1
 * tal cual y solo cambia la forma de las opciones de reemplazo (`use`), que pasan
 * de texto a `{ name }` sin textura (el plan v1 no la decía). `profile` y `goals`
 * quedan ausentes: «tu plan no lo dice», nunca inventado.
 */
export function migrateV1toV2(v1: DietPlanV1): DietPlan {
  return {
    ...v1,
    schemaVersion: 2,
    equivalences: v1.equivalences.map((eq) => ({
      ...eq,
      use: eq.use.map((name) => ({ name })),
    })),
  };
}
