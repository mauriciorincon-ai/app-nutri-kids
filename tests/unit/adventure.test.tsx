import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Adventure } from "@/components/adventure/adventure";
import { KidGuard } from "@/components/app-shell/kid-guard";
import { I18nProvider } from "@/i18n";
import { adventureText } from "@/i18n/adventure";
import {
  canExit,
  checkAnswer,
  HOLD_MS,
  makeChallenge,
  wordsOf,
} from "@/lib/adventure/adult-exit";
import {
  coerceSparks,
  doneOnDay,
  earnSparks,
  energyOf,
  SOURCES,
  sourcesOfDay,
  stageOf,
  STAGE_MAX,
  untilNext,
  type DaySignals,
} from "@/lib/adventure/energy";
import { kidModeOn, KIDMODE_ITEM, setKidMode } from "@/lib/adventure/kidmode";
import { scanDays } from "@/lib/adventure/scan";
import {
  ADVENTURE_ITEM,
  earnAll,
  readAdventure,
  setWorld,
} from "@/lib/adventure/store";
import { looksLikeMedicalAdvice } from "@/lib/diet/guardrails";
import { clearDayLog, markDone, setFood, setHabit } from "@/lib/diet/day-log";
import { clearAllData } from "@/lib/diet/storage";
import { foodKey, type FoodValue } from "@/lib/wellbeing/values";

// El reloj, fijo: ninguna prueba de la aventura depende de la hora real (regla 2).
const NOW = new Date(2026, 10, 24, 7, 30);
const DAY = "2026-11-24";

const nav = vi.hoisted(() => ({ path: "/dieta", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), back: vi.fn() }),
}));

const empty: DaySignals = { habits: {}, markIds: [], food: {} };
const asNew = (
  stage: "looked" | "touched" | "tasted",
  verdict: "loves" | "accepts" | "refuses" | null = null,
): FoodValue => ({
  stage,
  verdict,
  texture: null,
  presentation: null,
  isNew: true,
});

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "Date",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
    ],
  });
  vi.setSystemTime(NOW);
  window.localStorage.clear();
  clearDayLog();
  nav.path = "/dieta";
  nav.replace.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("la energía sale de hábitos y de explorar, jamás de comer", () => {
  it("las fuentes son los hábitos, el agua y conocer algo nuevo", () => {
    expect(
      sourcesOfDay({
        habits: { sleep: 600, activity: 30, sun: 20 },
        markIds: ["water:1"],
        food: { a: asNew("tasted") },
      }),
    ).toEqual(["sleep", "activity", "sun", "water", "try"]);
    expect(sourcesOfDay(empty)).toEqual([]);
  });

  it("ninguna comida, suplemento, cantidad ni pantalla la mueve", () => {
    const base = sourcesOfDay(empty);
    // Marcar todas las comidas y los suplementos del día.
    const meals = sourcesOfDay({
      ...empty,
      markIds: ["meal:desayuno", "meal:almuerzo", "meal:cena", "supplement:x"],
    });
    expect(meals).toEqual(base);
    // Comer algo conocido, lo acepte o lo rechace, y comer más o menos.
    const known = (verdict: "loves" | "accepts" | "refuses" | null) => ({
      stage: "tasted" as const,
      verdict,
      texture: null,
      presentation: null,
      isNew: false,
    });
    for (const v of ["loves", "accepts", "refuses", null] as const)
      expect(
        sourcesOfDay({
          ...empty,
          food: { a: known(v), b: known(v), c: known(v) },
        }),
      ).toEqual(base);
    // La pantalla no es fuente: ni premio ni castigo.
    expect(sourcesOfDay({ ...empty, habits: { screen: 240 } })).toEqual(base);
    // Un hábito en cero no cuenta.
    expect(sourcesOfDay({ ...empty, habits: { sleep: 0 } })).toEqual(base);
  });

  it("conocer algo nuevo vale igual mirado, tocado o probado, y aceptado o no", () => {
    const one = (food: DaySignals["food"]) => sourcesOfDay({ ...empty, food });
    expect(one({ a: asNew("looked") })).toEqual(["try"]);
    expect(one({ a: asNew("touched") })).toEqual(["try"]);
    expect(one({ a: asNew("tasted", "refuses") })).toEqual(["try"]);
    expect(one({ a: asNew("tasted", "loves") })).toEqual(["try"]);
    // Cinco alimentos nuevos el mismo día siguen siendo UNA chispa.
    const five = Object.fromEntries(
      ["a", "b", "c", "d", "e"].map((k) => [k, asNew("tasted")]),
    );
    expect(earnSparks([], DAY, sourcesOfDay({ ...empty, food: five }))).toEqual(
      [`${DAY}:try`],
    );
  });

  it("el registro real del día: marcar comidas no sube; un hábito y agua, sí", () => {
    markDone(NOW, "meal:desayuno", "07:30");
    markDone(NOW, "meal:almuerzo", "12:00");
    setFood(NOW, foodKey("desayuno", "pan"), {
      ...asNew("tasted"),
      isNew: false,
    });
    expect(scanDays().flatMap((d) => d.sources)).toEqual([]);
    setHabit(NOW, "sleep", 600);
    markDone(NOW, "water:1", "08:00");
    expect(scanDays()).toEqual([{ day: DAY, sources: ["sleep", "water"] }]);
  });
});

describe("la energía solo sube", () => {
  it("una chispa por fuente y día; el libro nunca pierde una clave", () => {
    let ledger: string[] = [];
    const rng = (() => {
      let s = 7;
      return () => (s = (s * 48271) % 2147483647) / 2147483647;
    })();
    let last = 0;
    for (let i = 0; i < 400; i++) {
      const day = `2026-11-${String(1 + Math.floor(rng() * 28)).padStart(2, "0")}`;
      const sources = SOURCES.filter(() => rng() < 0.4);
      const before = new Set(ledger);
      ledger = earnSparks(ledger, day, sources);
      for (const k of before) expect(ledger).toContain(k);
      expect(energyOf(ledger)).toBeGreaterThanOrEqual(last);
      last = energyOf(ledger);
    }
    expect(new Set(ledger).size).toBe(ledger.length);
    expect(ledger.length).toBeLessThanOrEqual(28 * SOURCES.length);
  });

  it("corregir un hábito después no baja nada", () => {
    setHabit(NOW, "sleep", 600);
    earnAll(scanDays());
    expect(readAdventure().sparks).toEqual([`${DAY}:sleep`]);
    setHabit(NOW, "sleep", null); // se quitó o se corrigió
    earnAll(scanDays());
    expect(readAdventure().sparks).toEqual([`${DAY}:sleep`]);
  });

  it("cambiar de mundo no toca la energía (es una sola para los tres)", () => {
    earnAll([{ day: DAY, sources: ["sleep", "sun", "kitchen"] }]);
    const before = readAdventure().sparks;
    for (const w of ["lumo", "nubo", "brote", "nubo"] as const) {
      setWorld(w);
      expect(readAdventure().world).toBe(w);
      expect(readAdventure().sparks).toEqual(before);
    }
  });

  it("lo que no encaja se descarta al leer, sin quitar lo bueno", () => {
    window.localStorage.setItem(
      ADVENTURE_ITEM,
      JSON.stringify({
        world: "otro",
        sparks: [`${DAY}:sleep`, `${DAY}:sleep`, "x", `${DAY}:comida`, 7, null],
      }),
    );
    expect(readAdventure()).toEqual({
      world: "brote",
      sparks: [`${DAY}:sleep`],
    });
    expect(coerceSparks("nope")).toEqual([]);
    expect(earnSparks([`${DAY}:sun`], "mañana", ["sleep"])).toEqual([
      `${DAY}:sun`,
    ]);
  });

  it("los pasos del mundo salen de la energía y se acaban en el último", () => {
    expect(stageOf(0)).toBe(0);
    expect(stageOf(4)).toBe(0);
    expect(stageOf(5)).toBe(1);
    expect(stageOf(23)).toBe(4);
    expect(stageOf(25)).toBe(STAGE_MAX);
    expect(stageOf(999)).toBe(STAGE_MAX);
    expect(untilNext(23)).toBe(2);
    expect(untilNext(25)).toBe(5);
  });

  it("«Borrar datos» es el único camino que la baja", () => {
    earnAll([{ day: DAY, sources: ["sleep"] }]);
    setKidMode(true);
    clearAllData();
    expect(readAdventure().sparks).toEqual([]);
    expect(kidModeOn()).toBe(false);
    expect(window.localStorage.getItem(ADVENTURE_ITEM)).toBeNull();
  });
});

describe("la salida del adulto", () => {
  it("la cuenta se lee en palabras y solo acepta el resultado en dígitos", () => {
    const c = makeChallenge(() => 0);
    expect(c).toEqual({ a: 6, b: 6 });
    expect(wordsOf(6, "es")).toBe("seis");
    expect(wordsOf(19, "en")).toBe("nineteen");
    expect(checkAnswer(c, "12")).toBe(true);
    for (const bad of ["", " ", "13", "doce", "twelve", "12.0", "012x", "-12"])
      expect(checkAnswer(c, bad), bad).toBe(false);
    const hi = makeChallenge(() => 0.999);
    expect(hi).toEqual({ a: 19, b: 19 });
  });

  it("sin la pulsación larga completa, la cuenta bien no basta; sin la cuenta, la pulsación tampoco", () => {
    const challenge = { a: 7, b: 9 };
    expect(canExit({ heldMs: HOLD_MS, challenge, input: "16" })).toBe(true);
    expect(canExit({ heldMs: HOLD_MS - 1, challenge, input: "16" })).toBe(
      false,
    );
    expect(canExit({ heldMs: 0, challenge, input: "16" })).toBe(false);
    expect(canExit({ heldMs: HOLD_MS, challenge, input: "15" })).toBe(false);
    expect(canExit({ heldMs: HOLD_MS, challenge, input: "" })).toBe(false);
  });

  const ui = () =>
    render(
      <I18nProvider>
        <Adventure />
      </I18nProvider>,
    );
  const hold = (ms: number) => {
    const btn = screen.getByTestId("adult-exit");
    fireEvent.pointerDown(btn);
    act(() => {
      vi.advanceTimersByTime(ms);
    });
    return btn;
  };

  it("en modo niño no hay forma de salir sin el adulto: un toque, media pulsación y una cuenta mala no apagan nada", () => {
    setKidMode(true);
    ui();
    const btn = screen.getByTestId("adult-exit");
    // Un toque suelto.
    fireEvent.click(btn);
    expect(screen.queryByTestId("adult-exit-dialog")).toBeNull();
    // Una pulsación que se suelta antes de tiempo.
    fireEvent.pointerDown(btn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS - 100);
    });
    fireEvent.pointerUp(btn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("adult-exit-dialog")).toBeNull();
    expect(kidModeOn()).toBe(true);
    // Completa la pulsación: sale la cuenta, pero con la cuenta mala se queda.
    hold(HOLD_MS);
    expect(screen.getByTestId("adult-exit-dialog")).toBeTruthy();
    fireEvent.change(screen.getByTestId("adult-exit-input"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTestId("adult-exit-confirm"));
    expect(kidModeOn()).toBe(true);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(
      within(screen.getByTestId("adult-exit-dialog")).getByText(
        adventureText.es.exitWrong,
      ),
    ).toBeTruthy();
  });

  it("con la pulsación y la cuenta bien, sale a Hoy y apaga la bandera", () => {
    setKidMode(true);
    ui();
    hold(HOLD_MS);
    const text = screen.getByTestId("adult-exit-dialog").textContent ?? "";
    const m = text.match(/¿Cuánto es (\S+) más (\S+)\?/);
    expect(m).toBeTruthy();
    const es = adventureText.es; // el idioma por defecto
    expect(es.exitSum).toContain("{a}");
    const n = (w: string) =>
      6 +
      [
        "seis",
        "siete",
        "ocho",
        "nueve",
        "diez",
        "once",
        "doce",
        "trece",
        "catorce",
        "quince",
        "dieciséis",
        "diecisiete",
        "dieciocho",
        "diecinueve",
      ].indexOf(w);
    fireEvent.change(screen.getByTestId("adult-exit-input"), {
      target: { value: String(n(m![1]) + n(m![2])) },
    });
    fireEvent.click(screen.getByTestId("adult-exit-confirm"));
    expect(kidModeOn()).toBe(false);
    expect(nav.replace).toHaveBeenCalledWith("/");
  });

  it("fuera del modo niño no hay salida que forzar y se ve cómo activarlo", () => {
    ui();
    expect(screen.queryByTestId("adult-exit")).toBeNull();
    fireEvent.click(screen.getByTestId("kid-mode-on"));
    expect(kidModeOn()).toBe(true);
    expect(screen.getByTestId("adult-exit")).toBeTruthy();
  });
});

describe("la pantalla", () => {
  const ui = () =>
    render(
      <I18nProvider>
        <Adventure />
      </I18nProvider>,
    );

  it("el niño elige su mundo y la energía es la misma en los tres", () => {
    earnAll([{ day: DAY, sources: ["sleep", "sun", "water"] }]);
    ui();
    const energy = () =>
      screen.getByTestId("adventure-energy").getAttribute("data-energy");
    expect(energy()).toBe("3");
    for (const w of ["lumo", "nubo", "brote"] as const) {
      fireEvent.click(screen.getByTestId(`world-${w}`));
      expect(screen.getByTestId("adventure").getAttribute("data-world")).toBe(
        w,
      );
      expect(energy()).toBe("3");
      expect(
        screen.getByTestId(`world-${w}`).getAttribute("aria-pressed"),
      ).toBe("true");
    }
  });

  it("las fichas llevan símbolo + palabra; lo hecho dice «hecho»", () => {
    setHabit(NOW, "sleep", 600);
    ui();
    const sleep = screen.getByTestId("tile-sleep");
    expect(sleep.getAttribute("data-done")).toBe("true");
    expect(within(sleep).getByText("hecho")).toBeTruthy();
    expect(within(sleep).getByText("Dormí")).toBeTruthy();
    expect(within(sleep).queryAllByRole("img").length).toBe(0);
    expect(sleep.querySelector("svg")).toBeTruthy();
    expect(screen.getByTestId("tile-sun").getAttribute("data-done")).toBe(
      "false",
    );
  });

  it("la cocina la toca quien juega y suma una sola vez al día", () => {
    ui();
    const kitchen = screen.getByTestId("tile-kitchen");
    fireEvent.click(within(kitchen).getByRole("button"));
    expect(readAdventure().sparks).toEqual([`${DAY}:kitchen`]);
    expect(within(kitchen).queryByRole("button")).toBeNull();
    expect(doneOnDay(readAdventure().sparks, DAY).has("kitchen")).toBe(true);
    expect(
      screen.getByTestId("adventure-energy").getAttribute("data-energy"),
    ).toBe("1");
  });

  it("al abrir suma lo que el día ya tiene, y no lo que se comió", () => {
    markDone(NOW, "meal:desayuno", "07:30");
    setHabit(NOW, "activity", 45);
    ui();
    expect(readAdventure().sparks).toEqual([`${DAY}:activity`]);
  });
});

describe("el cascarón devuelve al niño a la aventura", () => {
  it("en modo niño, cualquier otra pantalla (también con Atrás) vuelve a /aventura", () => {
    setKidMode(true);
    nav.path = "/ajustes";
    render(<KidGuard />);
    expect(nav.replace).toHaveBeenCalledWith("/aventura");
  });
  it("en /aventura se queda, y sin modo niño no toca nada", () => {
    setKidMode(true);
    nav.path = "/aventura";
    const { unmount } = render(<KidGuard />);
    expect(nav.replace).not.toHaveBeenCalled();
    unmount();
    setKidMode(false);
    nav.path = "/dieta";
    render(<KidGuard />);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KIDMODE_ITEM)).toBeNull();
  });
});

describe("textos de la aventura (es/en)", () => {
  const flat = (o: unknown, p = ""): [string, string][] =>
    typeof o === "string"
      ? [[p, o]]
      : Object.entries(o as object).flatMap(([k, v]) => flat(v, `${p}.${k}`));
  const es = flat(adventureText.es);
  const en = flat(adventureText.en);
  const all = [...es, ...en];

  it("paridad: mismas claves, ninguna vacía y los mismos {marcadores}", () => {
    expect(en.map(([k]) => k)).toEqual(es.map(([k]) => k));
    const ph = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const em = Object.fromEntries(en);
    for (const [k, v] of es) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(ph(em[k]), k).toEqual(ph(v));
    }
  });

  it("sin culpa, sin alarma, sin comida como premio, sin cifras de comida ni indicación médica", () => {
    const BAD = [
      /culpa|guilt|perdiste|you lost|fall[óo]|failed|fracas/i,
      /urgent|peligr|danger|alarm|grave\b|emergenc|r[aá]pido|hurry|quick/i,
      /premi|reward|prize|te lo ganaste|you earned/i,
      /calor[ií]as?|calories?|kcal|peso\b|weight|imc|bmi|percentil|talla/i,
      /\bracha|streak|no te (rindas|olvides)|don'?t (forget|give up)/i,
      /\bcomi(da|das|r|ste|mos)\b|\beat(ing|en)?\b|\bate\b|bocado|bite/i,
    ];
    for (const rx of BAD)
      expect(
        all.filter(([k, v]) => rx.test(v) && !k.includes("adultRule")),
        String(rx),
      ).toEqual([]);
    // La regla del adulto sí nombra «comer», pero solo para decir que NO da energía.
    const rule = all.filter(([k]) => k.includes("adultRule"));
    for (const [, v] of rule) expect(/never|nunca/i.test(v)).toBe(true);
    for (const [k, v] of all) {
      expect(/\d/.test(v.replace(/\{\w+\}/g, "")), `${k}: ${v}`).toBe(false);
      expect(looksLikeMedicalAdvice(v), `${k}: ${v}`).toBe(false);
      expect(/https?:|www\./i.test(v), k).toBe(false);
    }
  });

  it("cada mundo y cada ficha tiene su palabra, en los dos idiomas", () => {
    for (const lang of ["es", "en"] as const)
      for (const w of ["brote", "lumo", "nubo"] as const)
        for (const s of SOURCES)
          expect(adventureText[lang].worlds[w].tiles[s].length).toBeGreaterThan(
            1,
          );
  });
});
