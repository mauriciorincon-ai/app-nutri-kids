// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  live,
  mapChanged,
  mergeMap,
  mergePlan,
  mergeReg,
  wins,
  type Reg,
  type RegMap,
} from "@/lib/family/merge";

const r = <T>(t: number, by: string, v: T | null): Reg<T> => ({ t, by, v });

describe("mezcla determinista (el último que escribe gana, por marca y por nota)", () => {
  it("gana la hora más reciente", () => {
    expect(mergeReg(r(1, "A", "x"), r(2, "B", "y"))?.v).toBe("y");
    expect(mergeReg(r(3, "A", "x"), r(2, "B", "y"))?.v).toBe("x");
    expect(mergeReg(undefined, r(1, "A", "x"))?.v).toBe("x");
    expect(mergeReg(r(1, "A", "x"), undefined)?.v).toBe("x");
  });

  it("empate de hora: gana el teléfono de id mayor; empate total: el valor mayor", () => {
    expect(mergeReg(r(5, "A", "x"), r(5, "B", "y"))?.by).toBe("B");
    expect(mergeReg(r(5, "B", "y"), r(5, "A", "x"))?.by).toBe("B");
    expect(mergeReg(r(5, "A", "a"), r(5, "A", "b"))?.v).toBe("b");
    expect(wins(r(5, "A", "a"), r(5, "A", "a"))).toBe(false);
  });

  it("quitar una marca es un cambio: la lápida más nueva gana y no reaparece", () => {
    const phoneA: RegMap<{ at: string }> = {
      "meal:a": r(10, "A", { at: "08:00" }),
    };
    const phoneB: RegMap<{ at: string }> = { "meal:a": r(20, "B", null) };
    const merged = mergeMap(phoneA, phoneB);
    expect(merged["meal:a"].v).toBeNull();
    expect(live(merged)).toEqual({});
    // Una marca más nueva después de la lápida sí vuelve.
    expect(
      live(mergeMap(merged, { "meal:a": r(30, "A", { at: "09:00" }) })),
    ).toEqual({
      "meal:a": { at: "09:00" },
    });
  });

  it("cada marca por separado: dos teléfonos marcando cosas distintas no se pisan", () => {
    const a = { "meal:a": r(1, "A", { at: "08:00" }) };
    const b = { "meal:b": r(2, "B", { at: "13:00" }) };
    expect(Object.keys(live(mergeMap(a, b))).sort()).toEqual([
      "meal:a",
      "meal:b",
    ]);
  });

  it("es conmutativa, asociativa e idempotente: todos los teléfonos llegan a lo mismo", () => {
    const x: RegMap<string> = { k1: r(1, "A", "a"), k2: r(4, "A", null) };
    const y: RegMap<string> = { k1: r(1, "B", "b"), k3: r(2, "B", "c") };
    const z: RegMap<string> = { k2: r(4, "C", "d"), k3: r(2, "B", "c") };
    const sort = (m: RegMap<string>) =>
      JSON.stringify(Object.entries(m).sort());
    expect(sort(mergeMap(x, y))).toBe(sort(mergeMap(y, x)));
    expect(sort(mergeMap(mergeMap(x, y), z))).toBe(
      sort(mergeMap(x, mergeMap(y, z))),
    );
    expect(sort(mergeMap(x, x))).toBe(sort(x));
  });

  it("mapChanged detecta lo nuevo, lo quitado y lo cambiado", () => {
    const a = { k: r(1, "A", "x") };
    expect(mapChanged(a, { ...a })).toBe(false);
    expect(mapChanged(a, { k: r(2, "A", "x") })).toBe(true);
    expect(mapChanged(a, { k: r(1, "B", "x") })).toBe(true);
    expect(mapChanged(a, { k: r(1, "A", "y") })).toBe(true);
    expect(mapChanged(a, {})).toBe(true);
    expect(mapChanged({}, a)).toBe(true);
  });
});

describe("el plan, por versión", () => {
  const local = { t: 10, by: "A", diet: "local" };
  const remote = { t: 20, by: "B", diet: "remoto" };

  it("sin cambio remoto: queda el local; se sube solo si cambió", () => {
    expect(mergePlan(local, true, null)).toEqual({
      winner: local,
      conflict: false,
      push: true,
    });
    expect(mergePlan(local, false, null)).toEqual({
      winner: local,
      conflict: false,
      push: false,
    });
  });

  it("solo cambió el remoto: se toma sin aviso", () => {
    expect(mergePlan(local, false, remote)).toEqual({
      winner: remote,
      conflict: false,
      push: false,
    });
  });

  it("los dos lo cambiaron: queda el más reciente y se avisa", () => {
    expect(mergePlan(local, true, remote)).toEqual({
      winner: remote,
      conflict: true,
      push: false,
    });
    const newer = { ...local, t: 30 };
    expect(mergePlan(newer, true, remote)).toEqual({
      winner: newer,
      conflict: true,
      push: true,
    });
  });

  it("empate de hora: gana el teléfono de id mayor", () => {
    const tieL = { t: 20, by: "Z", diet: "l" };
    expect(mergePlan(tieL, true, remote).winner).toBe(tieL);
    expect(mergePlan({ ...tieL, by: "A" }, true, remote).winner).toBe(remote);
  });
});
