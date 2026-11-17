// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ALPHABET,
  CODE_LENGTH,
  PHRASE_LENGTH,
  PIN_LENGTH,
  formatCode,
  formatInvite,
  newDeviceId,
  newFamilyCode,
  newPhrase,
  normalizeCode,
  normalizePhrase,
  parseInvite,
} from "@/lib/family/phrase";

describe("código y frase de la familia", () => {
  it("el alfabeto tiene 32 letras sin I, L, O ni U", () => {
    expect(ALPHABET).toHaveLength(32);
    expect(new Set(ALPHABET).size).toBe(32);
    expect(ALPHABET).not.toMatch(/[ILOU]/);
  });

  it("la frase lleva 100 bits: 20 caracteres en 5 grupos de 4", () => {
    const p = newPhrase();
    expect(p).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
    expect(PHRASE_LENGTH * Math.log2(ALPHABET.length)).toBe(100);
  });

  it("el código lleva 10 caracteres y se muestra en 2 grupos", () => {
    const c = newFamilyCode();
    expect(c).toHaveLength(CODE_LENGTH);
    expect(formatCode(c)).toMatch(/^.{5}-.{5}$/);
    expect(newDeviceId()).toHaveLength(12);
  });

  it("usa la fuente de azar del sistema: dos frases jamás salen iguales", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newPhrase()));
    expect(seen.size).toBe(500);
  });

  it("cada byte se lleva a una letra sin sesgo (byte & 31)", () => {
    const fixed = (bytes: Uint8Array) => bytes.map((_, i) => i * 8 + 1);
    expect(newPhrase(fixed).replace(/-/g, "")).toBe(
      Array.from({ length: 20 }, (_, i) => ALPHABET[(i * 8 + 1) & 31]).join(""),
    );
  });

  it("al leerla perdona minúsculas, espacios, guiones, O→0 e I/L→1", () => {
    expect(normalizePhrase("abcd-efgh jkmn-pqrs-tvwx")).toBe(
      "ABCDEFGHJKMNPQRSTVWX",
    );
    expect(normalizePhrase("OOOO IIII LLLL 0000 1111")).toBe(
      "00001111111100001111",
    );
    expect(normalizeCode("a1b2c-d3e4f")).toBe("A1B2CD3E4F");
  });

  it("rechaza largo equivocado o letras fuera del alfabeto (la U)", () => {
    expect(normalizePhrase("ABCD")).toBeNull();
    expect(normalizePhrase("UUUU-UUUU-UUUU-UUUU-UUUU")).toBeNull();
    expect(normalizeCode("A1B2C-D3E4")).toBeNull();
    expect(normalizeCode("A1B2C-D3E4!")).toBeNull();
  });
});

describe("invitación: la huella mide siempre 12 (60 bits)", () => {
  const FAMILY = "A1B2CD3E4F";
  const PIN = "0123456789AB";
  it("va y vuelve con huella de 12, con o sin etiqueta", () => {
    expect(PIN_LENGTH).toBe(12);
    expect(parseInvite(formatInvite(FAMILY, PIN))).toEqual({
      family: FAMILY,
      pin: PIN,
      tag: null,
    });
    expect(parseInvite(formatInvite(FAMILY, PIN, "ABCD"))?.pin.length).toBe(12);
  });
  it("una huella más corta o más larga no se acepta", () => {
    expect(parseInvite(formatInvite(FAMILY, PIN.slice(0, 11)))).toBeNull();
    expect(parseInvite(formatInvite(FAMILY, PIN + "C", "A"))).toBeNull();
  });
});
