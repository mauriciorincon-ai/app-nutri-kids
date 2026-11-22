/**
 * El logger del NAVEGADOR (S12): misma forma que el de pino que usa el servidor
 * (`pino({ level, browser: { asObject: true } })` → `log.info({ event, …conteos })`), sin
 * cargar pino en cada pantalla. `next.config.ts` lo pone en lugar de `pino` solo en el
 * bundle del cliente; el servidor y las pruebas siguen con pino.
 * Regla dura: lo que se le pasa son solo metadatos (`kind` + conteos), igual que antes.
 */
const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
type Level = keyof typeof LEVELS;
type Fn = (obj: object | string, msg?: string) => void;
export type BrowserLogger = Record<Level, Fn> & { level: Level };

const SINK: Record<Level, "debug" | "info" | "warn" | "error"> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
};

export default function pino(opts: { level?: string } = {}): BrowserLogger {
  const level = (opts.level && opts.level in LEVELS ? opts.level : "info") as Level;
  const min = LEVELS[level];
  const make =
    (l: Level): Fn =>
    (obj, msg) => {
      if (LEVELS[l] < min) return;
      const base = typeof obj === "string" ? { msg: obj } : { ...obj };
      console[SINK[l]]({
        time: Date.now(),
        level: LEVELS[l],
        ...base,
        ...(msg ? { msg } : {}),
      });
    };
  return {
    level,
    trace: make("trace"),
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
    fatal: make("fatal"),
  };
}
