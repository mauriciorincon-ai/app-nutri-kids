import { describe, expect, it } from "vitest";

import demo from "../../data/demo-diet.json";
import { APT_MAX, aptProducts, categoryChain } from "@/lib/catalog/apt";
import { allergenWords, checkProduct } from "@/lib/catalog/product";
import type { Product } from "@/lib/catalog/schema";
import { dietPlanSchema } from "@/lib/diet/schema";

/**
 * Un producto del catálogo con el MISMO cotejo que la foto (S13 · ADR-019), y las «marcas aptas».
 * Los productos son INVENTADOS; el plan es la demo. Reloj fijo: nunca la fecha real.
 */
const diet = dietPlanSchema.parse(demo);
const NOW = new Date("2026-07-06T12:00:00");

const product = (over: Partial<Product> = {}): Product => ({
  code: "7702535016688",
  name: "Galletas demo",
  brand: "Marca Demo",
  cat: ["snacks", "biscuits"],
  ing: "harina de arroz, agua, aceite de girasol, sal, levadura, semillas de linaza",
  add: [],
  alg: [],
  tr: [],
  ...over,
});

describe("checkProduct", () => {
  it("un producto sin nada que choque, con ingredientes completos: «no vi nada que choque»", () => {
    expect(checkProduct(product(), diet, NOW).verdict).toBe("ok");
  });

  it("un aditivo del plan declarado por el catálogo es «no va», aunque el texto no lo diga", () => {
    const r = checkProduct(product({ add: ["E999"] }), diet, NOW);
    expect(r.verdict).toBe("no");
    expect(r.hits[0]).toMatchObject({ kind: "additive", code: "E999" });
  });

  it("un aditivo con letra («E999D») se mira como su número", () => {
    expect(checkProduct(product({ add: ["E999D"] }), diet, NOW).verdict).toBe("no");
  });

  it("una alergia del plan declarada en el catálogo es «no va» (mariscos ← crustáceos)", () => {
    const r = checkProduct(product({ alg: ["crustaceans"] }), diet, NOW);
    expect(r.verdict).toBe("no");
    expect(r.hits.some((h) => h.kind === "allergy")).toBe(true);
  });

  it("una alergia solo en las trazas del catálogo TAMBIÉN es «no va»", () => {
    const r = checkProduct(product({ tr: ["molluscs"] }), diet, NOW);
    expect(r.verdict).toBe("no");
    expect(r.hits.find((h) => h.kind === "allergy")?.where).toBe("traces");
  });

  it("un rojo del plan en los ingredientes del catálogo es «no va»; un amarillo, «revisa»", () => {
    expect(
      checkProduct(product({ ing: "agua, azúcar, gaseosas, sal, aceite" }), diet, NOW)
        .verdict,
    ).toBe("no");
    expect(
      checkProduct(product({ ing: "agua, banano, harina de arroz, sal, aceite" }), diet, NOW)
        .verdict,
    ).toBe("check");
  });

  it("sin lista de ingredientes: «no sé qué lleva», NUNCA «no vi nada que choque»", () => {
    expect(checkProduct(product({ ing: "" }), diet, NOW).verdict).toBe("unreadable");
    // …ni siquiera cuando el catálogo declara «sin alérgenos»: una declaración vacía no suma apto.
    expect(
      checkProduct(product({ ing: "", add: [], alg: [], tr: [] }), diet, NOW).verdict,
    ).toBe("unreadable");
  });

  it("con ingredientes vacíos y un alérgeno declarado, igual es «no va» (con el aviso de que falta texto)", () => {
    const r = checkProduct(product({ ing: "", alg: ["crustaceans"] }), diet, NOW);
    expect(r.verdict).toBe("no");
    expect(r.partial).toBe(true);
  });

  it("un texto corto o con ruido tampoco es «apto»", () => {
    expect(checkProduct(product({ ing: "sal" }), diet, NOW).verdict).toBe("unreadable");
    expect(checkProduct(product({ ing: "x1 y2 z3 ..." }), diet, NOW).verdict).toBe(
      "unreadable",
    );
  });

  it("lo anotado por quien cuida también cuenta", () => {
    const r = checkProduct(product({ alg: ["peanuts"] }), diet, NOW, [
      { kind: "allergy", text: "maní" },
    ]);
    expect(r.verdict).toBe("no");
  });

  it("los alérgenos sin traducción entran con sus palabras: se sobra, nunca se falta", () => {
    expect(allergenWords("milk")).toMatch(/leche/);
    expect(allergenWords("tree-nuts")).toBe("tree nuts");
  });
});

describe("marcas aptas", () => {
  const ok = (n: number, brand = "Marca"): Product =>
    product({ code: `770253501${String(1000 + n)}`, name: `Producto ${n}`, brand });

  it("solo salen los que dan «no vi nada que choque»: ni «no», ni «revisa», ni «no sé qué lleva»", () => {
    const candidates = [
      ok(1),
      product({ code: "1111111111111", name: "Con aditivo", add: ["E999"] }),
      product({ code: "2222222222222", name: "Con amarillo", ing: "banano, agua, harina de arroz, sal" }),
      product({ code: "3333333333333", name: "Sin ingredientes", ing: "" }),
      product({ code: "4444444444444", name: "Con mariscos", tr: ["crustaceans"] }),
      ok(2),
    ];
    const out = aptProducts(candidates, diet, NOW);
    expect(out.map((p) => p.name)).toEqual(["Producto 1", "Producto 2"]);
    for (const p of out) expect(checkProduct(p, diet, NOW).verdict).toBe("ok");
  });

  it("deja fuera el producto que se está mirando y los repetidos, y corta en 5", () => {
    const many = Array.from({ length: 12 }, (_, i) => ok(i));
    const out = aptProducts([...many, many[0]], diet, NOW, { exclude: many[3].code });
    expect(out).toHaveLength(APT_MAX);
    expect(out.some((p) => p.code === many[3].code)).toBe(false);
    expect(new Set(out.map((p) => p.code)).size).toBe(out.length);
  });

  it("el orden es estable (marca y nombre): sin favoritos", () => {
    const a = aptProducts([ok(2, "Zeta"), ok(1, "Alfa"), ok(3, "Alfa")], diet, NOW);
    expect(a.map((p) => p.name)).toEqual(["Producto 1", "Producto 3", "Producto 2"]);
  });

  it("si no hay ninguno apto, la lista queda vacía: jamás se rellena con dudosos", () => {
    expect(aptProducts([product({ add: ["E999"] }), product({ ing: "" })], diet, NOW)).toEqual([]);
  });

  it("la categoría sube a lo sumo dos niveles y nunca hasta la raíz", () => {
    expect(categoryChain({ cat: ["food", "snacks", "biscuits", "oat-biscuits"] })).toEqual([
      "oat-biscuits",
      "biscuits",
      "snacks",
    ]);
    expect(categoryChain({ cat: ["food", "snacks"] })).toEqual(["snacks"]);
    expect(categoryChain({ cat: ["snacks"] })).toEqual(["snacks"]);
    expect(categoryChain({ cat: [] })).toEqual([]);
  });
});
