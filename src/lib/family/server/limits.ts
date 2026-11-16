import { z } from "zod";

/**
 * Topes del servicio de la familia (S7 · ADR-011): lo que el servidor acepta, sin leer
 * nada de lo que guarda. Todo lo que llega se valida con estas formas antes de tocar la base.
 */

/** Tamaño máximo del cifrado (base64url) del plan y de cualquier otro registro. */
export const PLAN_MAX_CT = 256 * 1024;
export const ITEM_MAX_CT = 64 * 1024;
/** Registros por familia (un día es un registro: ~2,7 años de historial). */
export const MAX_RECORDS = 1000;
/** Cuerpo de una petición y registros por subida. */
export const MAX_BODY = 1024 * 1024;
export const PUSH_BATCH = 50;
/** Bytes de cifrado por página al bajar (la respuesta cabe holgada en la plataforma). */
export const PULL_PAGE_BYTES = 2 * 1024 * 1024;
/** Familias nuevas por IP al día y en total al día; peticiones por IP por minuto. */
export const CREATES_PER_IP_DAY = 5;
export const CREATES_PER_DAY = 500;
export const REQUESTS_PER_IP_MIN = 120;
/** Una familia sin actividad se borra sola a los 400 días. */
export const FAMILY_TTL_SECONDS = 400 * 24 * 3600;

const b64u = (len: number) =>
  z
    .string()
    .length(len)
    .regex(/^[A-Za-z0-9_-]+$/);

/** Código de familia: 10 caracteres Crockford base32 (ver phrase.ts). */
export const familyField = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{10}$/);
export const saltField = b64u(22); // 16 bytes
export const tokenField = b64u(43); // 32 bytes
export const idField = b64u(22); // 16 bytes de HMAC
export const ivField = b64u(16); // 12 bytes
export const epochField = z.number().int().positive();

const ctField = z
  .string()
  .min(1)
  .max(PLAN_MAX_CT)
  .regex(/^[A-Za-z0-9_-]+$/);

export const pushRecord = z
  .object({
    id: idField,
    kind: z.enum(["plan", "item"]),
    /** Versión que este teléfono vio (0 = nuevo). Si el servidor tiene otra: 409. */
    ver: z.number().int().nonnegative(),
    iv: ivField,
    ct: ctField,
  })
  .strict()
  .refine((r) => r.kind === "plan" || r.ct.length <= ITEM_MAX_CT, {
    message: "too-large",
  });

export const bodies = {
  create: z
    .object({ family: familyField, salt: saltField, token: tokenField })
    .strict(),
  join: z.object({ family: familyField }).strict(),
  pull: z
    .object({
      family: familyField,
      epoch: epochField,
      since: z.number().int().nonnegative(),
    })
    .strict(),
  push: z
    .object({
      family: familyField,
      epoch: epochField,
      records: z.array(pushRecord).min(1).max(PUSH_BATCH),
    })
    .strict(),
  rotate: z
    .object({
      family: familyField,
      epoch: epochField,
      salt: saltField,
      token: tokenField,
    })
    .strict(),
  destroy: z.object({ family: familyField }).strict(),
} as const;
