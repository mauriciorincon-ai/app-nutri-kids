import { describe, expect, it } from "vitest";

import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { fmt } from "@/i18n";

/**
 * Paridad ES/EN al 100% (acceptance criterion): mismas secciones, mismas claves,
 * cero strings vacíos y los MISMOS {placeholders} en ambos idiomas.
 */

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("i18n parity es↔en", () => {
  const sections = Object.keys(es) as (keyof typeof es)[];

  it("has the same sections", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it.each(sections)(
    "section '%s': same keys, non-empty, same placeholders",
    (section) => {
      const esSection: Record<string, string> = es[section];
      const enSection: Record<string, string> = en[section];
      expect(Object.keys(enSection).sort()).toEqual(
        Object.keys(esSection).sort(),
      );
      for (const key of Object.keys(esSection)) {
        expect(esSection[key].trim(), `es.${section}.${key} vacío`).not.toBe(
          "",
        );
        expect(enSection[key].trim(), `en.${section}.${key} vacío`).not.toBe(
          "",
        );
        expect(
          placeholders(enSection[key]),
          `placeholders de ${section}.${key}`,
        ).toEqual(placeholders(esSection[key]));
      }
    },
  );
});

describe("fmt", () => {
  it("interpolates named placeholders", () => {
    expect(fmt("Ya hiciste {done} de {total}", { done: 3, total: 6 })).toBe(
      "Ya hiciste 3 de 6",
    );
  });

  it("leaves unknown placeholders visible (bug detectable a ojo)", () => {
    expect(fmt("hasta el {date}", {})).toBe("hasta el {date}");
  });
});
