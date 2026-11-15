import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCENT_TIMEOUT_MS,
  accentSchema,
  accentWithDevice,
  hasDeviceModel,
} from "@/lib/ia/device-accent";

const SOURCE = "Si no hay manzana, tu plan da estas opciones:";

type Fake = {
  availability: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function installFake(state: string, reply: string | Promise<string>): Fake {
  const prompt = vi.fn().mockReturnValue(Promise.resolve(reply));
  const destroy = vi.fn();
  const fake = {
    availability: vi.fn().mockResolvedValue(state),
    create: vi.fn().mockResolvedValue({ prompt, destroy }),
    prompt,
    destroy,
  };
  (globalThis as Record<string, unknown>).LanguageModel = {
    availability: fake.availability,
    create: fake.create,
  };
  return fake;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).LanguageModel;
  vi.useRealTimers();
});

describe("sin modelo del aparato, el código responde igual", () => {
  it("no hay LanguageModel → null, sin llamar a nada", async () => {
    expect(await hasDeviceModel("es")).toBe(false);
    expect(await accentWithDevice(SOURCE, ["manzana"], "es")).toBeNull();
  });

  it("«downloadable» no cuenta: jamás se pide una descarga", async () => {
    const fake = installFake("downloadable", "x");
    expect(await accentWithDevice(SOURCE, ["manzana"], "es")).toBeNull();
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("availability que truena → null", async () => {
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: () => Promise.reject(new Error("boom")),
      create: vi.fn(),
    };
    expect(await hasDeviceModel("en")).toBe(false);
  });
});

describe("la consulta al navegador se hace una sola vez por página e idioma", () => {
  it("varias respuestas seguidas no vuelven a preguntar", async () => {
    const fake = installFake(
      "available",
      "Si no hay manzana, tu plan da estas opciones.",
    );
    await hasDeviceModel("es");
    await hasDeviceModel("es");
    await accentWithDevice(SOURCE, ["manzana"], "es");
    await accentWithDevice(SOURCE, ["manzana"], "es");
    expect(fake.availability).toHaveBeenCalledTimes(1);
    await hasDeviceModel("en"); // otro idioma = otra pregunta
    expect(fake.availability).toHaveBeenCalledTimes(2);
  });

  it("si availability truena de golpe (sin promesa) tampoco rompe", async () => {
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: () => {
        throw new Error("boom");
      },
      create: vi.fn(),
    };
    expect(await hasDeviceModel("es")).toBe(false);
  });
});

describe("con modelo del aparato, solo re-redacta lo que el código decidió", () => {
  it("una salida válida se usa (y la sesión se cierra)", async () => {
    const fake = installFake(
      "available",
      "Si se acabó la manzana, mira lo que trae tu plan:",
    );
    expect(await accentWithDevice(SOURCE, ["manzana"], "es")).toBe(
      "Si se acabó la manzana, mira lo que trae tu plan:",
    );
    expect(fake.destroy).toHaveBeenCalled();
  });

  it.each([
    ["pierde el alimento del plan", "Mira lo que trae tu plan:"],
    ["agrega una cifra", "Si no hay manzana, dale 200 gramos de pera:"],
    ["trae un enlace", "Si no hay manzana, mira https://ejemplo.test"],
    ["habla de calorías", "Si no hay manzana, cuida las calorías:"],
    ["habla de peso", "Si no hay manzana, piensa en su peso:"],
    ["usa culpa", "Si no hay manzana, no es tu culpa:"],
    ["vacía", "   "],
    ["demasiado larga", "manzana ".repeat(80)],
  ])("se descarta si %s", async (_why, reply) => {
    installFake("available", reply);
    expect(await accentWithDevice(SOURCE, ["manzana"], "es")).toBeNull();
  });

  it("si prompt truena → null", async () => {
    installFake("available", Promise.reject(new Error("model crashed")));
    expect(await accentWithDevice(SOURCE, ["manzana"], "es")).toBeNull();
  });

  it("si tarda más que el límite → null", async () => {
    vi.useFakeTimers();
    installFake("available", new Promise<string>(() => {}));
    const pending = accentWithDevice(SOURCE, ["manzana"], "es");
    await vi.advanceTimersByTimeAsync(ACCENT_TIMEOUT_MS + 10);
    expect(await pending).toBeNull();
  });

  it("EN: conserva el nombre y no inventa cifras", () => {
    const schema = accentSchema("Next up is Lunch, at 12:30.", ["Lunch"], "en");
    expect(schema.safeParse("Lunch is next, at 12:30.").success).toBe(true);
    expect(schema.safeParse("Lunch is next, at 1:00.").success).toBe(false);
    expect(schema.safeParse("Something is next.").success).toBe(false);
  });
});

describe("auditoría S4: el esquema protege menú e hidratación", () => {
  const MEAL = "Media mañana, 10:00 a 10:30: Pera, yogur natural";
  it("meal: pierde un alimento del menú → rechaza; conserva todo → acepta", () => {
    const required = ["Media mañana", "Pera", "yogur natural"];
    const schema = accentSchema(MEAL, required, "es");
    expect(
      schema.safeParse("Toca media mañana, de 10:00 a 10:30: pera.").success,
    ).toBe(false);
    expect(
      schema.safeParse(
        "Toca media mañana, de 10:00 a 10:30: pera y yogur natural.",
      ).success,
    ).toBe(true);
  });
  it("meal: cambia la hora → rechaza", () => {
    const schema = accentSchema(
      MEAL,
      ["Media mañana", "Pera", "yogur natural"],
      "es",
    );
    expect(
      schema.safeParse("Media mañana a las 11:00: pera y yogur natural.")
        .success,
    ).toBe(false);
  });
  it("hydration: pierde o cambia las cifras → rechaza", () => {
    const src = "Tu plan pide entre 1,2 y 1,5 litros al día (6 vasos).";
    const schema = accentSchema(src, [], "es");
    expect(
      schema.safeParse("Tu plan pide tomar harta agua al día.").success,
    ).toBe(false);
    expect(
      schema.safeParse("Tu plan pide entre 1,2 y 2 litros (6 vasos).").success,
    ).toBe(false);
    expect(
      schema.safeParse(
        "Tu plan pide entre 1,2 y 1,5 litros al día, unos 6 vasos.",
      ).success,
    ).toBe(true);
  });
  it("consejo o imperativo médico («deberías», «should») → rechaza", () => {
    const schema = accentSchema("Toma agua.", [], "es");
    expect(schema.safeParse("Deberías tomar agua.").success).toBe(false);
    expect(
      accentSchema("Drink water.", [], "en").safeParse("He should drink water.")
        .success,
    ).toBe(false);
  });
});
