import { afterEach, describe, expect, it, vi } from "vitest";

import demoRaw from "../../data/demo-diet.json";
import { readPlanText } from "@/lib/diet/pdf-reader";
import {
  PLAN_DRAFT_KEY,
  clearPlanDraft,
  loadPlanDraft,
  savePlanDraft,
} from "@/lib/diet/plan-draft";
import { startReview } from "@/lib/diet/plan-review";
import { PROFILE_NOTES_KEY } from "@/lib/diet/profile-notes";
import { dietPlanSchema } from "@/lib/diet/schema";
import {
  STORAGE_KEYS,
  clearAllData,
  hasStoredRealDiet,
  loadActiveDiet,
  storeDiet,
} from "@/lib/diet/storage";

const blank = () =>
  startReview(
    readPlanText([
      { n: 1, height: 800, items: [{ str: "Nada", x: 1, y: 1, w: 10 }] },
    ]),
    new Date("2030-01-07T10:00:00"),
  );

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("borrador de la revisión (nutrikids.plan-draft.v1)", () => {
  it("guarda, retoma y borra", () => {
    expect(loadPlanDraft()).toBeNull();
    const s = blank();
    expect(savePlanDraft(s)).toBe(true);
    expect(loadPlanDraft()).toEqual(s);
    clearPlanDraft();
    expect(loadPlanDraft()).toBeNull();
    expect(window.localStorage.getItem(PLAN_DRAFT_KEY)).toBeNull();
  });

  it("un borrador corrupto se descarta, no se adivina", () => {
    window.localStorage.setItem(PLAN_DRAFT_KEY, "{roto");
    expect(loadPlanDraft()).toBeNull();
  });

  it("con la cuota llena avisa sin lanzar", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(savePlanDraft(blank())).toBe(false);
  });

  it("«Borrar datos» también borra la revisión a medias", () => {
    savePlanDraft(blank());
    clearAllData();
    expect(window.localStorage.getItem(PLAN_DRAFT_KEY)).toBeNull();
  });

  it("no guarda nada que identifique al niño ni al PDF", () => {
    savePlanDraft(blank());
    const raw = window.localStorage.getItem(PLAN_DRAFT_KEY) ?? "";
    expect(raw).not.toMatch(/%PDF|kg|cm|percentil|@/i);
  });
});

describe("storeDiet (plan revisado → plan real)", () => {
  const plan = dietPlanSchema.parse(demoRaw);

  it("guarda como real y devuelve conteos", () => {
    const r = storeDiet(plan, "diet-saved-from-pdf");
    expect(r.ok).toBe(true);
    expect(hasStoredRealDiet()).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEYS.source)).toBe("real");
    expect(loadActiveDiet().source).toBe("real");
  });

  it("si el almacenamiento falla (cuota), no queda a medias y avisa", () => {
    storeDiet(plan);
    const before = window.localStorage.getItem(STORAGE_KEYS.diet);
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });
    const r = storeDiet(plan);
    spy.mockRestore();
    expect(r).toEqual({ ok: false, error: "no-storage" });
    expect(window.localStorage.getItem(STORAGE_KEYS.diet)).toBe(before);
  });

  it("no toca lo que quien cuida anotó en el perfil (S5)", () => {
    const notes = JSON.stringify({ acceptedTextures: [], notes: [] });
    window.localStorage.setItem(PROFILE_NOTES_KEY, notes);
    storeDiet(plan);
    expect(window.localStorage.getItem(PROFILE_NOTES_KEY)).toBe(notes);
  });
});
