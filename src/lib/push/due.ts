import type { ServerWake } from "./schedule";

/**
 * Qué despertares vencieron, en la zona horaria del teléfono (S8 · ADR-012). Puro: la hora
 * entra por parámetro. Se calcula con `Intl`, así el cambio de horario y la medianoche
 * salen bien sin tablas propias.
 *
 * El disparador corre cada 5 minutos y mira los últimos 10: un toque que llega tarde no se
 * repite (el servidor marca «enviado» por fecha y minuto) y uno perdido solo se pierde.
 */

export const WINDOW_MINUTES = 10;

export type LocalParts = { date: string; dow: number; minute: number };

const DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** ¿Es una zona horaria que `Intl` conoce? */
export function validTimeZone(tz: string): boolean {
  if (tz.length === 0 || tz.length > 64) return false;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export function localParts(ms: number, tz: string): LocalParts {
  const parts = Object.fromEntries(
    formatter(tz)
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dow: DOW[parts.weekday] ?? 0,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export type Due = { date: string; m: number };

/** Los despertares con minuto en (now − ventana, now], cada uno una sola vez. */
export function dueWakes(
  wakes: ServerWake[],
  tz: string,
  now: number,
  windowMinutes: number = WINDOW_MINUTES,
): Due[] {
  const out = new Map<string, Due>();
  const base = Math.floor(now / 60_000) * 60_000;
  for (let k = 0; k < windowMinutes; k++) {
    const p = localParts(base - k * 60_000, tz);
    for (const w of wakes) {
      if (w.m === p.minute && (w.d & (1 << p.dow)) !== 0) {
        out.set(`${p.date}|${w.m}`, { date: p.date, m: w.m });
      }
    }
  }
  return [...out.values()];
}
