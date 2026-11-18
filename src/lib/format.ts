import type { Locale } from "@/i18n";

/**
 * Un formateador por idioma y forma, creado la primera vez que se usa. Crear un
 * `Intl.DateTimeFormat` cuesta mucho más que usarlo: en Hoy se formatea una hora por
 * comida y por render, y crearlo cada vez era el grueso del trabajo al abrir la app
 * (medido en el S10). El texto que sale es el mismo.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

const SHAPES = {
  date: { day: "numeric", month: "short", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

function formatter(shape: keyof typeof SHAPES, locale: Locale) {
  const key = `${shape}:${locale}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(
      locale === "es" ? "es-CO" : "en-US",
      SHAPES[shape],
    );
    formatters.set(key, f);
  }
  return f;
}

/** "2026-09-28" → "28 sep 2026" / "Sep 28, 2026" (fechas humanas para vigencias). */
export function formatShortDate(isoDate: string, locale: Locale): string {
  const date = new Date(`${isoDate}T00:00:00`);
  // Cinturón fail-safe: una fecha inválida (dato corrupto) haría LANZAR a Intl.
  if (Number.isNaN(date.getTime())) return "—";
  return formatter("date", locale).format(date);
}

/** "07:00" → "7:00 a.m." / "7:00 AM" (horarios del menú). */
export function formatTime(time: string, locale: Locale): string {
  const [h, m] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, h, m);
  // Una hora inválida ("zz:zz") produce Invalid Date → Intl.format lanza.
  if (Number.isNaN(date.getTime())) return "—";
  return formatter("time", locale).format(date);
}

const collators = new Map<Locale, Intl.Collator>();

/**
 * Orden alfabético del idioma activo, igual que `a.localeCompare(b, locale)` pero con
 * un comparador creado una sola vez (el otro crea uno por comparación).
 */
export function compareText(a: string, b: string, locale: Locale): number {
  let c = collators.get(locale);
  if (!c) {
    c = new Intl.Collator(locale);
    collators.set(locale, c);
  }
  return c.compare(a, b);
}
