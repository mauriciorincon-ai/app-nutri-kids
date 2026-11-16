import { getDeviceId } from "@/lib/device";
import { mergeMap, type Reg, type RegMap } from "@/lib/family/merge";

import { clockLabel, dateKey } from "./logic";

/**
 * Registro del día por fecha (clave YYYY-MM-DD, día local del dispositivo).
 * Amanece vacío cada día SIN borrar el historial de días anteriores.
 *
 * Sprint 003 — schema v2: cada marca guarda la HORA REAL a la que se hizo, y
 * cada comida puede llevar una NOTA corta (chips + texto). Ids de marca:
 * "meal:<id>" · "supplement:<id>" · "water:<n>" (ver logic.buildDayChecklist).
 *
 * Sprint 007 — schema v3: cada marca y cada nota lleva su SELLO {t, by, v} (hora de
 * escritura, teléfono, valor) y quitar algo deja una LÁPIDA (`v: null`), para que dos
 * teléfonos de la familia puedan mezclar su día sin pisarse ni resucitar lo quitado
 * (ADR-011). La lectura pública sigue siendo la misma de siempre, sin sellos, más `by`.
 *
 * PRIVACIDAD (regla dura 6 · ADR-007 · ADR-011): el registro son datos de salud de un
 * menor. Vive en el dispositivo y jamás va al repo ni al grounding del chat. Solo sale
 * si la familia lo comparte, y entonces únicamente CIFRADO en el aparato (src/lib/family):
 * este módulo no toca la red. "Borrar datos" lo incluye. Nada del registro se loguea
 * (la UI emite eventos solo-metadatos, jamás el texto).
 */

/** Clave del store ACTIVO (v3). Los tests la usan; la migración lee la v2 y la v1. */
export const DAY_LOG_KEY = "nutrikids.daylog.v3";
export const DAY_LOG_KEY_V2 = "nutrikids.daylog.v2";
const DAY_LOG_KEY_V1 = "nutrikids.daylog.v1";

/** Chips de nota — vocabulario cerrado, sin culpa (un registro nunca reprocha). */
export const NOTE_CHIPS = ["rejected", "pain", "craving", "other"] as const;
export type NoteChip = (typeof NOTE_CHIPS)[number];

/** Tope del texto libre de una nota. Exportado: la UI limita con el MISMO valor. */
export const NOTE_TEXT_MAX = 140;

/** Formas válidas para el saneamiento fail-safe (un store corrupto no debe llegar a Intl). */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM" 24h
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // clave de día YYYY-MM-DD

export type DayNote = { chips: NoteChip[]; text: string };
/** `at`: hora local "HH:MM" a la que se marcó; null = hora desconocida (migrada de v1). */
export type MarkValue = { at: string | null };
/** Lo que se lee: la marca y quién la hizo (`by` = id del teléfono; puede faltar). */
export type DayMark = { at: string | null; by?: string };
export type DayRecord = {
  marks: Record<string, DayMark>;
  notes: Record<string, DayNote>;
};

/** Lo que se guarda y se comparte: marcas y notas con sello y lápidas. */
export type DayRegs = {
  marks: RegMap<MarkValue>;
  notes: RegMap<DayNote>;
};
type DayLogStore = Record<string, DayRegs>;

function storage(): Storage | null {
  // El getter `window.localStorage` LANZA si el almacenamiento está bloqueado
  // (cookies deshabilitadas, modo privado antiguo) — no debe tumbar el render.
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function emptyRegs(): DayRegs {
  return { marks: {}, notes: {} };
}

function isChip(v: unknown): v is NoteChip {
  return typeof v === "string" && (NOTE_CHIPS as readonly string[]).includes(v);
}

const obj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function coerceMarkValue(raw: unknown): MarkValue {
  const rawAt =
    obj(raw) && typeof raw.at === "string" ? (raw.at as string) : null;
  // Un `at` con formato basura degrada a null (hora desconocida), jamás llega
  // a Intl.format — sigue siendo una marca válida, solo sin hora fiable.
  return { at: rawAt && TIME_RE.test(rawAt) ? rawAt : null };
}

/** null = no es una nota (vacía o de otra forma): se descarta. */
function coerceNoteValue(raw: unknown): DayNote | null {
  if (!obj(raw)) return null;
  const chips = Array.isArray(raw.chips) ? raw.chips.filter(isChip) : [];
  // Re-truncamos al LEER: un store manipulado con megabytes no revienta la UI.
  const text = (typeof raw.text === "string" ? raw.text : "").slice(
    0,
    NOTE_TEXT_MAX,
  );
  return chips.length || text ? { chips, text } : null;
}

/** Sello válido de un registro leído, o null si no lo es. */
function coerceStamp(raw: unknown): { t: number; by: string } | null {
  if (!obj(raw)) return null;
  const { t, by } = raw;
  if (typeof t !== "number" || !Number.isInteger(t) || t < 0) return null;
  if (typeof by !== "string" || by.length < 1 || by.length > 24) return null;
  return { t, by };
}

function coerceRegs(value: unknown): DayRegs {
  const regs = emptyRegs();
  if (!obj(value)) return regs;
  if (obj(value.marks)) {
    for (const [checkId, raw] of Object.entries(value.marks)) {
      const st = coerceStamp(raw);
      if (!st) continue;
      const v = (raw as { v?: unknown }).v;
      regs.marks[checkId] = {
        ...st,
        v: v === null || v === undefined ? null : coerceMarkValue(v),
      };
    }
  }
  if (obj(value.notes)) {
    for (const [checkId, raw] of Object.entries(value.notes)) {
      const st = coerceStamp(raw);
      if (!st) continue;
      const v = (raw as { v?: unknown }).v;
      const note = v === null || v === undefined ? null : coerceNoteValue(v);
      regs.notes[checkId] = { ...st, v: note };
    }
  }
  return regs;
}

function coerceStore(parsed: unknown): DayLogStore {
  if (!obj(parsed)) return {};
  const store: DayLogStore = {};
  for (const [key, value] of Object.entries(parsed)) {
    // Descarta claves de día basura: `formatShortDate` haría Invalid Date → Intl lanza.
    if (!DATE_RE.test(key)) continue;
    store[key] = coerceRegs(value);
  }
  return store;
}

/**
 * Migra la v2 (`Record<fecha, {marks, notes}>` sin sellos) a v3: todo lo que ya había queda
 * sellado con t = 0 y ESTE teléfono, así cualquier cambio posterior de cualquiera le gana.
 */
function migrateV2(raw: string): DayLogStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!obj(parsed)) return {};
  const by = getDeviceId();
  const store: DayLogStore = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!DATE_RE.test(key)) continue;
    const regs = emptyRegs();
    if (obj(value)) {
      if (obj(value.marks))
        for (const [checkId, mark] of Object.entries(value.marks))
          regs.marks[checkId] = { t: 0, by, v: coerceMarkValue(mark) };
      if (obj(value.notes))
        for (const [checkId, raw] of Object.entries(value.notes)) {
          const note = coerceNoteValue(raw);
          if (note) regs.notes[checkId] = { t: 0, by, v: note };
        }
    }
    store[key] = regs;
  }
  return store;
}

/** Migra el store v1 (`Record<fecha, string[]>`): marcas con hora desconocida, ya en v3. */
function migrateV1(raw: string): DayLogStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {}; // v1 corrupto ⇒ empezar fresco (el historial no es crítico)
  }
  if (!obj(parsed)) return {};
  const by = getDeviceId();
  const store: DayLogStore = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!DATE_RE.test(key)) continue; // clave de día basura → se descarta
    const regs = emptyRegs();
    if (Array.isArray(value)) {
      for (const checkId of value) {
        if (typeof checkId === "string")
          regs.marks[checkId] = { t: 0, by, v: { at: null } };
      }
    }
    store[key] = regs;
  }
  return store;
}

/**
 * Lee el store. Si solo existe una versión vieja (v2, o la v1), la MIGRA a v3, escribe la v3 y
 * elimina la vieja — una sola fuente de verdad tras la migración. Si la v3 existe, manda ella.
 */
function readStore(): DayLogStore {
  const s = storage();
  if (!s) return {};

  const rawV3 = s.getItem(DAY_LOG_KEY);
  if (rawV3 != null) {
    try {
      return coerceStore(JSON.parse(rawV3));
    } catch {
      return {}; // v3 corrupto ⇒ fresco (fail-safe, consistente con la dieta)
    }
  }

  for (const [key, migrate] of [
    [DAY_LOG_KEY_V2, migrateV2],
    [DAY_LOG_KEY_V1, migrateV1],
  ] as const) {
    const raw = s.getItem(key);
    if (raw == null) continue;
    const migrated = migrate(raw);
    // Solo borramos lo viejo si la v3 QUEDÓ escrita. Si el storage está lleno
    // (QuotaExceededError), devolvemos la v3 en memoria y dejamos lo viejo intacto
    // para reintentar — jamás lanzamos: readStore corre dentro del render.
    if (writeStore(migrated)) {
      s.removeItem(DAY_LOG_KEY_V2);
      s.removeItem(DAY_LOG_KEY_V1);
    }
    return migrated;
  }

  return {};
}

/** Persiste el store. Devuelve false si el storage rechazó la escritura (quota/bloqueo). */
function writeStore(store: DayLogStore): boolean {
  try {
    storage()?.setItem(DAY_LOG_KEY, JSON.stringify(store));
    return true;
  } catch {
    // Quota llena o storage bloqueado: la escritura no persiste, pero la copia
    // en memoria del llamador sigue siendo válida y el render no se cae.
    return false;
  }
}

/** Lo vivo de un día, sin lápidas ni sellos (con `by` para decir «por quién»). */
function toRecord(regs: DayRegs): DayRecord {
  const record: DayRecord = { marks: {}, notes: {} };
  for (const [id, r] of Object.entries(regs.marks))
    if (r.v) record.marks[id] = { at: r.v.at, by: r.by };
  for (const [id, r] of Object.entries(regs.notes))
    if (r.v) record.notes[id] = { chips: r.v.chips, text: r.v.text };
  return record;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** Registro completo del día (marcas con hora + notas). Amanece vacío. */
export function getDayRecord(date: Date): DayRecord {
  const regs = readStore()[dateKey(date)];
  return regs ? toRecord(regs) : { marks: {}, notes: {} };
}

/** Marcas hechas del día (checkIds) — compatibilidad con logic.buildDayChecklist. */
export function getDoneIds(date: Date): string[] {
  return Object.keys(getDayRecord(date).marks);
}

/** Hora "HH:MM" a la que se marcó un ítem, o null (no marcado / hora desconocida). */
export function getMarkTime(date: Date, checkId: string): string | null {
  return getDayRecord(date).marks[checkId]?.at ?? null;
}

/** Nota de una comida, o null si no tiene. */
export function getNote(date: Date, checkId: string): DayNote | null {
  return getDayRecord(date).notes[checkId] ?? null;
}

export type RecordedDay = { day: string; record: DayRecord };

/**
 * Días con algún registro (marca o nota) vivo, del más reciente al más antiguo,
 * leyendo el store UNA sola vez. La usa el historial: evita reparsear el store
 * completo por cada día en el render (O(días) en vez de O(días²)).
 */
export function listRecordedEntries(): RecordedDay[] {
  const store = readStore();
  return Object.entries(store)
    .map(([day, regs]) => ({ day, record: toRecord(regs) }))
    .filter(
      ({ record: r }) =>
        Object.keys(r.marks).length > 0 || Object.keys(r.notes).length > 0,
    )
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/** Días con algún registro, del más reciente al más antiguo (solo las claves). */
export function listRecordedDays(): string[] {
  return listRecordedEntries().map((e) => e.day);
}

/** Un ítem de un día en el historial: su marca (con hora) y/o su nota. */
export type DayEntry = {
  checkId: string;
  at: string | null;
  marked: boolean;
  note: DayNote | null;
  /** Teléfono que hizo la marca. */
  by?: string;
};

/**
 * Ítems de un día (con marca y/o nota) ordenados por hora real; los de hora
 * desconocida van al final. Ordenamiento del dominio (no de la UI): sin el
 * centinela "99:99" — trata `at: null` como "mayor" en el comparador.
 */
export function listDayEntries(record: DayRecord): DayEntry[] {
  const checkIds = [
    ...new Set([...Object.keys(record.marks), ...Object.keys(record.notes)]),
  ];
  return checkIds
    .map((checkId) => ({
      checkId,
      at: record.marks[checkId]?.at ?? null,
      marked: checkId in record.marks,
      note: record.notes[checkId] ?? null,
      by: record.marks[checkId]?.by,
    }))
    .sort((a, b) => {
      if (a.at === b.at) return 0;
      if (a.at === null) return 1; // sin hora → al final
      if (b.at === null) return -1;
      return a.at < b.at ? -1 : 1;
    });
}

// ---------------------------------------------------------------------------
// Para la familia (sincronización): leer y mezclar los registros con sello
// ---------------------------------------------------------------------------

/** Todos los días con sus registros sellados (incluye lápidas). Solo lo usa la sincronización. */
export function readDayRegs(): DayLogStore {
  return readStore();
}

/**
 * Mezcla un día que llegó de otro teléfono con el de este (gana el sello más reciente en
 * cada marca y cada nota). Devuelve true si algo cambió aquí.
 */
export function mergeRemoteDay(day: string, remote: DayRegs): boolean {
  if (!DATE_RE.test(day)) return false;
  const store = readStore();
  const local = store[day] ?? emptyRegs();
  const merged: DayRegs = {
    marks: mergeMap(local.marks, remote.marks),
    notes: mergeMap(local.notes, remote.notes),
  };
  if (JSON.stringify(merged) === JSON.stringify(local)) return false;
  store[day] = merged;
  return writeStore(store);
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/** Hora de escritura de un registro: nunca menor ni igual que la del anterior (aunque el reloj retroceda). */
function nextStamp<T>(prev: Reg<T> | undefined): { t: number; by: string } {
  return { t: Math.max(Date.now(), (prev?.t ?? 0) + 1), by: getDeviceId() };
}

function mutateDay(date: Date, fn: (r: DayRegs) => void): DayRecord {
  const store = readStore();
  const key = dateKey(date);
  const regs = store[key] ?? emptyRegs();
  fn(regs);
  store[key] = regs;
  writeStore(store);
  return toRecord(regs);
}

/** Marca un ítem con la hora indicada ("HH:MM" o null). Idempotente. */
export function markDone(
  date: Date,
  checkId: string,
  at: string | null,
): string[] {
  const record = mutateDay(date, (r) => {
    r.marks[checkId] = { ...nextStamp(r.marks[checkId]), v: { at } };
  });
  return Object.keys(record.marks);
}

/** Desmarca un ítem (lápida; conserva su nota, por si fue un toque accidental). */
export function unmark(date: Date, checkId: string): string[] {
  const record = mutateDay(date, (r) => {
    // Sin marca previa no hay nada que quitar: no se crea una lápida suelta.
    if (r.marks[checkId])
      r.marks[checkId] = { ...nextStamp(r.marks[checkId]), v: null };
  });
  return Object.keys(record.marks);
}

/**
 * Marca/desmarca un ítem. Al marcar guarda la hora real del dispositivo salvo
 * que se pase `at` explícito (tests deterministas / reloj inyectado).
 * Firma compatible con el S1 (`toggleDone(date, checkId)`).
 */
export function toggleDone(
  date: Date,
  checkId: string,
  at?: string | null,
): string[] {
  const current = getDayRecord(date);
  if (current.marks[checkId]) return unmark(date, checkId);
  const stamp = at !== undefined ? at : clockLabel(new Date());
  return markDone(date, checkId, stamp);
}

/** Fija o limpia (null) la nota de una comida. Texto acotado; sin culpa por diseño. */
export function setNote(
  date: Date,
  checkId: string,
  note: DayNote | null,
): void {
  mutateDay(date, (r) => {
    const prev = r.notes[checkId];
    if (note === null || (note.chips.length === 0 && note.text.trim() === "")) {
      if (prev) r.notes[checkId] = { ...nextStamp(prev), v: null };
      return;
    }
    r.notes[checkId] = {
      ...nextStamp(prev),
      v: {
        chips: note.chips.filter(isChip),
        text: note.text.trim().slice(0, NOTE_TEXT_MAX),
      },
    };
  });
}

/** Limpieza total (la usa "borrar datos"): borra el store activo y cualquier versión vieja. */
export function clearDayLog(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(DAY_LOG_KEY);
  s.removeItem(DAY_LOG_KEY_V2);
  s.removeItem(DAY_LOG_KEY_V1);
}
