import type { Locale } from "@/i18n";

/** "2026-09-28" → "28 sep 2026" / "Sep 28, 2026" (fechas humanas para vigencias). */
export function formatShortDate(isoDate: string, locale: Locale): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-CO" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** "07:00" → "7:00 a.m." / "7:00 AM" (horarios del menú). */
export function formatTime(time: string, locale: Locale): string {
  const [h, m] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(locale === "es" ? "es-CO" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
