import { z } from "zod";

import { NOTE_CHIPS, NOTE_TEXT_MAX } from "@/lib/diet/day-log";
import { NOTE_KINDS, PROFILE_NOTE_MAX } from "@/lib/diet/profile-notes";
import { textureSchema } from "@/lib/diet/schema";

import { aadFor, open, recordId, seal, type FamilyKeys } from "./crypto";

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
export const DEVICE_NAME_MAX = 30;

const stamp = {
  t: z.number().int().nonnegative(),
  by: z.string().min(1).max(24),
};
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

export const daySchema = z.object({
  marks: z.record(checkId, reg(markValue)),
  notes: z.record(checkId, reg(dayNoteValue)),
});
export const profileSchema = z.object({
  textures: reg(z.array(textureSchema)).optional(),
  notes: z.record(z.string().min(1).max(40), reg(profileNoteValue)),
});
/** El plan entero; su forma la valida `dietPlanSchema` al aplicarlo. */
export const planSchema = z.object({ ...stamp, diet: z.unknown() });
export const deviceSchema = z.object({
  id: z.string().min(1).max(24),
  name: z.string().trim().min(1).max(DEVICE_NAME_MAX),
  /** Última vez que este teléfono sincronizó (ms). */
  seen: z.number().int().nonnegative(),
  /** Consentimiento: fecha (YYYY-MM-DD) en que quien usa este teléfono aceptó compartir. */
  consent: z.string().regex(DATE),
});

export type DayShared = z.infer<typeof daySchema>;
export type ProfileShared = z.infer<typeof profileSchema>;
export type PlanShared = z.infer<typeof planSchema>;
export type DeviceShared = z.infer<typeof deviceSchema>;

export type Named =
  | { name: "plan"; data: PlanShared }
  | { name: "profile"; data: ProfileShared }
  | { name: `day:${string}`; data: DayShared }
  | { name: `device:${string}`; data: DeviceShared };

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
