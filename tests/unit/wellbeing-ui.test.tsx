import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DietProvider } from "@/components/diet-provider";
import { AgePicker } from "@/components/wellbeing/age-picker";
import FoodLog from "@/components/wellbeing/food-log";
import { HabitRow, referenceLines } from "@/components/wellbeing/habit-row";
import { WellbeingBlock } from "@/components/wellbeing/history-block";
import { MoodChips } from "@/components/wellbeing/mood-chips";
import WellbeingPage from "@/app/bienestar/page";
import { I18nProvider } from "@/i18n";
import { wellbeingText } from "@/i18n/wellbeing";
import {
  clearDayLog,
  getWellbeing,
  setFood,
  setWell,
} from "@/lib/diet/day-log";
import {
  clearProfileNotes,
  getAgeBand,
  setAgeBand,
} from "@/lib/diet/profile-notes";
import { getDemoDiet } from "@/lib/diet/storage";
import { acceptableFoods } from "@/lib/wellbeing/foods";
import { referenceFor } from "@/lib/wellbeing/references";
import { foodKey } from "@/lib/wellbeing/values";

const diet = getDemoDiet();
const day = new Date("2026-11-17T12:00:00");
const ui = (node: React.ReactNode) =>
  render(
    <I18nProvider>
      <DietProvider>{node}</DietProvider>
    </I18nProvider>,
  );

beforeEach(() => {
  clearDayLog();
  clearProfileNotes();
  window.localStorage.clear();
});

describe("semáforo emocional", () => {
  it("un toque elige, otro toque quita; símbolo + texto en cada opción", async () => {
    const onPick = vi.fn();
    const { rerender } = ui(
      <MoodChips mealName="Desayuno" value={null} onPick={onPick} />,
    );
    const group = screen.getByRole("group");
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(5);
    for (const b of buttons) {
      expect(b.textContent?.trim().length).toBeGreaterThan(0);
      expect(b.querySelector("svg")).not.toBeNull();
    }
    await userEvent.click(screen.getByRole("button", { name: /Cansado/ }));
    expect(onPick).toHaveBeenLastCalledWith("tired");
    rerender(
      <I18nProvider>
        <DietProvider>
          <MoodChips mealName="Desayuno" value="tired" onPick={onPick} />
        </DietProvider>
      </I18nProvider>,
    );
    const on = screen.getByRole("button", { name: /Cansado/ });
    expect(on).toHaveAttribute("aria-pressed", "true");
    // El elegido se ve también por la marca ✓, no solo por el tono.
    expect(on.textContent).toContain("✓");
    await userEvent.click(on);
    expect(onPick).toHaveBeenLastCalledWith(null);
  });

  it("con un rol que no anota esto, se ve y no se cambia", () => {
    ui(
      <MoodChips
        mealName="Desayuno"
        value="happy"
        onPick={() => {}}
        disabled
      />,
    );
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
  });
});

describe("hábitos contra la referencia", () => {
  const w = wellbeingText.es;
  it("cada referencia con cifra muestra su fuente; sin cifra lo dice y no inventa meta", () => {
    for (const habit of ["sleep", "screen", "activity", "sun"] as const)
      for (const band of ["1", "2", "3-4", "5", "6-12", "13-17"] as const) {
        const ref = referenceFor(habit, band);
        const { text, source } = referenceLines(w, habit, band, ref);
        expect(text.length).toBeGreaterThan(0);
        if (ref.kind === "none") expect(source).toBeNull();
        else expect(source).toContain(ref.source.cite.es);
      }
    expect(
      referenceLines(w, "screen", "6-12", referenceFor("screen", "6-12")).text,
    ).toContain("sin dar una cifra");
  });

  it("«distinto» se ve con símbolo y texto, jamás en rojo", () => {
    ui(
      <HabitRow
        habit="sleep"
        band="6-12"
        minutes={300}
        disabled={false}
        reference={referenceFor}
        onSave={() => {}}
      />,
    );
    const status = screen.getByTestId("habit-status-sleep");
    expect(status.textContent).toContain("Por debajo");
    expect(status.querySelector("svg")).not.toBeNull();
    expect(status.className).not.toMatch(/tl-red|destructive/);
    expect(screen.getByTestId("habit-source-sleep").textContent).toContain(
      "AASM 2016",
    );
  });

  it("sin franja de edad solo anota: no compara ni cita referencia", () => {
    ui(
      <HabitRow
        habit="sleep"
        band={null}
        minutes={540}
        disabled={false}
        reference={referenceFor}
        onSave={() => {}}
      />,
    );
    expect(screen.queryByTestId("habit-status-sleep")).toBeNull();
    expect(screen.queryByTestId("habit-source-sleep")).toBeNull();
  });

  it("guarda minutos válidos y no deja guardar uno inválido", async () => {
    const onSave = vi.fn();
    ui(
      <HabitRow
        habit="screen"
        band="2"
        minutes={null}
        disabled={false}
        reference={referenceFor}
        onSave={onSave}
      />,
    );
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Pantalla.*Minutos/), "45");
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(45);
  });
});

describe("bitácora de aceptación (formulario)", () => {
  // La bitácora anota en el día real si cruzó la medianoche: el reloj se fija al día de la prueba.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day);
  });
  afterEach(() => vi.useRealTimers());

  const meals = diet.dailyMenu.map((m) => ({ id: m.id, name: m.name }));
  const foods = acceptableFoods(diet);

  it("anota lo que hizo con un alimento y cuenta las exposiciones solo en los nuevos", async () => {
    const mealId = meals[0].id;
    ui(
      <FoodLog
        today={day}
        meals={meals}
        foods={foods}
        mealId={mealId}
        canWrite={() => true}
      />,
    );
    expect(screen.getByText(/muchas veces, sin presión/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox"), foods[0].id);
    await userEvent.click(screen.getByRole("button", { name: "Lo miró" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /nuevo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    const saved = getWellbeing(day).food[foodKey(mealId, foods[0].id)];
    expect(saved).toMatchObject({ stage: "looked", isNew: true });
    expect(await screen.findByText(/1 vez/)).toBeInTheDocument();
  });

  it("el colegio solo anota su franja: sin permiso no se puede guardar", async () => {
    ui(
      <FoodLog
        today={day}
        meals={meals}
        foods={foods}
        mealId={meals[0].id}
        canWrite={() => false}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), foods[0].id);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("lo anotado se puede quitar", async () => {
    setFood(day, foodKey(meals[0].id, foods[0].id), {
      stage: "tasted",
      verdict: "accepts",
      texture: null,
      presentation: null,
      isNew: false,
    });
    ui(
      <FoodLog
        today={day}
        meals={meals}
        foods={foods}
        mealId={meals[0].id}
        canWrite={() => true}
      />,
    );
    const list = await screen.findByTestId("food-entries");
    await userEvent.click(within(list).getByRole("button", { name: "Quitar" }));
    expect(Object.keys(getWellbeing(day).food)).toHaveLength(0);
  });
});

describe("pantalla de bienestar", () => {
  it("una reacción ofrece el plan de emergencia, jamás una indicación", async () => {
    setWell(new Date(), "reaction", "skin");
    ui(<WellbeingPage />);
    const help = await screen.findByTestId("reaction-help");
    expect(help.textContent).toContain("plan de emergencia");
    expect(within(help).getByRole("link")).toHaveAttribute(
      "href",
      "/escenarios?e=emergency",
    );
  });

  it("sin reacción no hay ayuda de emergencia", async () => {
    ui(<WellbeingPage />);
    await screen.findByText("Cómo está hoy");
    expect(screen.queryByTestId("reaction-help")).toBeNull();
  });

  it("pregunta una vez al año si la franja sigue igual y confirmarla vuelve a sellarla", async () => {
    setAgeBand("3-4", Date.now() - 400 * 24 * 60 * 60 * 1000);
    const before = getAgeBand()!.t;
    ui(<WellbeingPage />);
    const ask = await screen.findByTestId("age-recheck");
    expect(ask.textContent).toContain("3–4 años");
    await userEvent.click(
      within(ask).getByRole("button", { name: "Sí, sigue igual" }),
    );
    expect(getAgeBand()!.band).toBe("3-4");
    expect(getAgeBand()!.t).toBeGreaterThan(before);
  });

  it("el agua sale de las marcas del día contra la meta del plan", async () => {
    ui(<WellbeingPage />);
    const water = await screen.findByTestId("habit-water");
    expect(water.textContent).toMatch(/0 de \d+ vasos/);
  });
});

describe("franja de edad en el Perfil", () => {
  it("elegirla guarda solo la franja", async () => {
    ui(<AgePicker />);
    await userEvent.click(screen.getByRole("button", { name: "6–12 años" }));
    expect(getAgeBand()?.band).toBe("6-12");
    expect(JSON.stringify(window.localStorage)).not.toMatch(
      /birth|nacimiento/i,
    );
  });
});

describe("Historial", () => {
  it("muestra lo anotado con las mismas palabras de casa", () => {
    const foods = acceptableFoods(diet);
    ui(
      <WellbeingBlock
        diet={diet}
        mealLabel={() => "Desayuno"}
        wellbeing={{
          moods: { "meal:breakfast": "tired" },
          food: {
            [foodKey("breakfast", foods[0].id)]: {
              stage: "tasted",
              verdict: "loves",
              texture: null,
              presentation: null,
              isNew: false,
            },
          },
          well: { energy: "low", note: "Durmió poco" },
          habits: { sleep: 570 },
          lunch: {},
          ctx: {},
        }}
      />,
    );
    const block = screen.getByTestId("history-wellbeing");
    expect(block.textContent).toContain("Cansado");
    expect(block.textContent).toContain("Energía: Con poca energía");
    expect(block.textContent).toContain("Durmió poco");
    expect(block.textContent).toContain("9 h 30 min");
    expect(block.textContent).toContain("Le encantó");
  });
});
