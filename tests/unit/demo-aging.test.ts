import { describe, expect, it } from "vitest";
import {
  DEMO_DAYS_AFTER,
  DEMO_DAYS_BEFORE,
  rebaseDemoWindow,
} from "@/lib/diet/demo";
import {
  isRestrictionActive,
  restrictionDaysRemaining,
  resolveItemStatus,
} from "@/lib/diet/logic";
import { getDemoDiet, getDemoDietFor } from "@/lib/diet/storage";

// Regla 23: la demo se construye en cada fecha en que algo cambiaría de estado
// (hoy, los bordes de la ventana original, +100 días, +1 año) y nunca caduca.
const base = getDemoDiet();
const restricted = "manzana";

const FECHAS = [
  "2026-07-01", // inicio de la ventana original
  "2026-09-28", // fin de la ventana original
  "2026-09-29", // el día en que la demo vieja caducaba
  "2026-11-15", // el día en que se halló el hueco
  "2027-02-23", // hoy + 100 días
  "2027-11-15", // +1 año
  "2028-02-29", // bisiesto
].map((d) => new Date(`${d}T10:00:00`));

describe("la demo no envejece", () => {
  it.each(FECHAS.map((d) => [d.toISOString().slice(0, 10), d] as const))(
    "el %s la restricción está vigente y enseña «hasta»",
    (_label, now) => {
      const demo = rebaseDemoWindow(base, now);
      expect(isRestrictionActive(demo, now)).toBe(true);
      expect(restrictionDaysRemaining(demo, now)).toBe(DEMO_DAYS_AFTER);
      const status = resolveItemStatus(demo, restricted, now);
      expect(status).toMatchObject({
        kind: "restricted",
        color: "red",
        restrictionActive: true,
      });
      if (status?.kind !== "restricted") return;
      expect(status.until).toBe(demo.restrictions.validUntil);
    },
  );

  it("la ventana abarca DEMO_DAYS_BEFORE atrás y DEMO_DAYS_AFTER adelante", () => {
    const now = new Date("2026-11-15T10:00:00");
    const demo = rebaseDemoWindow(base, now);
    expect(demo.restrictions.validFrom).toBe("2026-10-16");
    expect(demo.restrictions.validUntil).toBe("2027-01-14");
    expect(DEMO_DAYS_BEFORE).toBe(30);
  });

  it("no toca el resto del plan ni el original", () => {
    const now = new Date("2027-05-05T10:00:00");
    const demo = rebaseDemoWindow(base, now);
    expect(demo.trafficLight).toBe(base.trafficLight);
    expect(base.restrictions.validUntil).toBe("2026-09-28");
  });

  it("getDemoDietFor devuelve la misma referencia durante el día y cambia al siguiente", () => {
    const a = getDemoDietFor(new Date("2026-11-15T08:00:00"));
    const b = getDemoDietFor(new Date("2026-11-15T22:00:00"));
    const c = getDemoDietFor(new Date("2026-11-16T08:00:00"));
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });
});
