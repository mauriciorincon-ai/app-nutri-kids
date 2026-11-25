import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const changed = vi.fn();
const stop = vi.fn();
vi.mock("@/lib/family/controller", () => ({
  getFamily: () => ({ start: () => stop, changed }),
}));

import { FamilySync } from "@/components/family/family-sync";
import { addPressure, clearPressure } from "@/lib/pressure/store";

/**
 * S14: lo anotado en «Cuando le ofrecen algo» sube poco después, como el resto de lo del día; antes
 * esperaba al sondeo de 30 s porque el registro avisa con su propio evento.
 */
describe("FamilySync · disparadores", () => {
  afterEach(() => {
    clearPressure();
    changed.mockClear();
  });

  it("una anotación de presión pide sincronizar; al desmontar deja de escuchar", () => {
    const { unmount } = render(<FamilySync />);
    changed.mockClear();
    const t = new Date("2026-07-06T07:30:00").getTime();
    addPressure(
      {
        id: "p1abcdef9",
        t,
        date: "2026-07-06",
        by: "3677AMW2FSVY",
        who: "other",
        what: "outside",
        place: "party",
        answer: "calm-no",
      },
      t,
    );
    expect(changed).toHaveBeenCalled();

    unmount();
    expect(stop).toHaveBeenCalled();
    changed.mockClear();
    clearPressure();
    expect(changed).not.toHaveBeenCalled();
  });
});
