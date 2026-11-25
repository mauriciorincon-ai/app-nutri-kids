import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OFF_VIEW } from "@/lib/family/controller";
import { may, ROLES, type Role, type Write } from "@/lib/family/roster";

const fam = vi.hoisted(() => ({
  phase: "off" as "off" | "ready",
  role: null as Role | null,
}));
vi.mock("@/components/family/use-family", () => ({
  useFamily: () => ({ ...OFF_VIEW, phase: fam.phase, role: fam.role }),
  useWho: () => () => undefined,
  useCan: () => (w: Write) =>
    fam.phase === "off" ||
    may(fam.role ? { role: fam.role, meals: ["almuerzo"] } : null, w),
}));

import LearnPage from "@/app/aprende/page";
import { DayCard } from "@/components/learn/day-card";
import { DietProvider } from "@/components/diet-provider";
import { I18nProvider } from "@/i18n";
import { clearDayLog, getWellbeing, setHabit } from "@/lib/diet/day-log";
import { clearProfileNotes, setAgeBand } from "@/lib/diet/profile-notes";
import { notifyLocalStore } from "@/lib/local-store";
import { TWIN_KEY } from "@/lib/insights/twin-store";

/** Un lunes a las 20:00, para que el reloj no sea la hora de quien corre la prueba. */
const NOW = new Date("2026-08-10T20:00:00");
const today = new Date("2026-08-10T12:00:00");

const ui = (node: React.ReactNode) =>
  render(
    <I18nProvider>
      <DietProvider>{node}</DietProvider>
    </I18nProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  window.localStorage.clear();
  clearDayLog();
  clearProfileNotes();
  fam.phase = "off";
  fam.role = null;
});
afterEach(() => vi.useRealTimers());

const asRole = (role: Role) => {
  fam.phase = "ready";
  fam.role = role;
};

describe("«Lo que aprende» y quién la ve (G-Plan 2a)", () => {
  it("madre o padre, y un teléfono sin familia, ven el cómo va, lo que se repite y lo que aprende", async () => {
    for (const setup of [() => {}, () => asRole("parent")]) {
      fam.phase = "off";
      setup();
      const { unmount } = ui(<LearnPage />);
      expect(await screen.findByTestId("learn-week")).toBeVisible();
      expect(screen.getByTestId("learn-radar")).toBeVisible();
      expect(screen.getByTestId("learn-twin")).toBeVisible();
      expect(screen.queryByTestId("learn-role-limit")).toBeNull();
      unmount();
    }
  });

  it.each(ROLES.filter((r) => r !== "parent"))(
    "%s no ve adherencia, radar ni gemelo: ve el límite en palabras",
    (role) => {
      asRole(role);
      ui(<LearnPage />);
      expect(screen.getByTestId("learn-role-limit")).toHaveTextContent(
        /madre o padre/,
      );
      for (const id of [
        "learn-week",
        "learn-radar",
        "learn-twin",
        "twin-erase",
      ])
        expect(screen.queryByTestId(id)).toBeNull();
    },
  );

  it("sin días anotados todo se dice en palabras: nada anotado, el radar calla y el gemelo aún aprende", async () => {
    ui(<LearnPage />);
    expect(await screen.findByTestId("learn-week-line")).toHaveTextContent(
      "Esta semana no hay días anotados.",
    );
    expect(screen.getByTestId("learn-radar-quiet")).toHaveTextContent(
      "Para buscar lo que se repite hacen falta 7 días anotados; van 0.",
    );
    expect(screen.getByTestId("twin-learning")).toHaveTextContent(
      "Aún aprendiendo (0 de 14 días)",
    );
    // Ni un porcentaje en toda la pantalla.
    expect(document.body.textContent).not.toMatch(/%|por ciento/);
  });

  it("«Borrar lo aprendido» pide confirmar, guarda solo desde cuándo cuenta y no toca el registro", async () => {
    setHabit(today, "sleep", 300);
    ui(<LearnPage />);
    await userEvent.click(await screen.findByTestId("twin-erase"));
    expect(screen.getByTestId("twin-erase-ask")).toBeVisible();
    // Sin confirmar no se guardó nada.
    expect(window.localStorage.getItem(TWIN_KEY)).toBeNull();
    await userEvent.click(screen.getByTestId("twin-erase-yes"));
    expect(JSON.parse(window.localStorage.getItem(TWIN_KEY)!)).toEqual({
      since: "2026-08-10",
    });
    expect(screen.getByTestId("twin-erased")).toHaveTextContent(
      "empieza de cero",
    );
    expect(getWellbeing(today).habits.sleep).toBe(300);
  });
});

describe("«El día de hoy» en Hoy (G-Plan 2a)", () => {
  it.each(ROLES)(
    "%s ve el día de hoy y sus factores; solo quien puede anotar el contexto tiene botones",
    async (role) => {
      asRole(role);
      ui(<DayCard today={today} />);
      expect(await screen.findByTestId("day-card")).toBeVisible();
      expect(screen.getByTestId("day-level")).toHaveTextContent(
        "Mochila ligera",
      );
      const canNote = role !== "nutritionist";
      expect(screen.getByTestId("ctx-social").tagName).toBe(
        canNote ? "BUTTON" : "DIV",
      );
    },
  );

  it("cada aviso del día sube el nivel y dice por qué y qué preparar; quitarlo lo baja", async () => {
    ui(<DayCard today={today} />);
    const level = await screen.findByTestId("day-level");
    expect(level).toHaveTextContent("Mochila ligera");

    await userEvent.click(screen.getByTestId("ctx-social"));
    expect(screen.getByTestId("day-level")).toHaveTextContent(
      "Mochila con algo más",
    );
    expect(screen.getByTestId("day-why")).toHaveTextContent(
      "Hay un evento con más gente.",
    );
    expect(screen.getByTestId("day-prepare")).toHaveTextContent(
      "Mira el plan para un cumpleaños",
    );
    expect(screen.getByTestId("ctx-social")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getWellbeing(today).ctx.social).toBe(true);

    await userEvent.click(screen.getByTestId("ctx-away"));
    expect(screen.getByTestId("day-level")).toHaveTextContent("Mochila llena");

    await userEvent.click(screen.getByTestId("ctx-social"));
    await userEvent.click(screen.getByTestId("ctx-away"));
    expect(screen.getByTestId("day-level")).toHaveTextContent("Mochila ligera");
    expect(getWellbeing(today).ctx).toEqual({});
  });

  it("la noche corta pesa según su edad; sin edad o sin sueño, lo dice y no suma", async () => {
    ui(<DayCard today={today} />);
    expect(await screen.findByTestId("day-sleep-missing")).toHaveTextContent(
      /Elige su edad/,
    );
    act(() => {
      setAgeBand("3-4");
      setHabit(today, "sleep", 540);
      notifyLocalStore();
    });
    expect(await screen.findByTestId("day-level")).toHaveTextContent(
      "Mochila con algo más",
    );
    expect(screen.getByTestId("day-why")).toHaveTextContent(
      "La noche fue más corta que la referencia de su edad.",
    );
    expect(screen.queryByTestId("day-sleep-missing")).toBeNull();
  });

  it("la nutricionista lo ve pero no lo anota, y lo que se ve nunca usa el rojo de los alimentos", async () => {
    asRole("nutritionist");
    ui(<DayCard today={today} />);
    const card = await screen.findByTestId("day-card");
    expect(card.className).toContain("border-mood-anxious");
    expect(card.outerHTML).not.toMatch(/red|danger|destructive/i);
    expect(
      screen
        .queryAllByRole("button")
        .filter((b) => b.dataset.testid?.startsWith("ctx-")),
    ).toEqual([]);
  });
});
