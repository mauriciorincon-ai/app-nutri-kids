import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/ajustes/page";
import { ThemeSync } from "@/components/app-shell/theme-sync";
import { DietProvider } from "@/components/diet-provider";
import { I18nProvider } from "@/i18n";
import { loadPrefs } from "@/lib/diet/storage";

/** Ajustes · Tema (S11): se elige, se recuerda, se aplica y no pisa el idioma. */

vi.mock("@/components/family/use-family", () => ({
  useFamily: () => ({ phase: "idle", phones: [] }),
}));
vi.mock("@/components/family/family-section", () => ({
  FamilySection: () => null,
}));
vi.mock("@/components/push/push-section", () => ({ PushSection: () => null }));

let systemDark = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  systemDark = false;
  listeners.clear();
  window.matchMedia = ((q: string) => ({
    media: q,
    get matches() {
      return systemDark;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as never;
});
afterEach(() => vi.restoreAllMocks());

function renderApp() {
  return render(
    <I18nProvider>
      <DietProvider>
        <ThemeSync />
        <SettingsPage />
      </DietProvider>
    </I18nProvider>,
  );
}

describe("Ajustes · Tema", () => {
  it("empieza en «Sistema» y lo marca (aria-pressed)", () => {
    renderApp();
    expect(screen.getByTestId("theme-system")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("theme-dark")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("Oscuro: pone la clase y se recuerda; Claro la quita", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("theme-dark"));
    expect(document.documentElement).toHaveClass("dark");
    expect(loadPrefs().theme).toBe("dark");
    await user.click(screen.getByTestId("theme-light"));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(loadPrefs().theme).toBe("light");
  });

  it("cambiar el idioma no pierde el tema", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("theme-dark"));
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(loadPrefs()).toMatchObject({ locale: "en", theme: "dark" });
    expect(document.documentElement).toHaveClass("dark");
  });

  it("en «Sistema» sigue al teléfono cuando cambia; con tema a mano, no", async () => {
    const user = userEvent.setup();
    renderApp();
    systemDark = true;
    listeners.forEach((fn) => fn());
    expect(document.documentElement).toHaveClass("dark");
    await user.click(screen.getByTestId("theme-light"));
    expect(listeners.size).toBe(0); // dejó de escuchar al teléfono
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
