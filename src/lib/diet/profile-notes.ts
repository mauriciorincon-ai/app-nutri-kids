import { z } from "zod";

import { getDeviceId } from "@/lib/device";
import { mergeMap, mergeReg, type Reg, type RegMap } from "@/lib/family/merge";

import { TEXTURES, textureSchema, type Texture } from "./schema";

/**
 * Lo que QUIEN CUIDA anota del niño en el teléfono (ADR-009, decisión 1 a del
 * G-Plan del S5). Vive en su propia clave, aparte del plan: cargar un plan nuevo
 * no lo toca, y cada dato se muestra como «anotado por quien cuida», nunca como del
 * profesional. Regla dura 6: jamás sale del aparato en claro (ni red, ni logs, ni Sentry,
 * ni export); si la familia comparte, solo viaja CIFRADO en el aparato (src/lib/family,
 * ADR-011). «Borrar datos» lo elimina. Lo que se lee pasa por Zod (regla 4): un dato
 * corrupto se descarta entero, no se adivina.
 *
 * Sprint 007 — v2: cada nota y la lista de texturas llevan sello {t, by, v} y lápida
 * (`v: null`) para mezclarse entre los teléfonos de la familia. La lectura pública es la de siempre.
 */

export const PROFILE_NOTES_KEY = "nutrikids.profile-notes.v2";
export const PROFILE_NOTES_KEY_V1 = "nutrikids.profile-notes.v1";

export const NOTE_KINDS = [
  "condition",
  "allergy",
  "intolerance",
  "medication",
  "other",
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const PROFILE_NOTE_MAX = 140;

const noteSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(NOTE_KINDS),
  text: z.string().trim().min(1).max(PROFILE_NOTE_MAX),
  /** Día en que se anotó (YYYY-MM-DD, fecha local). */
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const storeSchema = z.object({
  acceptedTextures: z.array(textureSchema),
  notes: z.array(noteSchema),
});

/** Una anotación, con el teléfono que la escribió (`by`) para decir «por quién». */
export type ProfileNote = z.infer<typeof noteSchema> & { by?: string };
export type ProfileNotes = {
  acceptedTextures: Texture[];
  notes: ProfileNote[];
};

export const EMPTY_NOTES: ProfileNotes = { acceptedTextures: [], notes: [] };

// --- Lo que se guarda: con sello y lápidas -----------------------------------------------

type NoteValue = Omit<z.infer<typeof noteSchema>, "id">;
export type ProfileRegs = {
  textures?: Reg<Texture[]>;
  notes: RegMap<NoteValue>;
};

const stamp = {
  t: z.number().int().nonnegative(),
  by: z.string().min(1).max(24),
  /** Firma de quien la escribió (familia, S9); se conserva tal cual para volver a compartirla. */
  s: z.string().max(100).optional(),
};
const noteValueSchema = noteSchema.omit({ id: true });
const regsSchema = z.object({
  textures: z
    .object({ ...stamp, v: z.array(textureSchema).nullable() })
    .optional(),
  notes: z.record(
    z.string().min(1).max(40),
    z.object({ ...stamp, v: noteValueSchema.nullable() }),
  ),
});

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

const EMPTY_REGS: ProfileRegs = { notes: {} };

/** v1 (sin sellos) → v2: todo con t = 0 y ESTE teléfono, para que cualquier cambio lo supere. */
function migrateV1(raw: string): ProfileRegs {
  try {
    const parsed = storeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return EMPTY_REGS;
    const by = getDeviceId();
    const regs: ProfileRegs = { notes: {} };
    if (parsed.data.acceptedTextures.length)
      regs.textures = { t: 0, by, v: parsed.data.acceptedTextures };
    for (const { id, ...v } of parsed.data.notes)
      regs.notes[id] = { t: 0, by, v };
    return regs;
  } catch {
    return EMPTY_REGS;
  }
}

/** Lee los registros con sello. Si solo existe la v1, la migra (y borra la v1 si la v2 quedó escrita). */
export function readProfileRegs(): ProfileRegs {
  const s = storage();
  if (!s) return EMPTY_REGS;
  const raw = s.getItem(PROFILE_NOTES_KEY);
  if (raw != null) {
    try {
      const parsed = regsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : EMPTY_REGS;
    } catch {
      return EMPTY_REGS;
    }
  }
  const v1 = s.getItem(PROFILE_NOTES_KEY_V1);
  if (v1 == null) return EMPTY_REGS;
  const migrated = migrateV1(v1);
  if (writeRegs(migrated)) s.removeItem(PROFILE_NOTES_KEY_V1);
  return migrated;
}

function writeRegs(regs: ProfileRegs): boolean {
  try {
    storage()?.setItem(PROFILE_NOTES_KEY, JSON.stringify(regs));
    return true;
  } catch {
    return false;
  }
}

/** Lo vivo, sin sellos ni lápidas: lo de siempre, más `by`. Las notas, de la más vieja a la más nueva. */
export function loadProfileNotes(): ProfileNotes {
  const regs = readProfileRegs();
  const notes = Object.entries(regs.notes)
    .filter(([, r]) => r.v !== null)
    .sort(([ia, a], [ib, b]) => a.t - b.t || (ia < ib ? -1 : ia > ib ? 1 : 0))
    .map(([id, r]) => ({ id, ...r.v!, by: r.by }));
  const acceptedTextures = regs.textures?.v ?? [];
  return notes.length === 0 && acceptedTextures.length === 0
    ? EMPTY_NOTES
    : { acceptedTextures, notes };
}

/** Mezcla lo que llegó de otro teléfono. true = algo cambió aquí. */
export function mergeRemoteProfile(remote: ProfileRegs): boolean {
  const local = readProfileRegs();
  const textures = mergeReg(local.textures, remote.textures);
  const merged: ProfileRegs = {
    ...(textures ? { textures } : {}),
    notes: mergeMap(local.notes, remote.notes),
  };
  if (JSON.stringify(merged) === JSON.stringify(local)) return false;
  return writeRegs(merged);
}

function nextStamp(prevT: number | undefined, now: number): Reg<never> {
  return { t: Math.max(now, (prevT ?? 0) + 1), by: getDeviceId(), v: null };
}

/** Fecha local YYYY-MM-DD (la fecha es perilla: el llamador pasa `now`). */
function dayOf(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Marca o desmarca una textura que el niño hoy acepta. Orden estable de la lista cerrada. */
export function toggleTexture(
  texture: Texture,
  now = Date.now(),
): ProfileNotes {
  const regs = readProfileRegs();
  const set = new Set(regs.textures?.v ?? []);
  if (set.has(texture)) set.delete(texture);
  else set.add(texture);
  const { t, by } = nextStamp(regs.textures?.t, now);
  writeRegs({
    ...regs,
    textures: { t, by, v: TEXTURES.filter((x) => set.has(x)) },
  });
  return loadProfileNotes();
}

/** Agrega una anotación; texto vacío o demasiado largo ⇒ no se guarda (null). */
export function addProfileNote(
  kind: NoteKind,
  text: string,
  now: Date,
): ProfileNotes | null {
  const regs = readProfileRegs();
  const by = getDeviceId();
  const id = `${now.getTime().toString(36)}-${by}`;
  const note = noteSchema.safeParse({ id, kind, text, at: dayOf(now) });
  if (!note.success) return null;
  const { id: noteId, ...v } = note.data;
  const { t } = nextStamp(regs.notes[noteId]?.t, now.getTime());
  writeRegs({ ...regs, notes: { ...regs.notes, [noteId]: { t, by, v } } });
  return loadProfileNotes();
}

export function removeProfileNote(id: string, now = Date.now()): ProfileNotes {
  const regs = readProfileRegs();
  const prev = regs.notes[id];
  if (!prev) return loadProfileNotes();
  const { t, by } = nextStamp(prev.t, now);
  writeRegs({ ...regs, notes: { ...regs.notes, [id]: { t, by, v: null } } });
  return loadProfileNotes();
}

export function clearProfileNotes(): void {
  const s = storage();
  s?.removeItem(PROFILE_NOTES_KEY);
  s?.removeItem(PROFILE_NOTES_KEY_V1);
}
