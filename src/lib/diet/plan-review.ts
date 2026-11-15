import { assembleDietPlan } from "./plan-assemble";
import {
  type DraftAdditive,
  type DraftItem,
  type PlanDraft,
  type PlanReading,
  type SectionKey,
  SECTION_KEYS,
  same,
  slug,
} from "./pdf-reader";
import type { LocalizedText, ParseDietResult, Weekday } from "./schema";

/**
 * La revisión del plan leído (ADR-010, decisión 1 a): puro, sin React ni storage.
 * Cada sección se marca «está bien», se corrige (renombrar, quitar, añadir) o se marca
 * «mi plan no lo trae»; lo que el lector no reconoció se completa a mano en la misma
 * pantalla. Nada se guarda hasta que todas las secciones estén revisadas.
 */

/** El rojo fijo de la plantilla viene en prosa: se añade a mano, siempre. */
export const REVIEW_KEYS = [
  "validity",
  "restricted",
  "red",
  ...SECTION_KEYS.filter((k) => k !== "validity" && k !== "restricted"),
] as const;
export type ReviewKey = (typeof REVIEW_KEYS)[number];

export type Mark = "pending" | "ok" | "corrected" | "absent";

/** Sin estas tres el plan no se arma: «mi plan no lo trae» no existe para ellas. */
export const REQUIRED_KEYS: readonly ReviewKey[] = [
  "green",
  "menu",
  "hydration",
];

export type ReviewState = {
  v: 1;
  /** Cuándo se leyó (ISO); la fecha del plan cae a ella si el PDF no la trae. */
  readAt: string;
  draft: PlanDraft;
  pages: Record<string, number>;
  /** Ítems del rojo fijo añadidos a mano. */
  red: DraftItem[];
  /** Lo que el lector no encontró en absoluto. */
  unrecognized: SectionKey[];
  marks: Record<ReviewKey, Mark>;
};

export function startReview(reading: PlanReading, readAt: Date): ReviewState {
  const marks = Object.fromEntries(
    REVIEW_KEYS.map((k) => [k, "pending"]),
  ) as Record<ReviewKey, Mark>;
  return {
    v: 1,
    readAt: readAt.toISOString(),
    draft: reading.draft,
    pages: reading.pages,
    red: [],
    unrecognized: reading.unrecognized,
    marks,
  };
}

// ───────────────────────── campos de cada sección ─────────────────────────

export type FieldKind = "text" | "time" | "days" | "number" | "date" | "list";
export type FieldSpec = { key: string; kind: FieldKind; optional?: boolean };

/** `single`: la sección es un solo registro (fecha, hidratación, metas). */
export const SECTIONS: Record<
  ReviewKey,
  { fields: FieldSpec[]; single?: boolean }
> = {
  validity: { fields: [{ key: "issuedAt", kind: "date" }], single: true },
  restricted: { fields: [{ key: "name", kind: "text" }] },
  red: { fields: [{ key: "name", kind: "text" }] },
  additives: {
    fields: [
      { key: "code", kind: "text" },
      { key: "name", kind: "text" },
      { key: "foundIn", kind: "text", optional: true },
    ],
  },
  alsoAvoid: { fields: [{ key: "name", kind: "text" }] },
  green: {
    fields: [
      { key: "name", kind: "text" },
      { key: "portion", kind: "text" },
      { key: "items", kind: "list" },
    ],
  },
  yellow: {
    fields: [
      { key: "name", kind: "text" },
      { key: "limit", kind: "text" },
    ],
  },
  equivalences: {
    fields: [
      { key: "whenMissing", kind: "text" },
      { key: "title", kind: "text" },
      { key: "uses", kind: "list" },
    ],
  },
  supplements: {
    fields: [
      { key: "name", kind: "text" },
      { key: "days", kind: "days" },
      { key: "dose", kind: "text" },
      { key: "when", kind: "text" },
    ],
  },
  menu: {
    fields: [
      { key: "name", kind: "text" },
      { key: "start", kind: "time" },
      { key: "end", kind: "time" },
      { key: "content", kind: "text" },
    ],
  },
  hydration: {
    fields: [
      { key: "min", kind: "number" },
      { key: "max", kind: "number" },
      { key: "habit", kind: "text" },
    ],
    single: true,
  },
  goals: {
    fields: [
      { key: "activity", kind: "text", optional: true },
      { key: "sleep", kind: "text", optional: true },
    ],
    single: true,
  },
};

export const WEEKDAYS: Weekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export type Values = Record<string, string>;
export type Row = { id: string; values: Values };

const es = (t: LocalizedText | undefined) => t?.es ?? "";
const SINGLE = "single";

const listText = (items: { name: LocalizedText }[]) =>
  items.map((i) => es(i.name)).join(", ");

/** El id del alimento al que apunta una equivalencia, mostrado como su nombre. */
function nameOfFood(state: ReviewState, id: string): string {
  const pool: DraftItem[] = [
    ...state.draft.restricted,
    ...state.red,
    ...state.draft.yellow,
    ...state.draft.green.flatMap((g) => [g, ...g.items]),
  ];
  const hit = pool.find((p) => p.id === id);
  return hit ? es(hit.name) : id;
}

function idOfFood(state: ReviewState, name: string): string {
  const pool: DraftItem[] = [
    ...state.draft.restricted,
    ...state.red,
    ...state.draft.yellow,
    ...state.draft.green.flatMap((g) => [g, ...g.items]),
  ];
  const clean = name.trim().toLowerCase();
  const hit = pool.find((p) => es(p.name).toLowerCase() === clean);
  return hit ? hit.id : slug(name);
}

/** Las filas de una sección, ya como texto editable. */
export function rowsOf(state: ReviewState, key: ReviewKey): Row[] {
  const d = state.draft;
  switch (key) {
    case "validity":
      return d.issuedAt
        ? [{ id: SINGLE, values: { issuedAt: d.issuedAt } }]
        : [];
    case "restricted":
    case "red":
    case "alsoAvoid": {
      const list =
        key === "restricted"
          ? d.restricted
          : key === "red"
            ? state.red
            : d.alsoAvoid;
      return list.map((i) => ({ id: i.id, values: { name: es(i.name) } }));
    }
    case "additives":
      return d.additives.map((a) => ({
        id: a.code,
        values: { code: a.code, name: es(a.name), foundIn: es(a.foundIn) },
      }));
    case "green":
      return d.green.map((g) => ({
        id: g.id,
        values: {
          name: es(g.name),
          portion: es(g.portion),
          items: listText(g.items),
        },
      }));
    case "yellow":
      return d.yellow.map((y) => ({
        id: y.id,
        values: { name: es(y.name), limit: es(y.limit) },
      }));
    case "equivalences":
      return d.equivalences.map((e) => ({
        id: e.whenMissing,
        values: {
          whenMissing: nameOfFood(state, e.whenMissing),
          title: es(e.title),
          uses: listText(e.use),
        },
      }));
    case "supplements":
      return d.supplements.map((s) => ({
        id: s.id,
        values: {
          name: es(s.name),
          days: s.days.join(","),
          dose: es(s.dose),
          when: es(s.when),
        },
      }));
    case "menu":
      return d.menu.map((m) => ({
        id: m.id,
        values: {
          name: es(m.name),
          start: m.start,
          end: m.end,
          content: es(m.content),
        },
      }));
    case "hydration":
      return d.hydration
        ? [
            {
              id: SINGLE,
              values: {
                min: String(d.hydration.targetLitersMin),
                max: String(d.hydration.targetLitersMax),
                habit: es(d.hydration.habit),
              },
            },
          ]
        : [];
    case "goals": {
      const { activity, sleep } = d.goals;
      return activity || sleep
        ? [
            {
              id: SINGLE,
              values: { activity: es(activity), sleep: es(sleep) },
            },
          ]
        : [];
    }
  }
}

export const hasContent = (state: ReviewState, key: ReviewKey) =>
  rowsOf(state, key).length > 0;

/** Página del PDF de un dato (o de la sección); `undefined` si lo añadió quien cuida. */
export function pageOf(
  state: ReviewState,
  key: ReviewKey,
  id?: string,
): number | undefined {
  if (key === "red") return undefined;
  const k = key;
  return (
    (id && id !== SINGLE ? state.pages[`${k}.${id}`] : undefined) ??
    state.pages[k]
  );
}

/** ¿El lector no encontró nada de esta sección? (para el mensaje «complétala a mano»). */
export function wasUnrecognized(state: ReviewState, key: ReviewKey): boolean {
  return key === "red" ? false : state.unrecognized.includes(key as SectionKey);
}

// ───────────────────────── validación y escritura ─────────────────────────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const parseNumber = (s: string): number =>
  Number(s.trim().replace(",", "."));

const csv = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Campos con error (vacío si la fila es válida). */
export function validateValues(key: ReviewKey, values: Values): string[] {
  const bad: string[] = [];
  for (const f of SECTIONS[key].fields) {
    const v = (values[f.key] ?? "").trim();
    if (!v) {
      if (!f.optional) bad.push(f.key);
      continue;
    }
    if (f.kind === "time" && !TIME.test(v)) bad.push(f.key);
    if (f.kind === "date" && !DATE.test(v)) bad.push(f.key);
    if (f.kind === "number" && !(parseNumber(v) > 0)) bad.push(f.key);
    if (f.kind === "list" && csv(v).length === 0) bad.push(f.key);
    if (
      f.kind === "days" &&
      !v.split(",").every((d) => WEEKDAYS.includes(d as Weekday))
    )
      bad.push(f.key);
  }
  if (
    key === "additives" &&
    !/^E\d+$/.test((values.code ?? "").trim().toUpperCase())
  )
    bad.push("code");
  if (key === "menu" && !bad.includes("start") && !bad.includes("end")) {
    if ((values.end ?? "") < (values.start ?? "")) bad.push("end");
  }
  if (key === "hydration" && !bad.includes("min") && !bad.includes("max")) {
    if (parseNumber(values.max) < parseNumber(values.min)) bad.push("max");
  }
  return bad;
}

function uniqueId(base: string, taken: string[]): string {
  const root = base || "item";
  let id = root;
  for (let n = 2; taken.includes(id); n++) id = `${root}-${n}`;
  return id;
}

/**
 * El texto del plan va igual a los dos idiomas; si quien cuida no lo cambió, se conserva
 * el original (los textos que la app puso en {es, en} no se pisan al confirmar).
 */
const t = (s: string | undefined, old?: LocalizedText): LocalizedText => {
  const text = (s ?? "").trim();
  return old && old.es === text ? old : same(text);
};
const optText = (s: string | undefined, old?: LocalizedText) =>
  (s ?? "").trim() ? t(s, old) : undefined;

const withMark = (s: ReviewState, key: ReviewKey): ReviewState => ({
  ...s,
  marks: { ...s.marks, [key]: "corrected" },
});

/**
 * Guarda una fila (`id` null = añadir). Devuelve el estado nuevo o los campos con error.
 * Editar o añadir deja la sección «corregida».
 */
export function upsertRow(
  state: ReviewState,
  key: ReviewKey,
  id: string | null,
  values: Values,
): { ok: true; state: ReviewState } | { ok: false; bad: string[] } {
  const bad = validateValues(key, values);
  if (bad.length) return { ok: false, bad };
  const d = state.draft;
  const v = (k: string) => (values[k] ?? "").trim();
  const replace = <T extends { id: string }>(
    list: T[],
    make: (newId: string) => T,
    base: string,
  ): T[] => {
    if (id !== null) return list.map((x) => (x.id === id ? make(id) : x));
    return [
      ...list,
      make(
        uniqueId(
          base,
          list.map((x) => x.id),
        ),
      ),
    ];
  };
  let next: ReviewState = state;
  switch (key) {
    case "validity":
      next = { ...state, draft: { ...d, issuedAt: v("issuedAt") } };
      break;
    case "restricted":
      next = {
        ...state,
        draft: {
          ...d,
          restricted: replace(
            d.restricted,
            (i) => ({
              id: i,
              name: t(v("name"), d.restricted.find((x) => x.id === i)?.name),
            }),
            slug(v("name")),
          ),
        },
      };
      break;
    case "red":
      next = {
        ...state,
        red: replace(
          state.red,
          (i) => ({
            id: i,
            name: t(v("name"), state.red.find((x) => x.id === i)?.name),
          }),
          slug(v("name")),
        ),
      };
      break;
    case "alsoAvoid":
      next = {
        ...state,
        draft: {
          ...d,
          alsoAvoid: replace(
            d.alsoAvoid,
            (i) => ({
              id: i,
              name: t(v("name"), d.alsoAvoid.find((x) => x.id === i)?.name),
            }),
            slug(v("name")),
          ),
        },
      };
      break;
    case "additives": {
      const code = v("code").toUpperCase();
      const prev = d.additives.find((a) => a.code === (id ?? code));
      const row: DraftAdditive = {
        code,
        name: t(v("name"), prev?.name),
        ...(v("foundIn") ? { foundIn: t(v("foundIn"), prev?.foundIn) } : {}),
      };
      const exists = d.additives.some((a) => a.code === (id ?? code));
      next = {
        ...state,
        draft: {
          ...d,
          additives: exists
            ? d.additives.map((a) => (a.code === (id ?? code) ? row : a))
            : [...d.additives, row],
        },
      };
      break;
    }
    case "green":
      next = {
        ...state,
        draft: {
          ...d,
          green: replace(
            d.green,
            (i) => {
              const prev = d.green.find((g) => g.id === i);
              const old = prev?.items ?? [];
              const items = csv(v("items")).map((name) => {
                const kept = old.find((o) => es(o.name) === name);
                return kept ?? { id: slug(name), name: t(name) };
              });
              return {
                id: i,
                name: t(v("name"), prev?.name),
                portion: t(v("portion"), prev?.portion),
                items,
              };
            },
            slug(v("name")),
          ),
        },
      };
      break;
    case "yellow":
      next = {
        ...state,
        draft: {
          ...d,
          yellow: replace(
            d.yellow,
            (i) => {
              const prev = d.yellow.find((x) => x.id === i);
              return {
                id: i,
                name: t(v("name"), prev?.name),
                limit: t(v("limit"), prev?.limit),
              };
            },
            slug(v("name")),
          ),
        },
      };
      break;
    case "equivalences": {
      const whenMissing = idOfFood(state, v("whenMissing"));
      const prev = d.equivalences.find(
        (e) => e.whenMissing === (id ?? whenMissing),
      );
      const old = prev?.use ?? [];
      const row = {
        whenMissing,
        title: t(v("title"), prev?.title),
        use: csv(v("uses")).map((name) => {
          const kept = old.find((o) => es(o.name) === name);
          return kept ?? { name: t(name) };
        }),
      };
      const exists = d.equivalences.some(
        (e) => e.whenMissing === (id ?? whenMissing),
      );
      next = {
        ...state,
        draft: {
          ...d,
          equivalences: exists
            ? d.equivalences.map((e) =>
                e.whenMissing === (id ?? whenMissing) ? row : e,
              )
            : [...d.equivalences, row],
        },
      };
      break;
    }
    case "supplements":
      next = {
        ...state,
        draft: {
          ...d,
          supplements: replace(
            d.supplements,
            (i) => {
              const prev = d.supplements.find((x) => x.id === i);
              return {
                id: i,
                name: t(v("name"), prev?.name),
                days: v("days").split(",") as Weekday[],
                dose: t(v("dose"), prev?.dose),
                when: t(v("when"), prev?.when),
              };
            },
            slug(v("name")),
          ),
        },
      };
      break;
    case "menu":
      next = {
        ...state,
        draft: {
          ...d,
          menu: replace(
            d.menu,
            (i) => {
              const prev = d.menu.find((x) => x.id === i);
              return {
                id: i,
                name: t(v("name"), prev?.name),
                start: v("start"),
                end: v("end"),
                content: t(v("content"), prev?.content),
              };
            },
            `${slug(v("name"))}-${v("start").replace(":", "")}`,
          ),
        },
      };
      break;
    case "hydration":
      next = {
        ...state,
        draft: {
          ...d,
          hydration: {
            ...d.hydration,
            targetLitersMin: parseNumber(v("min")),
            targetLitersMax: parseNumber(v("max")),
            habit: t(v("habit"), d.hydration?.habit),
          },
        },
      };
      break;
    case "goals":
      next = {
        ...state,
        draft: {
          ...d,
          goals: {
            ...(optText(values.activity, d.goals.activity)
              ? { activity: optText(values.activity, d.goals.activity) }
              : {}),
            ...(optText(values.sleep, d.goals.sleep)
              ? { sleep: optText(values.sleep, d.goals.sleep) }
              : {}),
          },
        },
      };
      break;
  }
  return { ok: true, state: withMark(next, key) };
}

/** Quita una fila; la sección queda «corregida». */
export function removeRow(
  state: ReviewState,
  key: ReviewKey,
  id: string,
): ReviewState {
  const d = state.draft;
  const not = <T extends { id: string }>(l: T[]) =>
    l.filter((x) => x.id !== id);
  let next: ReviewState = state;
  switch (key) {
    case "validity": {
      const { issuedAt: _gone, ...rest } = d;
      void _gone;
      next = { ...state, draft: rest };
      break;
    }
    case "restricted":
      next = { ...state, draft: { ...d, restricted: not(d.restricted) } };
      break;
    case "red":
      next = { ...state, red: not(state.red) };
      break;
    case "alsoAvoid":
      next = { ...state, draft: { ...d, alsoAvoid: not(d.alsoAvoid) } };
      break;
    case "additives":
      next = {
        ...state,
        draft: { ...d, additives: d.additives.filter((a) => a.code !== id) },
      };
      break;
    case "green":
      next = { ...state, draft: { ...d, green: not(d.green) } };
      break;
    case "yellow":
      next = { ...state, draft: { ...d, yellow: not(d.yellow) } };
      break;
    case "equivalences":
      next = {
        ...state,
        draft: {
          ...d,
          equivalences: d.equivalences.filter((e) => e.whenMissing !== id),
        },
      };
      break;
    case "supplements":
      next = { ...state, draft: { ...d, supplements: not(d.supplements) } };
      break;
    case "menu":
      next = { ...state, draft: { ...d, menu: not(d.menu) } };
      break;
    case "hydration": {
      const { hydration: _gone, ...rest } = d;
      void _gone;
      next = { ...state, draft: rest };
      break;
    }
    case "goals":
      next = { ...state, draft: { ...d, goals: {} } };
      break;
  }
  return withMark(next, key);
}

export type MarkResult =
  | { ok: true; state: ReviewState }
  | { ok: false; reason: "required" | "empty" };

/**
 * «Está bien» pide que haya algo que confirmar; «mi plan no lo trae» pide que no haya
 * nada (si lo hay, se quita primero) y no existe para verde, menú ni hidratación.
 */
export function markSection(
  state: ReviewState,
  key: ReviewKey,
  mark: "ok" | "absent",
): MarkResult {
  const has = hasContent(state, key);
  if (mark === "ok" && !has) return { ok: false, reason: "empty" };
  if (mark === "absent") {
    if (REQUIRED_KEYS.includes(key)) return { ok: false, reason: "required" };
    if (has) return { ok: false, reason: "empty" };
  }
  return {
    ok: true,
    state: {
      ...state,
      // Confirmar tras corregir no borra la huella de que se corrigió.
      marks: {
        ...state.marks,
        [key]:
          mark === "ok" && state.marks[key] === "corrected"
            ? "corrected"
            : mark,
      },
    },
  };
}

/** Por qué no se puede marcar «mi plan no lo trae» (null = sí se puede). */
export function absentBlock(
  state: ReviewState,
  key: ReviewKey,
): "required" | "has-content" | null {
  if (REQUIRED_KEYS.includes(key)) return "required";
  return hasContent(state, key) ? "has-content" : null;
}

export const pendingKeys = (state: ReviewState): ReviewKey[] =>
  REVIEW_KEYS.filter((k) => state.marks[k] === "pending");

/** Lista para guardar: todo revisado y lo obligatorio con contenido. */
export function isComplete(state: ReviewState): boolean {
  return (
    pendingKeys(state).length === 0 &&
    REQUIRED_KEYS.every((k) => hasContent(state, k))
  );
}

/** El plan v2 validado, o por qué no se pudo armar. */
export function buildPlan(state: ReviewState): ParseDietResult {
  return assembleDietPlan(
    state.draft,
    state.pages,
    new Date(state.readAt),
    state.red,
  );
}

// ───────────────────────── borrador guardado ─────────────────────────

/** Parseo defensivo del borrador guardado: lo malformado se descarta (nunca se arregla). */
export function parseReviewState(raw: string | null): ReviewState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<ReviewState> | null;
    if (
      !s ||
      s.v !== 1 ||
      typeof s.readAt !== "string" ||
      Number.isNaN(new Date(s.readAt).getTime()) ||
      !s.draft ||
      !Array.isArray(s.draft.restricted) ||
      !Array.isArray(s.draft.additives) ||
      !Array.isArray(s.draft.alsoAvoid) ||
      !Array.isArray(s.draft.green) ||
      !Array.isArray(s.draft.yellow) ||
      !Array.isArray(s.draft.equivalences) ||
      !Array.isArray(s.draft.supplements) ||
      !Array.isArray(s.draft.menu) ||
      !Array.isArray(s.draft.restrictedNotes) ||
      typeof s.draft.goals !== "object" ||
      !s.pages ||
      typeof s.pages !== "object" ||
      !Array.isArray(s.red) ||
      !Array.isArray(s.unrecognized) ||
      !s.marks ||
      !REVIEW_KEYS.every((k) =>
        ["pending", "ok", "corrected", "absent"].includes(
          (s.marks as Record<string, string>)[k],
        ),
      )
    )
      return null;
    return s as ReviewState;
  } catch {
    return null;
  }
}
