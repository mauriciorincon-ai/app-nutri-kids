import { describe, expect, it } from "vitest";

import { MAX_SEEN, matchSeen, splitSeen } from "@/lib/camera/match";
import { getDemoDiet } from "@/lib/diet/storage";

/**
 * El cotejo de lo que dijo el modelo (S12 · ADR-018). La regla: ningún id nace del texto del modelo;
 * solo cuenta lo que cuadra por nombre con el catálogo o con el plan, y lo demás queda a la vista
 * como «no está en tu catálogo». Salidas adversas: rojo, alergia, palabra inventada, plural,
 * inglés, español, relleno, texto vacío y basura.
 */
const diet = getDemoDiet();
const NOW = new Date("2026-07-06T12:45:00");

describe("splitSeen: el texto del modelo → nombres", () => {
  it("parte por comas, «and», saltos y numeración; quita relleno, números y repetidos", () => {
    expect(
      splitSeen(
        "1. Two eggs, some sliced carrots and broccoli\n2) the EGGS; rice.",
      ),
    ).toEqual(["eggs", "carrots", "broccoli", "rice"]);
  });

  it("descarta frases que no nombran comida y textos desbocados", () => {
    expect(splitSeen("The image shows a kitchen table")).toEqual([]);
    expect(splitSeen("x".repeat(200))).toEqual([]);
    expect(splitSeen("")).toEqual([]);
    expect(splitSeen("123, !!!, ...")).toEqual([]);
  });

  it("salidas reales del modelo en el Mac: solo la primera frase, sin preámbulos, colores ni escena", () => {
    expect(splitSeen("Bananas, mushrooms, and other produce.")).toEqual([
      "bananas",
      "mushrooms",
      "produce",
    ]);
    expect(
      splitSeen(
        "The image shows a white and multicolored carrot with a circular arrangement of the carrot in the center. The background is white",
      ),
    ).toEqual(["carrot"]);
    expect(
      splitSeen(
        "The food items that can be seen include carrots, green leaves and some other vegetables. They appear",
      ),
    ).toEqual(["carrots", "leaves", "vegetables"]);
    expect(splitSeen("The food is mashed potatoes.")).toEqual(["potatoes"]);
    expect(
      splitSeen(
        "Broccoli, carrots, broccoli leaves, broccoli, meat, broccoli, broccoli, broccoli",
      ),
    ).toEqual(["broccoli", "carrots", "broccoli leaves", "meat"]);
    expect(
      splitSeen("There are bananas on a table and some other fruits behind it"),
    ).toEqual(["bananas", "fruits"]);
  });

  it("nunca devuelve más de MAX_SEEN nombres", () => {
    const many = Array.from(
      { length: 40 },
      (_, i) =>
        `berry${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
    ).join(", ");
    expect(splitSeen(many)).toHaveLength(MAX_SEEN);
  });
});

describe("matchSeen: solo lo que la app conoce", () => {
  it("inglés y plural cuadran con el catálogo y con el plan", () => {
    const r = matchSeen("carrots, eggs, rice", diet, NOW);
    expect(r.known.map((s) => s.ingredient)).toEqual([
      "zanahoria",
      "huevos",
      "arroz",
    ]);
    expect(r.known[0].planIds).toEqual(["zanahoria"]);
    expect(r.unknown).toEqual([]);
  });

  it("el plural inglés en «-oes» también cuadra (potatoes → papa, tomatoes → tomate)", () => {
    const r = matchSeen("potatoes, tomatoes", diet, NOW);
    expect(r.known.map((s) => s.ingredient)).toEqual(["papa", "tomate"]);
  });

  it("lo que no es comida en las salidas reales se descarta: escena, horas, efectos", () => {
    expect(
      splitSeen(
        "Chicken wings for sale at a butcher shop, restaurant, 10pm local time UTC",
      ),
    ).toEqual(["chicken wings"]);
    expect(splitSeen("Eggs, butter, salt & pepper powder")).toEqual([
      "eggs",
      "butter",
      "salt",
      "pepper powder",
    ]);
    expect(splitSeen("Carrot, each with a collage effect")).toEqual(["carrot"]);
    expect(splitSeen("Chicken breast topped with grilled potatoes")).toEqual([
      "chicken breast",
      "potatoes",
    ]);
  });

  it("también en español (el modelo a veces contesta así)", () => {
    const r = matchSeen("zanahorias, brócoli", diet, NOW);
    expect(r.known.map((s) => s.ingredient)).toEqual(["zanahoria", "brocoli"]);
  });

  it("gana la forma más larga: «rice cakes» es tostadas, no arroz", () => {
    expect(matchSeen("rice cakes", diet, NOW).known[0].ingredient).toBe(
      "tostadas",
    );
  });

  it("un rojo del plan se RECONOCE (por su id del plan) para que el código lo nombre, y no es ingrediente", () => {
    const r = matchSeen("soda", diet, NOW);
    expect(r.known).toHaveLength(1);
    expect(r.known[0].ingredient).toBeNull();
    expect(r.known[0].planIds).toEqual(["gaseosas"]);
  });

  it("una palabra inventada o genérica no se convierte en alimento", () => {
    const r = matchSeen("flurbleberry, vegetables, food, plate", diet, NOW);
    expect(r.known).toEqual([]);
    // «food» y «plate» ni siquiera son nombres (relleno y escena); lo demás queda a la vista.
    expect(r.unknown).toEqual(["flurbleberry", "vegetables"]);
  });

  it("una alergia (mariscos) no es un alimento del plan: queda a la vista y no entra a ningún lado", () => {
    const r = matchSeen("shrimp, shellfish", diet, NOW);
    expect(r.known).toEqual([]);
    expect(r.unknown).toEqual(["shrimp", "shellfish"]);
  });

  it("los ids salen SIEMPRE del catálogo o del plan, nunca del texto", () => {
    const r = matchSeen(
      "pollo, chicken; huevos, ../../etc, <script>, gaseosas",
      diet,
      NOW,
    );
    const ids = new Set([...Object.keys(diet.trafficLight), "x"]);
    for (const s of r.known) {
      for (const id of s.planIds)
        expect(JSON.stringify(diet)).toContain(`"id":"${id}"`);
      expect(ids.has(s.label)).toBe(false);
    }
    expect(r.known.map((s) => s.ingredient)).toEqual(["pollo", "huevos", null]);
  });
});

describe("matchSeen: lo procesado no es el alimento de dentro (auditoría)", () => {
  it.each([
    "potato chips",
    "chicken nuggets",
    "tomato ketchup",
    "carrot cake",
    "papitas de pollo",
  ])("«%s» no entra como ingrediente de la despensa", (name) => {
    const r = matchSeen(name, diet, NOW);
    expect(r.known.map((s) => s.ingredient).filter(Boolean)).toEqual([]);
  });

  it("lo procesado conserva los avisos: un rojo del plan sigue nombrándose", () => {
    const r = matchSeen("orange juice, soda", diet, NOW);
    expect(r.known.some((s) => s.planIds.includes("gaseosas"))).toBe(true);
    expect(r.known.every((s) => s.ingredient === null)).toBe(true);
  });

  it("el nombre propio del ingrediente no cuenta como procesado (tostadas, helado de la forma)", () => {
    expect(matchSeen("rice cakes", diet, NOW).known[0].ingredient).toBe(
      "tostadas",
    );
  });
});

describe("matchSeen: la primera frase manda y el tope se cuenta (auditoría)", () => {
  it("más allá de MAX_SEEN no se muestran, pero se cuentan en `more`", () => {
    const many = Array.from(
      { length: 20 },
      (_, i) =>
        `zz${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}berry`,
    ).join(", ");
    const r = matchSeen(many, diet, NOW);
    expect(r.unknown).toHaveLength(MAX_SEEN);
    expect(r.more).toBeGreaterThan(0);
  });

  it("sin desborde `more` no aparece o es 0", () => {
    expect(matchSeen("carrots, rice", diet, NOW).more ?? 0).toBe(0);
  });

  it("las frases siguientes solo aportan lo que la app conoce, nunca ruido desconocido", () => {
    const r = matchSeen(
      "Carrots and rice. There is also a flurblezot and some eggs.",
      diet,
      NOW,
    );
    expect(r.known.map((s) => s.ingredient)).toEqual([
      "zanahoria",
      "arroz",
      "huevos",
    ]);
    expect(r.unknown).toEqual([]);
  });

  it("los caracteres de control y los invisibles no sobreviven en ningún nombre", () => {
    const out = splitSeen("rice\u200B,\u0000 egg\u202Es, \u0007carrots");
    expect(out).toEqual(["rice", "egg s", "carrots"]);
    for (const name of out) expect(/\p{C}/u.test(name)).toBe(false);
  });

  it("los plurales ingleses en -ies, -ches y -oes cuadran con su singular", () => {
    expect(matchSeen("berries", diet, NOW).unknown).toEqual(["berries"]);
    expect(matchSeen("tomatoes", diet, NOW).known[0].ingredient).toBe("tomate");
  });
});
