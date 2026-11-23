import { describe, expect, it } from "vitest";

import { getDemoDiet } from "@/lib/diet/storage";
import type { DietPlan } from "@/lib/diet/schema";
import { checkLabel, withinOne, type LabelInput } from "@/lib/label/check";
import {
  findCodes,
  foldText,
  splitSections,
  textQuality,
} from "@/lib/label/normalize";

/**
 * El cotejo de una etiqueta (S13 · ADR-019). Todas las etiquetas son INVENTADAS. Lo que se prueba:
 * un aditivo del plan en todas sus formas, su nombre, su alias y su clase; rojo, restricción con su
 * fecha, amarillo; alergia e intolerancia en ingredientes y en trazas, por familia y por nota; y que
 * un texto mal leído jamás da «no vi nada que choque».
 */
const diet = getDemoDiet();
/** Con la restricción temporal vigente (julio a septiembre de 2026 en la demo). */
const NOW = new Date("2026-07-06T12:45:00");
/** Ya sin la restricción. */
const LATER = new Date("2026-11-02T09:00:00");

const CLEAN =
  "Ingredientes: harina de trigo, azúcar, aceite vegetal, sal, levadura y almidón de maíz.";

const check = (text: string, over: Partial<LabelInput> = {}) =>
  checkLabel({ text, confidence: 92, diet, now: NOW, ...over });

/** La demo con un aditivo real añadido (para el alias y la «O» leída como cero). */
const withE102: DietPlan = {
  ...diet,
  trafficLight: {
    ...diet.trafficLight,
    red: {
      ...diet.trafficLight.red,
      additives: [
        ...diet.trafficLight.red.additives,
        {
          code: "E102",
          name: { es: "Tartrazina", en: "Tartrazine" },
          foundIn: { es: "bebidas de ejemplo", en: "sample drinks" },
        },
      ],
    },
  },
};

describe("findCodes: el número de un aditivo en todas sus formas", () => {
  it.each([
    "E999",
    "E-999",
    "E 999",
    "e‑999",
    "INS 999",
    "INS-999",
    "SIN 999",
    "I.N.S. 999",
    "E999a",
    "INS 999(ii)",
    "E 999 d",
    "INS N° 999",
  ])("«%s» → E999", (form) => {
    expect(
      findCodes(foldText(`colorante (${form}), sal`)).map((c) => c.code),
    ).toEqual(["E999"]);
  });

  it("una «O» o una «l» leídas por error cuentan como 0 y 1, con dos cifras de verdad al menos", () => {
    expect(findCodes(foldText("E1O2")).map((c) => c.code)).toEqual(["E102"]);
    expect(findCodes(foldText("E l02")).map((c) => c.code)).toEqual(["E102"]);
    expect(findCodes(foldText("Ello"))).toEqual([]);
  });

  it("«sin 100 %», un peso o un número fuera de la numeración no son aditivos", () => {
    expect(findCodes(foldText("sin 100 % azúcar añadida"))).toEqual([]);
    expect(findCodes(foldText("E 250 g"))).toEqual([]);
    expect(findCodes(foldText("E 099, E 1600"))).toEqual([]);
    expect(findCodes(foldText("Sin gluten. Lote 12345"))).toEqual([]);
  });
});

describe("foldText y splitSections", () => {
  it("une la palabra cortada al final de una línea y pliega tildes", () => {
    expect(foldText("Hari-\nna de TRI-\ngo, AZÚCAR")).toBe(
      "harina de trigo, azucar",
    );
    expect(foldText("amarillo N° 5, rojo No. 40")).toBe("amarillo 5, rojo 40");
  });

  it("lo que sigue a «puede contener» es traza hasta el final de la frase; después vuelve a ser ingrediente", () => {
    const s = splitSections(
      foldText(
        "Harina, sal. Puede contener trazas de soya y maní. Contiene: leche.",
      ),
    );
    expect(s.traces).toBe("puede contener trazas de soya y mani");
    expect(s.ingredients).toContain("contiene: leche");
    expect(s.ingredients).not.toContain("soya");
  });

  it("reconoce las trazas en inglés y la «planta que también procesa»", () => {
    expect(
      splitSections(foldText("Oats, salt. May contain milk.")).traces,
    ).toContain("milk");
    expect(
      splitSections(
        foldText(
          "Maíz, sal. Elaborado en una planta que también procesa nueces.",
        ),
      ).traces,
    ).toContain("nueces");
  });
});

describe("checkLabel: no va", () => {
  it("un aditivo rojo del plan, escrito de cinco formas, da «no va» con el código como venía", () => {
    for (const form of ["E999", "E-999", "E 999", "INS 999", "SIN 999"]) {
      const r = check(`${CLEAN} Colorante (${form}).`);
      expect(r.verdict, form).toBe("no");
      expect(r.hits[0]).toMatchObject({
        kind: "additive",
        code: "E999",
        seen: form,
      });
    }
  });

  it("también por su nombre en el plan, en español y en inglés", () => {
    expect(check(`${CLEAN} Aditivo demo uno.`).hits[0]).toMatchObject({
      code: "E999",
    });
    expect(
      check(`Ingredients: wheat flour, sugar, salt, demo additive two.`)
        .hits[0],
    ).toMatchObject({ code: "E998" });
  });

  it("por su nombre público solo si el código está en el plan («tartrazina», «amarillo N° 5», «E1O2»)", () => {
    for (const t of ["tartrazina", "amarillo N° 5", "E1O2", "FD&C Yellow 5"]) {
      const r = check(`${CLEAN} Colorante ${t}.`, { diet: withE102 });
      expect(r.verdict, t).toBe("no");
      expect(
        r.hits.some((h) => h.kind === "additive" && h.code === "E102"),
        t,
      ).toBe(true);
    }
  });

  it("un colorante artificial visto por su número designa el rojo «Colorantes artificiales» del plan", () => {
    const r = check(`${CLEAN} Colorante E102.`);
    expect(r.verdict).toBe("no");
    expect(r.hits).toContainEqual(
      expect.objectContaining({ kind: "red", id: "colorantes" }),
    );
    // Un endulzante artificial, igual.
    expect(check(`${CLEAN} Sucralosa.`).hits).toContainEqual(
      expect.objectContaining({ kind: "red", id: "endulzante-artificial" }),
    );
  });

  it("un rojo del plan por su nombre o por una de sus alternativas", () => {
    expect(check(`${CLEAN} Con colorantes artificiales.`).hits).toContainEqual(
      expect.objectContaining({ kind: "red", id: "colorantes" }),
    );
    expect(
      check(`Ingredientes: agua, jugo de caja de naranja, azúcar, sal.`)
        .verdict,
    ).toBe("no");
  });

  it("una restricción vigente da «no va»; vencida, «revisa» (la reintroducción la guía el profesional)", () => {
    const text =
      "Ingredientes: manzana deshidratada, harina de avena, sal, azúcar.";
    expect(check(text).hits).toContainEqual(
      expect.objectContaining({
        kind: "restricted",
        id: "manzana",
        active: true,
      }),
    );
    expect(check(text).verdict).toBe("no");
    const later = check(text, { now: LATER });
    expect(later.verdict).toBe("check");
    expect(later.hits[0]).toMatchObject({ kind: "restricted", active: false });
  });

  it("una alergia del plan, en ingredientes y en trazas, también por su familia", () => {
    expect(check(`${CLEAN} Mariscos.`).hits[0]).toMatchObject({
      kind: "allergy",
      where: "ingredients",
    });
    const traces = check(`${CLEAN} Puede contener trazas de camarón.`);
    expect(traces.verdict).toBe("no");
    expect(traces.hits[0]).toMatchObject({ kind: "allergy", where: "traces" });
    expect(
      check(`Ingredients: oats, sugar, salt, wheat flour. May contain shrimp.`)
        .verdict,
    ).toBe("no");
  });

  it("una alergia anotada por quien cuida también descarta, en trazas", () => {
    const r = check(`${CLEAN} Puede contener trazas de maní.`, {
      notes: [{ kind: "allergy", text: "maní" }],
      now: LATER,
    });
    expect(r.verdict).toBe("no");
    expect(r.hits[0]).toMatchObject({
      kind: "allergy",
      where: "traces",
      name: { es: "maní" },
    });
  });

  it("una intolerancia en los ingredientes, también por su número (E420 = sorbitol)", () => {
    expect(check(`${CLEAN} Sorbitol.`).verdict).toBe("no");
    expect(check(`${CLEAN} Humectante (INS 420).`).hits).toContainEqual(
      expect.objectContaining({ kind: "intolerance", where: "ingredients" }),
    );
  });

  it("«Contiene: leche» tras las trazas es ingrediente: una alergia a la leche da «no va» en ingredientes", () => {
    const r = check(
      `${CLEAN} Puede contener trazas de soya. Contiene: leche.`,
      {
        notes: [{ kind: "allergy", text: "leche" }],
      },
    );
    expect(r.hits[0]).toMatchObject({ kind: "allergy", where: "ingredients" });
  });

  it("del catálogo, un aditivo declarado aparte del texto también cuenta", () => {
    const r = checkLabel({
      text: CLEAN,
      diet,
      now: NOW,
      declared: { codes: ["e999"] },
    });
    expect(r.verdict).toBe("no");
  });
});

describe("checkLabel: revisa", () => {
  it("un amarillo del plan da «revisa» con su límite", () => {
    const r = check(`${CLEAN} Banano deshidratado.`);
    expect(r.verdict).toBe("check");
    expect(r.hits[0]).toMatchObject({
      kind: "yellow",
      id: "banano",
      limit: { es: "máx. 1 al día" },
    });
  });

  it("una intolerancia solo en trazas da «revisa», no «no va»", () => {
    const r = check(`${CLEAN} Puede contener trazas de sorbitol.`);
    expect(r.verdict).toBe("check");
    expect(r.hits[0]).toMatchObject({ kind: "intolerance", where: "traces" });
  });

  it("un rojo solo en trazas da «revisa»", () => {
    expect(check(`${CLEAN} Puede contener trazas de manzana.`).verdict).toBe(
      "check",
    );
  });
});

describe("checkLabel: jamás «no vi nada» con un texto mal leído", () => {
  it.each([
    ["vacío", "", 95],
    ["solo signos", "@@## 12 %% ~~ || 000", 95],
    ["otro alfabeto", "Состав: мука, сахар, соль, масло, вода", 95],
    ["confianza baja", CLEAN, 40],
    ["cortado", "Ingredientes: har", 95],
    ["palabras que no son una etiqueta", "xqzt bbrr klmn wpqv zzkt", 95],
    ["confianza que no es un número", CLEAN, Number.NaN],
  ])("%s → «no pude leerla»", (_, text, confidence) => {
    const r = check(text, { confidence });
    expect(r.verdict).toBe("unreadable");
    expect(r.quality.ok).toBe(false);
  });

  it("un «no va» con el resto mal leído sigue siendo «no va», con el aviso de que lo demás no se leyó", () => {
    const r = check("E999 ~~ ##", { confidence: 30 });
    expect(r.verdict).toBe("no");
    expect(r.partial).toBe(true);
  });

  it("del catálogo, sin texto de ingredientes y sin declarar nada: «no pude leerla» (no sé qué lleva)", () => {
    expect(checkLabel({ text: "", diet, now: NOW }).verdict).toBe("unreadable");
    // Un alérgeno declarado SIN texto no basta para «apto»: lo que no choca no hace apto lo no leído.
    expect(
      checkLabel({
        text: "",
        diet,
        now: NOW,
        declared: { contains: ["gluten"] },
      }).verdict,
    ).toBe("unreadable");
  });
});

describe("checkLabel: no vi nada que choque", () => {
  it("solo con un texto bien leído y nada del plan en él", () => {
    const r = check(CLEAN);
    expect(r).toMatchObject({ verdict: "ok", hits: [], partial: false });
    expect(textQuality(CLEAN, 92).ok).toBe(true);
  });

  it("un aditivo que el plan no evita se muestra entre los vistos pero no decide", () => {
    const r = check(`${CLEAN} Conservante: benzoato de sodio (E211).`);
    expect(r.verdict).toBe("ok");
    expect(r.codes).toContain("E211");
  });

  it("la etiqueta en inglés, bien leída, también", () => {
    expect(
      check(
        "Ingredients: rice flour, sugar, sunflower oil, salt, natural flavor.",
      ).verdict,
    ).toBe("ok");
  });
});

describe("auditoría S13 · aditivos con espacios y comas, y letras por cifras", () => {
  it.each([
    "E 9 99",
    "E,999",
    "E.999",
    "aditivo 999",
    "additive 999",
    "E-999",
    "INS 999",
  ])("«%s» es el aditivo E999 del plan", (form) => {
    const r = check(`${CLEAN} Colorante ${form}.`);
    expect(r.verdict).toBe("no");
    expect(r.hits[0]).toMatchObject({ kind: "additive" });
  });

  it("una cifra pegada a otra unidad no es un aditivo (ni «sin 200 mg»)", () => {
    expect(check(`${CLEAN} Sin 999 mg de nada.`).verdict).toBe("ok");
    expect(check(`${CLEAN} Sin 999 %.`).verdict).toBe("ok");
  });

  it("«E9S9» (una S por un 9) da «revisa», nunca «no va» ni «no vi nada»", () => {
    const r = check(`${CLEAN} Colorante E9S9.`);
    expect(r.verdict).toBe("check");
    expect(r.hits[0]).toMatchObject({
      kind: "similar",
      seen: expect.any(String),
    });
  });

  it("un código con letras que NO cuadra con ningún aditivo del plan no dice nada", () => {
    expect(check(`${CLEAN} Colorante E1S5.`).verdict).toBe("ok");
  });
});

describe("auditoría S13 · una letra mal leída en lo que el plan evita", () => {
  it("«camar6n» (alergia a los mariscos por familia) da «revisa»", () => {
    const r = check(
      "Ingredientes: harina de trigo, sal, aceite vegetal, camar6n molido y levadura.",
    );
    expect(r.verdict).not.toBe("ok");
    expect(r.hits.some((h) => h.kind === "similar")).toBe(true);
  });

  it("una palabra corta cercana a otra no dispara el parecido", () => {
    expect(check(`${CLEAN} Sal y mar.`).verdict).toBe("ok");
  });

  it("withinOne reconoce una letra cambiada, puesta, quitada y dos juntas", () => {
    expect(withinOne("camaron", "camar6n")).toBe(true);
    expect(withinOne("camaron", "camarron")).toBe(true);
    expect(withinOne("camaron", "camaro")).toBe(true);
    expect(withinOne("camaron", "camarno")).toBe(true);
    expect(withinOne("camaron", "camerin")).toBe(false);
    expect(withinOne("camaron", "camaron")).toBe(true);
  });
});

describe("auditoría S13 · trazas sin punto y con un rojo", () => {
  it("«puede contener» sin punto antes de «Información nutricional» no se la traga", () => {
    const r = check(
      `${CLEAN} Puede contener trazas de mariscos Información nutricional: porción.`,
    );
    expect(r.verdict).toBe("no");
    expect(r.hits[0]).toMatchObject({ kind: "allergy", where: "traces" });
  });

  it("un rojo del plan tras «puede contener» también es «no va»", () => {
    const r = check(`${CLEAN} Puede contener gaseosas.`);
    expect(r.verdict).toBe("no");
    expect(r.hits[0]).toMatchObject({ kind: "red", where: "traces" });
  });

  it("un texto ilegible nunca da apto, ni con nada que cuadre", () => {
    expect(check("xq zk ñ ll ww", { confidence: 30 }).verdict).toBe(
      "unreadable",
    );
  });
});

describe("auditoría S13 · singular, plural y otras escrituras", () => {
  it.each([
    ["yogur natural", "yellow"],
    ["yoghurt", "yellow"],
    ["yogures", "yellow"],
    ["postre industrial", "red"],
    ["postres industriales", "red"],
    ["dulce industrial", "red"],
  ])("«%s» se reconoce como lo que el plan nombra", (text, kind) => {
    const r = check(`${CLEAN} ${text}.`);
    expect(r.hits.some((h) => h.kind === kind)).toBe(true);
  });
});
