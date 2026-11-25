import { z } from "zod";

import { NOTE_CHIPS, NOTE_TEXT_MAX } from "@/lib/diet/day-log";
import { DEVICE_NAME_MAX } from "@/lib/device";
import { NOTE_KINDS, PROFILE_NOTE_MAX } from "@/lib/diet/profile-notes";
import { textureSchema } from "@/lib/diet/schema";
import {
  AGE_BANDS,
  FOOD_KEY_MAX,
  FOOD_TEXTURES,
  HABIT_MAX_MIN,
  LUNCH_KEY_MAX,
  LUNCH_STATES,
  MAP_CAPS,
  MOODS,
  PRESENTATIONS,
  STAGES,
  SYMPTOMS,
  VERDICTS,
  WELL_NOTE_KEY,
  WELL_NOTE_MAX,
} from "@/lib/wellbeing/values";

import { aadFor, open, recordId, seal, type FamilyKeys } from "./crypto";
import { logSharedSchema } from "./log";
import { rosterSchema } from "./roster";
import { PUB_RE, SIG_RE } from "./sign";
import { pressureSharedSchema } from "@/lib/pressure/shared";

/**
 * Lo que viaja, ANTES de cifrarse (S7 · decisión 2 del G-Plan · ADR-011): el plan, el día
 * (marcas, horas, notas y quién) y el perfil con sus notas, alergias y medicamentos. Cada
 * cosa en su registro. Idioma, tema y el nombre de cada teléfono en su pantalla se quedan
 * en el aparato; el nombre del teléfono SÍ viaja, cifrado, para decir «por Mamá».
 *
 * Lo que llega se valida con Zod (regla 4): un registro que no encaja se descarta entero.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export { DEVICE_NAME_MAX };

const stamp = {
  t: z.number().int().nonnegative(),
  by: z.string().min(1).max(24),
  /** Firma de quien escribió (S9 · ADR-013); sin ella, los demás teléfonos la descartan. */
  s: z.string().regex(SIG_RE).optional(),
};
const sig = z.string().regex(SIG_RE).optional();
const reg = <T extends z.ZodType>(v: T) =>
  z.object({ ...stamp, v: v.nullable() });

export const markValue = z.object({ at: z.string().regex(TIME).nullable() });
export const dayNoteValue = z.object({
  chips: z.array(z.enum(NOTE_CHIPS)).max(NOTE_CHIPS.length),
  text: z.string().max(NOTE_TEXT_MAX),
});
export const profileNoteValue = z.object({
  kind: z.enum(NOTE_KINDS),
  text: z.string().trim().min(1).max(PROFILE_NOTE_MAX),
  at: z.string().regex(DATE),
});

const checkId = z.string().min(1).max(80);

// S10 · bienestar (ADR-015): ids cerrados y minutos; cada mapa con su tope, para que un día
// lleno siga cabiendo en lo compartido.
export const foodValue = z.object({
  stage: z.enum(STAGES),
  verdict: z.enum(VERDICTS).nullable(),
  texture: z.enum(FOOD_TEXTURES).nullable(),
  presentation: z.enum(PRESENTATIONS).nullable(),
  isNew: z.boolean(),
});
const wellKey = z.string().min(1).max(20);
const wellValue = z.string().min(1).max(WELL_NOTE_MAX);
const capped = <T extends z.ZodType>(
  s: z.ZodRecord<z.ZodString, T>,
  max: number,
) => s.refine((m) => Object.keys(m).length <= max, "too many entries");

export const daySchema = z.object({
  marks: z.record(checkId, reg(markValue)),
  notes: z.record(checkId, reg(dayNoteValue)),
  moods: capped(
    z.record(checkId, reg(z.enum(MOODS))),
    MAP_CAPS.moods,
  ).optional(),
  food: capped(
    z.record(z.string().min(1).max(FOOD_KEY_MAX), reg(foodValue)),
    MAP_CAPS.food,
  ).optional(),
  well: capped(z.record(wellKey, reg(wellValue)), MAP_CAPS.well).optional(),
  habits: capped(
    z.record(wellKey, reg(z.number().int().min(0).max(HABIT_MAX_MIN))),
    MAP_CAPS.habits,
  ).optional(),
  // S11 · lonchera (ADR-017): alimento → puesta, comida o volvió.
  lunch: capped(
    z.record(z.string().min(1).max(LUNCH_KEY_MAX), reg(z.enum(LUNCH_STATES))),
    MAP_CAPS.lunch,
  ).optional(),
  // S15 · contexto del día (ADR-021): evento social, fuera de casa, alguien nuevo; solo «sí».
  ctx: capped(
    z.record(wellKey, reg(z.literal(true))),
    MAP_CAPS.ctx,
  ).optional(),
});
export const profileSchema = z.object({
  textures: reg(z.array(textureSchema)).optional(),
  /** Franja de edad que un padre eligió (S10, decisión 1a): jamás una fecha de nacimiento. */
  age: reg(z.enum(AGE_BANDS)).optional(),
  notes: z.record(z.string().min(1).max(40), reg(profileNoteValue)),
});
/** Las claves válidas de «cómo está»: los ocho síntomas y la nota del día. */
export const WELL_KEYS: readonly string[] = [
  ...Object.keys(SYMPTOMS),
  WELL_NOTE_KEY,
];
/** El plan entero; su forma la valida `dietPlanSchema` al aplicarlo. */
export const planSchema = z.object({ ...stamp, diet: z.unknown() });
export const deviceSchema = z.object({
  id: z.string().min(1).max(24),
  name: z.string().trim().min(1).max(DEVICE_NAME_MAX),
  /** Última vez que este teléfono sincronizó (ms). */
  seen: z.number().int().nonnegative(),
  /** Consentimiento: fecha (YYYY-MM-DD) en que quien usa este teléfono aceptó compartir. */
  consent: z.string().regex(DATE),
  /** Llave pública de firma de este teléfono (S9). */
  pub: z.string().regex(PUB_RE).optional(),
  /** Etiqueta de la invitación con la que entró (S9): un padre la confirma con su rol. */
  invite: z
    .string()
    .regex(/^[0-9A-HJKMNP-TV-Z]{4}$/)
    .optional(),
  /** Firma del propio teléfono sobre id, nombre, consentimiento, llave e invitación. */
  s: sig,
});

/**
 * «Avisar a la familia» (S8 · ADR-012): una nota corta de quien cuida, un registro por aviso.
 * Viaja cifrada como todo lo demás; el servidor solo despierta a los otros teléfonos y es el
 * trabajador de cada uno quien la abre.
 */
export const NOTICE_TEXT_MAX = 140;
export const noticeSchema = z.object({
  text: z.string().trim().min(1).max(NOTICE_TEXT_MAX),
  /** Nombre de quien la escribió, tal como lo dice su teléfono. */
  name: z.string().trim().min(1).max(DEVICE_NAME_MAX),
  /** Id del teléfono que la escribió. */
  by: z.string().min(1).max(24),
  /** Cuándo (ms). */
  t: z.number().int().nonnegative(),
  /** Día local (YYYY-MM-DD): «Hoy» muestra solo los de hoy. */
  date: z.string().regex(DATE),
  /** Firma de quien la escribió (S9). */
  s: sig,
});
export const NOTICE_ID = /^[0-9a-z]{6,24}$/;

export type DayShared = z.infer<typeof daySchema>;
export type ProfileShared = z.infer<typeof profileSchema>;
export type PlanShared = z.infer<typeof planSchema>;
export type DeviceShared = z.infer<typeof deviceSchema>;
export type NoticeShared = z.infer<typeof noticeSchema>;
export type { RosterShared } from "./roster";
export type { LogShared } from "./log";

export type Named =
  | { name: "plan"; data: PlanShared }
  | { name: "profile"; data: ProfileShared }
  | { name: `day:${string}`; data: DayShared }
  | { name: `device:${string}`; data: DeviceShared }
  | { name: `notice:${string}`; data: NoticeShared }
  | { name: "roster"; data: z.infer<typeof rosterSchema> }
  | { name: `log:${string}`; data: z.infer<typeof logSharedSchema> }
  // S14 · lo que este teléfono anotó de «cuando le ofrecen algo» (ADR-020).
  | { name: `pressure:${string}`; data: z.infer<typeof pressureSharedSchema> };

/** Tipo que ve el servidor: solo distingue el plan (más grande) del resto. */
export type Kind = "plan" | "item";
export const kindOf = (name: string): Kind =>
  name === "plan" ? "plan" : "item";

export function dayName(date: string): `day:${string}` {
  return `day:${date}`;
}
export function deviceName(id: string): `device:${string}` {
  return `device:${id}`;
}
export function noticeName(id: string): `notice:${string}` {
  return `notice:${id}`;
}
export function logName(id: string): `log:${string}` {
  return `log:${id}`;
}

/** Valida un registro descifrado según su nombre; null si no encaja. */
export function parseNamed(value: unknown): Named | null {
  const env = z.object({ n: z.string(), d: z.unknown() }).safeParse(value);
  if (!env.success) return null;
  const { n, d } = env.data;
  const pick = <S extends z.ZodType>(s: S) => {
    const r = s.safeParse(d);
    return r.success ? r.data : null;
  };
  if (n === "plan") {
    const data = pick(planSchema);
    return data ? { name: "plan", data } : null;
  }
  if (n === "profile") {
    const data = pick(profileSchema);
    return data ? { name: "profile", data } : null;
  }
  if (n.startsWith("day:") && DATE.test(n.slice(4))) {
    const data = pick(daySchema);
    return data ? { name: n as `day:${string}`, data } : null;
  }
  if (n.startsWith("device:")) {
    const data = pick(deviceSchema);
    return data && data.id === n.slice(7)
      ? { name: n as `device:${string}`, data }
      : null;
  }
  if (n.startsWith("notice:") && NOTICE_ID.test(n.slice(7))) {
    const data = pick(noticeSchema);
    return data ? { name: n as `notice:${string}`, data } : null;
  }
  if (n === "roster") {
    const data = pick(rosterSchema);
    return data ? { name: "roster", data } : null;
  }
  if (n.startsWith("log:")) {
    const data = pick(logSharedSchema);
    return data && data.by === n.slice(4)
      ? { name: n as `log:${string}`, data }
      : null;
  }
  if (n.startsWith("pressure:")) {
    const data = pick(pressureSharedSchema);
    return data && data.by === n.slice(9)
      ? { name: n as `pressure:${string}`, data }
      : null;
  }
  return null;
}

/** Registro tal como lo guarda el servidor: nada en claro. */
export type WireRecord = { id: string; kind: Kind; iv: string; ct: string };

export async function sealNamed(
  keys: FamilyKeys,
  familyId: string,
  epoch: number,
  named: Named,
): Promise<WireRecord> {
  const id = await recordId(keys.id, named.name);
  const sealed = await seal(
    keys.enc,
    { n: named.name, d: named.data },
    aadFor(familyId, epoch, id),
  );
  return { id, kind: kindOf(named.name), ...sealed };
}

/**
 * Abre un registro del servidor. null si no descifra (otra clave, otro sitio, alterado),
 * si no encaja en su forma, o si su nombre no corresponde a su id.
 */
export async function openNamed(
  keys: FamilyKeys,
  familyId: string,
  epoch: number,
  wire: WireRecord,
): Promise<Named | null> {
  const value = await open(keys.enc, wire, aadFor(familyId, epoch, wire.id));
  const named = parseNamed(value);
  if (!named) return null;
  if ((await recordId(keys.id, named.name)) !== wire.id) return null;
  if (kindOf(named.name) !== wire.kind) return null;
  return named;
}
