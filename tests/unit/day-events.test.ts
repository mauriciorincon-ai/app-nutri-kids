import { describe, expect, it, vi } from "vitest";

import { trackMark, trackNote, trackReminderSeen } from "@/lib/diet/day-events";
import { log } from "@/lib/log";

/**
 * Candado de privacidad (regla dura 1 · ADR-007): la telemetría del registro es
 * SOLO metadatos. Si alguien añadiera el texto/los chips reales o el id concreto
 * al payload, estos tests FALLAN — el gate de cobertura global (80%) no lo vería
 * porque no delata un módulo al 0%.
 */
describe("day-events: telemetría solo metadatos", () => {
  it("trackNote loguea chipCount/hasText y JAMÁS el texto ni los chips reales", () => {
    const spy = vi.spyOn(log, "info").mockImplementation(() => {});
    trackNote({ chips: ["rejected"], text: "NOTA-SECRETA-XYZ" });

    const payload = JSON.stringify(spy.mock.calls);
    expect(payload).not.toContain("NOTA-SECRETA-XYZ");
    expect(payload).not.toContain("rejected");
    expect(spy).toHaveBeenCalledWith({
      event: "nota_agregada",
      chipCount: 1,
      hasText: true,
    });
    spy.mockRestore();
  });

  it("trackNote con texto en blanco → hasText:false (sin exponer nada)", () => {
    const spy = vi.spyOn(log, "info").mockImplementation(() => {});
    trackNote({ chips: ["pain", "craving"], text: "   " });
    expect(spy).toHaveBeenCalledWith({
      event: "nota_agregada",
      chipCount: 2,
      hasText: false,
    });
    spy.mockRestore();
  });

  it("trackMark loguea SOLO la categoría, jamás el id concreto", () => {
    const spy = vi.spyOn(log, "info").mockImplementation(() => {});
    trackMark("meal:desayuno");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("desayuno");
    expect(spy).toHaveBeenCalledWith({
      event: "registro_marcado",
      kind: "meal",
    });
    spy.mockRestore();
  });

  it("trackReminderSeen no lleva payload de contenido", () => {
    const spy = vi.spyOn(log, "debug").mockImplementation(() => {});
    trackReminderSeen();
    expect(spy).toHaveBeenCalledWith({ event: "recordatorio_visto" });
    spy.mockRestore();
  });
});
