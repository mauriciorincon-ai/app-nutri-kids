import { afterEach, describe, expect, it, vi } from "vitest";

import pino from "@/lib/log-browser";

/** El logger del navegador (alias de `pino` en el bundle del cliente, S12): misma forma y niveles. */
describe("logger del navegador", () => {
  afterEach(() => vi.restoreAllMocks());

  it("escribe el objeto tal cual, con nivel y hora, por la consola del nivel", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = pino({ level: "info" });
    log.info({ event: "diet-imported", foods: 12 });
    log.warn({ event: "stored-diet-invalid" }, "descartado");
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "diet-imported", foods: 12, level: 30 }),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "stored-diet-invalid", msg: "descartado", level: 40 }),
    );
  });

  it("respeta el nivel: en producción (info) no sale debug", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    pino({ level: "info" }).debug({ event: "x" });
    expect(debug).not.toHaveBeenCalled();
    pino({ level: "debug" }).debug({ event: "x" });
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("un nivel desconocido cae a info y un texto suelto va como msg", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = pino({ level: "nope" });
    expect(log.level).toBe("info");
    log.info("hola");
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ msg: "hola" }));
  });
});
