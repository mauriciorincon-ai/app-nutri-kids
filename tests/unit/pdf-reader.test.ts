// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  joinCell,
  parseTimeRange,
  readPlanText,
  slug,
  type PlanReading,
} from "@/lib/diet/pdf-reader";
import {
  extractPdfPages,
  toLines,
  type PdfJsLike,
  type PdfPage,
} from "@/lib/diet/pdf-text";
import {
  assembleDietPlan,
  addDaysIso,
  localIso,
} from "@/lib/diet/plan-assemble";
import { dietPlanSchema } from "@/lib/diet/schema";

/**
 * El lector contra `tests/fixtures/plan-ejemplo.pdf`: un plan INVENTADO con la forma de
 * la plantilla oficial (scripts/make-plan-fixture.mjs). Cada sección sale completa y con
 * su página; la identidad, las medidas, los resultados y el contacto NO salen jamás.
 */
const FIXTURE = join(__dirname, "../fixtures/plan-ejemplo.pdf");
let pages: PdfPage[];
let reading: PlanReading;

beforeAll(async () => {
  const pdfjs =
    (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsLike;
  pages = await extractPdfPages(pdfjs, new Uint8Array(readFileSync(FIXTURE)));
  reading = readPlanText(pages);
});

const es = (x: { name: { es: string } }) => x.name.es;

describe("cada sección del PDF de prueba sale completa y con su página", () => {
  it("lee las 18 páginas y no deja secciones sin reconocer", () => {
    expect(pages).toHaveLength(18);
    expect(reading.unrecognized).toEqual([]);
  });

  it("vigencia: la fecha de la portada (DD.MM.AAAA) y su página", () => {
    expect(reading.draft.issuedAt).toBe("2030-01-05");
    expect(reading.pages.validity).toBe(1);
  });

  it("restricción temporal: 5 alimentos separados por «·», aclaración aparte", () => {
    expect(reading.draft.restricted.map(es)).toEqual([
      "Lácteos de vaca",
      "Gluten",
      "Huevo de gallina",
      "Maní",
      "Fresa",
    ]);
    expect(reading.draft.restrictedNotes).toEqual([
      "Huevo de gallina: incluye mayonesa y repostería.",
    ]);
    expect(reading.pages["restricted.mani"]).toBe(11);
  });

  it("aditivos: 10 códigos, la palabra cortada sin guion se une, «presente en» por código", () => {
    const adds = reading.draft.additives;
    expect(adds.map((a) => a.code)).toEqual([
      "E901",
      "E902",
      "E903",
      "E904",
      "E905",
      "E906",
      "E907",
      "E908",
      "E909",
      "E910",
    ]);
    expect(adds[2].name.es).toBe("Conservante Ejemplo (CEJ)");
    // Dos códigos en una fila comparten «presente en»; la columna de riesgo se ignora.
    expect(adds[1].foundIn?.es).toBe("Embutidos, salsas");
    expect(adds[2].foundIn?.es).toBe("Embutidos, salsas");
    expect(adds[0].foundIn?.es).toBe("Gomitas, refrescos de ejemplo");
    expect(adds[9].foundIn).toBeUndefined();
    expect(JSON.stringify(reading)).not.toContain("texto personal");
    expect(reading.pages["additives.E903"]).toBe(8);
  });

  it("también evitar: solo el nombre antes de «:»", () => {
    expect(reading.draft.alsoAvoid.map(es)).toEqual([
      "Edulcorantes artificiales",
      "Grasas hidrogenadas",
      "Embutidos procesados",
      "Bebidas energéticas",
    ]);
  });

  it("verde: 8 grupos con porción; la fila partida entre páginas se une", () => {
    const g = reading.draft.green;
    expect(g).toHaveLength(8);
    const cereal = g.find((x) => x.id === "cereales-sin-gluten")!;
    expect(cereal.items.map(es)).toEqual([
      "Arroz",
      "Quinoa",
      "Maíz",
      "Avena certificada",
      "Arepa de maíz",
    ]);
    expect(cereal.portion.es).toBe("arroz: 1/2 taza; quinoa: 1/3 taza");
    expect(g[0].portion.es).toBe("80-100g por comida, 2 veces al día");
    expect(reading.pages["green.cereales-sin-gluten"]).toBe(11);
    expect(reading.pages["green.tuberculos"]).toBe(12);
    // Los paréntesis con hábitos del niño y las marcas ✅ se descartan.
    expect(JSON.stringify(g)).not.toMatch(/le encanta|✅/);
    // Las columnas «Nutrientes» y «Tip» no se leen.
    expect(JSON.stringify(g)).not.toMatch(/texto libre|hierro y zinc/);
  });

  it("amarillo: solo lo que trae un límite entre paréntesis", () => {
    expect(reading.draft.yellow.map((y) => [y.name.es, y.limit.es])).toEqual([
      ["Huevo de codorniz", "máx 2/día"],
      ["Banano", "máx 1/día"],
      ["Avena certificada", "3-4 uds"],
    ]);
  });

  it("equivalencias: notas del rojo, etiquetas de reemplazo y el tip de hidratación", () => {
    const byKey = Object.fromEntries(
      reading.draft.equivalences.map((e) => [e.whenMissing, e]),
    );
    // «Nota lácteos» apunta al id del alimento restringido.
    expect(byKey["lacteos-de-vaca"].use.map((u) => u.name.es)).toEqual([
      "bebida de avena",
      "bebida de arroz",
      "bebida de coco",
      "bebida de almendra",
    ]);
    expect(byKey.gluten.use).toHaveLength(5);
    expect(byKey.pan.use.map((u) => u.name.es)).toEqual([
      "pan de arroz",
      "tortilla de maíz",
      "arepa",
    ]);
    // La textura solo cuando el texto la dice.
    expect(byKey.snacks.use.every((u) => u.texture === "crunchy")).toBe(true);
    expect(byKey.pan.use.every((u) => u.texture === undefined)).toBe(true);
    expect(byKey.leches.use).toHaveLength(2);
    expect(byKey.jugos.use.map((u) => u.name.es)).toEqual([
      "agua con limón",
      "agua de coco",
    ]);
    expect(reading.pages["equivalences.lacteos-de-vaca"]).toBe(11);
  });

  it("suplementos: días Lun–Dom, dosis envuelta y la primera oración de instrucciones", () => {
    const s = reading.draft.supplements;
    expect(s.map((x) => [x.name.es, x.days, x.dose.es, x.when.es])).toEqual([
      [
        "Vitamina D Gotas Ejemplo",
        ["mon", "wed", "fri"],
        "2 gotas por dosis",
        "Tomar con el desayuno.",
      ],
      [
        "Omega Ejemplo Masticable",
        ["tue", "thu", "sat"],
        "1 unidad (masticable)",
        "Tomar con el almuerzo.",
      ],
      [
        "Probiótico Ejemplo",
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        "1 sobre",
        "Puede darse disuelto en agua fría.",
      ],
    ]);
    expect(reading.draft.supplementNotes?.es).toMatch(
      /^Constancia: .*Olvidos: /,
    );
    // El aviso y la columna del profesional no entran a las notas.
    expect(reading.draft.supplementNotes?.es).not.toMatch(/Aviso|Inventada/);
    expect(reading.pages.supplements).toBe(15);
  });

  it("menú: 5 franjas en 24 h; «12:30 – 1:30 pm» y una hora sola (+30 min); sin «→»", () => {
    expect(reading.draft.menu.map((m) => [m.name.es, m.start, m.end])).toEqual([
      ["Desayuno", "07:00", "07:30"],
      ["Media mañana", "10:00", "10:30"],
      ["Almuerzo", "12:30", "13:30"],
      ["Merienda / Onces", "16:00", "16:30"],
      ["Cena", "18:30", "19:00"],
    ]);
    expect(reading.draft.menu[0].content.es).toBe(
      "Arepa de maíz con aguacate · Opción A: avena con pera",
    );
    expect(JSON.stringify(reading.draft.menu)).not.toContain("→");
    expect(reading.pages["menu.almuerzo"]).toBe(13);
  });

  it("hidratación: meta con punto decimal, hábito y vasos", () => {
    expect(reading.draft.hydration).toEqual({
      targetLitersMin: 1.1,
      targetLitersMax: 1.3,
      glassesPerDay: 3,
      habit: {
        es: "1 vaso al despertar, 1 con el almuerzo, 1 con la cena.",
        en: "1 vaso al despertar, 1 con el almuerzo, 1 con la cena.",
      },
    });
  });

  it("actividad y sueño: solo de la columna de recomendaciones", () => {
    expect(reading.draft.goals.activity?.es).toBe(
      "45 a 60 minutos de juego activo al aire libre.",
    );
    expect(reading.draft.goals.sleep?.es).toBe(
      "Acostarse entre 7:30 y 8:00pm y dormir 10-11 horas.",
    );
    expect(JSON.stringify(reading.draft.goals)).not.toContain("análisis");
  });
});

describe("lo que jamás se lee (regla dura 2, decisión 2 a)", () => {
  it("ni peso, ni talla, ni IMC, ni percentiles, ni identidad, ni contacto, ni resultados", () => {
    const all = JSON.stringify(reading);
    for (const bait of [
      "23,4",
      "118",
      "kg",
      " cm",
      "16,8",
      "p50",
      "Peso",
      "Talla",
      "IMC",
      "Percentil",
      "6 años",
      "Lucas",
      "Ejemplar",
      "EJ-0000",
      "@",
      "+00",
      "Inventada",
      "Marcador",
      "Motivo de Consulta",
    ])
      expect(all, bait).not.toContain(bait);
  });

  it("el perfil no se infiere: el borrador no tiene condición ni alergias", () => {
    expect(reading.draft).not.toHaveProperty("profile");
    const plan = assembleDietPlan(
      reading.draft,
      reading.pages,
      new Date(2030, 0, 6),
    );
    expect(plan.ok && plan.diet.profile).toBeFalsy();
  });

  it("una línea con medidas se descarta aunque aparezca fuera de su página", () => {
    const r = readPlanText([
      fakePage(1, [
        [78, "💧 Hidratación de Niño Uno"],
        [
          78,
          "Meta: 1.0 a 1.5 litros de agua al día. Hábito: 1 vaso al despertar.",
        ],
        [78, "Peso de referencia 30 kg"],
      ]),
    ]);
    expect(JSON.stringify(r)).not.toMatch(/30 kg|Peso/);
    expect(r.draft.hydration?.targetLitersMax).toBe(1.5);
  });
});

describe("el plan ensamblado", () => {
  it("valida contra el schema v2, con 90 días de vigencia y la página de cada dato", () => {
    const res = assembleDietPlan(
      reading.draft,
      reading.pages,
      new Date(2030, 0, 6),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.diet.restrictions.validFrom).toBe("2030-01-05");
    expect(res.diet.restrictions.validUntil).toBe("2030-04-05");
    expect(res.diet.restrictions.note.es).toContain("incluye mayonesa");
    expect(res.diet.meta.source.es).toBe(
      "Leído del PDF el 2030-01-06, revisado por ti.",
    );
    expect(res.diet.pages?.["menu.cena"]).toBe(13);
    expect(res.diet.trafficLight.red.additives[9].foundIn.es).toBe(
      "Tu plan no lo dice.",
    );
    expect(dietPlanSchema.safeParse(res.diet).success).toBe(true);
  });

  it("sin fecha en el PDF, la vigencia arranca el día de la lectura", () => {
    const res = assembleDietPlan(
      { ...reading.draft, issuedAt: undefined },
      {},
      new Date(2030, 1, 1),
    );
    expect(res.ok && res.diet.restrictions.validFrom).toBe("2030-02-01");
  });

  it("los ítems rojos que añade quien cuida llevan su «por qué» del plan", () => {
    const res = assembleDietPlan(reading.draft, {}, new Date(2030, 0, 6), [
      {
        id: "snacks",
        name: { es: "Snacks de paquete", en: "Packaged snacks" },
      },
    ]);
    expect(res.ok && res.diet.trafficLight.red.items[0].why.es).toBe(
      "Tu plan pide evitarlo.",
    );
  });

  it("sin hidratación no se inventa: el ensamblado falla y la revisión la pide", () => {
    const res = assembleDietPlan(
      { ...reading.draft, hydration: undefined },
      {},
      new Date(2030, 0, 6),
    );
    expect(res).toEqual({
      ok: false,
      error: "invalid-schema",
      detail: "hydration",
    });
  });

  it("sin menú, el schema lo rechaza (nunca se guarda un plan inválido)", () => {
    const res = assembleDietPlan(
      { ...reading.draft, menu: [] },
      {},
      new Date(),
    );
    expect(res.ok).toBe(false);
  });

  it("fechas: suma de días y fecha local", () => {
    expect(addDaysIso("2030-12-15", 30)).toBe("2031-01-14");
    expect(localIso(new Date(2030, 6, 9, 23, 59))).toBe("2030-07-09");
  });
});

describe("un PDF con otra forma no rechaza: dice qué no reconoció", () => {
  it("texto cualquiera → todas las secciones sin reconocer, sin error", () => {
    const r = readPlanText([
      fakePage(1, [
        [78, "Un documento cualquiera"],
        [78, "Sin tablas ni secciones conocidas."],
      ]),
    ]);
    expect(r.unrecognized).toHaveLength(11);
    expect(r.draft.green).toEqual([]);
  });

  it("un PDF vacío tampoco truena", () => {
    expect(readPlanText([]).unrecognized).toHaveLength(11);
  });
});

describe("piezas del lector", () => {
  it.each([
    ["7:00 – 8:00 am", "07:00", "08:00"],
    ["12:30 – 1:30 pm", "12:30", "13:30"],
    ["11:30 – 12:30 pm", "11:30", "12:30"],
    ["4:00 – 4:30 p.m.", "16:00", "16:30"],
    ["10:00 am – 1:00 pm", "10:00", "13:00"],
    ["10:00 am", "10:00", "10:30"],
    ["11:45 pm", "23:45", "23:59"],
  ])("hora «%s» → %s–%s", (text, start, end) => {
    expect(parseTimeRange(text)).toEqual({ start, end });
  });

  it("sin hora → null", () => {
    expect(parseTimeRange("Desayuno")).toBeNull();
  });

  it("une guiones de corte y, en nombres, palabras cortadas sin guion", () => {
    expect(joinCell(["ali-", "mento", "otro"])).toBe("alimento otro");
    expect(joinCell(["Conservan", "te Ejemplo"], true)).toBe(
      "Conservante Ejemplo",
    );
    expect(joinCell(["huevo de", "codorniz"])).toBe("huevo de codorniz");
    expect(joinCell(["", "  "])).toBe("");
  });

  it("slug sin tildes", () => {
    expect(slug("Médium Ñandú")).toBe("medium-nandu");
    expect(slug("···")).toBe("item");
  });

  it("toLines: un blanco ancho separa columnas; uno angosto, palabras; un ítem pegado se une", () => {
    const lines = toLines({
      n: 3,
      height: 800,
      items: [
        { str: "Grupo", x: 78, y: 100, w: 24 },
        { str: " ", x: 102, y: 100, w: 40 },
        { str: "Fuentes", x: 150, y: 100.5, w: 30 },
        { str: " ", x: 180, y: 100, w: 3 },
        { str: "Arti", x: 183, y: 100, w: 10 },
        { str: "fi", x: 193, y: 100, w: 4 },
        { str: "cial", x: 197, y: 100, w: 10 },
        { str: "abajo", x: 78, y: 120, w: 20 },
      ],
    });
    expect(lines.map((l) => l.segs.map((s) => s.text))).toEqual([
      ["Grupo", "Fuentes Artificial"],
      ["abajo"],
    ]);
    expect(lines[0].page).toBe(3);
  });
});

describe("extracción", () => {
  it("el documento se destruye aunque falle la lectura (no quedan bytes vivos)", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const fake: PdfJsLike = {
      getDocument: () => ({
        promise: Promise.reject(new Error("broken")),
        destroy,
      }),
    };
    await expect(extractPdfPages(fake, new Uint8Array([1]))).rejects.toThrow();
    expect(destroy).toHaveBeenCalled();
  });

  it("pide a pdf.js sin eval, sin fuentes del sistema y sin descargas", async () => {
    const getDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ height: 100 }),
          getTextContent: async () => ({
            items: [
              { str: "hola", transform: [1, 0, 0, 1, 10, 90], width: 5 },
              { type: "beginMarkedContent" },
            ],
          }),
        }),
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    });
    const out = await extractPdfPages({ getDocument }, new Uint8Array([1]));
    expect(getDocument.mock.calls[0][0]).toMatchObject({
      isEvalSupported: false,
      useSystemFonts: false,
      disableAutoFetch: true,
      disableRange: true,
      disableStream: true,
    });
    expect(out).toEqual([
      { n: 1, height: 100, items: [{ str: "hola", x: 10, y: 10, w: 5 }] },
    ]);
  });
});

function fakePage(n: number, rows: [number, string][]): PdfPage {
  return {
    n,
    height: 842,
    items: rows.map(([x, str], i) => ({
      str,
      x,
      y: 100 + i * 12,
      w: str.length * 4,
    })),
  };
}
