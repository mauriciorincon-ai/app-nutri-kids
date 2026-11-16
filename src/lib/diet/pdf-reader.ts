import type { LocalizedText, Texture, Weekday } from "./schema";
import { type Line, type PdfPage, toLines } from "./pdf-text";

/**
 * Lector determinista del PDF del plan (ADR-010). Puro: recibe el texto de las páginas
 * (ya extraído en el aparato) y devuelve un BORRADOR por secciones, cada dato con la
 * página de donde salió. Detecta por FORMA (encabezados, columnas, separadores) y por
 * palabras clave genéricas; no copia los títulos de la plantilla enteros (ADR-010, punto abierto).
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

/** Separa una lista con comas y una «o»/«y» final. */
const splitList = (s: string) =>
  s
    .replace(/\.\s*$/, "")
    .split(/\s*,\s*|\s+[oy]\s+/)
    .map((x) => tidy(x))
    .filter(Boolean);

const LIMIT =
  /m[aá]x|\d+\s*[-–]\s*\d+\s*(?:uds?\b|unidades)|\d+\s*\/\s*(?:d[ií]a|semana)/i;

const WEEKDAYS: Record<string, Weekday> = {
  lunes: "mon",
  martes: "tue",
  miercoles: "wed",
  jueves: "thu",
  viernes: "fri",
  sabado: "sat",
  domingo: "sun",
};

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

/** Línea con identidad, medidas, resultados o contacto: se descarta antes de buscar. */
const FORBIDDEN_LINE = [
  /\S+@\S+\.\S+/, // correo
  /\+?\d[\d\s().-]{7,}\d/, // teléfono
  /\bID\s*:/i,
  /\b(peso|talla|estatura|imc|percentil\w*|edad)\b/i,
  /\d+(?:[.,]\d+)?\s*(?:kg|cm)\b/i,
];

type PageKind = "A" | "B" | "none";
type CleanPage = {
  n: number;
  kind: PageKind;
  section?: string;
  lines: Line[];
};

const HEADER_A = /Secci[oó]n\s*0(\d)\s*$/i;
const HEADER_B = /^(.+?)\s·\s(.+?)\s·\s\p{L}+\s+\d{4}$/u;

function classify(pages: PdfPage[]): { pages: CleanPage[]; names: string[] } {
  const names = new Set<string>();
  const out: CleanPage[] = [];
  for (const page of pages) {
    let lines = toLines(page);
    let kind: PageKind = "none";
    let section: string | undefined;
    const first = lines[0];
    if (first && first.y < 70) {
      const a = HEADER_A.exec(first.text);
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
    // Pie de página (profesional y especialidades): fuera.
    lines = lines.filter((l) => l.y < page.height - 30);
    out.push({ n: page.n, kind, section, lines });
  }
  return { pages: out, names: [...names] };
}

/** ¿Página que NUNCA se lee? Resultados (Sección 01/02), identidad y medidas, divisores. */
function isForbiddenPage(p: CleanPage): boolean {
  if (p.kind === "A" && (p.section === "01" || p.section === "02")) return true;
  // Tabla «Dato | Información»: identidad y medidas corporales.
  if (
    p.lines.some(
      (l) =>
        l.segs.length >= 2 &&
        /^dato$/i.test(l.segs[0].text) &&
        /^informaci[oó]n$/i.test(l.segs[1].text),
    )
  )
    return true;
  if (
    p.kind === "none" &&
    p.lines.length <= 9 &&
    p.lines.some((l) => /Secci[oó]n\s*\d\d/i.test(l.text))
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
 * Lee una tabla desde su encabezado. Las columnas salen de la x de cada título; una
 * fila empieza con `isRowStart` en la primera columna; lo que llega después (aunque
 * cambie de página, sin repetir encabezado) es continuación de la fila abierta.
 */
function readTable(
  lines: Line[],
  headerIdx: number,
  opts: {
    isRowStart: (col0: string) => boolean;
    stop: (l: Line) => boolean;
    maxPage?: number;
  },
): { rows: Row[]; next: number } {
  const header = lines[headerIdx];
  const cols = header.segs.map((s) => s.x);
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
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (opts.maxPage !== undefined && line.page > opts.maxPage) break;
    if (opts.stop(line)) break;
    const col0 = line.segs.find((s) => colOf(cols, s.x) === 0);
    if ((col0 && opts.isRowStart(col0.text)) || rows.length === 0) {
      if (rows.length === 0 && !(col0 && opts.isRowStart(col0.text))) continue;
      rows.push({ page: line.page, cells: cols.map(() => []) });
    }
    const row = rows[rows.length - 1];
    for (const s of line.segs) row.cells[colOf(cols, s.x)].push(s.text);
  }
  return { rows, next: i };
}

// ─────────────── el lector ───────────────

const findIdx = (lines: Line[], re: RegExp, from = 0) => {
  for (let i = from; i < lines.length; i++)
    if (re.test(lines[i].text)) return i;
  return -1;
};

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

  // 2.1 La fecha del plan: la única fecha completa, en la portada (lo demás de ahí no se lee).
  for (const p of pages.filter((p) => !isForbiddenPage(p))) {
    const hit = p.lines
      .map((l) => /Fecha\s*:\s*(\d{2})[./-](\d{2})[./-](\d{4})/i.exec(l.text))
      .find(Boolean);
    if (hit) {
      draft.issuedAt = `${hit[3]}-${hit[2]}-${hit[1]}`;
      pagesMap.validity = p.n;
      break;
    }
  }

  // Todo lo demás: solo páginas permitidas y sin líneas prohibidas.
  const lines: Line[] = pages
    .filter((p) => !isForbiddenPage(p))
    .flatMap((p) => p.lines)
    .filter((l) => !FORBIDDEN_LINE.some((re) => re.test(l.text)));

  readRestricted(lines, draft, pagesMap);
  const skipped: Partial<Record<SectionKey, number>> = {};
  const skip: Skip = (k) => {
    skipped[k] = (skipped[k] ?? 0) + 1;
  };
  readAdditives(lines, draft, pagesMap, skip);
  readAlsoAvoid(lines, draft, pagesMap);
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

function readRestricted(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
) {
  const start = findIdx(lines, /alimentos\b.*restricci[oó]n.*:\s*$/i);
  if (start < 0) return;
  const parts: string[] = [];
  let i = start + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== lines[start].page) break;
    if (/^Nota\b/i.test(l.text) || /grupos\s+alimentarios/i.test(l.text)) break;
    parts.push(l.text);
  }
  const page = lines[start].page;
  pages.restricted = page;
  const span = /\bpor\s+(\d{1,3})\s*(d[ií]as?|semanas?|mes(?:es)?)\b/i.exec(
    lines[start].text,
  );
  if (span) {
    const unit = span[2].toLowerCase();
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
  // 2.5 (a) Notas con reemplazos, debajo de la lista roja.
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== page || /grupos\s+alimentarios/i.test(l.text)) break;
    const note = /^Nota\s+([^:]+):/i.exec(l.text);
    if (!note) continue;
    const para = [l.text];
    while (
      i + 1 < lines.length &&
      lines[i + 1].page === page &&
      !/^Nota\b/i.test(lines[i + 1].text) &&
      !/grupos\s+alimentarios/i.test(lines[i + 1].text)
    )
      para.push(lines[++i].text);
    const text = joinCell(para);
    const opts =
      /(?:reemplazar\s+siempre\s+por|alternativas\s*:)\s*(.+?)\.?\s*$/i.exec(
        text,
      );
    if (!opts) continue;
    const key = tidy(note[1]);
    draft.equivalences.push({
      whenMissing: slug(key),
      title: { es: `En vez de ${key}`, en: `Instead of ${key}` },
      use: splitList(opts[1]).map((n) => ({ name: same(n) })),
    });
    pages[`equivalences.${slug(key)}`] = l.page;
  }
}

function readAdditives(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
  skip: Skip,
) {
  const start = findIdx(lines, /aditivos\b.*\bevitar/i);
  if (start < 0) return;
  // Rejilla: cada celda empieza con «E nnn»; una línea debajo en la misma x la continúa.
  const cells: { x: number; parts: string[]; page: number }[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== lines[start].page || /^La lista\b/i.test(l.text)) break;
    for (const s of l.segs) {
      if (/^E\s?\d{3}\b/.test(s.text))
        cells.push({ x: s.x, parts: [s.text], page: l.page });
      else {
        const open = [...cells].reverse().find((c) => Math.abs(c.x - s.x) < 4);
        open?.parts.push(s.text);
      }
    }
  }
  for (const c of cells) {
    const m = /^E\s?(\d{3})\s+(.+)$/.exec(joinCell(c.parts, true));
    if (!m) {
      skip("additives");
      continue;
    }
    const code = `E${m[1]}`;
    if (draft.additives.some((a) => a.code === code)) continue;
    draft.additives.push({ code, name: same(m[2]) });
    pages[`additives.${code}`] = c.page;
  }
  if (draft.additives.length) pages.additives = lines[start].page;

  // «Presente en»: tabla Aditivo | Tipo | Presente en | Riesgo… (esta última se ignora).
  const header = lines.findIndex(
    (l) =>
      l.segs.length >= 3 &&
      /^aditivo$/i.test(l.segs[0].text) &&
      l.segs.some((s) => /^presente en$/i.test(s.text)),
  );
  if (header < 0) return;
  const foundCol = lines[header].segs.findIndex((s) =>
    /^presente en$/i.test(s.text),
  );
  const { rows } = readTable(lines, header, {
    isRowStart: (t) => /^E\s?\d{3}\b/.test(t),
    stop: (l) => /nota importante/i.test(l.text),
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

function readAlsoAvoid(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
) {
  const start = findIdx(lines, /tambi[eé]n\s+recomendamos\s+evitar/i);
  if (start < 0) return;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.page !== lines[start].page || /^Cualquier indicaci/i.test(l.text))
      break;
    const m = /^([^:]{3,40}):\s/.exec(l.text);
    if (!m) continue;
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
  const anchor = findIdx(lines, /grupos\s+alimentarios/i);
  if (anchor < 0) return;
  const header = findIdx(lines, /fuentes/i, anchor);
  if (header < 0 || lines[header].page !== lines[anchor].page) return;
  const segs = lines[header].segs;
  const col = (re: RegExp) => segs.findIndex((s) => re.test(s.text));
  const srcCol = col(/fuentes/i);
  const portionCol = col(/porci[oó]n/i);
  const { rows } = readTable(lines, header, {
    isRowStart: startsWithIcon,
    stop: (l) => /men[uú](?!\p{L})|hidrataci[oó]n|suplementaci[oó]n/iu.test(l.text),
    maxPage: lines[header].page + 1,
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
      if (paren && LIMIT.test(paren[2])) {
        draft.yellow.push({
          id: itemId,
          name: same(itemName),
          limit: same(tidy(paren[2])),
        });
        pages[`yellow.${itemId}`] = row.page;
      }
    }
    const portion = joinCell(row.cells[portionCol] ?? [])
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
  [/crujiente/i, "crunchy"],
  [/pur[eé]/i, "puree"],
  [/l[ií]quid/i, "liquid"],
  [/blanda|suave/i, "soft"],
];

function readPillars(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
) {
  const header = lines.findIndex(
    (l) =>
      l.segs.length >= 3 &&
      /^pilar$/i.test(l.segs[0].text) &&
      l.segs.some((s) => /^recomendaciones/i.test(s.text)),
  );
  if (header < 0) return;
  const recCol = lines[header].segs.findIndex((s) =>
    /^recomendaciones/i.test(s.text),
  );
  const { rows } = readTable(lines, header, {
    isRowStart: startsWithIcon,
    stop: () => false,
    maxPage: lines[header].page + 1,
  });
  for (const row of rows) {
    const rec = joinCell(row.cells[recCol] ?? []);
    const activity = /Objetivo diario\s*:\s*(.+?\.)/i.exec(rec);
    if (activity && !draft.goals.activity) {
      draft.goals.activity = same(capitalize(tidy(activity[1])));
      pages["goals.activity"] = row.page;
    }
    const sleep =
      /→\s*Objetivo\s*:\s*(.+?)(?=\s*→|\s+\p{Lu}[^:.]{2,40}:|$)/u.exec(rec);
    if (sleep && !draft.goals.sleep) {
      draft.goals.sleep = same(capitalize(tidy(sleep[1])).replace(/\.?$/, "."));
      pages["goals.sleep"] = row.page;
    }
    // 2.5 (b) Etiquetas de reemplazo: «Cambio del X:», «X de reemplazo:», «Snacks de reemplazo Y:».
    for (const m of rec.matchAll(/(\p{Lu}[^:.→]{2,40}?):\s*([^.→]+)\./gu)) {
      const label = tidy(m[1]);
      const key =
        /^cambio del?\s+(.+)$/i.exec(label)?.[1] ??
        /^(\S+)\s+de\s+reemplazo/i.exec(label)?.[1];
      if (!key) continue;
      const texture = TEXTURE_WORDS.find(([re]) => re.test(label))?.[1];
      draft.equivalences.push({
        whenMissing: slug(key),
        title: same(label),
        use: splitList(m[2]).map((n) => ({
          name: same(n),
          ...(texture ? { texture } : {}),
        })),
      });
      pages[`equivalences.${slug(key)}`] = row.page;
    }
  }
  if (draft.goals.activity || draft.goals.sleep)
    pages.goals = pages["goals.activity"] ?? pages["goals.sleep"];
}

function readSupplements(
  lines: Line[],
  draft: PlanDraft,
  pages: Record<string, number>,
  skip: Skip,
) {
  const anchor = findIdx(lines, /plan de suplementaci[oó]n/i);
  if (anchor >= 0) {
    const header = lines.findIndex(
      (l, i) =>
        i > anchor &&
        l.segs.some((s) => /^d[ií]as$/i.test(s.text)) &&
        l.segs.some((s) => /^dosis$/i.test(s.text)),
    );
    if (header >= 0) {
      const segs = lines[header].segs;
      const daysCol = segs.findIndex((s) => /^d[ií]as$/i.test(s.text));
      const doseCol = segs.findIndex((s) => /^dosis$/i.test(s.text));
      const instrCol = segs.findIndex((s) => /^instrucciones/i.test(s.text));
      const { rows } = readTable(lines, header, {
        isRowStart: startsWithIcon,
        stop: (l) => /calendario/i.test(l.text),
        maxPage: lines[header].page,
      });
      for (const row of rows) {
        const name = stripIcon(joinCell(row.cells[0], true));
        const days = row.cells[daysCol]
          .map((d) => WEEKDAYS[slug(d)])
          .filter((d): d is Weekday => !!d);
        if (!name) continue;
        if (days.length === 0) {
          skip("supplements");
          continue;
        }
        const instr = joinCell(row.cells[instrCol] ?? []);
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
  }
  // Notas: párrafos «Etiqueta: texto» hasta el bloque de aviso (dos columnas o «Aviso»).
  const notes = findIdx(lines, /notas sobre la suplementaci[oó]n/i);
  if (notes < 0) return;
  const paras: string[] = [];
  for (let i = notes + 1; i < lines.length; i++) {
    const l = lines[i];
    if (
      l.page !== lines[notes].page ||
      l.segs.length > 1 ||
      /^aviso\b/i.test(l.text)
    )
      break;
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
  const start = findIdx(lines, /men[uú](?!\p{L}).*d[ií]a/iu);
  const hydr = findIdx(lines, /hidrataci[oó]n/i, Math.max(start, 0));
  if (start >= 0) {
    const end = hydr >= 0 ? hydr : lines.length;
    const body = lines
      .slice(start + 1, end)
      .filter((l) => l.page === lines[start].page);
    const xs = body.flatMap((l) => l.segs.map((s) => s.x));
    const split = Math.min(...xs) + 40;
    type Block = { page: number; left: string[]; right: string[] };
    const blocks: Block[] = [];
    for (const l of body) {
      const left = l.segs.filter((s) => s.x < split).map((s) => s.text);
      const right = l.segs.filter((s) => s.x >= split).map((s) => s.text);
      if (left[0] && startsWithIcon(left[0]))
        blocks.push({ page: l.page, left: [], right: [] });
      const b = blocks.at(-1);
      if (!b) continue;
      b.left.push(...left);
      b.right.push(...right);
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
      const pieces: string[] = [];
      for (const r of b.right) {
        if (/^→/.test(r)) continue;
        if (/^Opci[oó]n\s+\S+\s*:/i.test(r) || pieces.length === 0)
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
    /Meta\s*:\s*(\d+(?:[.,]\d+)?)\s*a\s*(\d+(?:[.,]\d+)?)\s*litros/i.exec(text);
  if (!meta) return;
  const habit = /H[aá]bito\s*:\s*(.+?)(?:\s*Tips\s*:|$)/i.exec(text)?.[1] ?? "";
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
  const tip = /reemplazar\s+(.+?)\s+por\s+(.+?)\.(?:\s|$)/i.exec(text);
  if (tip) {
    const key = tidy(tip[1]);
    draft.equivalences.push({
      whenMissing: slug(key),
      title: { es: `En vez de ${key}`, en: `Instead of ${key}` },
      use: splitList(tip[2]).map((n) => ({ name: same(n) })),
    });
    pages[`equivalences.${slug(key)}`] = lines[hydr].page;
  }
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
