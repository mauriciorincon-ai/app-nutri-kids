import { describe, expect, it } from "vitest";

import { pantryWrite, plateWrite } from "@/lib/camera/access";
import { may, type Member } from "@/lib/family/roster";

/** Rol × flujo de la cámara (S12): la misma `may()` que usa la sincronía. */
type Role = Member["role"];
const member = (role: Role, meals?: string[]) => ({ role, meals });

describe("quién puede usar la cámara", () => {
  it.each<[Role, boolean]>([
    ["parent", true],
    ["caregiver", true],
    ["school", false],
    ["nutritionist", false],
  ])("despensa y recetas: %s → %s", (role, allowed) => {
    expect(may(member(role), pantryWrite())).toBe(allowed);
  });

  it.each<[string, Role, string[] | undefined, string, boolean]>([
    ["madre o padre", "parent", undefined, "almuerzo", true],
    ["cuidador", "caregiver", undefined, "cena", true],
    ["colegio, su comida", "school", ["almuerzo"], "almuerzo", true],
    ["colegio, otra comida", "school", ["almuerzo"], "cena", false],
    ["colegio sin comidas", "school", [], "almuerzo", false],
    ["nutricionista", "nutritionist", undefined, "almuerzo", false],
  ])("mirar el plato: %s", (_n, role, meals, meal, allowed) => {
    expect(may(member(role, meals), plateWrite(meal))).toBe(allowed);
  });

  it("sin rol (familia sin elegir) no puede nada", () => {
    expect(may(null, pantryWrite())).toBe(false);
    expect(may(undefined, plateWrite("almuerzo"))).toBe(false);
  });
});
