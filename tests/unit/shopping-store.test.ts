import { beforeEach, describe, expect, it } from "vitest";

import { BOUGHT_SLOT, clearDayToDay } from "@/lib/day-to-day/store";
import { BOUGHT_MAX, addBought, getBought, removeBought } from "@/lib/shopping/store";

/** «Lo que compré» (S13 · ADR-019): solo en este teléfono, defensivo y sin veredictos guardados. */
const item = (n: number) => ({
  code: `770253501${String(1000 + n)}`,
  name: `Producto ${n}`,
  brand: "Marca",
});

describe("lo que compré", () => {
  beforeEach(() => localStorage.clear());

  it("anota, lo más nuevo primero, y repetir un producto lo sube con el día de hoy (sin duplicar)", () => {
    addBought(item(1), "2026-07-06");
    addBought(item(2), "2026-07-07");
    const out = addBought(item(1), "2026-07-08");
    expect(out.map((b) => [b.code, b.date])).toEqual([
      [item(1).code, "2026-07-08"],
      [item(2).code, "2026-07-07"],
    ]);
    expect(getBought()).toEqual(out);
  });

  it("guarda código, nombre, marca y día: JAMÁS un veredicto ni nada del plan", () => {
    addBought(item(1), "2026-07-06");
    const raw = JSON.parse(localStorage.getItem(BOUGHT_SLOT) as string)[0];
    expect(Object.keys(raw).sort()).toEqual(["brand", "code", "date", "name"]);
  });

  it("tiene tope y no se desborda", () => {
    for (let i = 0; i < BOUGHT_MAX + 25; i++) addBought(item(i), "2026-07-06");
    expect(getBought()).toHaveLength(BOUGHT_MAX);
  });

  it("un valor roto, a medias o con un código inválido vuelve vacío o se descarta", () => {
    localStorage.setItem(BOUGHT_SLOT, "{no es json");
    expect(getBought()).toEqual([]);
    localStorage.setItem(BOUGHT_SLOT, JSON.stringify({ a: 1 }));
    expect(getBought()).toEqual([]);
    localStorage.setItem(
      BOUGHT_SLOT,
      JSON.stringify([
        { code: "123", name: "x", brand: "", date: "2026-07-06" },
        { code: item(1).code, name: "", brand: "", date: "2026-07-06" },
        { code: item(1).code, name: "Bien", brand: "", date: "ayer" },
        { code: item(2).code, name: "Bueno", brand: "M", date: "2026-07-06" },
      ]),
    );
    expect(getBought().map((b) => b.name)).toEqual(["Bueno"]);
  });

  it("no anota lo que no es un producto válido", () => {
    expect(addBought({ code: "abc", name: "x", brand: "" }, "2026-07-06")).toEqual([]);
    expect(addBought({ ...item(1), name: "  " }, "2026-07-06")).toEqual([]);
  });

  it("quita uno; si era el último, la clave se va", () => {
    addBought(item(1), "2026-07-06");
    expect(removeBought(item(1).code)).toEqual([]);
    expect(localStorage.getItem(BOUGHT_SLOT)).toBeNull();
  });

  it("«Borrar datos» (clearDayToDay) la limpia con lo demás", () => {
    addBought(item(1), "2026-07-06");
    clearDayToDay();
    expect(getBought()).toEqual([]);
    expect(localStorage.getItem(BOUGHT_SLOT)).toBeNull();
  });
});
