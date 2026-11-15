import { describe, expect, it } from "vitest";

import { orderByTexture } from "@/lib/diet/texture";

const o = (es: string, texture?: "soft" | "chopped" | "crunchy") => ({
  name: { es, en: es },
  ...(texture ? { texture } : {}),
});
const OPTIONS = [
  o("pera", "chopped"),
  o("kiwi", "soft"),
  o("uvas", "chopped"),
  o("manzana"),
  o("galleta", "crunchy"),
];
const view = (r: ReturnType<typeof orderByTexture>) =>
  r.map((x) => `${x.name.es}${x.notAccepted ? "*" : ""}`);

describe("orderByTexture", () => {
  it("sin texturas marcadas queda el orden del plan, sin marcas", () => {
    expect(view(orderByTexture(OPTIONS, []))).toEqual([
      "pera",
      "kiwi",
      "uvas",
      "manzana",
      "galleta",
    ]);
  });

  it("aceptadas primero, sin textura en medio, las que no acepta al final y marcadas", () => {
    expect(view(orderByTexture(OPTIONS, ["soft"]))).toEqual([
      "kiwi",
      "manzana",
      "pera*",
      "uvas*",
      "galleta*",
    ]);
  });

  it("dentro de cada grupo conserva el orden del plan", () => {
    expect(view(orderByTexture(OPTIONS, ["chopped", "crunchy"]))).toEqual([
      "pera",
      "uvas",
      "galleta",
      "manzana",
      "kiwi*",
    ]);
  });

  it("jamás oculta nada ni deja la lista vacía, aunque ninguna se acepte", () => {
    const r = orderByTexture(
      [o("pera", "chopped"), o("kiwi", "soft")],
      ["crunchy"],
    );
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.notAccepted)).toBe(true);
  });

  it("no muta la entrada", () => {
    const copy = JSON.stringify(OPTIONS);
    orderByTexture(OPTIONS, ["soft"]);
    expect(JSON.stringify(OPTIONS)).toBe(copy);
  });
});
