import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS, type ThemePref } from "@/lib/diet/storage";
import { applyTheme, resolveTheme, THEME_COLORS } from "@/lib/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";

/**
 * Tema (S11, ADR-016): quién manda (ajuste o teléfono), qué se pone en <html> y en la barra, y
 * que el script de antes del primer pintado hace lo mismo que `applyTheme`.
 */

const root = document.documentElement;

function barMetas() {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLORS.light}">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}">`;
  return [...document.querySelectorAll('meta[name="theme-color"]')];
}

function snapshot() {
  return {
    pref: root.dataset.themePref,
    dark: root.classList.contains("dark"),
    scheme: root.style.colorScheme,
    bar: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) =>
      m.getAttribute("content"),
    ),
  };
}

function reset() {
  root.classList.remove("dark");
  delete root.dataset.themePref;
  root.style.colorScheme = "";
  window.localStorage.clear();
  barMetas();
}

beforeEach(reset);
afterEach(reset);

describe("resolveTheme", () => {
  it("un tema elegido a mano gana al teléfono; «sistema» lo sigue", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("applyTheme", () => {
  it("oscuro: clase, color-scheme y las dos etiquetas de la barra en oscuro", () => {
    applyTheme(document, "dark", false);
    expect(snapshot()).toEqual({
      pref: "dark",
      dark: true,
      scheme: "dark",
      bar: [THEME_COLORS.dark, THEME_COLORS.dark],
    });
  });

  it("claro con el teléfono oscuro: manda lo elegido", () => {
    applyTheme(document, "light", true);
    expect(snapshot()).toEqual({
      pref: "light",
      dark: false,
      scheme: "light",
      bar: [THEME_COLORS.light, THEME_COLORS.light],
    });
  });

  it("«sistema»: cada etiqueta conserva su color y la clase sigue al teléfono", () => {
    applyTheme(document, "dark", false); // venía de un tema a mano
    applyTheme(document, "system", true);
    expect(snapshot()).toEqual({
      pref: "system",
      dark: true,
      scheme: "dark",
      bar: [THEME_COLORS.light, THEME_COLORS.dark],
    });
    applyTheme(document, "system", false);
    expect(snapshot().dark).toBe(false);
  });

  it("no toca <html> si nada cambió (invalidar estilos cuesta)", () => {
    applyTheme(document, "dark", false);
    let touched = 0;
    const observer = new MutationObserver((records) => {
      touched += records.length;
    });
    observer.observe(root, { attributes: true });
    applyTheme(document, "dark", false);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
    expect(touched).toBe(0);
  });
});

describe("THEME_SCRIPT (corre antes del primer pintado)", () => {
  function runScript(pref: unknown, systemDark: boolean) {
    if (pref !== undefined) {
      window.localStorage.setItem(
        STORAGE_KEYS.prefs,
        JSON.stringify({ theme: pref }),
      );
    }
    const original = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({ matches: systemDark, media: q }) as MediaQueryList) as never;
    try {
      new Function(THEME_SCRIPT)();
    } finally {
      window.matchMedia = original;
    }
  }

  const cases: [ThemePref | undefined, boolean][] = [
    [undefined, false],
    [undefined, true],
    ["system", true],
    ["system", false],
    ["light", true],
    ["dark", false],
  ];

  it.each(cases)(
    "ajuste %s, teléfono oscuro=%s: deja el documento como applyTheme",
    (pref, systemDark) => {
      runScript(pref, systemDark);
      const fromScript = snapshot();
      reset();
      applyTheme(document, pref ?? "system", systemDark);
      expect(fromScript).toEqual(snapshot());
    },
  );

  it("un valor roto o ajeno no rompe la página y cae en «sistema»", () => {
    runScript("azul", true);
    expect(snapshot().dark).toBe(true);
    reset();
    window.localStorage.setItem(STORAGE_KEYS.prefs, "###");
    expect(() => new Function(THEME_SCRIPT)()).not.toThrow();
  });
});
