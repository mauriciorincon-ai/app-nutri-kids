import pino from "pino";

/**
 * Logger estructurado del kit (Pino).
 * Regla dura: los logs JAMÁS incluyen contenido de la dieta ni datos del niño —
 * solo metadatos (schemaVersion, conteos, códigos de error).
 */
export const log = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  browser: { asObject: true },
  base: undefined,
});
