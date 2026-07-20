import { clockLabel, dateKey } from "./logic";

/**
 * Registro del día por fecha (clave YYYY-MM-DD, día local del dispositivo).
 * Amanece vacío cada día SIN borrar el historial de días anteriores.
 *
 * Sprint 003 — schema v2: cada marca guarda la HORA REAL a la que se hizo, y
 * cada comida puede llevar una NOTA corta (chips + texto). Ids de marca:
 * "meal:<id>" · "supplement:<id>" · "water:<n>" (ver logic.buildDayChecklist).
 *
 * PRIVACIDAD (regla dura 1 · ADR-007): el registro son datos de salud de un
 * menor — vive SOLO en el dispositivo. JAMÁS viaja a red, repo ni al grounding
 * del chat. "Borrar datos" lo incluye. Los logs de este módulo no existen: nada
 * del registro se loguea (la UI emite eventos solo-metadatos, jamás el texto).
 */

/** Clave del store ACTIVO (v2). Los tests la usan; la migración lee la v1. */
export const DAY_LOG_KEY = "nutrikids.daylog.v2";
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
export type DayMark = { at: string | null };
export type DayRecord = {
  marks: Record<string, DayMark>;
  notes: Record<string, DayNote>;
};

type DayLogStore = Record<string, DayRecord>;

function storage(): Storage | null {
  // El getter `window.localStorage` LANZA si el almacenamiento está bloqueado
  // (cookies deshabilitadas, modo privado antiguo) — no debe tumbar el render.
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function emptyRecord(): DayRecord {
  return { marks: {}, notes: {} };
}

function isChip(v: unknown): v is NoteChip {
  return typeof v === "string" && (NOTE_CHIPS as readonly string[]).includes(v);
}

/** Normaliza un valor desconocido a DayRecord (fail-safe ante datos corruptos). */
function coerceRecord(value: unknown): DayRecord {
  const record = emptyRecord();
  if (value === null || typeof value !== "object") return record;
  const obj = value as Record<string, unknown>;

  const marks = obj.marks;
  if (marks && typeof marks === "object" && !Array.isArray(marks)) {
    for (const [checkId, mark] of Object.entries(marks)) {
      const rawAt =
        mark &&
        typeof mark === "object" &&
        typeof (mark as DayMark).at === "string"
          ? (mark as DayMark).at
          : null;
      // Un `at` con formato basura degrada a null (hora desconocida), jamás llega
      // a Intl.format — sigue siendo una marca válida, solo sin hora fiable.
      const at = rawAt && TIME_RE.test(rawAt) ? rawAt : null;
      record.marks[checkId] = { at };
    }
  }

  const notes = obj.notes;
  if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    for (const [checkId, note] of Object.entries(notes)) {
      if (!note || typeof note !== "object") continue;
      const n = note as Partial<DayNote>;
      const chips = Array.isArray(n.chips) ? n.chips.filter(isChip) : [];
      // Re-truncamos al LEER: un store manipulado con megabytes no revienta la UI.
      const text = (typeof n.text === "string" ? n.text : "").slice(
        0,
        NOTE_TEXT_MAX,
      );
      if (chips.length || text) record.notes[checkId] = { chips, text };
    }
  }
  return record;
}

function coerceStore(parsed: unknown): DayLogStore {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return {};
  const store: DayLogStore = {};
  for (const [key, value] of Object.entries(parsed)) {
    // Descarta claves de día basura: `formatShortDate` haría Invalid Date → Intl lanza.
    if (!DATE_RE.test(key)) continue;
    store[key] = coerceRecord(value);
  }
  return store;
}

/** Migra el store v1 (`Record<fecha, string[]>`) a v2: marcas con hora desconocida. */
function migrateV1(raw: string): DayLogStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {}; // v1 corrupto ⇒ empezar fresco (el historial no es crítico)
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return {};
  const store: DayLogStore = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!DATE_RE.test(key)) continue; // clave de día basura → se descarta
    const record = emptyRecord();
    if (Array.isArray(value)) {
      for (const checkId of value) {
        if (typeof checkId === "string") record.marks[checkId] = { at: null };
      }
    }
    store[key] = record;
  }
  return store;
}

/**
 * Lee el store. Si solo existe la v1, la MIGRA a v2 (marcas con `at: null`),
 * escribe la v2 y elimina la v1 — una sola fuente de verdad tras la migración.
 */
function readStore(): DayLogStore {
  const s = storage();
  if (!s) return {};

  const rawV2 = s.getItem(DAY_LOG_KEY);
  if (rawV2 != null) {
    try {
      return coerceStore(JSON.parse(rawV2));
    } catch {
      return {}; // v2 corrupto ⇒ fresco (fail-safe, consistente con la dieta)
    }
  }

  const rawV1 = s.getItem(DAY_LOG_KEY_V1);
  if (rawV1 != null) {
    const migrated = migrateV1(rawV1);
    // Solo borramos la v1 si la v2 QUEDÓ escrita. Si el storage está lleno
    // (QuotaExceededError), devolvemos la v2 en memoria y dejamos la v1 intacta
    // para reintentar — jamás lanzamos: readStore corre dentro del render.
    if (writeStore(migrated)) s.removeItem(DAY_LOG_KEY_V1);
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

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** Registro completo del día (marcas con hora + notas). Amanece vacío. */
export function getDayRecord(date: Date): DayRecord {
  return readStore()[dateKey(date)] ?? emptyRecord();
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
 * Días con algún registro (marca o nota), del más reciente al más antiguo,
 * leyendo el store UNA sola vez. La usa el historial: evita reparsear el store
 * completo por cada día en el render (O(días) en vez de O(días²)).
 */
export function listRecordedEntries(): RecordedDay[] {
  const store = readStore();
  return Object.entries(store)
    .filter(
      ([, r]) =>
        Object.keys(r.marks).length > 0 || Object.keys(r.notes).length > 0,
    )
    .map(([day, record]) => ({ day, record }))
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
    }))
    .sort((a, b) => {
      if (a.at === b.at) return 0;
      if (a.at === null) return 1; // sin hora → al final
      if (b.at === null) return -1;
      return a.at < b.at ? -1 : 1;
    });
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

function mutateDay(date: Date, fn: (r: DayRecord) => void): DayRecord {
  const store = readStore();
  const key = dateKey(date);
  const record = store[key] ?? emptyRecord();
  fn(record);
  store[key] = record;
  writeStore(store);
  return record;
}

/** Marca un ítem con la hora indicada ("HH:MM" o null). Idempotente. */
export function markDone(
  date: Date,
  checkId: string,
  at: string | null,
): string[] {
  const record = mutateDay(date, (r) => {
    r.marks[checkId] = { at };
  });
  return Object.keys(record.marks);
}

/** Desmarca un ítem (conserva su nota, por si fue un toque accidental). */
export function unmark(date: Date, checkId: string): string[] {
  const record = mutateDay(date, (r) => {
    delete r.marks[checkId];
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
    if (note === null || (note.chips.length === 0 && note.text.trim() === "")) {
      delete r.notes[checkId];
      return;
    }
    r.notes[checkId] = {
      chips: note.chips.filter(isChip),
      text: note.text.trim().slice(0, NOTE_TEXT_MAX),
    };
  });
}

/** Limpieza total (la usa "borrar datos"): borra el store activo y cualquier v1 remanente. */
export function clearDayLog(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(DAY_LOG_KEY);
  s.removeItem(DAY_LOG_KEY_V1);
}
