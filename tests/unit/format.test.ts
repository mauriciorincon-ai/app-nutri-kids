import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Formato de fechas y horas (S10): el texto es el mismo de siempre, pero el formateador se
 * crea una vez por idioma y forma. Crearlo en cada llamada era el grueso del trabajo de Hoy
 * al abrir la app (una hora por comida y por render).
 */

async function fresh() {
  vi.resetModules();
  return import("@/lib/format");
}

afterEach(() => vi.restoreAllMocks());

describe("formatTime y formatShortDate", () => {
  it("dan el mismo texto que un Intl.DateTimeFormat recién creado", async () => {
    const { formatTime, formatShortDate } = await fresh();
    const time = (locale: string) =>
      new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
    const date = (locale: string) =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    for (const hhmm of ["07:00", "12:30", "19:45"]) {
      const [h, m] = hhmm.split(":").map(Number);
      const at = new Date(2000, 0, 1, h, m);
      expect(formatTime(hhmm, "es")).toBe(time("es-CO").format(at));
      expect(formatTime(hhmm, "en")).toBe(time("en-US").format(at));
    }
    const day = new Date("2026-09-28T00:00:00");
    expect(formatShortDate("2026-09-28", "es")).toBe(date("es-CO").format(day));
    expect(formatShortDate("2026-09-28", "en")).toBe(date("en-US").format(day));
  });

  it("una hora o fecha inválida da «—» en vez de lanzar", async () => {
    const { formatTime, formatShortDate } = await fresh();
    expect(formatTime("zz:zz", "es")).toBe("—");
    expect(formatShortDate("no-es-fecha", "en")).toBe("—");
  });

  it("crea un formateador por idioma y forma, no uno por llamada", async () => {
    const { formatTime, formatShortDate } = await fresh();
    const Original = Intl.DateTimeFormat;
    const spy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(function (
        ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
      ) {
        return new Original(...args);
      } as never);
    for (let i = 0; i < 6; i++) {
      formatTime("07:00", "es");
      formatTime("08:15", "en");
      formatShortDate("2026-09-28", "es");
    }
    // es·hora, en·hora, es·fecha: tres, aunque se llamaron dieciocho veces.
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe("compareText", () => {
  it("ordena igual que localeCompare con el idioma (tildes y ñ incluidas)", async () => {
    const { compareText } = await fresh();
    const names = ["ñame", "Arroz", "árbol", "naranja", "Zanahoria", "éxito"];
    for (const locale of ["es", "en"] as const) {
      const expected = [...names].sort((a, b) => a.localeCompare(b, locale));
      expect([...names].sort((a, b) => compareText(a, b, locale))).toEqual(
        expected,
      );
    }
  });

  it("crea un comparador por idioma, no uno por comparación", async () => {
    const { compareText } = await fresh();
    const Original = Intl.Collator;
    const spy = vi
      .spyOn(Intl, "Collator")
      .mockImplementation(function (
        ...args: ConstructorParameters<typeof Intl.Collator>
      ) {
        return new Original(...args);
      } as never);
    for (let i = 0; i < 10; i++) {
      compareText("a", "b", "es");
      compareText("a", "b", "en");
    }
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
