import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/ajustes/page";
import { DietProvider } from "@/components/diet-provider";
import { I18nProvider } from "@/i18n";
import { getPush } from "@/lib/push/controller";

/**
 * «Borrar mis datos» con familia: si la familia no se pudo borrar (sin red), NO se borra nada
 * y los avisos siguen como estaban — el orden de la pantalla (primero la familia, los avisos
 * justo antes de borrar) lo garantiza. S8 · auditoría.
 */

const destroy = vi.fn();
const leave = vi.fn();

vi.mock("@/components/family/use-family", () => ({
  useFamily: () => ({ phase: "idle", phones: [] }),
}));
vi.mock("@/components/family/family-section", () => ({
  FamilySection: () => null,
}));
vi.mock("@/components/push/push-section", () => ({ PushSection: () => null }));
vi.mock("@/lib/family/controller", () => ({
  getFamily: () => ({ destroy, leave }),
}));

describe("Ajustes · Borrar mis datos con familia", () => {
  beforeEach(() => {
    destroy.mockReset();
    leave.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("si la familia falla, los avisos no se apagan y los datos no se borran", async () => {
    destroy.mockResolvedValue({ ok: false, reason: "offline" });
    const disable = vi
      .spyOn(getPush(), "disable")
      .mockResolvedValue({ server: true });
    localStorage.setItem("nutrikids.sentinel", "1");
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <DietProvider>
          <SettingsPage />
        </DietProvider>
      </I18nProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Borrar mis datos" }));
    await user.click(
      await screen.findByRole("checkbox", { name: /compartido/i }),
    );
    await user.click(await screen.findByRole("button", { name: "Sí, borrar" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(disable).not.toHaveBeenCalled();
    expect(localStorage.getItem("nutrikids.sentinel")).toBe("1");
  });

  it("si la familia sale bien, los avisos se apagan y se borra", async () => {
    leave.mockResolvedValue({ ok: true });
    const disable = vi
      .spyOn(getPush(), "disable")
      .mockResolvedValue({ server: true });
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <DietProvider>
          <SettingsPage />
        </DietProvider>
      </I18nProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Borrar mis datos" }));
    await user.click(await screen.findByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(disable).toHaveBeenCalledTimes(1));
    expect(leave).toHaveBeenCalledTimes(1);
    await screen.findByText(/Datos borrados/);
  });
});
