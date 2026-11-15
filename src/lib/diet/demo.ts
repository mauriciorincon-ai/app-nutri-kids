import { dateKey } from "./logic";
import type { DietPlan } from "./schema";

/**
 * La demo no caduca (regla 23 del núcleo: matriz de envejecimiento).
 *
 * `data/demo-diet.json` trae una ventana de restricción fija (anclada para los tests
 * de lógica). En la app, la demo recorre esa ventana a la fecha del aparato: la
 * restricción empezó hace `DEMO_DAYS_BEFORE` días y termina dentro de `DEMO_DAYS_AFTER`,
 * así que el ejemplo siempre enseña un «Evitar hasta…» vigente. Función pura: la
 * fecha entra por parámetro, jamás se lee el reloj aquí.
 */
export const DEMO_DAYS_BEFORE = 30;
export const DEMO_DAYS_AFTER = 60;

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date.getTime());
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export function rebaseDemoWindow(plan: DietPlan, now: Date): DietPlan {
  return {
    ...plan,
    restrictions: {
      ...plan.restrictions,
      validFrom: dateKey(shiftDays(now, -DEMO_DAYS_BEFORE)),
      validUntil: dateKey(shiftDays(now, DEMO_DAYS_AFTER)),
    },
  };
}
