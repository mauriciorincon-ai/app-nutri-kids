import { z } from "zod";

import { TEXTURES, textureSchema, type Texture } from "./schema";

/**
 * Lo que QUIEN CUIDA anota del niño en el teléfono (ADR-009, decisión 1 a del
 * G-Plan del S5). Vive en su propia clave, aparte del plan: cargar un plan nuevo
 * no lo toca, y cada dato se muestra como «anotado por ti», nunca como del
 * profesional. Regla dura 6: jamás sale del aparato (ni red, ni logs, ni Sentry,
 * ni export); «Borrar datos» lo elimina. Lo que se lee pasa por Zod (regla 4):
 * un dato corrupto se descarta entero, no se adivina.
 */

export const PROFILE_NOTES_KEY = "nutrikids.profile-notes.v1";

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

export type ProfileNote = z.infer<typeof noteSchema>;
export type ProfileNotes = z.infer<typeof storeSchema>;

export const EMPTY_NOTES: ProfileNotes = { acceptedTextures: [], notes: [] };

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function loadProfileNotes(): ProfileNotes {
  const raw = storage()?.getItem(PROFILE_NOTES_KEY);
  if (!raw) return EMPTY_NOTES;
  try {
    const parsed = storeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_NOTES;
  } catch {
    return EMPTY_NOTES;
  }
}

function save(next: ProfileNotes): ProfileNotes {
  storage()?.setItem(PROFILE_NOTES_KEY, JSON.stringify(next));
  return next;
}

/** Fecha local YYYY-MM-DD (la fecha es perilla: el llamador pasa `now`). */
function dayOf(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Marca o desmarca una textura que el niño hoy acepta. Orden estable de la lista cerrada. */
export function toggleTexture(texture: Texture): ProfileNotes {
  const cur = loadProfileNotes();
  const set = new Set(cur.acceptedTextures);
  if (set.has(texture)) set.delete(texture);
  else set.add(texture);
  return save({
    ...cur,
    acceptedTextures: TEXTURES.filter((t) => set.has(t)),
  });
}

/** Agrega una anotación; texto vacío o demasiado largo ⇒ no se guarda (null). */
export function addProfileNote(
  kind: NoteKind,
  text: string,
  now: Date,
): ProfileNotes | null {
  const cur = loadProfileNotes();
  const note = noteSchema.safeParse({
    id: `${now.getTime().toString(36)}-${cur.notes.length}`,
    kind,
    text,
    at: dayOf(now),
  });
  if (!note.success) return null;
  return save({ ...cur, notes: [...cur.notes, note.data] });
}

export function removeProfileNote(id: string): ProfileNotes {
  const cur = loadProfileNotes();
  return save({ ...cur, notes: cur.notes.filter((n) => n.id !== id) });
}

export function clearProfileNotes(): void {
  storage()?.removeItem(PROFILE_NOTES_KEY);
}
