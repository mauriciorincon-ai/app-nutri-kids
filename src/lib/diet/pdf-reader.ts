import type { LocalizedText, Texture, Weekday } from "./schema";
import { type Line, type PdfPage, toLines } from "./pdf-text";

/**
 * Lector determinista del PDF del plan (ADR-010). Puro: recibe el texto de las páginas
 * (ya extraído en el aparato) y devuelve un BORRADOR por secciones, cada dato con la
 * página de donde salió. Detecta por FORMA (posición, columnas, íconos, «:» al final, pie) y
 * se ancla SOLO en palabras sueltas y genéricas (`ANCHOR_WORDS`, una por condición): ninguna
 * frase ni título de la plantilla (decisión del dueño «1 a», ADR-010). Las palabras de valor
 * (unidades, gramática, texturas) y las de descarte también están declaradas, y un test exige
 * que el lector no use ninguna otra.
 *
 * Lo que JAMÁS lee (regla dura 2 y decisión 2 a): identidad, medidas del cuerpo,
 * resultados de laboratorio y contacto. Esas páginas y líneas se descartan ANTES de
 * buscar nada; el nombre del niño solo se usa para borrarlo de lo leído.
 * El perfil (condición, alergias) vive en prosa: NO se infiere.
 * Lo que no reconoce no rechaza el PDF: la sección queda vacía y quien cuida la completa.
 */

export const SECTION_KEYS = [
  "validity",
  "restricted",
  "additives",
  "alsoAvoid",
  "green",
  "yellow",
  "equivalences",
  "supplements",
  "menu",
  "hydration",
  "goals",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export type DraftItem = { id: string; name: LocalizedText };
export type DraftAdditive = {
  code: string;
  name: LocalizedText;
  foundIn?: LocalizedText;
};
export type DraftYellow = DraftItem & { limit: LocalizedText };
export type DraftGroup = DraftItem & {
  portion: LocalizedText;
  items: DraftItem[];
};
export type DraftEquivalence = {
  whenMissing: string;
  title: LocalizedText;
  use: { name: LocalizedText; texture?: Texture }[];
};
export type DraftSupplement = DraftItem & {
  days: Weekday[];
  dose: LocalizedText;
  when: LocalizedText;
};
export type DraftMeal = DraftItem & {
  start: string;
  end: string;
  content: LocalizedText;
};
export type DraftHydration = {
  targetLitersMin: number;
  targetLitersMax: number;
  glassesPerDay?: number;
  habit: LocalizedText;
};

/** El plan leído, por secciones; lo que falta queda vacío (o ausente) para la revisión. */
export type PlanDraft = {
  issuedAt?: string;
  /** Plazo de la restricción, en días, si el PDF lo dice («por 3 meses»). */
  restrictionDays?: number;
  restricted: DraftItem[];
  /** Aclaraciones entre paréntesis de la lista restringida («incluye …»). */
  restrictedNotes: string[];
  additives: DraftAdditive[];
  alsoAvoid: DraftItem[];
  green: DraftGroup[];
  yellow: DraftYellow[];
  equivalences: DraftEquivalence[];
  supplements: DraftSupplement[];
  supplementNotes?: LocalizedText;
  menu: DraftMeal[];
  hydration?: DraftHydration;
  goals: { activity?: LocalizedText; sleep?: LocalizedText };
};

export type PlanReading = {
  draft: PlanDraft;
  /** Página de cada dato: `<sección>` o `<sección>.<id>`. */
  pages: Record<string, number>;
  /** Secciones de las que el lector no encontró nada: quien cuida las completa a mano. */
  unrecognized: SectionKey[];
  /** Filas que el lector vio pero no pudo leer, por sección: quien cuida las cotejará con el PDF. */
  skipped: Partial<Record<SectionKey, number>>;
};

type Skip = (k: SectionKey) => void;

// ───────────────────────── las palabras del lector ─────────────────────────

/**
 * Las ÚNICAS palabras en las que el lector se ancla para ubicar una sección: sueltas,
 * genéricas de nutrición, sin tildes (se comparan sin tildes ni mayúsculas, en singular o
 * plural). Ninguna lleva espacio: una frase sería un título de la plantilla (decisión «1 a»).
 */
export const ANCHOR_WORDS = [
  "aditivos",
  "grupos",
  "fuentes",
  "porcion",
  "suplemento",
  "dosis",
  "menu",
  "hidratacion",
  "meta",
  "habito",
  "nota",
  "evitar",
  "reemplazar",
  "alternativas",
  "objetivo",
  "presente",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
  "seccion",
] as const;
export type AnchorWord = (typeof ANCHOR_WORDS)[number];

/** Palabras de VALOR: leen un dato ya ubicado (unidades, plazos, gramática, texturas); no ubican secciones. */
export const VALUE_WORDS = [
  "por",
  "de",
  "del",
  "el",
  "la",
  "incluye",
  "dia",
  "dias",
  "semana",
  "semanas",
  "mes",
  "meses",
  "veces",
  "max",
  "uds",
  "unidades",
  "litros",
  "minutos",
  "fl",
  "oz",
  "ml",
  "si",
  "crujiente",
  "pure",
  "liquid",
  "blanda",
  "suave",
] as const;

/** Palabras de DESCARTE: lo que jamás se lee (identidad, medidas, contacto; regla dura 2). */
export const DISCARD_WORDS = [
  "peso",
  "talla",
  "estatura",
  "imc",
  "percentil",
  "edad",
  "kg",
  "cm",
  "id",
  "dato",
  "informacion",
] as const;

/**
 * Sin tildes y en minúsculas, conservando la LONGITUD (cada carácter se cambia por uno):
 * así un índice del texto plegado sirve en el original.
 */
export function fold(s: string): string {
  let out = "";
  for (const ch of s) {
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    out += base.length === ch.length ? base : ch;
  }
  return out;
}

const tokens = (s: string) =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** ¿El texto trae la palabra ancla (sin tildes, singular o plural)? */
export function has(text: string, word: AnchorWord): boolean {
  const forms = new Set([
    word,
    `${word}s`,
    `${word}es`,
    word.replace(/s$/, ""),
  ]);
  return tokens(text).some((t) => forms.has(t));
}

/**
 * Busca `re` (escrita en minúsculas y sin tildes) en el texto plegado y devuelve los grupos
 * con el texto ORIGINAL (con sus tildes y mayúsculas).
 */
function execF(re: RegExp, text: string): string[] | null {
  const f = fold(text);
  const m = re.exec(f);
  if (!m) return null;
  const out = [text.slice(m.index, m.index + m[0].length)];
  let from = 0;
  for (let g = 1; g < m.length; g++) {
    if (m[g] === undefined) {
      out.push("");
      continue;
    }
    const at = m[0].indexOf(m[g], from);
    const pos = at < 0 ? m[0].indexOf(m[g]) : at;
    out.push(text.slice(m.index + pos, m.index + pos + m[g].length));
    if (at >= 0) from = at + m[g].length;
  }
  return out;
}

// ───────────────────────── utilidades puras ─────────────────────────

/** El texto del plan está en español: va a los dos idiomas tal cual (no se traduce). */
export const same = (text: string): LocalizedText => ({ es: text, en: text });

export function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

const ICON = /^[\p{Extended_Pictographic}\p{So}\p{Sk}\u{FE0F}\u{200D}\s]+/u;
const stripIcon = (s: string) => s.replace(ICON, "").trim();
const startsWithIcon = (s: string) => /^\p{Extended_Pictographic}/u.test(s);
const capitalize = (s: string) =>
  s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1) : s;
const tidy = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();

/**
 * Une las líneas de una celda. Un guion de corte se quita; con `cutWords`, una línea
 * que sigue en minúscula es la misma palabra cortada sin guion (nombres de aditivos y
 * marcas en celdas estrechas).
 */
export function joinCell(parts: string[], cutWords = false): string {
  let out = "";
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (!out) out = p;
    else if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(p))
      out = out.slice(0, -1) + p;
    else if (cutWords && /\p{L}$/u.test(out) && /^\p{Ll}/u.test(p)) out += p;
    else out += " " + p;
  }
  return tidy(out);
}

/** Separa por « · » (U+00B7) y limpia íconos y marcas ✅. */
const splitDots = (s: string) =>
  s
    .split(/\s*·\s*/)
    .map((x) => stripIcon(x.replace(/✅/g, "")))
    .filter(Boolean);

/**
 * Separa una lista: por comas y por la «o»/«y» que va antes del ÚLTIMO ítem. Dentro de un
 * ítem, « o » no separa («<a> o <b> <calificativo>» es uno: comparten el calificativo).
 */
const splitList = (s: string) => {
  const parts = s.replace(/\.\s*$/, "").split(/\s*,\s*/);
  const last = parts.pop() ?? "";
  const m = /^(.*)\s+[oy]\s+(.+)$/.exec(last);
  return [...parts, ...(m ? [m[1], m[2]] : [last])]
    .map((x) => tidy(x))
    .filter(Boolean);
};

/** Un paréntesis con límite (amarillo): «máx 2/día», «3-4 uds», «2/semana». */
const LIMIT =
  /max|\d+\s*[-–]\s*\d+\s*(?:uds?\b|unidades)|\d+\s*\/\s*(?:dia|semana)/;

const WEEKDAYS: Record<string, Weekday> = {
  lunes: "mon",
  martes: "tue",
  miercoles: "wed",
  jueves: "thu",
  viernes: "fri",
  sabado: "sat",
  domingo: "sun",
};
const isWeekday = (s: string) => slug(s) in WEEKDAYS;

/** «H:MM» + sufijo am/pm → «HH:MM» de 24 h. */
function to24(h: number, m: number, suffix?: string): number {
  let hh = h % 12;
  if (suffix === "p") hh += 12;
  if (!suffix) hh = h;
  return hh * 60 + m;
}
const fmtMin = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Franja horaria del menú. El sufijo va solo al final y vale para ambas horas; si así
 * el inicio queda después del fin, el inicio era de la mañana («11:30 – 12:30 pm»).
 * Una sola hora: el fin es 30 min después (decisión del lector, ADR-010).
 */
export function parseTimeRange(
  text: string,
): { start: string; end: string } | null {
  const range =
    /(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?\.?\s*[–-]\s*(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i.exec(
      text,
    );
  if (range) {
    const sfx = range[6].toLowerCase();
    const sfxStart = range[3]?.toLowerCase() ?? sfx;
    const end = to24(+range[4], +range[5], sfx);
    let start = to24(+range[1], +range[2], sfxStart);
    if (!range[3] && start > end) start = to24(+range[1], +range[2], "a");
    return { start: fmtMin(start), end: fmtMin(end) };
  }
  const single = /(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i.exec(text);
  if (single) {
    const start = to24(+single[1], +single[2], single[3].toLowerCase());
    return {
      start: fmtMin(start),
      end: fmtMin(Math.min(start + 30, 23 * 60 + 59)),
    };
  }
  return null;
}

// ─────────────── limpieza: lo que jamás se lee ───────────────

/** Línea con identidad, medidas, resultados o contacto (texto plegado): se descarta antes de buscar. */
const FORBIDDEN_LINE = [
  /\S+@\S+\.\S+/, // correo
  /\+?\d[\d\s().-]{7,}\d/, // teléfono
  /\bid\s*:/,
  /\b(?:peso|talla|estatura|imc|percentil\w*|edad)\b/,
  /\d+(?:[.,]\d+)?\s*(?:kg|cm)\b/,
];

type PageKind = "A" | "B" | "none";
type CleanPage = {
  n: number;
  kind: PageKind;
  section?: string;
  lines: Line[];
};

/** Tipo A: la línea 1 termina en «Sección NN». Tipo B: «<texto> · <texto> · <mes> <AAAA>». */
const HEADER_A = /seccion\s*0(\d)\s*$/;
const HEADER_B = /^(.+?)\s·\s(.+?)\s·\s\p{L}+\s+\d{4}$/u;
/** Pie tipo B: «<profesional>, <titulación> · <especialidad> / …». */
const FOOTER_B = /^[^·]+,[^·]+·[^·]+/;
/** Banda del encabezado y del pie (pt desde el borde). */
const EDGE = 60;

function classify(pages: PdfPage[]): { pages: CleanPage[]; names: string[] } {
  const names = new Set<string>();
  const out: CleanPage[] = [];
  for (const page of pages) {
    let lines = toLines(page);
    let kind: PageKind = "none";
    let section: string | undefined;
    const first = lines[0];
    if (first && first.y < 70) {
      const a = HEADER_A.exec(fold(first.text));
      const b = HEADER_B.exec(first.text);
      if (a) {
        kind = "A";
        section = `0${a[1]}`;
        lines = lines.slice(1);
      } else if (b) {
        kind = "B";
        names.add(b[2].trim());
        lines = lines.slice(1);
      }
    }
    // Encabezado y pie FUERA antes de leer cualquier tabla: en las páginas tipo B, todo lo que
    // cae en la banda de arriba o de abajo; en las demás, el pie con la forma del profesional.
    lines = lines.filter((l) =>
      kind === "B"
        ? l.y >= EDGE && l.y <= page.height - EDGE
        : l.y < page.height - 30 &&
          !(l.y > page.height - EDGE && FOOTER_B.test(l.text)),
    );
    out.push({ n: page.n, kind, section, lines });
  }
  return { pages: out, names: [...names] };
}

/** ¿Página que NUNCA se lee? Resultados (Sección 01/02), identidad y medidas, divisores. */
function isForbiddenPage(p: CleanPage): boolean {
  if (p.kind === "A" && (p.section === "01" || p.section === "02")) return true;
  // Tabla de dos columnas «dato» | «información»: identidad y medidas corporales.
  if (
    p.lines.some(
      (l) =>
        l.segs.length >= 2 &&
        tokens(l.segs[0].text).includes("dato") &&
        tokens(l.segs[1].text).includes("informacion"),
    )
  )
    return true;
  if (
    p.kind === "none" &&
    p.lines.length <= 9 &&
    p.lines.some((l) => /seccion\s*\d\d/.test(fold(l.text)))
  )
    return true;
  return false;
}

// ─────────────── tablas por columnas ───────────────

type Row = { page: number; cells: string[][] };

const colOf = (cols: number[], x: number) => {
  let i = 0;
  for (let c = 0; c < cols.length; c++) if (x >= cols[c] - 3) i = c;
  return i;
};

/**
 * Lee una tabla desde su encabezado. Las columnas salen de la x de cada título (o de
 * `cols`, si el encabezado va en dos líneas); una fila empieza con `isRowStart` en la
 * primera columna; lo que llega después (aunque cambie de página, sin repetir encabezado)
 * es continuación de la fila abierta. Si `stop` corta justo después de una línea suelta
 * de una sola celda, esa línea era el título de lo que sigue y no entra a la fila.
 */
function readTable(
  lines: Line[],
  headerIdx: number,
  opts: {
    isRowStart: (col0: string, line?: Line) => boolean;
    stop: (l: Line) => boolean;
    maxPage?: number;
    cols?: number[];
  },
): { rows: Row[]; next: number } {
  const header = lines[headerIdx];
  const cols = opts.cols ?? header.segs.map((s) => s.x);
  const rows: Row[] = [];
  let i = headerIdx + 1;
  // Títulos de varias líneas (debajo del encabezado, misma página, antes de la 1.ª fila).
  while (
    i < lines.length &&
    lines[i].page === header.page &&
    lines[i].y - header.y < 25 &&
    !opts.isRowStart(
      lines[i].segs.find((s) => colOf(cols, s.x) === 0)?.text ?? "",
    )
  )
    i++;
  let last: { line: Line; row: Row; prevY: number } | undefined;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (opts.maxPage !== undefined && line.page > opts.maxPage) break;
    if (opts.stop(line)) {
      // Una línea suelta, apartada de la fila (salto > 1 renglón), justo antes del corte: título.
      if (
        last &&
        last.line.segs.length === 1 &&
        last.prevY !== -Infinity &&
        last.line.y - last.prevY > 14 &&
        !opts.isRowStart(last.line.segs[0].text)
      ) {
        const cell = last.row.cells[colOf(cols, last.line.segs[0].x)];
        if (cell.at(-1) === last.line.segs[0].text) cell.pop();
      }
      break;
    }
    const col0 = line.segs.find((s) => colOf(cols, s.x) === 0);
    const starts = !!col0 && opts.isRowStart(col0.text, line);
    if (starts || rows.length === 0) {
      if (rows.length === 0 && !starts) continue;
      rows.push({ page: line.page, cells: cols.map(() => []) });
    }
    const row = rows[rows.length - 1];
    for (const s of line.segs) row.cells[colOf(cols, s.x)].push(s.text);
    last = {
      line,
      row,
      prevY: last && last.line.page === line.page ? last.line.y : -Infinity,
    };
  }
  return { rows, next: i };
}

// ─────────────── el lector ───────────────

const findIdx = (
  lines: Line[],
  test: (l: Line, i: number) => boolean,
  from = 0,
) => {
  for (let i = Math.max(from, 0); i < lines.length; i++)
    if (test(lines[i], i)) return i;
  return -1;
};

/** Una fecha completa DD.MM.AAAA (la del plan es la única de la portada). */
const FULL_DATE = /(?:^|\D)(\d{2})[./-](\d{2})[./-](\d{4})(?!\d)/;

export function readPlanText(pdfPages: PdfPage[]): PlanReading {
  const { pages, names } = classify(pdfPages);
  const pagesMap: Record<string, number> = {};
  const draft: PlanDraft = {
    restricted: [],
    restrictedNotes: [],
    additives: [],
    alsoAvoid: [],
    green: [],
    yellow: [],
    equivalences: [],
    supplements: [],
    menu: [],
    goals: {},
  };

  // Todo: solo páginas permitidas y sin líneas prohibidas.
  const allowed = pages.filter((p) => !isForbiddenPage(p));
  const lines: Line[] = allowed
    .flatMap((p) => p.lines)
    .filter((l) => !FORBIDDEN_LINE.some((re) => re.test(fold(l.text))));

  // 2.1 La fecha del plan: solo en una página sin encabezado (la portada), la ÚLTIMA fecha
  // completa de la primera que traiga alguna (otra fecha anterior en la portada no gana).
  // Se busca antes del filtro de líneas (una fecha DD.MM.AAAA parece un teléfono) y solo se toma la fecha.
  for (const p of allowed.filter((p) => p.kind === "none")) {
    const hits = p.lines
      .map((l) => FULL_DATE.exec(l.text))
      .filter((m): m is RegExpExecArray => !!m);
    const hit = hits.at(-1);
    if (hit) {
      draft.issuedAt = `${hit[3]}-${hit[2]}-${hit[1]}`;
      pagesMap.validity = p.n;
      break;
    }
  }

  const skipped: Partial<Record<SectionKey, number>> = {};
  const skip: Skip = (k) => {
    skipped[k] = (skipped[k] ?? 0) + 1;
  };
  readRestricted(lines, draft, pagesMap);
  const additivesEnd = readAdditives(lines, draft, pagesMap, skip);
  // «Otros que evitar» va bajo la rejilla de aditivos, en su misma página: sin rejilla, no se busca.
  if (additivesEnd > 0) readAlsoAvoid(lines, additivesEnd, draft, pagesMap);
  readGreen(lines, draft, pagesMap, skip);
  readPillars(lines, draft, pagesMap);
  readSupplements(lines, draft, pagesMap, skip);
  readMenuAndHydration(lines, draft, pagesMap, skip);
  linkEquivalences(draft, pagesMap);
  mergeEquivalences(draft);

  scrubNames(draft, names);

  const filled: Record<SectionKey, boolean> = {
    validity: !!draft.issuedAt,
    restricted: draft.restricted.length > 0,
    additives: draft.additives.length > 0,
    alsoAvoid: draft.alsoAvoid.length > 0,
    green: draft.green.length > 0,
    yellow: draft.yellow.length > 0,
    equivalences: draft.equivalences.length > 0,
    supplements: draft.supplements.length > 0,
    menu: draft.menu.length > 0,
    hydration: !!draft.hydration,
    goals: !!(draft.goals.activity || draft.goals.sleep),
  };
  return {
    draft,
    pages: pagesMap,
    unrecognized: SECTION_KEYS.filter((k) => !filled[k]),
    skipped,
  };
}

/** «… por <n> días|semanas|meses:» al final de la línea (texto plegado). */
const SPAN = /\bpor\s+(\d{1,3})\s*(dias?|semanas?|mes\w*)\s*:\s*$/;
const isNote = (l: Line) => /^nota\b/.test(fold(l.text));

function readRestricted(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
) {
  // Inicio: una línea con ícono que termina en «por <n> <plazo>:».
  const start = findIdx(
    lines,
    (l) => startsWithIcon(l.text) && SPAN.test(fold(l.text)),
  );
  if (start < 0) return;
  const page = lines[start].page;
  const ends = (l: Line) =>
    l.page !== page || isNote(l) || has(l.text, "grupos");
  const parts: string[] = [];
  let i = start + 1;
  for (; i < lines.length && !ends(lines[i]); i++) parts.push(lines[i].text);
  pages.restricted = page;
  const span = SPAN.exec(fold(lines[start].text));
  if (span) {
    const unit = span[2];
    draft.restrictionDays =
      +span[1] * (unit.startsWith("d") ? 1 : unit.startsWith("s") ? 7 : 30);
  }
  for (const raw of splitDots(joinCell(parts))) {
    const paren = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(raw);
    const name = capitalize(tidy(paren ? paren[1] : raw));
    if (!name) continue;
    const id = slug(name);
    if (paren) draft.restrictedNotes.push(`${name}: ${tidy(paren[2])}.`);
    draft.restricted.push({ id, name: same(name) });
    pages[`restricted.${id}`] = page;
  }
  // 2.5 (a) Notas con reemplazos, debajo de la lista: «Nota <palabra>: … reemplazar … por <lista>.»
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== page || has(l.text, "grupos")) break;
    const note = execF(/^nota\s+([^:]+):/, l.text);
    if (!note) continue;
    const para = [l.text];
    while (
      i + 1 < lines.length &&
      lines[i + 1].page === page &&
      !isNote(lines[i + 1]) &&
      !has(lines[i + 1].text, "grupos")
    )
      para.push(lines[++i].text);
    const opts = execF(
      /(?:reemplazar|alternativas)\b[^.:]*?(?:\bpor\b|:)\s*(.+?)\.?\s*$/,
      joinCell(para),
    );
    if (!opts) continue;
    // «Nota <palabra>: el|la <X> incluye …»: lo que se reemplaza es <X> (la palabra de la
    // nota es el momento o el contexto).
    const subject = execF(
      /^nota\s+[^:]+:\s*(?:el|la)\s+([^.,:]+?)\s+incluye\b/,
      joinCell(para),
    );
    const key = tidy(subject ? subject[1] : note[1]);
    draft.equivalences.push({
      whenMissing: slug(key),
      title: { es: `En vez de ${key}`, en: `Instead of ${key}` },
      use: splitList(opts[1]).map((n) => ({ name: same(n) })),
    });
    pages[`equivalences.${slug(key)}`] = l.page;
  }
}

const CODE = /^E\s?(\d{3})(?!\d)\s*(.*)$/;

/**
 * Rejilla de aditivos: cada celda son DOS segmentos en la misma línea, el código «E nnn»
 * y, a otra x, el nombre. Un nombre de dos líneas va CENTRADO sobre su código (una arriba,
 * otra abajo): cada línea de nombre es de la fila cuyo código le queda más cerca en `y`
 * (a menos de media fila), jamás de la que la precede en orden de lectura.
 * Termina en el primer párrafo que empieza a la izquierda de los códigos sin traer código.
 * Devuelve el índice donde terminó (lo de «evitar» que sigue se busca desde ahí).
 */
function readAdditives(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
  skip: Skip,
): number {
  const start = findIdx(
    lines,
    (l, i) =>
      has(l.text, "aditivos") &&
      has(l.text, "evitar") &&
      !l.text.trim().endsWith(":") &&
      // …y la rejilla de códigos empieza pocas líneas debajo, en la misma página.
      lines
        .slice(i + 1, i + 8)
        .some(
          (n) => n.page === l.page && n.segs.some((s) => CODE.test(s.text)),
        ),
  );
  if (start < 0) return 0;
  type Cell = {
    code: string;
    x: number;
    y: number;
    parts: { y: number; x: number; text: string }[];
    page: number;
  };
  const cells: Cell[] = [];
  const loose: { y: number; x: number; text: string }[] = [];
  let codeX = Infinity;
  let i = start + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== lines[start].page) break;
    const hasCode = l.segs.some((s) => CODE.test(s.text));
    if (cells.length && !hasCode && l.segs[0].x < codeX - 3) break;
    for (const s of l.segs) {
      const code = CODE.exec(s.text);
      if (code) {
        codeX = Math.min(codeX, s.x);
        cells.push({
          code: code[1],
          x: s.x,
          y: l.y,
          parts: code[2] ? [{ y: l.y, x: s.x, text: code[2] }] : [],
          page: l.page,
        });
      } else loose.push({ y: l.y, x: s.x, text: s.text });
    }
  }
  // Media fila: la mitad del paso más corto entre dos códigos de la misma columna.
  const steps = cells.flatMap((c) =>
    cells
      .filter((d) => Math.abs(d.x - c.x) < 4 && d.y > c.y)
      .map((d) => d.y - c.y),
  );
  const half = (steps.length ? Math.min(...steps) : 40) / 2;
  for (const seg of loose) {
    // La columna: el código más cercano a su izquierda; la fila: el más cercano en y.
    const left = cells.filter((c) => c.x <= seg.x);
    const colX = Math.max(...left.map((c) => c.x));
    const row = left
      .filter((c) => Math.abs(c.x - colX) < 4 && Math.abs(c.y - seg.y) < half)
      .sort((a, b) => Math.abs(a.y - seg.y) - Math.abs(b.y - seg.y))[0];
    row?.parts.push(seg);
  }
  for (const c of cells) {
    const name = joinCell(
      c.parts.sort((a, b) => a.y - b.y || a.x - b.x).map((p) => p.text),
      true,
    );
    if (!name) {
      skip("additives");
      continue;
    }
    const code = `E${c.code}`;
    if (draft.additives.some((a) => a.code === code)) continue;
    draft.additives.push({ code, name: same(name) });
    pages[`additives.${code}`] = c.page;
  }
  if (draft.additives.length) pages.additives = lines[start].page;

  // «Presente en»: tabla de 4 columnas, la 1.ª con «aditivo» y la 3.ª con «presente».
  const header = lines.findIndex(
    (l) =>
      l.segs.length >= 3 &&
      has(l.segs[0].text, "aditivos") &&
      l.segs.some((s) => has(s.text, "presente")),
  );
  if (header >= 0) {
    const foundCol = lines[header].segs.findIndex((s) =>
      has(s.text, "presente"),
    );
    const { rows } = readTable(lines, header, {
      // Dos códigos pueden compartir fila: el 2.º abre línea en la 1.ª columna, pero la
      // fila nueva trae además texto en otra columna.
      isRowStart: (t, l) => CODE.test(t) && (l?.segs.length ?? 0) > 1,
      stop: (l) => startsWithIcon(l.text),
      maxPage: lines[header].page,
    });
    for (const row of rows) {
      const codes = [...joinCell(row.cells[0]).matchAll(/E\s?(\d{3})/g)].map(
        (m) => `E${m[1]}`,
      );
      const foundIn = joinCell(row.cells[foundCol] ?? []);
      if (!foundIn) continue;
      for (const code of codes) {
        const add = draft.additives.find((a) => a.code === code);
        if (add) add.foundIn = same(capitalize(foundIn));
      }
    }
  }
  return i;
}

/**
 * «Otros que evitar»: una línea que contiene «evitar» y termina en «:»; debajo, bloques
 * sangrados cuyo NOMBRE es una línea sola que termina en «:» (el párrafo va después).
 * Termina en el recuadro de aviso (otra sangría o un ícono).
 */
function readAlsoAvoid(
  lines: Line[],
  from: number,
  draft: PlanDraft,
  pages: Record<string, number>,
) {
  const start = findIdx(
    lines,
    (l) =>
      has(l.text, "evitar") &&
      l.text.trim().endsWith(":") &&
      !startsWithIcon(l.text) &&
      !SPAN.test(fold(l.text)),
    from,
  );
  if (start < 0 || lines[start].page !== lines[from - 1]?.page) return;
  let blockX: number | undefined;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== lines[start].page || startsWithIcon(l.text)) break;
    if (blockX !== undefined && Math.abs(l.segs[0].x - blockX) > 3) break;
    const m = /^([^:]{3,60}):$/.exec(l.text.trim());
    if (!m || l.segs.length > 1) continue;
    blockX ??= l.segs[0].x;
    const name = capitalize(tidy(m[1]));
    const id = slug(name);
    draft.alsoAvoid.push({ id, name: same(name) });
    pages[`alsoAvoid.${id}`] = l.page;
  }
  if (draft.alsoAvoid.length) pages.alsoAvoid = lines[start].page;
}

function readGreen(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
  skip: Skip,
) {
  // El encabezado (en una o dos líneas) trae «fuentes» y «porción» en celdas distintas.
  const secondOf = (i: number) =>
    lines[i + 1]?.page === lines[i].page && lines[i + 1].y - lines[i].y < 15
      ? lines[i + 1]
      : undefined;
  const header = findIdx(
    lines,
    (l, i) =>
      l.segs.some((s) => has(s.text, "fuentes")) &&
      [...l.segs, ...(secondOf(i)?.segs ?? [])].some((s) =>
        has(s.text, "porcion"),
      ),
  );
  if (header < 0) return;
  const second = secondOf(header);
  // El título con «grupos» (si está) arriba en la misma página da la página de la sección.
  const title = findIdx(lines, (l) => has(l.text, "grupos"));
  const anchor =
    title >= 0 && title < header && lines[title].page === lines[header].page
      ? title
      : header;
  const headSegs = [...lines[header].segs, ...(second?.segs ?? [])];
  const cols = [...new Set(headSegs.map((s) => Math.round(s.x)))]
    .sort((a, b) => a - b)
    .filter((x, k, a) => k === 0 || x - a[k - 1] > 5);
  const colIdx = (w: AnchorWord) => {
    const seg = headSegs.find((s) => has(s.text, w));
    return seg ? colOf(cols, seg.x) : -1;
  };
  const srcCol = colIdx("fuentes");
  const portionCol = colIdx("porcion");
  const { rows } = readTable(lines, header, {
    isRowStart: startsWithIcon,
    stop: (l) =>
      has(l.text, "menu") ||
      has(l.text, "hidratacion") ||
      l.segs.some((s) => has(s.text, "suplemento")),
    maxPage: lines[header].page + 1,
    cols,
  });
  for (const row of rows) {
    const name = capitalize(stripIcon(joinCell(row.cells[0])));
    if (!name) continue;
    const id = slug(name);
    const items: DraftItem[] = [];
    for (const raw of splitDots(joinCell(row.cells[srcCol] ?? []))) {
      const paren = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(raw);
      const itemName = capitalize(tidy(paren ? paren[1] : raw));
      if (!itemName) continue;
      const itemId = slug(itemName);
      items.push({ id: itemId, name: same(itemName) });
      // Un paréntesis con límite es amarillo; uno con hábitos del niño se descarta.
      if (paren && LIMIT.test(fold(paren[2]))) {
        draft.yellow.push({
          id: itemId,
          name: same(itemName),
          limit: same(tidy(paren[2])),
        });
        pages[`yellow.${itemId}`] = row.page;
      }
    }
    const portion = joinCell(portionCol >= 0 ? row.cells[portionCol] : [])
      .replace(/\s+(?=\d+\s+veces\b)/g, ", ")
      .replace(/\s+(?=\p{Ll}\p{L}{1,20}:\s)/gu, "; ");
    if (items.length === 0) {
      skip("green");
      continue;
    }
    draft.green.push({
      id,
      name: same(name),
      portion: same(portion || "—"),
      items,
    });
    pages[`green.${id}`] = row.page;
  }
  if (draft.green.length) pages.green = lines[anchor].page;
  if (draft.yellow.length) pages.yellow = lines[anchor].page;
}

const TEXTURE_WORDS: [RegExp, Texture][] = [
  [/crujiente/, "crunchy"],
  [/pure/, "puree"],
  [/liquid/, "liquid"],
  [/blanda|suave/, "soft"],
];

/** Meta de movimiento: «<n> a <n> minutos …» en la línea que trae «objetivo». */
const ACTIVITY = /\d+\s+a\s+\d+\s+minutos\b/;

/**
 * Pilares: la columna de la derecha empieza en la x del segmento con «objetivo» y la meta
 * de minutos; lo de su izquierda (lo personal) no se lee. Ahí viven la meta de movimiento,
 * la de sueño (viñeta «→» con «objetivo») y las etiquetas de reemplazo al inicio de línea:
 * `<sustantivo> del <x>:`, `<X> de <palabra>:` o `<X> de <palabra> <adjetivo>:`, seguidas de
 * una lista con comas que puede envolver varias líneas y termina en «.».
 */
function readPillars(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
) {
  let colX: number | undefined;
  let page = -1;
  for (const l of lines) {
    const seg = l.segs.find(
      (s) => has(s.text, "objetivo") && ACTIVITY.test(fold(s.text)),
    );
    if (seg) {
      colX = seg.x;
      page = l.page;
      break;
    }
  }
  // Respaldo: si la meta de minutos se escribe distinto, la columna es la de las viñetas «→».
  if (colX === undefined) {
    const arrow = lines.find((l) => l.segs.some((s) => /^→/.test(s.text)));
    const seg = arrow?.segs.find((s) => /^→/.test(s.text));
    if (!arrow || !seg) return;
    colX = seg.x;
    page = arrow.page;
  }
  const right = lines
    .filter((l) => l.page === page || l.page === page + 1)
    .map((l) => ({
      page: l.page,
      text: l.segs
        .filter((s) => s.x >= colX! - 3)
        .map((s) => s.text)
        .join(" "),
    }))
    .filter((l) => l.text);
  const all = joinCell(right.map((l) => l.text));

  // La meta es la frase con «objetivo» que trae los minutos; otra con «objetivo» sin
  // minutos puede ir antes en la misma columna y no cuenta.
  const goals = [...fold(all).matchAll(/objetivo[^:.]*:\s*([^.]+\.)/g)].map(
    (m) =>
      all.slice(m.index + m[0].length - m[1].length, m.index + m[0].length),
  );
  const activity = goals.find((g) => ACTIVITY.test(fold(g)));
  if (activity) {
    draft.goals.activity = same(capitalize(tidy(activity)));
    pages["goals.activity"] = page;
  }
  const sleepAt = right.find((l) => /^→\s*objetivo\s*:/.test(fold(l.text)));
  const sleep = execF(
    /→\s*objetivo\s*:\s*(.+?)(?=\s*→|$)/,
    all.slice(Math.max(all.indexOf("→"), 0)),
  );
  if (sleep && sleepAt) {
    const text = sleep[1].replace(/\s+\p{Lu}[^:.]{2,60}:.*$/u, "");
    draft.goals.sleep = same(capitalize(tidy(text)).replace(/\.?$/, "."));
    pages["goals.sleep"] = sleepAt.page;
  }

  // Etiquetas al inicio de línea: cada una junta las líneas que siguen hasta la próxima.
  type Entry = { page: number; label: string; text: string };
  const entries: Entry[] = [];
  for (const l of right) {
    const m = /^(\p{Lu}[^:.→]{2,60}):\s*(.*)$/u.exec(l.text);
    if (m) entries.push({ page: l.page, label: tidy(m[1]), text: m[2] });
    else if (entries.length && !/^→/.test(l.text))
      entries[entries.length - 1].text += " " + l.text;
    else if (/^→/.test(l.text))
      entries.push({ page: l.page, label: "", text: "" });
  }
  for (const e of entries) {
    if (!e.label || has(e.label, "objetivo")) continue;
    const shape = execF(/^(\S+)\s+(del?)\s+(\S+)(?:\s+\S+)?$/, e.label);
    if (!shape) continue;
    // La lista (o la frase) termina en el primer punto que no es decimal («0.5»).
    const list = /^((?:[^.→]|\.(?=\d))+)\./.exec(joinCell([e.text]));
    if (!list) continue;
    // «<persona>: si tiene …, reemplazar por …» nombra a alguien de la familia: no se lee.
    if (/^\s*si\b/.test(fold(list[1])) || /\bsi\b[^,]*,/.test(fold(list[1])))
      continue;
    const isDel = fold(shape[2]) === "del";
    // «<sustantivo> del <x>:» trae una FRASE «<verbo> el <x> por <y> — <comentario>»: el
    // reemplazo es <y>; lo de después de la raya es comentario, no un ítem.
    // El «por» va ANTES de la raya; sin él, la etiqueta no trae reemplazo y no se lee.
    const phrase = isDel
      ? execF(/^[^—–]*?\bpor\s+([^—–]+?)\s*(?:[—–]|$)/, list[1])
      : null;
    if (isDel && !phrase) continue;
    const use = phrase ? [tidy(phrase[1])] : splitList(list[1]);
    if (use.length < (phrase ? 1 : 2)) continue;
    const key = isDel ? shape[3] : shape[1];
    const texture = TEXTURE_WORDS.find(([re]) => re.test(fold(e.label)))?.[1];
    draft.equivalences.push({
      whenMissing: slug(key),
      title: same(e.label),
      use: use.map((n) => ({ name: same(n), ...(texture ? { texture } : {}) })),
    });
    pages[`equivalences.${slug(key)}`] = e.page;
  }
  if (draft.goals.activity || draft.goals.sleep)
    pages.goals = pages["goals.activity"] ?? pages["goals.sleep"];
}

/** La presentación del frasco («4 fl oz 120 ml», «(30 ml)») sale del nombre del suplemento; la marca se queda. */
function dropPresentation(name: string): string {
  const f = fold(name);
  const re = /\(?(?:\s*\/?\s*\d+(?:[.,]\d+)?(?:\s*(?:fl|oz|ml)\b\.?)+)+\s*\)?/g;
  let out = "";
  let last = 0;
  for (const m of f.matchAll(re)) {
    out += name.slice(last, m.index);
    last = m.index! + m[0].length;
  }
  return tidy(out + name.slice(last));
}

function readSupplements(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
  skip: Skip,
) {
  // Encabezado: una línea con «suplemento» y «dosis» en celdas distintas.
  const header = findIdx(
    lines,
    (l) =>
      l.segs.some((s) => has(s.text, "suplemento")) &&
      l.segs.some((s) => has(s.text, "dosis")),
  );
  if (header >= 0) {
    const segs = lines[header].segs;
    const doseCol = segs.findIndex((s) => has(s.text, "dosis"));
    const lastCol = segs.length - 1;
    // Calendario de verificación: una fila con los días de la semana en columnas.
    const isWeekRow = (l: Line) =>
      l.segs.filter((s) => isWeekday(s.text)).length >= 3;
    const { rows } = readTable(lines, header, {
      isRowStart: startsWithIcon,
      stop: isWeekRow,
      maxPage: lines[header].page,
    });
    // La columna de los días es la que trae días de la semana.
    const counts = segs.map((_, c) =>
      rows.reduce((n, r) => n + r.cells[c].filter(isWeekday).length, 0),
    );
    const daysCol = counts.indexOf(Math.max(...counts));
    for (const row of rows) {
      const name = dropPresentation(stripIcon(joinCell(row.cells[0], true)));
      const days = row.cells[daysCol]
        .map((d) => WEEKDAYS[slug(d)])
        .filter((d): d is Weekday => !!d);
      if (!name) continue;
      if (days.length === 0) {
        skip("supplements");
        continue;
      }
      const instr = lastCol > doseCol ? joinCell(row.cells[lastCol] ?? []) : "";
      const when = /^(.+?\.)(\s|$)/.exec(instr)?.[1] ?? instr;
      const id = slug(name);
      draft.supplements.push({
        id,
        name: same(name),
        days,
        dose: same(joinCell(row.cells[doseCol] ?? []) || "—"),
        when: same(when || "—"),
      });
      pages[`supplements.${id}`] = row.page;
    }
    if (draft.supplements.length) pages.supplements = lines[header].page;
  }
  // Notas: tras un título con 📌, párrafos «Etiqueta: texto» hasta el aviso en dos columnas.
  const notes = findIdx(lines, (l) => /^\u{1F4CC}/u.test(l.text), header);
  if (notes < 0) return;
  const paras: string[] = [];
  for (let i = notes + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== lines[notes].page || l.segs.length > 1) break;
    if (/^[^:]{2,30}:\s/.test(l.text) || paras.length === 0) paras.push(l.text);
    else paras[paras.length - 1] += " " + l.text;
  }
  if (paras.length) {
    draft.supplementNotes = same(paras.map(tidy).join(" "));
    pages.supplementNotes = lines[notes].page;
  }
}

function readMenuAndHydration(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
  skip: Skip,
) {
  // Inicio: una línea con «menú» (sin ícono) y, en su página y pocas líneas abajo, un bloque
  // con ícono y una hora: es el menú, no una mención suelta. El título va seguido de
  // contenido, no del ícono (la celda izquierda va centrada frente a la derecha).
  const start = findIdx(lines, (l, i) => {
    if (!has(l.text, "menu") || startsWithIcon(l.text)) return false;
    const near = lines.slice(i + 1, i + 9).filter((n) => n.page === l.page);
    const icon = near.findIndex((n) => startsWithIcon(n.text));
    return (
      icon >= 0 && near.slice(icon).some((n) => /\d{1,2}:\d{2}/.test(n.text))
    );
  });
  const hydr = findIdx(lines, (l) => has(l.text, "hidratacion"), start);
  if (start >= 0) {
    const end = hydr >= 0 ? hydr : lines.length;
    const body = lines
      .slice(start + 1, end)
      .filter((l) => l.page === lines[start].page);
    const xs = body.flatMap((l) => l.segs.map((s) => s.x));
    const split = Math.min(...xs) + 40;
    // Izquierda: cada bloque va del ícono a su hora. Derecha: cada línea es de la comida
    // cuyo bloque izquierdo le queda más cerca en y (las celdas van centradas), jamás de la
    // que la precede en orden de lectura.
    type Block = {
      page: number;
      top: number;
      bottom: number;
      left: string[];
      right: { y: number; text: string }[];
    };
    const blocks: Block[] = [];
    const rights: { y: number; text: string }[] = [];
    for (const l of body) {
      const left = l.segs.filter((s) => s.x < split).map((s) => s.text);
      const right = l.segs.filter((s) => s.x >= split).map((s) => s.text);
      if (left[0] && startsWithIcon(left[0]))
        blocks.push({
          page: l.page,
          top: l.y,
          bottom: l.y,
          left: [],
          right: [],
        });
      const b = blocks.at(-1);
      if (b && left.length) {
        b.left.push(...left);
        b.bottom = l.y;
      }
      if (right.length) rights.push({ y: l.y, text: right.join(" ") });
    }
    const gap = (b: Block, y: number) =>
      y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
    for (const r of rights) {
      const b = [...blocks].sort(
        (p, q) =>
          gap(p, r.y) - gap(q, r.y) ||
          Math.abs((p.top + p.bottom) / 2 - r.y) -
            Math.abs((q.top + q.bottom) / 2 - r.y),
      )[0];
      b?.right.push(r);
    }
    const used = new Set<string>();
    for (const b of blocks) {
      const timeIdx = b.left.findIndex((t) => parseTimeRange(t));
      if (timeIdx < 0) {
        skip("menu");
        continue;
      }
      const time = parseTimeRange(b.left[timeIdx])!;
      const name = capitalize(stripIcon(joinCell(b.left.slice(0, timeIdx))));
      if (!name) continue;
      // Las líneas con «→» son recordatorios de suplemento: no son parte del menú.
      // Una línea «<Etiqueta corta>: …» abre otra opción.
      const pieces: string[] = [];
      for (const { text: r } of b.right.sort((p, q) => p.y - q.y)) {
        if (/^→/.test(r)) continue;
        if (/^\p{Lu}[^:]{0,20}:\s/u.test(r) || pieces.length === 0)
          pieces.push(r);
        else pieces[pieces.length - 1] += " " + r;
      }
      let id = slug(name);
      while (used.has(id)) id += "-2";
      used.add(id);
      draft.menu.push({
        id,
        name: same(name),
        ...time,
        content: same(pieces.map(tidy).join(" · ") || "—"),
      });
      pages[`menu.${id}`] = b.page;
    }
    if (draft.menu.length) pages.menu = lines[start].page;
  }
  if (hydr < 0) return;
  const text = joinCell(
    lines
      .slice(hydr + 1)
      .filter((l) => l.page === lines[hydr].page)
      .map((l) => l.text),
  );
  const meta =
    /meta\s*:\s*(\d+(?:[.,]\d+)?)\s*a\s*(\d+(?:[.,]\d+)?)\s*litros/.exec(
      fold(text),
    );
  if (!meta) return;
  // Hábito: desde «hábito:» hasta el fin de su oración o la próxima etiqueta («<Palabra>: …»). Los consejos que
  // siguen nombran a personas de la familia: NO se leen (se completan a mano).
  const at = /habito\s*:\s*/.exec(fold(text));
  const rest = at ? text.slice(at.index + at[0].length) : "";
  const habit = rest
    .replace(/\.\s+\p{Lu}.*$/u, ".")
    .replace(/\s+\p{Lu}[^:.]{0,40}:.*$/u, "");
  const glasses = habit
    .split(",")
    .map((p) => Number(/^\s*(\d+)\b/.exec(p)?.[1] ?? 0))
    .reduce((a, b) => a + b, 0);
  draft.hydration = {
    targetLitersMin: Number(meta[1].replace(",", ".")),
    targetLitersMax: Number(meta[2].replace(",", ".")),
    ...(glasses > 0 ? { glassesPerDay: glasses } : {}),
    habit: same(capitalize(tidy(habit).replace(/\.?$/, "."))),
  };
  pages.hydration = lines[hydr].page;
}

/** Una equivalencia cuya clave nombra un alimento restringido apunta a SU id. */
function linkEquivalences(draft: PlanDraft, pages: Record<string, number>) {
  const ids = [
    ...draft.restricted.map((r) => r.id),
    ...draft.alsoAvoid.map((r) => r.id),
  ];
  for (const eq of draft.equivalences) {
    const hit = ids.find(
      (id) => id === eq.whenMissing || id.startsWith(`${eq.whenMissing}-`),
    );
    if (!hit || hit === eq.whenMissing) continue;
    const page = pages[`equivalences.${eq.whenMissing}`];
    delete pages[`equivalences.${eq.whenMissing}`];
    eq.whenMissing = hit;
    if (page !== undefined) pages[`equivalences.${hit}`] = page;
  }
}

/**
 * Una equivalencia por alimento que falta (la fila de la revisión se identifica por él):
 * si el PDF trae dos para el mismo, se juntan sus opciones en la primera.
 */
function mergeEquivalences(draft: PlanDraft) {
  const seen = new Map<string, DraftEquivalence>();
  const out: DraftEquivalence[] = [];
  for (const e of draft.equivalences) {
    const first = seen.get(e.whenMissing);
    if (!first) {
      seen.set(e.whenMissing, e);
      out.push(e);
    } else {
      first.use = [
        ...first.use,
        ...e.use.filter((u) => !first.use.some((f) => f.name.es === u.name.es)),
      ];
    }
  }
  draft.equivalences = out;
}

/** El nombre del niño (del encabezado) se borra de todo lo leído: jamás queda en el plan. */
function scrubNames(draft: PlanDraft, names: string[]) {
  const tokens = names
    .flatMap((n) => [n, ...n.split(/\s+/)])
    .filter((t) => t.length >= 3)
    .sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return;
  const esc = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(
    `(?:\\s+de)?\\s*(?<![\\p{L}\\p{N}])(?:${esc.join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return tidy(v.replace(re, ""));
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, walk(x)]),
      );
    return v;
  };
  Object.assign(draft, walk(draft));
}
