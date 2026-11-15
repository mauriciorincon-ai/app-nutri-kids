#!/usr/bin/env node
/**
 * Genera `tests/fixtures/plan-ejemplo.pdf`: un plan nutricional INVENTADO con la misma
 * FORMA que la plantilla oficial (dos documentos fusionados, encabezados tipo A «Informe
 * … Sección NN» y tipo B «… · … · Mes AAAA», tablas por columnas, una fila partida entre
 * páginas, una palabra cortada sin guion, una hora «12:30 – 1:30 pm»). Ningún dato es real:
 * nombre, profesional, alimentos, aditivos (E9xx no existen), dosis y medidas son de ejemplo.
 * La página de identidad trae peso y talla A PROPÓSITO: es la carnada del test que exige que
 * el lector jamás los lea (regla dura 2).
 *
 * Se genera con Chromium sin cabeza (Playwright `page.pdf()`), como el original:
 *   node scripts/make-plan-fixture.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "tests/fixtures/plan-ejemplo.pdf");

const CHILD = "Lucas Ejemplar";
const PRO =
  "Dra. Ana Inventada, Nutricionista · Pediatría / Nutrición / Deporte";
const HEAD_B = `Plan Ejemplo · ${CHILD} · Enero 2030`;
const HEAD_A = "Informe Ejemplo de Laboratorio";

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const lines = (arr) => arr.map((l) => `<div>${esc(l)}</div>`).join("");

function pageA(section, title, body) {
  return `<section class="page"><header class="ha"><span>${esc(HEAD_A)}</span><span>${esc(title)} Sección ${section}</span></header>${body}</section>`;
}
function pageB(body) {
  return `<section class="page"><header class="hb">${esc(HEAD_B)}</header>${body}<footer>${esc(PRO)}</footer></section>`;
}
function bare(body) {
  return `<section class="page">${body}</section>`;
}
/** Tabla de columnas con anchos en pt; filas = arrays de celdas (cada celda = líneas). */
function table(widths, head, rows, { header = true } = {}) {
  const cols = widths.map((w) => `<col style="width:${w}pt">`).join("");
  const th = header
    ? `<tr class="th">${head.map((h) => `<td>${lines([h])}</td>`).join("")}</tr>`
    : "";
  const trs = rows
    .map(
      (r) => `<tr>${r.map((c) => `<td>${lines(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table><colgroup>${cols}</colgroup>${th}${trs}</table>`;
}

const GREEN_W = [72, 109, 90, 81, 110];
const GREEN_H = [
  "Grupo",
  "Fuentes Recomendadas",
  "Nutrientes que Optimiza",
  "Porción / Frecuencia",
  "Tip Práctico",
];
const GREEN_1 = [
  [
    ["🥩 Proteína", "Animal"],
    ["pollo · pavo · pescado", "blanco · huevo de", "codorniz (máx 2/día)"],
    ["hierro y zinc de", "ejemplo"],
    ["80-100g por comida", "2 veces al día"],
    ["texto libre de", "ejemplo"],
  ],
  [
    ["🥦 Verduras"],
    ["brócoli · zanahoria ·", "calabacín (le encanta) ·", "espinaca"],
    ["fibra de ejemplo"],
    ["1 taza por comida", "3 veces al día"],
    ["texto libre"],
  ],
  [
    ["🍐 Frutas"],
    ["pera · kiwi · mango ·", "banano (máx 1/día)"],
    ["vitaminas de", "ejemplo"],
    ["1 porción por", "merienda", "2 veces al día"],
    ["texto libre"],
  ],
  [
    ["🍚 Cereales", "sin", "Gluten"],
    ["arroz · quinoa · maíz ·", "avena certificada"],
    ["energía de", "ejemplo"],
    ["arroz: 1/2 taza"],
    ["texto libre de", "ejemplo que"],
  ],
];
const GREEN_4_CONT = [
  [[], ["(3-4 uds) · ✅ arepa de", "maíz"], ["sigue"], ["quinoa: 1/3 taza"], ["continúa"]],
];
const GREEN_2 = [
  [
    ["🥑 Grasas", "Buenas"],
    ["aguacate · aceite de", "oliva · semillas de", "chía"],
    ["omega de ejemplo"],
    ["1 cucharada por", "comida"],
    ["texto libre"],
  ],
  [
    ["🫘 Legumbres"],
    ["lenteja · garbanzo ·", "frijol"],
    ["proteína vegetal"],
    ["1/2 taza", "3 veces por semana"],
    ["texto libre"],
  ],
  [
    ["🥥 Bebidas", "Vegetales"],
    ["bebida de avena ·", "bebida de coco"],
    ["calcio de ejemplo"],
    ["1 vaso al día"],
    ["texto libre"],
  ],
  [
    ["🥔 Tubérculos"],
    ["papa · yuca · batata"],
    ["energía"],
    ["1 porción por", "almuerzo"],
    ["texto libre"],
  ],
];

const pages = [
  // p1 portada: la ÚNICA fecha completa; nombre e ID no se guardan.
  bare(
    `<div class="cover">${lines([
      "Plan Ejemplo de Nutrición Infantil",
      CHILD,
      "ID: EJ-0000-9999",
      "Fecha: 05.01.2030",
    ])}</div>`,
  ),
  // p2 bienvenida
  bare(lines(["Bienvenida", "Texto de bienvenida de ejemplo para la familia."])),
  // p3 Informe Sección 01: resultados (ignorar)
  pageA(
    "01",
    "Resultados",
    lines([
      "Marcador Ejemplo A 12,3 unidades",
      "Marcador Ejemplo B 45 unidades",
    ]),
  ),
  // p4 divisor
  bare(`<div class="divider">${lines(["Sección 02", "Plan"])}</div>`),
  // p5 Plan: identidad y medidas (NUNCA se parsea) — carnada de antropometría
  pageB(
    lines(["Motivo de Consulta y Estado General"]) +
      table(
        [120, 300],
        ["Dato", "Información"],
        [
          [["Nombre"], [CHILD]],
          [["Edad"], ["6 años"]],
          [["Peso"], ["23,4 kg"]],
          [["Talla"], ["118 cm"]],
          [["IMC"], ["16,8"]],
          [["Percentil"], ["p50"]],
          [["Correo"], ["familia@ejemplo.test"]],
          [["Teléfono"], ["+00 000 000 000"]],
        ],
      ) +
      lines([
        "Prosa de ejemplo del motivo de consulta: no se infiere ningún dato clínico.",
      ]),
  ),
  // p6 Plan: pilares (nutrición y movimiento)
  pageB(
    table(
      [78, 168, 200],
      ["Pilar", `Análisis de ${CHILD}`, "Recomendaciones (para cuidadores)"],
      [
        [
          ["🥗 Nutrición"],
          ["análisis personal de", "ejemplo que no se lee"],
          [
            "Cambio del pan: pan de arroz, tortilla de",
            "maíz, arepa.",
            "Snacks de reemplazo crujientes:",
            "palomitas caseras, galletas de arroz,",
            "garbanzos tostados.",
          ],
        ],
        [
          ["🏃 Movimiento"],
          ["análisis personal"],
          [
            "Objetivo diario: 45 a 60 minutos de juego",
            "activo al aire libre.",
          ],
        ],
        [
          ["😴 Recuperación", "/ Sueño"],
          ["análisis personal"],
          ["→ Apagar pantallas una hora antes de", "dormir."],
        ],
      ],
    ),
  ),
  // p7 Plan: continuación de la fila de sueño (sin encabezado)
  pageB(
    table(
      [78, 168, 200],
      [],
      [
        [
          [],
          ["sigue el análisis"],
          [
            "→ Objetivo: acostarse entre 7:30 y 8:00pm y",
            "dormir 10-11 horas.",
            "Leches de reemplazo: bebida de avena,",
            "bebida de coco.",
          ],
        ],
      ],
      { header: false },
    ),
  ),
  // p8 Informe Sección 03: aditivos (rejilla 2 columnas) + también evitar
  pageA(
    "03",
    "Ajustes",
    lines(["Aditivos a Evitar durante los próximos 90 días"]) +
      table(
        [220, 220],
        [],
        [
          [["E 901   Colorante Ejemplo Uno"], ["E 902   Colorante Ejemplo Dos"]],
          [["E 903   Conservan", "te Ejemplo (CEJ)"], ["E 904   Espesante Ejemplo"]],
          [["E 905   Resaltador Ejemplo"], ["E 906   Antiaglomerante Ejemplo"]],
          [["E 907   Emulsionante Ejemplo"], ["E 908   Acidulante Ejemplo"]],
          [["E 909   Edulcorante Ejemplo"], ["E 910   Estabilizante Ejemplo"]],
        ],
        { header: false },
      ) +
      lines([
        "La lista mostrada es de ejemplo y no exhaustiva.",
        "También recomendamos evitar:",
        "Edulcorantes artificiales: párrafo de ejemplo sobre por qué.",
        "Grasas hidrogenadas: párrafo de ejemplo.",
        "Embutidos procesados: párrafo de ejemplo.",
        "Bebidas energéticas: párrafo de ejemplo.",
        "Cualquier indicación sobre alimentos a evitar es de ejemplo.",
      ]),
  ),
  // p9 Informe Sección 03: «presente en»
  pageA(
    "03",
    "Ajustes",
    table(
      [85, 64, 92, 180],
      ["Aditivo", "Tipo", "Presente en", "Riesgo Ejemplo"],
      [
        [["E901 – Colorante", "Ejemplo Uno"], ["Colorante"], ["gomitas, refrescos", "de ejemplo"], ["texto personal que se ignora"]],
        [["E902 – Colorante", "Ejemplo Dos / E903", "– Conservante", "Ejemplo"], ["Varios"], ["embutidos, salsas"], ["texto personal"]],
        [["E904 – Espesante", "Ejemplo"], ["Espesante"], ["postres de caja"], ["texto"]],
        [["E905 – Resaltador", "Ejemplo"], ["Sabor"], ["sopas instantáneas"], ["texto"]],
      ],
    ) + lines(["⚠️ Nota importante: texto de ejemplo que se ignora."]),
  ),
  // p10 Informe Sección 03: rejilla de restringidos sin separadores (NO usar)
  pageA(
    "03",
    "Ajustes",
    lines([
      "Ajustes de alimentos",
      "Esto no es una prueba clínica: es una guía de ejemplo.",
      "lácteos de vaca     gluten     huevo de gallina",
      "maní     fresa",
    ]),
  ),
  // p11 Plan: rojo + notas de equivalencias + grupos verdes (filas 1–4, la 4 partida)
  pageB(
    lines([
      "Presentación del Plan",
      "⛔ Alimentos con restricción temporal por 3 meses:",
      "lácteos de vaca · gluten · huevo de gallina (incluye mayonesa y",
      "repostería) · maní · fresa",
      "Nota lácteos: texto libre de ejemplo. Reemplazar siempre por bebida",
      "de avena, bebida de arroz, bebida de coco o bebida de almendra.",
      "Nota gluten: texto libre. Alternativas: arroz, quinoa, maíz, papa o",
      "yuca.",
      "Grupos Alimentarios Recomendados",
    ]) + table(GREEN_W, GREEN_H, GREEN_1),
  ),
  // p12 Plan: continúa la fila 4 sin encabezado + filas 5–8
  pageB(table(GREEN_W, [], [...GREEN_4_CONT, ...GREEN_2], { header: false })),
  // p13 Plan: menú y hidratación
  pageB(
    lines([`Menú Ejemplo — Día Promedio de ${CHILD}`]) +
      `<div class="menu">${[
        [["🌅 Desayuno", "7:00 – 7:30 am"], ["Arepa de maíz con aguacate", "Opción A: avena con pera", "→ Vitamina D si es Lunes, Miércoles o Viernes"]],
        [["🍎 Media", "mañana", "10:00 am"], ["Fruta del día con semillas"]],
        [["☀️ Almuerzo", "12:30 – 1:30 pm"], ["Arroz, pollo y verduras", "Opción B: lentejas con papa"]],
        [["🍪 Merienda /", "Onces", "4:00 – 4:30 pm"], ["Palomitas caseras"]],
        [["🌙 Cena", "6:30 – 7:00 pm"], ["Sopa de verduras con pescado"]],
      ]
        .map(
          ([l, r]) =>
            `<div class="block"><div class="ml">${lines(l)}</div><div class="mr">${lines(r)}</div></div>`,
        )
        .join("")}</div>` +
      lines([
        `💧 Hidratación de ${CHILD}`,
        "Meta: 1.1 a 1.3 litros de agua al día. Hábito: 1 vaso al despertar, 1",
        "con el almuerzo, 1 con la cena.",
        "Tips: reemplazar jugos por agua con limón o agua de coco.",
      ]),
  ),
  // p14 Informe Sección 03: listas por categoría (NO es semáforo)
  pageA("03", "Listas", lines(["Frutas     Verduras     Granos", "pera     brócoli     arroz"])),
  // p15 Plan: suplementos + calendario
  pageB(
    lines([`Plan de Suplementación de ${CHILD}`]) +
      table(
        [85, 71, 60, 121, 120],
        ["Suplemento", "Días", "Dosis", "Marcadores que Optimiza", "Instrucciones y Notas"],
        [
          [["💊 Vitamina D", "Gotas", "Ejemplo"], ["Lunes", "Miércoles", "Viernes"], ["2 gotas", "por dosis"], ["texto libre"], ["Tomar con el desayuno.", "Agitar antes."]],
          [["🐟 Omega", "Ejemplo", "Masticable"], ["Martes", "Jueves", "Sábado"], ["1 unidad", "(masticable)"], ["texto"], ["Tomar con el almuerzo."]],
          [["🦠 Probiótico", "Ejemplo"], ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"], ["1 sobre"], ["texto"], ["Puede darse disuelto", "en agua fría."]],
        ],
      ) +
      lines(["Calendario Semanal de Suplementación"]) +
      table(
        [62, 62, 62, 62, 62, 62, 62],
        ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
        [[["Vitamina D", "(2 gotas)"], ["Omega", "(1 unidad)"], ["Vitamina D"], ["Omega"], ["Vitamina D"], ["Omega"], ["Probiótico"]]],
      ),
  ),
  // p16 Plan: notas de suplementación + aviso (derecha: profesional, se ignora)
  pageB(
    lines([
      `📌 Notas sobre la suplementación de ${CHILD}`,
      "Constancia: dar los suplementos a la misma hora ayuda a recordarlos.",
      "Conservación: guardar en un lugar fresco y seco.",
      "Olvidos: si se olvida una dosis, seguir al día siguiente sin duplicar.",
    ]) +
      `<div class="two"><div>${lines([
        "Aviso: este plan es educativo y de ejemplo.",
      ])}</div><div>${lines([PRO, "consulta@ejemplo.test", "+00 111 222 333"])}</div></div>`,
  ),
  // p17 Informe Sección 02 (ignorar)
  pageA("02", "Resultados", lines(["Marcador Ejemplo C 7,8 unidades"])),
  // p18 cierre con contacto (ignorar)
  bare(lines(["Gracias", PRO, "consulta@ejemplo.test"])),
];

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><style>
@page { size: 595.92pt 842.88pt; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 8pt; line-height: 11pt }
.page { width: 595.92pt; height: 842.88pt; padding: 36pt 40pt 40pt 78pt; position: relative; overflow: hidden; page-break-after: always }
header { margin: 0 0 18pt -60pt; font-size: 7pt }
.ha { display: flex; justify-content: space-between; margin-right: -20pt }
footer { position: absolute; left: 18pt; bottom: 16pt; font-size: 7pt }
table { border-collapse: collapse; table-layout: fixed; margin: 6pt 0 10pt }
td { vertical-align: top; padding: 0 4pt 9pt 0; overflow-wrap: anywhere }
.th td { font-weight: bold }
.cover { margin-top: 300pt; font-size: 12pt; line-height: 18pt }
.divider { margin-top: 380pt; font-size: 18pt; line-height: 24pt }
.menu { margin: 8pt 0 }
.block { display: flex; margin-bottom: 22pt }
.ml { width: 74pt; margin-left: 27pt }
.mr { width: 300pt }
.two { display: flex; gap: 40pt; margin-top: 30pt }
.two > div { width: 220pt }
</style><body>${pages.join("")}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
const pdf = await page.pdf({
  width: "8.2767in",
  height: "11.7067in",
  printBackground: false,
  preferCSSPageSize: true,
});
await browser.close();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, pdf);
console.log(`plan-ejemplo.pdf ← ${pages.length} páginas, ${pdf.length} bytes`);
