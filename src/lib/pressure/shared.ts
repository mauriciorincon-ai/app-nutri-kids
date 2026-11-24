import { z } from "zod";

import { sign, SIG_RE, verify, type Signer } from "@/lib/family/sign";

import {
  PRESSURE_MAX,
  pressureEntrySchema,
  type PressureEntry,
} from "./values";

/**
 * El registro de presión de un teléfono tal como viaja a la familia (S14 · ADR-020), dentro de lo
 * cifrado: `pressure:<id del teléfono>`, con TODAS sus anotaciones firmadas juntas por ese
 * teléfono. Nadie puede escribir en el registro de otro (no tiene su llave). Quién lo LEE lo
 * decide la sincronía (`sync.ts`): solo madre y padre guardan los de los demás.
 */

export const pressureSharedSchema = z
  .object({
    by: z.string().min(1).max(24),
    /** Vacía cuando quien anotó borró lo suyo: así el borrado también llega. */
    ev: z.array(pressureEntrySchema).max(PRESSURE_MAX),
    s: z.string().regex(SIG_RE),
  })
  .strict();
export type PressureShared = z.infer<typeof pressureSharedSchema>;

export function pressureName(id: string): `pressure:${string}` {
  return `pressure:${id}`;
}

const payload = (by: string, ev: PressureEntry[]) => ({
  n: pressureName(by),
  by,
  ev,
});

export async function sealPressure(
  signer: Signer,
  by: string,
  ev: PressureEntry[],
): Promise<PressureShared> {
  return { by, ev, s: await sign(signer, payload(by, ev)) };
}

/** Huella barata del contenido, para no volver a firmar ni subir lo mismo. */
export function pressureHash(ev: PressureEntry[]): string {
  return `${ev.length}.${ev[0]?.id ?? ""}.${ev.at(-1)?.id ?? ""}.${ev.at(-1)?.t ?? 0}`;
}

/**
 * Lo que llegó de otro teléfono: firma de ese teléfono (su llave del roster) y cada anotación
 * suya. null si algo no encaja: se descarta entero.
 */
export async function acceptPressure(
  remote: unknown,
  pub: string | undefined,
): Promise<PressureEntry[] | null> {
  const parsed = pressureSharedSchema.safeParse(remote);
  if (!parsed.success) return null;
  const { by, ev, s } = parsed.data;
  if (ev.some((e) => e.by !== by)) return null;
  if (!(await verify(pub, payload(by, ev), s))) return null;
  return ev;
}
