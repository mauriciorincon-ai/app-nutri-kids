import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FAMILY_STATE_ITEM,
  clearFamilyLocal,
  freshFamilyState,
  loadFamilyState,
  saveFamilyState,
} from "@/lib/family/state";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("estado de la familia en este teléfono", () => {
  const st = freshFamilyState("ABCDE12345", 1, "2026-11-16");

  it("guarda, lee y olvida", () => {
    expect(loadFamilyState()).toBeNull();
    expect(saveFamilyState(st)).toBe(true);
    expect(loadFamilyState()).toEqual(st);
    clearFamilyLocal();
    expect(loadFamilyState()).toBeNull();
  });

  it("un estado roto o con otra forma se descarta, no se adivina", () => {
    window.localStorage.setItem(FAMILY_STATE_ITEM, "{roto");
    expect(loadFamilyState()).toBeNull();
    window.localStorage.setItem(FAMILY_STATE_ITEM, JSON.stringify({ v: 9 }));
    expect(loadFamilyState()).toBeNull();
  });

  it("sin almacenamiento o con el disco lleno no revienta", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(saveFamilyState(st)).toBe(false);
    vi.restoreAllMocks();
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(loadFamilyState()).toBeNull();
    expect(saveFamilyState(st)).toBe(false);
    expect(() => clearFamilyLocal()).not.toThrow();
  });
});
