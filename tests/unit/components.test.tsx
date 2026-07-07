import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChecklistRow } from "@/components/day-checklist/checklist-row";
import { DaySummary } from "@/components/day-checklist/day-summary";
import { StatusChip } from "@/components/traffic-light/status-chip";
import { I18nProvider } from "@/i18n";
import { buildDayChecklist } from "@/lib/diet/logic";
import { getDemoDiet } from "@/lib/diet/storage";

function withProviders(ui: React.ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("StatusChip (regla A11y: nunca solo color)", () => {
  it.each([
    ["green", "Se puede"],
    ["yellow", "Con límite"],
    ["red", "Evitar"],
  ] as const)(
    "estado %s comunica con texto además del color",
    (color, text) => {
      const { container } = withProviders(<StatusChip color={color} />);
      expect(screen.getByText(text)).toBeInTheDocument();
      // y con símbolo (ícono svg presente)
      expect(container.querySelector("svg")).not.toBeNull();
    },
  );
});

describe("ChecklistRow", () => {
  it("marca y desmarca vía checkbox accesible (≥44px táctil por fila)", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    withProviders(
      <ChecklistRow
        done={false}
        onToggle={onToggle}
        title="Desayuno"
        detail="Huevos"
        time="7:00"
        ariaLabel="Marcar Desayuno como hecho"
      />,
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Marcar Desayuno como hecho" }),
    );
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("al estar hecho atenúa, no tacha (sin line-through)", () => {
    withProviders(
      <ChecklistRow
        done
        onToggle={() => {}}
        title="Desayuno"
        ariaLabel="Desmarcar Desayuno"
      />,
    );
    expect(
      screen.getByText("Desayuno").closest("span.opacity-55"),
    ).not.toBeNull();
    expect(document.querySelector(".line-through")).toBeNull();
  });
});

describe("DaySummary (sin carga moral)", () => {
  const diet = getDemoDiet();
  const monday = new Date("2026-07-06T10:00:00");

  it("muestra 'N de M' y qué falta — jamás porcentajes", () => {
    const checklist = buildDayChecklist(diet, monday, ["meal:desayuno"]);
    withProviders(<DaySummary checklist={checklist} labelFor={() => "algo"} />);
    expect(screen.getByText("Ya hiciste 1 de 10")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/%|puntaje|nota/i);
  });

  it("celebra el día completo sin calificar", () => {
    const all = buildDayChecklist(diet, monday, []);
    const doneIds = all.items.map((i) => i.checkId);
    const checklist = buildDayChecklist(diet, monday, doneIds);
    withProviders(<DaySummary checklist={checklist} labelFor={() => ""} />);
    expect(screen.getByText(/Listo el día/)).toBeInTheDocument();
  });
});
