#!/usr/bin/env node
/**
 * Genera `tests/fixtures/plan-ejemplo.pdf`: un plan nutricional INVENTADO con la misma
 * FORMA que la plantilla oficial (ordenes/forma-del-pdf.md de la planeadora, §5), nunca
 * su texto: todos los títulos, metas, horas, litros, nombres, alimentos, aditivos (E95x no
 * existen) y dosis son de mentira (decisión del dueño «1 a»). Reproduce las trampas:
 *  - dos documentos fusionados: encabezado tipo A «… Sección NN» y tipo B «… · … · Mes AAAA»;
 *  - pie tipo B a y ≈ 805, x ≈ 72, también en una página tipo A;
 *  - rejilla de aditivos de DOS segmentos por celda (código y, a otra x, el nombre), con un
 *    nombre que envuelve bajo el NOMBRE;
 *  - 4 bloques de «otros que evitar», cada nombre solo en su línea y terminado en «:», uno de
 *    ≥ 40 caracteres;
 *  - encabezado de la tabla de grupos en dos líneas y una fila partida entre páginas con el
 *    pie y el encabezado EN MEDIO;
 *  - etiqueta «<X> de reemplazo <adjetivo>:» que envuelve 5 líneas y termina a mitad de línea;
 *  - suplemento con la presentación del frasco («4 fl oz 120 ml») y una palabra cortada sin guion;
 *  - un U+0000 dentro de un párrafo; la hora «12:15 – 1:15 pm»;
 *  - dos consejos «<persona>: si tiene …, reemplazar por …» (uno con «de» en el sujeto) que NO se leen.
 * La página de identidad trae peso, talla, IMC, percentil y contacto A PROPÓSITO: es la carnada
 * del test que exige que el lector jamás los lea (regla dura 2).
 *
 * Se genera con Chromium sin cabeza (Playwright `page.pdf()`), como el original:
 *   node scripts/make-plan-fixture.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "tests/fixtures/plan-ejemplo.pdf");

const CHILD = "Tomás Quimera";
const PRO = "Mtra. Rosa Ficticia, Lic. Dietética · Infancia / Juego / Familia";
const HEAD_B = `Cuaderno Simulado · ${CHILD} · Marzo 2031`;
const HEAD_A = "Reporte Simulado de Marcadores";
/**
 * Chromium descarta U+0000 al dibujar. Se escribe U+00A6 («¦», que el plan no usa) y, ya en
 * el PDF, su entrada en el ToUnicode de la fuente pasa a <0000>: pdf.js lo extrae como U+0000,
 * igual que en la plantilla real.
 */
const NUL = "\u00a6";

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const lines = (arr) => arr.map((l) => `<div>${esc(l)}</div>`).join("");
const foot = `<footer>${esc(PRO)}</footer>`;

function pageA(section, title, body, { cls = "", footer = false } = {}) {
  return `<section class="page ${cls}"><header class="ha"><span>${esc(HEAD_A)}</span><span>${esc(title)} Sección ${section}</span></header>${body}${footer ? foot : ""}</section>`;
}
function pageB(body) {
  return `<section class="page"><header class="hb">${esc(HEAD_B)}</header>${body}${foot}</section>`;
}
function bare(body) {
  return `<section class="page">${body}</section>`;
}
/** Tabla de columnas con anchos en pt; filas = arrays de celdas (cada celda = líneas). */
function table(widths, head, rows, { header = true } = {}) {
  const cols = widths.map((w) => `<col style="width:${w}pt">`).join("");
  const th = header
    ? `<tr class="th">${head.map((h) => `<td>${lines(Array.isArray(h) ? h : [h])}</td>`).join("")}</tr>`
    : "";
  const trs = rows
    .map((r) => `<tr>${r.map((c) => `<td>${lines(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><colgroup>${cols}</colgroup>${th}${trs}</table>`;
}

// Tabla de grupos: x ≈ 78 / 150 / 259 / 349 / 430; encabezado en DOS líneas.
const GREEN_W = [72, 109, 90, 81, 110];
const GREEN_H = [
  ["Grupo", "simulado"],
  ["Fuentes", "sugeridas"],
  [" ", "Aporte"],
  ["Porción", "y ritmo"],
  ["Idea", "casera"],
];
const GREEN_1 = [
  [
    ["🥩 Carnes", "y huevo"],
    ["pollo · pavo · trucha ·", "huevo de codorniz (máx", "2/día)"],
    ["hierro de", "mentira"],
    ["70-90g por comida", "2 veces al día"],
    ["texto libre", "simulado"],
  ],
  [
    ["🥦 Hojas", "verdes"],
    ["acelga · brócoli ·", "calabacín (lo pide) ·", "espinaca"],
    ["fibra de mentira"],
    ["1 taza por comida", "3 veces al día"],
    ["texto libre"],
  ],
  [
    ["🍐 Frutas", "de temporada"],
    ["pera · papaya · mango ·", "banano (máx 1/día)"],
    ["vitaminas de", "mentira"],
    ["1 porción por", "merienda", "2 veces al día"],
    ["texto libre"],
  ],
  [
    ["🍚 Granos", "sin", "trigo"],
    ["arroz · quinoa · maíz ·", "avena certificada"],
    ["energía de", "mentira"],
    ["arroz: 1/2 taza"],
    ["texto libre de", "mentira que"],
  ],
];
const GREEN_4_CONT = [
  [
    [],
    ["(3-4 uds) · ✅ arepa de", "maíz"],
    ["sigue"],
    ["quinoa: 1/3 taza"],
    ["continúa"],
  ],
];
const GREEN_2 = [
  [
    ["🥑 Grasas", "amables"],
    ["aguacate · aceite de", "oliva · semillas de", "chía"],
    ["omega de mentira"],
    ["1 cucharada por", "comida"],
    ["texto libre"],
  ],
  [
    ["🫘 Legumbres", "de olla"],
    ["lenteja · garbanzo ·", "frijol"],
    ["proteína vegetal"],
    ["1/2 taza", "3 veces por semana"],
    ["texto libre"],
  ],
  [
    ["🥥 Bebidas", "de planta"],
    ["bebida de avena ·", "bebida de coco"],
    ["calcio de mentira"],
    ["1 vaso al día"],
    ["texto libre"],
  ],
  [
    ["🥔 Raíces"],
    ["papa · yuca · batata"],
    ["energía"],
    ["1 porción por", "almuerzo"],
    ["texto libre"],
  ],
];

// Rejilla de aditivos: código (x ≈ 30 | 311) y nombre (x ≈ 68 | 349), dos segmentos por celda.
const ADDITIVES = [
  [
    ["E 951", ["Tinte Simulado Uno"]],
    ["E 952", ["Brillo Simulado", "Doble (BSD)"]],
  ],
  [
    ["E 953", ["Conserva Simulada"]],
    ["E 954", ["Espesor Simulado"]],
  ],
  [
    ["E 955", ["Realce Simulado"]],
    ["E 956", ["Suelto Simulado"]],
  ],
  [
    ["E 957", ["Mezcla Simulada"]],
    ["E 958", ["Ácido Simulado"]],
  ],
  [
    ["E 959", ["Dulzor Simulado"]],
    ["E 960", ["Firmeza Simulada"]],
  ],
];
const grid = `<div class="grid">${ADDITIVES.map((row) =>
  row
    .map(([code, name]) => `<div>${esc(code)}</div><div>${lines(name)}</div>`)
    .join(""),
).join("")}</div>`;

const pages = [
  // p1 portada: la ÚNICA fecha completa; nombre e ID no se guardan.
  bare(
    `<div class="cover">${lines([
      "Cuaderno Simulado de Comidas",
      CHILD,
      "ID: SIM-1234-0000",
      "Fecha: 14.03.2031",
    ])}</div>`,
  ),
  // p2 bienvenida
  bare(lines(["Hola, familia", "Unas palabras simuladas para empezar."])),
  // p3 Informe Sección 01: resultados (ignorar)
  pageA(
    "01",
    "Hallazgos",
    lines(["Valor Simulado A 12,3 unidades", "Valor Simulado B 45 unidades"]),
  ),
  // p4 divisor
  bare(`<div class="divider">${lines(["Sección 02", "Cuaderno"])}</div>`),
  // p5 Plan: identidad y medidas (NUNCA se lee) — carnada de antropometría y contacto
  pageB(
    lines(["Para conocernos"]) +
      table(
        [120, 300],
        ["Dato anotado", "Información simulada"],
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
      lines(["Prosa simulada del motivo: de aquí no se infiere nada clínico."]),
  ),
  // p6 Plan: ejes (x ≈ 78 / 156 / 324); la columna derecha es la que se lee.
  pageB(
    table(
      [78, 168, 200],
      ["Eje", `Lectura de ${CHILD}`, "Sugerencias para casa"],
      [
        [
          ["🥗 Comer"],
          ["lectura personal", "simulada que no se lee"],
          [
            "Cambio del pan: tostada de yuca, galleta",
            "de maíz morado, casabe.",
            "Meriendas de reemplazo crujientes: maíz",
            "inflado o garbanzo horneado, chips de",
            "plátano verde, semillas de girasol",
            "tostadas, bastones de jícama o",
            "manzana deshidratada. Otra frase sigue.",
          ],
        ],
        [
          ["🏃 Moverse"],
          ["lectura personal"],
          [
            "Objetivo de la semana: 30 a 50 minutos de",
            "bici o patines cada tarde.",
          ],
        ],
        [
          ["😴 Descanso", "/ Pausa"],
          ["lectura personal"],
          ["→ Guardar la tableta al bañarse."],
        ],
      ],
    ),
  ),
  // p7 Plan: continúa la fila de descanso (sin encabezado)
  pageB(
    table(
      [78, 168, 200],
      [],
      [
        [
          [],
          ["sigue la lectura"],
          [
            "→ Objetivo: dormir de 8:15 pm a 6:45 am",
            "con la luz apagada.",
            "Tazas de reemplazo: bebida de arroz,",
            "bebida de almendra.",
            "Tía de Ana: si tiene hambre, reemplazar por",
            "fruta, yogur de coco.",
          ],
        ],
      ],
      { header: false },
    ),
  ),
  // p8 Informe Sección 03: rejilla de aditivos (x ≈ 21) + otros que evitar (x ≈ 27)
  pageA(
    "03",
    "Ajustes Simulados",
    lines([
      "Aditivos que en casa conviene evitar",
      "Durante 90 días, mejor sin ellos.",
      "Un párrafo simulado sobre cómo leer las etiquetas de los paquetes.",
    ]) +
      grid +
      lines([
        "Este listado es una muestra simulada y no lo cubre todo.",
        "Otras cosas que en casa también hay que evitar:",
      ]) +
      `<div class="avoid">${lines([
        "Endulzantes de laboratorio:",
        "Párrafo simulado de por qué.",
        "Grasas endurecidas de fábrica para untar (GEFU):",
        "Párrafo simulado.",
        "Carnes curadas de bolsa:",
        "Párrafo simulado.",
        "Refrescos con cafeína:",
        "Párrafo simulado.",
      ])}</div>` +
      `<div class="box">${lines(["Recuadro simulado: nada de esto es una indicación médica."])}</div>`,
    { cls: "wide" },
  ),
  // p9 Informe Sección 03: «presente» (x ≈ 78 / 163 / 227 / 319), con pie tipo B debajo
  pageA(
    "03",
    "Ajustes Simulados",
    table(
      [85, 64, 92, 180],
      [
        "Aditivo simulado",
        "Clase",
        "Presente sobre todo en",
        "Comentario personal",
      ],
      [
        [
          ["E951 – Tinte", "Simulado Uno"],
          ["Tinte"],
          ["gomitas, refrescos", "simulados"],
          ["texto personal que se ignora"],
        ],
        [
          ["E952 – Brillo", "Simulado Doble /", "E953 – Conserva", "Simulada"],
          ["Varios"],
          ["embutidos, salsas"],
          ["texto personal"],
        ],
        [
          ["E954 – Espesor", "Simulado"],
          ["Espesor"],
          ["postres de caja"],
          ["texto"],
        ],
        [
          ["E955 – Realce", "Simulado"],
          ["Sabor"],
          ["sopas de sobre"],
          ["texto"],
        ],
      ],
    ) + lines(["⚠️ Recuadro simulado que se ignora."]),
    { footer: true },
  ),
  // p10 Informe Sección 03: rejilla de restringidos sin separadores (NO usar)
  pageA(
    "03",
    "Ajustes Simulados",
    lines([
      "Comidas en pausa, de un vistazo",
      "Esto no es una prueba clínica: es una guía simulada.",
      "leche de vaca     trigo y cebada     huevo entero",
      "cacahuate     kiwi",
    ]),
  ),
  // p11 Plan: rojo + notas con reemplazos + grupos (filas 1–4, la 4 partida)
  pageB(
    lines([
      "Así arranca el cuaderno",
      "⛔ Comidas en pausa simulada por 4 meses:",
      "leche de vaca · trigo y cebada · huevo entero (incluye tortas y salsas",
      "batidas) · cacahuate · kiwi",
      "Nota leche: texto simulado. Lo mejor es reemplazar por bebida de arroz,",
      "bebida de avena, bebida de coco o bebida de almendra.",
      "Nota trigo: texto simulado. Buenas alternativas: arroz, quinoa, maíz, papa",
      "o yuca.",
      "Tus grupos de cada día",
    ]) + table(GREEN_W, GREEN_H, GREEN_1),
  ),
  // p12 Plan: continúa la fila 4 sin encabezado + filas 5–8
  pageB(table(GREEN_W, [], [...GREEN_4_CONT, ...GREEN_2], { header: false })),
  // p13 Plan: menú (izquierda x ≈ 105, derecha x ≈ 179) e hidratación
  pageB(
    lines(["Un día cualquiera en la mesa: menú de muestra"]) +
      `<div class="menu">${[
        [
          ["🌅 Arranque", "6:45 – 7:15 am"],
          [
            "Arepa de maíz con aguacate",
            "Opción 2: avena con pera",
            "→ Gotas de sol si es Lunes, Miércoles o Viernes",
          ],
        ],
        [
          ["🍎 Recreo /", "Media", "9:50 am"],
          ["Fruta con semillas de girasol"],
        ],
        [
          ["☀️ Mediodía", "12:15 – 1:15 pm"],
          ["Arroz, trucha y verduras", "Opción 2: lentejas con papa"],
        ],
        [["🍪 Tarde", "3:40 – 4:10 pm"], ["Maíz inflado casero"]],
        [["🌙 Noche", "6:20 – 6:50 pm"], ["Crema de ahuyama con pollo"]],
      ]
        .map(
          ([l, r]) =>
            `<div class="block"><div class="ml">${lines(l)}</div><div class="mr">${lines(r)}</div></div>`,
        )
        .join("")}</div>` +
      lines([
        "💧 Agua y más: la hidratación de cada día",
        "Meta: 0.9 a 1.4 litros repartidos en el día. Hábito: 2 vasos al levantarse,",
        "1 en la merienda. Abuelo Simulado: si tiene sed, reemplazar por agua con",
        "hielo picado.",
      ]),
  ),
  // p14 Informe Sección 03: listas por categoría (NO es semáforo)
  pageA(
    "03",
    "Listas Simuladas",
    lines(["Granos     Hojas     Raíces", "arroz     acelga     yuca"]),
  ),
  // p15 Plan: suplementos (x ≈ 78 / 163 / 234 / 295 / 416) + calendario de verificación
  pageB(
    lines(["Lo que se suma: suplementos de la temporada"]) +
      table(
        [85, 71, 61, 121, 120],
        ["Suplemento", "Días", "Dosis", "Para qué (personal)", "Cómo darlo"],
        [
          [
            ["💊 Gotas de Sol", "Simuladas"],
            ["Lunes", "Miércoles", "Viernes"],
            ["2 gotas", "por dosis"],
            ["texto libre"],
            ["Darlas con el arranque.", "Agitar antes."],
          ],
          [
            ["🫐 Gomitas Simu", "ladas Marca", "Lumen 4 fl oz", "120 ml"],
            ["Martes", "Jueves", "Sábado"],
            ["1 unidad", "(masticable)"],
            ["texto"],
            ["Darla con el mediodía."],
          ],
          [
            ["🦠 Polvo Flora", "Simulada"],
            [
              "Lunes",
              "Martes",
              "Miércoles",
              "Jueves",
              "Viernes",
              "Sábado",
              "Domingo",
            ],
            ["1 sobre"],
            ["texto"],
            ["Puede ir disuelto", "en agua fría."],
          ],
        ],
      ) +
      lines(["La semana de un vistazo"]) +
      table(
        [62, 62, 62, 62, 62, 62, 62],
        [
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
          "Domingo",
        ],
        [
          [
            ["Gotas", "(2 gotas)"],
            ["Gomitas", "(1 unidad)"],
            ["Gotas"],
            ["Gomitas"],
            ["Gotas"],
            ["Gomitas"],
            ["Polvo"],
          ],
        ],
      ),
  ),
  // p16 Plan: notas tras un título con 📌 + aviso en dos columnas (derecha: profesional, se ignora)
  pageB(
    lines([
      "📌 Antes de abrir el frasco",
      "Rutina: darlos a la misma hora ayuda a no olvidarlos.",
      `Guardado: en un lugar fresco${NUL} y seco.`,
      "Si se olvida: seguir al día siguiente sin doblar la toma.",
    ]) +
      `<div class="two"><div>${lines([
        "Aviso: esta guía simulada es solo educativa.",
      ])}</div><div>${lines([PRO, "consulta@ejemplo.test", "+00 111 222 333"])}</div></div>`,
  ),
  // p17 Informe Sección 02 (ignorar)
  pageA("02", "Hallazgos", lines(["Valor Simulado C 7,8 unidades"])),
  // p18 cierre con contacto (ignorar)
  bare(lines(["Hasta pronto", PRO, "consulta@ejemplo.test"])),
];

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><style>
@page { size: 595.92pt 842.88pt; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 8pt; line-height: 11pt }
.page { width: 595.92pt; height: 842.88pt; padding: 36pt 40pt 40pt 78pt; position: relative; overflow: hidden; page-break-after: always }
.page.wide { padding-left: 21pt }
header { margin: 0 0 18pt -6pt; font-size: 7pt }
.wide header { margin-left: 51pt }
.ha { display: flex; justify-content: space-between; margin-right: -20pt }
footer { position: absolute; left: 72pt; bottom: 36pt; font-size: 7pt }
table { border-collapse: collapse; table-layout: fixed; margin: 6pt 0 10pt }
td { vertical-align: top; padding: 0 4pt 9pt 0; overflow-wrap: anywhere }
.th td { font-weight: bold; padding-bottom: 4pt }
.cover { margin-top: 300pt; font-size: 12pt; line-height: 18pt }
.divider { margin-top: 380pt; font-size: 18pt; line-height: 24pt }
.grid { display: grid; grid-template-columns: 38pt 243pt 38pt 200pt; row-gap: 6pt; margin: 8pt 0 10pt 9pt }
.avoid { margin: 4pt 0 10pt 6pt }
.box { margin: 10pt 0 0 0; padding: 0 }
.menu { margin: 8pt 0 }
.block { display: flex; margin-bottom: 22pt }
.ml { width: 74pt; margin-left: 27pt }
.mr { width: 300pt }
.two { display: flex; gap: 40pt; margin-top: 30pt }
.two > div { width: 220pt }
</style><body>${pages.join("")}</body></html>`;

/**
 * Cambia en los ToUnicode la entrada que da U+00A6 por U+0000 y rehace /Length y el xref.
 * El PDF de Chromium no usa flujos de objetos: cada objeto está entero y en claro.
 */
function nulInToUnicode(buf) {
  let s = buf.toString("latin1");
  let patched = 0;
  const re = /\/Length (\d+)([^]*?)>>\s*stream\r?\n/g;
  let out = "";
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const start = m.index + m[0].length;
    const len = Number(m[1]);
    const raw = Buffer.from(s.slice(start, start + len), "latin1");
    let text;
    try {
      text = inflateSync(raw).toString("latin1");
    } catch {
      continue;
    }
    if (!/beginbfchar/.test(text) || !/<[0-9A-F]{4}> <00A6>/.test(text))
      continue;
    const fixed = deflateSync(
      Buffer.from(
        text.replace(/(<[0-9A-F]{4}>) <00A6>/g, "$1 <0000>"),
        "latin1",
      ),
    ).toString("latin1");
    out +=
      s.slice(last, m.index) +
      `/Length ${fixed.length}${m[2]}>>\nstream\n` +
      fixed;
    last = start + len;
    re.lastIndex = start + len;
    patched++;
  }
  if (patched === 0)
    throw new Error("no ToUnicode maps U+00A6: the NUL trap is missing");
  s = out + s.slice(last);
  // xref nuevo con los desplazamientos reales.
  const xrefAt = s.lastIndexOf("\nxref\n") + 1;
  const trailerAt = s.indexOf("trailer", xrefAt);
  const size = Number(/0 (\d+)\n/.exec(s.slice(xrefAt))[1]);
  const offsets = new Array(size).fill(null);
  for (const m of s.slice(0, xrefAt).matchAll(/(?:^|\n)(\d+) 0 obj/g))
    offsets[Number(m[1])] = m.index + (m[0].startsWith("\n") ? 1 : 0);
  const rows = offsets.map((o, i) =>
    i === 0 || o === null
      ? "0000000000 65535 f \n"
      : `${String(o).padStart(10, "0")} 00000 n \n`,
  );
  const tail = s
    .slice(trailerAt)
    .replace(/startxref\n\d+/, `startxref\n${xrefAt}`);
  return Buffer.from(
    `${s.slice(0, xrefAt)}xref\n0 ${size}\n${rows.join("")}${tail}`,
    "latin1",
  );
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
const printed = await page.pdf({
  width: "8.2767in",
  height: "11.7067in",
  printBackground: false,
  preferCSSPageSize: true,
});
await browser.close();
const pdf = nulInToUnicode(Buffer.from(printed));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, pdf);
console.log(`plan-ejemplo.pdf ← ${pages.length} páginas, ${pdf.length} bytes`);
