import { describe, expect, it } from "vitest";

import { validGtin as scriptValid } from "../../scripts/build-catalog.mjs";
import { checkCode, digitsOf, lookupKeys, validGtin } from "@/lib/scan/gtin";

/** Códigos de barras (S13 · ADR-019): el dígito de control manda; uno inválido jamás se busca. */
const EAN13 = "7702535016688"; // el de un producto real del catálogo: su dígito de control cuadra
const EAN8 = "96385074"; // ejemplo público de GTIN-8
const UPCA = "036000291452"; // ejemplo público de UPC-A

describe("dígito de control", () => {
  it("acepta un EAN-13, un EAN-8 y un UPC-A válidos", () => {
    for (const c of [EAN13, EAN8, UPCA]) expect(validGtin(c), c).toBe(true);
  });

  it("rechaza el dígito de control equivocado, una cifra de más y una de menos", () => {
    expect(validGtin("7702535016689")).toBe(false);
    expect(validGtin("96385075")).toBe(false);
    expect(validGtin("036000291453")).toBe(false);
    expect(validGtin(EAN13 + "1")).toBe(false);
    expect(validGtin(EAN13.slice(1))).toBe(false);
    expect(validGtin("")).toBe(false);
    expect(validGtin("77025350166ab")).toBe(false);
  });

  it("el script del catálogo y la app calculan lo mismo, código por código", () => {
    for (let n = 0; n < 400; n++) {
      const code = String(7700000000000 + n * 7919).padStart(13, "0");
      expect(scriptValid(code), code).toBe(validGtin(code));
    }
  });
});

describe("lo que alguien escribe o lee", () => {
  it("quita espacios y guiones y valida", () => {
    expect(digitsOf("770 2535-016688")).toBe(EAN13);
    expect(checkCode(" 770 2535 016688 ")).toEqual({ ok: true, code: EAN13 });
  });

  it("dice por qué no: vacío, largo equivocado o dígito de control", () => {
    expect(checkCode("   ")).toEqual({ ok: false, problem: "empty" });
    expect(checkCode("abc")).toEqual({ ok: false, problem: "empty" });
    expect(checkCode("12345")).toEqual({ ok: false, problem: "length" });
    expect(checkCode("77025350166")).toEqual({ ok: false, problem: "length" });
    expect(checkCode("7702535016689")).toEqual({ ok: false, problem: "checksum" });
  });

  it("un UPC-A y su EAN-13 con cero delante son el mismo producto", () => {
    expect(lookupKeys(UPCA)).toEqual([UPCA, `0${UPCA}`]);
    expect(lookupKeys(`0${UPCA}`)).toEqual([`0${UPCA}`, UPCA]);
    expect(lookupKeys(EAN13)).toEqual([EAN13]);
    expect(validGtin(`0${UPCA}`)).toBe(true);
  });
});
