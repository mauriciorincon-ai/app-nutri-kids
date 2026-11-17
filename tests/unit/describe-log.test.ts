import { describe, expect, it } from "vitest";

import demoRaw from "../../data/demo-diet.json";
import { errorText } from "@/components/family/parts";
import { describeLog } from "@/components/family/roles";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { dietPlanSchema } from "@/lib/diet/schema";
import { lineLabel } from "@/lib/diet/reconcile";

const diet = dietPlanSchema.parse(demoRaw);
const nameOf = (id: string) => id;

describe("bitácora en llano: la línea del plan unido sale con su nombre, en los dos idiomas", () => {
  const key = `food:${diet.trafficLight.green.groups[0]!.items[0]!.id}`;
  const label = lineLabel(diet, key)!;

  it("es", () => {
    const text = describeLog(
      { k: "plan-line", r: key, t: 1, by: "x" } as never,
      es,
      "es",
      diet,
      nameOf,
    );
    expect(text).toContain(label.es);
    expect(text).not.toContain("food:");
  });

  it("en", () => {
    const text = describeLog(
      { k: "plan-line", r: key, t: 1, by: "x" } as never,
      en,
      "en",
      diet,
      nameOf,
    );
    expect(text).toContain(label.en);
    expect(text).not.toContain("food:");
  });

  it("una línea que ya no existe no enseña la clave cruda", () => {
    const text = describeLog(
      { k: "plan-line", r: "food:no-existe", t: 1, by: "x" } as never,
      es,
      "es",
      diet,
      nameOf,
    );
    expect(text).toContain(es.family.logItemOther);
    expect(text).not.toContain("no-existe");
  });
});

describe("la lista de la familia llena se dice en llano, en los dos idiomas", () => {
  it("«roster-full» no es el mensaje genérico y dice qué puede hacer el padre", () => {
    for (const dict of [es, en]) {
      const full = errorText(dict, "roster-full");
      expect(full).not.toBe(errorText(dict, "invalid"));
      expect(full.length).toBeGreaterThan(60);
    }
    expect(errorText(es, "roster-full")).toMatch(
      /sale de la familia.*crea una nueva/,
    );
    expect(errorText(en, "roster-full")).toMatch(
      /leaves the family.*creates a new one/,
    );
  });
});
