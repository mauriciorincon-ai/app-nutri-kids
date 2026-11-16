import { z } from "zod";

/**
 * Lo que este teléfono recuerda de su familia, sin secretos: el código, la época, hasta dónde
 * bajó, qué versión vio de cada registro y una huella de lo que el servidor ya tiene de él
 * (para saber qué falta por subir). Las claves NO están aquí: viven en `keystore.ts`, como
 * claves no exportables. La frase no se guarda en ningún lado.
 */

export const FAMILY_STATE_ITEM = "nutrikids.family.v1";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const familyStateSchema = z.object({
  v: z.literal(1),
  family: z.string().regex(/^[0-9A-Z]{10}$/),
  epoch: z.number().int().positive(),
  /** Hasta qué escritura del servidor ya se bajó. */
  since: z.number().int().nonnegative(),
  /** Versión que este teléfono vio de cada registro (para el 409). */
  vers: z.record(z.string(), z.number().int().nonnegative()),
  /** Huella de lo que el servidor tiene de cada registro, tal como lo dejó este teléfono. */
  pushed: z.record(z.string(), z.string()),
  /** Los otros teléfonos de la familia: nombre y última vez que sincronizaron. */
  devices: z.record(
    z.string(),
    z.object({
      name: z.string().max(30),
      seen: z.number().int().nonnegative(),
    }),
  ),
  /** Día (YYYY-MM-DD) en que quien usa este teléfono aceptó compartir. */
  consent: z.string().regex(DATE),
  lastSync: z.number().int().nonnegative(),
  /** Si al mezclar el plan de dos teléfonos quedó el de ellos o el de este. */
  planNotice: z.enum(["theirs", "mine"]).nullable(),
  /** Registros que no se pudieron abrir en la última bajada. */
  unreadable: z.number().int().nonnegative(),
  /** El servidor ya no acepta a este teléfono (lo sacaron o cambió la frase). */
  locked: z.boolean(),
  /** El plan no cabe en lo compartido y se queda solo en este teléfono. */
  planTooBig: z.boolean(),
  /** Registros (días, perfil) que no caben en lo compartido y se quedan solo en este teléfono. */
  oversize: z.number().int().nonnegative().default(0),
});

export type FamilyState = z.infer<typeof familyStateSchema>;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function freshFamilyState(
  family: string,
  epoch: number,
  consent: string,
): FamilyState {
  return {
    v: 1,
    family,
    epoch,
    since: 0,
    vers: {},
    pushed: {},
    devices: {},
    consent,
    lastSync: 0,
    planNotice: null,
    unreadable: 0,
    locked: false,
    planTooBig: false,
    oversize: 0,
  };
}

export function loadFamilyState(): FamilyState | null {
  try {
    const raw = storage()?.getItem(FAMILY_STATE_ITEM);
    if (!raw) return null;
    const parsed = familyStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveFamilyState(state: FamilyState): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(FAMILY_STATE_ITEM, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Olvida el estado de la familia en este teléfono. Las claves (IndexedDB) las borra quien llama
 * con `clearKeys()`, EN ORDEN: un borrado suelto en segundo plano podía caer sobre las claves de
 * una familia nueva.
 */
export function clearFamilyLocal(): void {
  try {
    storage()?.removeItem(FAMILY_STATE_ITEM);
  } catch {
    /* nada */
  }
}
