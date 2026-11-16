// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  has,
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
    expect(reading.draft.issuedAt).toBe("2031-03-14");
    expect(reading.pages.validity).toBe(1);
  });

  it("restricción temporal: 5 alimentos separados por «·», aclaración aparte", () => {
    expect(reading.draft.restricted.map(es)).toEqual([
      "Leche de vaca",
      "Trigo y cebada",
      "Huevo entero",
      "Cacahuate",
      "Kiwi",
    ]);
    expect(reading.draft.restrictedNotes).toEqual([
      "Huevo entero: incluye tortas y salsas batidas.",
    ]);
    expect(reading.pages["restricted.cacahuate"]).toBe(11);
  });

  it("aditivos: 10 de 10 en la rejilla de dos segmentos (código y nombre a otra x); el nombre envuelto se une", () => {
    const adds = reading.draft.additives;
    expect(adds.map((a) => [a.code, a.name.es])).toEqual([
      ["E951", "Tinte Simulado Uno"],
      ["E952", "Brillo Simulado Doble (BSD)"],
      ["E953", "Conserva Simulada"],
      ["E954", "Espesor Simulado"],
      ["E955", "Realce Simulado"],
      ["E956", "Suelto Simulado"],
      ["E957", "Mezcla Simulada"],
      ["E958", "Ácido Simulado"],
      ["E959", "Dulzor Simulado"],
      ["E960", "Firmeza Simulada"],
    ]);
    // Dos códigos en una fila comparten «presente»; la columna personal se ignora.
    expect(adds[1].foundIn?.es).toBe("Embutidos, salsas");
    expect(adds[2].foundIn?.es).toBe("Embutidos, salsas");
    expect(adds[0].foundIn?.es).toBe("Gomitas, refrescos simulados");
    expect(adds[9].foundIn).toBeUndefined();
    expect(JSON.stringify(reading)).not.toContain("texto personal");
    expect(reading.pages["additives.E952"]).toBe(8);
  });

  it("otros que evitar: 4 de 4, cada nombre es una línea sola que termina en «:» (uno de ≥ 40 caracteres)", () => {
    const names = reading.draft.alsoAvoid.map(es);
    expect(names).toEqual([
      "Endulzantes de laboratorio",
      "Grasas endurecidas de fábrica para untar (GEFU)",
      "Carnes curadas de bolsa",
      "Refrescos con cafeína",
    ]);
    expect(names[1].length).toBeGreaterThanOrEqual(40);
    // Ni el párrafo de cada bloque ni el recuadro de aviso del pie.
    expect(JSON.stringify(reading.draft.alsoAvoid)).not.toMatch(
      /Párrafo|Recuadro/,
    );
  });

  it("verde: 8 grupos con porción; la fila partida entre páginas se une SIN el pie ni el encabezado", () => {
    const g = reading.draft.green;
    expect(g.map(es)).toEqual([
      "Carnes y huevo",
      "Hojas verdes",
      "Frutas de temporada",
      "Granos sin trigo",
      "Grasas amables",
      "Legumbres de olla",
      "Bebidas de planta",
      "Raíces",
    ]);
    const grain = g.find((x) => x.id === "granos-sin-trigo")!;
    expect(grain.items.map(es)).toEqual([
      "Arroz",
      "Quinoa",
      "Maíz",
      "Avena certificada",
      "Arepa de maíz",
    ]);
    expect(grain.portion.es).toBe("arroz: 1/2 taza; quinoa: 1/3 taza");
    expect(g[0].portion.es).toBe("70-90g por comida, 2 veces al día");
    expect(reading.pages["green.granos-sin-trigo"]).toBe(11);
    expect(reading.pages["green.raices"]).toBe(12);
    // Los paréntesis con hábitos del niño y las marcas ✅ se descartan.
    expect(JSON.stringify(g)).not.toMatch(/lo pide|✅/);
    // Las columnas de aporte e idea no se leen.
    expect(JSON.stringify(g)).not.toMatch(/texto libre|hierro de/);
  });

  it("amarillo: solo lo que trae un límite entre paréntesis", () => {
    expect(reading.draft.yellow.map((y) => [y.name.es, y.limit.es])).toEqual([
      ["Huevo de codorniz", "máx 2/día"],
      ["Banano", "máx 1/día"],
      ["Avena certificada", "3-4 uds"],
    ]);
  });

  it("equivalencias: notas del rojo y etiquetas de reemplazo, la del adjetivo incluida (envuelve 5 líneas)", () => {
    const byKey = Object.fromEntries(
      reading.draft.equivalences.map((e) => [e.whenMissing, e]),
    );
    expect(Object.keys(byKey).sort()).toEqual([
      "leche-de-vaca",
      "meriendas",
      "pan",
      "tazas",
      "trigo-y-cebada",
    ]);
    // «Nota leche» apunta al id del alimento restringido.
    expect(byKey["leche-de-vaca"].use.map((u) => u.name.es)).toEqual([
      "bebida de arroz",
      "bebida de avena",
      "bebida de coco",
      "bebida de almendra",
    ]);
    expect(byKey["trigo-y-cebada"].use).toHaveLength(5);
    expect(byKey.pan.use.map((u) => u.name.es)).toEqual([
      "tostada de yuca",
      "galleta de maíz morado",
      "casabe",
    ]);
    // «<X> de reemplazo <adjetivo>:»: la lista termina a mitad de línea, la frase siguiente no entra.
    expect(byKey.meriendas.title.es).toBe("Meriendas de reemplazo crujientes");
    expect(byKey.meriendas.use.map((u) => u.name.es)).toEqual([
      "maíz inflado",
      "garbanzo horneado",
      "chips de plátano verde",
      "semillas de girasol tostadas",
      "bastones de jícama",
      "manzana deshidratada",
    ]);
    // La textura solo cuando el texto la dice.
    expect(byKey.meriendas.use.every((u) => u.texture === "crunchy")).toBe(
      true,
    );
    expect(byKey.pan.use.every((u) => u.texture === undefined)).toBe(true);
    expect(byKey.tazas.use).toHaveLength(2);
    expect(reading.pages["equivalences.leche-de-vaca"]).toBe(11);
  });

  it("el consejo «<persona>: si tiene …, reemplazar por …» no se lee (nombra a la familia), aunque el sujeto lleve «de»", () => {
    const all = JSON.stringify(reading);
    expect(all).not.toMatch(/Abuelo|hielo|Tía|Ana|hambre|yogur/);
  });

  it("en hidratación, un sujeto largo o con punto tampoco entra al hábito", () => {
    const r = readPlanText([
      fakePage(1, [
        [78, "💧 Hidratación simulada"],
        [
          78,
          "Meta: 1.0 a 1.5 litros. Hábito: 1 vaso al despertar. Sra. Persona Simulada De Nombre Muy Largo Extra: si tiene sed, reemplazar por agua.",
        ],
      ]),
    ]);
    expect(r.draft.hydration?.habit.es).toBe("1 vaso al despertar.");
    expect(JSON.stringify(r)).not.toMatch(/Persona|sed/);
  });

  it("suplementos: la presentación del frasco sale del nombre (la marca se queda), la palabra cortada se une", () => {
    const s = reading.draft.supplements;
    expect(s.map((x) => [x.name.es, x.days, x.dose.es, x.when.es])).toEqual([
      [
        "Gotas de Sol Simuladas",
        ["mon", "wed", "fri"],
        "2 gotas por dosis",
        "Darlas con el arranque.",
      ],
      [
        "Gomitas Simuladas Marca Lumen",
        ["tue", "thu", "sat"],
        "1 unidad (masticable)",
        "Darla con el mediodía.",
      ],
      [
        "Polvo Flora Simulada",
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        "1 sobre",
        "Puede ir disuelto en agua fría.",
      ],
    ]);
    // Ni el título del calendario de verificación entra al último nombre.
    expect(JSON.stringify(s)).not.toMatch(/fl oz|120 ml|vistazo/);
    expect(reading.draft.supplementNotes?.es).toMatch(
      /^Rutina: .*Si se olvida: /,
    );
    // El aviso y la columna del profesional no entran a las notas.
    expect(reading.draft.supplementNotes?.es).not.toMatch(/Aviso|Ficticia/);
    expect(reading.pages.supplements).toBe(15);
  });

  it("menú: 5 franjas en 24 h; «12:15 – 1:15 pm» y una hora sola (+30 min); sin «→»", () => {
    expect(reading.draft.menu.map((m) => [m.name.es, m.start, m.end])).toEqual([
      ["Arranque", "06:45", "07:15"],
      ["Recreo / Media", "09:50", "10:20"],
      ["Mediodía", "12:15", "13:15"],
      ["Tarde", "15:40", "16:10"],
      ["Noche", "18:20", "18:50"],
    ]);
    expect(reading.draft.menu[0].content.es).toBe(
      "Arepa de maíz con aguacate · Opción 2: avena con pera",
    );
    expect(JSON.stringify(reading.draft.menu)).not.toContain("→");
    expect(reading.pages["menu.mediodia"]).toBe(13);
  });

  it("hidratación: meta con punto decimal, hábito y vasos", () => {
    expect(reading.draft.hydration).toEqual({
      targetLitersMin: 0.9,
      targetLitersMax: 1.4,
      glassesPerDay: 3,
      habit: {
        es: "2 vasos al levantarse, 1 en la merienda.",
        en: "2 vasos al levantarse, 1 en la merienda.",
      },
    });
  });

  it("actividad y sueño: solo de la columna de la derecha", () => {
    expect(reading.draft.goals.activity?.es).toBe(
      "30 a 50 minutos de bici o patines cada tarde.",
    );
    expect(reading.draft.goals.sleep?.es).toBe(
      "Dormir de 8:15 pm a 6:45 am con la luz apagada.",
    );
    expect(JSON.stringify(reading.draft.goals)).not.toContain("lectura");
  });
});

describe("trampas de la extracción (forma-del-pdf §4)", () => {
  it("encabezado y pie tipo B fuera ANTES de leer tablas: la identidad del profesional no entra a ningún grupo", () => {
    // El pie está en la banda de abajo (y > alto − 60) de cada página tipo B…
    const footer = pages
      .find((p) => p.n === 11)!
      .items.find((i) => i.str.includes("Rosa"))!;
    expect(footer.y).toBeGreaterThan(842.88 - 60);
    expect(footer.y).toBeLessThan(842.88 - 30);
    // …y no sobrevive en lo leído.
    expect(JSON.stringify(reading)).not.toMatch(
      /Rosa|Ficticia|Dietética|Cuaderno/,
    );
  });

  it("un U+0000 del PDF se limpia antes de unir", () => {
    expect(
      pages.some((p) => p.items.some((i) => i.str.includes("\u0000"))),
    ).toBe(true);
    expect(JSON.stringify(reading)).not.toContain("\\u0000");
    expect(reading.draft.supplementNotes?.es).toContain("fresco y seco");
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
      "Tomás",
      "Quimera",
      "SIM-1234",
      "@",
      "+00",
      "Ficticia",
      "Valor Simulado",
      "Prosa simulada",
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
  it("valida contra el schema v2, con el plazo leído y la página de cada dato", () => {
    const res = assembleDietPlan(
      reading.draft,
      reading.pages,
      new Date(2030, 0, 6),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.diet.restrictions.validFrom).toBe("2031-03-14");
    // «por 4 meses» → 120 días.
    expect(res.diet.restrictions.validUntil).toBe("2031-07-12");
    expect(res.diet.restrictions.note.es).toContain("incluye tortas");
    expect(res.diet.meta.source.es).toBe(
      "Leído del PDF el 2030-01-06, revisado por ti.",
    );
    expect(res.diet.pages?.["menu.noche"]).toBe(13);
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

describe("filas que el lector vio y no pudo leer se avisan (no se pierden en silencio)", () => {
  it("el PDF de prueba se lee sin saltar ninguna fila", () => {
    expect(reading.skipped).toEqual({});
  });

  it("un menú con horas sin am/pm cuenta las comidas saltadas", () => {
    const broken = pages.map((p) => ({
      ...p,
      items: p.items.map((i) => ({
        ...i,
        str: /^\d{1,2}:\d{2}/.test(i.str)
          ? i.str.replace(/\s*[ap]\.?\s*m\.?/gi, "")
          : i.str,
      })),
    }));
    expect(readPlanText(broken).skipped.menu ?? 0).toBeGreaterThan(0);
  });

  it("un suplemento con días abreviados no reconocibles cuenta como saltado", () => {
    const broken = pages.map((p) => ({
      ...p,
      items: p.items.map((i) => ({
        ...i,
        str: /^(Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)/.test(
          i.str,
        )
          ? i.str.replace(/^(\p{L}{3})\p{L}*/u, "$1.")
          : i.str,
      })),
    }));
    expect(readPlanText(broken).skipped.supplements ?? 0).toBeGreaterThan(0);
  });
});

describe("vigencia, fecha y nombres", () => {
  it("el plazo se lee del encabezado de la restricción (4 meses → 120 días)", () => {
    expect(reading.draft.restrictionDays).toBe(120);
  });

  it("«por 60 días» → 60 y el plan lo usa; sin plazo → 90", () => {
    const edit = (re: RegExp, to: string) =>
      pages.map((p) => ({
        ...p,
        items: p.items.map((i) => ({ ...i, str: i.str.replace(re, to) })),
      }));
    const d60 = readPlanText(edit(/por 4 meses/, "por 60 días"));
    expect(d60.draft.restrictionDays).toBe(60);
    const plan = assembleDietPlan(d60.draft, d60.pages, new Date(2026, 10, 15));
    expect(plan.ok && plan.diet.restrictions.validUntil).toBe(
      addDaysIso(d60.draft.issuedAt!, 60),
    );
    const none = readPlanText(edit(/ por 4 meses/, ""));
    expect(none.draft.restrictionDays).toBeUndefined();
  });

  it("la fecha NO se toma de una página descartada (resultados)", () => {
    const blank = (str: string) => str.replace(/\d{2}[./-]\d{2}[./-]\d{4}/, "");
    const injected = pages.map((p) =>
      p.items.some((i) => /Secci[oó]n\s*0[12]/i.test(i.str))
        ? {
            ...p,
            items: [
              ...p.items,
              { str: "Fecha: 12.10.2026", x: 50, y: 120, w: 100 },
            ],
          }
        : {
            ...p,
            items: p.items.map((i) => ({ ...i, str: blank(i.str) })),
          },
    );
    // Hay una página de resultados con fecha y la portada no la trae: no se usa.
    expect(
      injected.some((p) => p.items.some((i) => i.str.includes("12.10.2026"))),
    ).toBe(true);
    expect(readPlanText(injected).draft.issuedAt).toBeUndefined();
  });

  it("una hora nocturna con am/pm explícitos conserva su inicio (9:00 pm – 8:00 am)", () => {
    expect(parseTimeRange("9:00 pm – 8:00 am")).toEqual({
      start: "21:00",
      end: "08:00",
    });
  });
});

describe("el nombre del niño se borra aunque lleve tilde o mayúsculas", () => {
  it.each([
    ["Álvaro Núñez", /lvaro|n[uú][ñn]ez/i],
    ["JOSÉ PÉREZ", /jos[eé]|p[eé]rez/i],
    ["Sofía Ramírez", /sof[ií]a|ram[ií]rez/i],
  ])("«%s» no sobrevive en el borrador", (name, leak) => {
    const renamed = pages.map((p) => ({
      ...p,
      items: p.items.map((i) => ({
        ...i,
        str: i.str.replace(/Tomás(\s+Quimera)?/g, name),
      })),
    }));
    expect(JSON.stringify(readPlanText(renamed).draft)).not.toMatch(leak);
  });
});

describe("equivalencias: una por alimento que falta", () => {
  it("el PDF de prueba no repite ninguna", () => {
    const keys = reading.draft.equivalences.map((e) => e.whenMissing);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("lo que pagó la auditoría del PR del lector", () => {
  const edit = (
    f: (
      i: PdfPage["items"][number],
      p: PdfPage,
    ) => PdfPage["items"][number] | null,
  ) =>
    pages.map((p) => ({
      ...p,
      items: p.items
        .map((i) => f(i, p))
        .filter((i): i is PdfPage["items"][number] => !!i),
    }));

  it("fecha: solo de la portada; sin fecha en la portada, una fecha de otra página no gana", () => {
    const noCover = edit((i) =>
      /\d{2}\.\d{2}\.\d{4}/.test(i.str) ? null : i,
    ).map((p) =>
      p.n === 12
        ? {
            ...p,
            items: [
              ...p.items,
              { str: "Revisado el 02.02.2032", x: 78, y: 400, w: 90 },
            ],
          }
        : p,
    );
    expect(readPlanText(noCover).draft.issuedAt).toBeUndefined();
  });

  it("fecha: con dos fechas en la portada, gana la última (la del plan, no una anterior)", () => {
    const two = pages.map((p) =>
      p.n === 1
        ? {
            ...p,
            items: [
              { str: "Nacimiento 09.09.2024", x: 78, y: 200, w: 90 },
              ...p.items,
            ],
          }
        : p,
    );
    expect(readPlanText(two).draft.issuedAt).toBe("2031-03-14");
  });

  it("menú: una mención suelta de «menú» antes de filas con ícono no roba el inicio", () => {
    const early = pages.map((p) =>
      p.n === 6
        ? {
            ...p,
            items: [
              { str: "Ideas para el menú", x: 78, y: 65, w: 70 },
              ...p.items,
            ],
          }
        : p,
    );
    const r = readPlanText(early);
    expect(r.draft.menu.map((m) => m.name.es)).toEqual([
      "Arranque",
      "Recreo / Media",
      "Mediodía",
      "Tarde",
      "Noche",
    ]);
    expect(r.pages.menu).toBe(13);
  });

  it("pilares: si la meta de minutos se escribe distinto, el sueño y los reemplazos se leen igual", () => {
    const r = readPlanText(
      edit((i) => ({
        ...i,
        str: i.str.replace("30 a 50 minutos de", "media hora de"),
      })),
    );
    expect(r.draft.goals.activity).toBeUndefined();
    expect(r.draft.goals.sleep?.es).toBe(
      "Dormir de 8:15 pm a 6:45 am con la luz apagada.",
    );
    expect(r.draft.equivalences.map((e) => e.whenMissing)).toEqual(
      expect.arrayContaining(["pan", "meriendas", "tazas"]),
    );
  });

  it("sin rejilla de aditivos, «otros que evitar» no se busca en otra parte del PDF", () => {
    const r = readPlanText(edit((i) => (/^E \d{3}$/.test(i.str) ? null : i)));
    expect(r.draft.additives).toEqual([]);
    expect(r.draft.alsoAvoid).toEqual([]);
  });

  it("toLines: un U+0000 suelto entre dos palabras es un blanco; uno pegado a la palabra se quita sin partirla", () => {
    const lines = toLines({
      n: 1,
      height: 800,
      items: [
        { str: "fresco", x: 78, y: 100, w: 24 },
        { str: "\u0000", x: 102, y: 100, w: 1 },
        { str: "y", x: 103, y: 100, w: 4 },
        { str: "se\u0000co", x: 78, y: 120, w: 20 },
      ],
    });
    expect(lines.map((l) => l.text)).toEqual(["fresco y", "seco"]);
  });

  it("toLines: una tilde descompuesta (NFD) se recompone y el ancla la reconoce", () => {
    const [l] = toLines({
      n: 1,
      height: 800,
      items: [{ str: "Porcio\u0301n", x: 78, y: 100, w: 30 }],
    });
    expect(l.text).toBe("Porción");
    expect(has(l.text, "porcion")).toBe(true);
  });
});
