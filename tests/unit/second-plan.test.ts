import { describe, expect, it } from "vitest";

import demoRaw from "../../data/demo-diet.json";
import {
  LOAD_SECOND_FLAG,
  SECOND_PLAN_SLOT,
  clearSecondPlan,
  isLoadingSecond,
  loadSecondPlan,
  setLoadingSecond,
  storeSecondPlan,
} from "@/lib/diet/second-plan";
import { dietPlanSchema } from "@/lib/diet/schema";
import {
  STORAGE_KEYS,
  clearAllData,
  loadActiveDiet,
  storeDiet,
} from "@/lib/diet/storage";

// Planes inventados: una variación de la demo, JAMÁS la dieta de un niño.
const plan = (id: string) =>
  dietPlanSchema.parse({
    ...demoRaw,
    meta: { ...demoRaw.meta, id },
  });

describe("segundo plan (local, aparte del activo)", () => {
  it("se guarda, se lee validado y se borra", () => {
    expect(loadSecondPlan()).toBeNull();
    expect(storeSecondPlan(plan("segundo-v1"))).toBe(true);
    expect(loadSecondPlan()?.meta.id).toBe("segundo-v1");
    clearSecondPlan();
    expect(loadSecondPlan()).toBeNull();
  });

  it("un JSON que no valida se lee como «no hay segundo plan»", () => {
    window.localStorage.setItem(SECOND_PLAN_SLOT, "{no json");
    expect(loadSecondPlan()).toBeNull();
    window.localStorage.setItem(SECOND_PLAN_SLOT, JSON.stringify({ a: 1 }));
    expect(loadSecondPlan()).toBeNull();
    clearSecondPlan();
  });

  it("la marca «el próximo plan es el segundo» se enciende, se apaga y se limpia al guardar", () => {
    expect(isLoadingSecond()).toBe(false);
    setLoadingSecond(true);
    expect(isLoadingSecond()).toBe(true);
    setLoadingSecond(false);
    expect(isLoadingSecond()).toBe(false);
    setLoadingSecond(true);
    storeSecondPlan(plan("segundo-v2"));
    expect(isLoadingSecond()).toBe(false);
    clearSecondPlan();
  });

  it("no toca el plan activo", () => {
    storeSecondPlan(plan("segundo-v3"));
    expect(loadActiveDiet().diet.meta.id).toBe("demo-diet-v1");
    clearSecondPlan();
  });

  it("«Borrar datos» también borra el segundo plan y la marca", () => {
    storeSecondPlan(plan("segundo-v4"));
    setLoadingSecond(true);
    clearAllData();
    expect(window.localStorage.getItem(SECOND_PLAN_SLOT)).toBeNull();
    expect(window.localStorage.getItem(LOAD_SECOND_FLAG)).toBeNull();
  });
});

describe("storeDiet: el sello del plan", () => {
  it("usa la hora dada (así la bitácora reconoce un cambio de línea) y, sin ella, la actual", () => {
    storeDiet(plan("activo-v1"), "diet-line-changed", 1234);
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEYS.planMeta)!),
    ).toMatchObject({ t: 1234 });
    const before = Date.now();
    storeDiet(plan("activo-v2"));
    const t = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.planMeta)!)
      .t as number;
    expect(t).toBeGreaterThanOrEqual(before);
    clearAllData();
  });
});
