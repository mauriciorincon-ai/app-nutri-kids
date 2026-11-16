import { z } from "zod";

import { familyField, tokenField } from "@/lib/family/server/limits";

import { validTimeZone } from "../due";
import { allowedEndpoint } from "../hosts";

/**
 * Topes y formas de la ruta de avisos (S8 · ADR-012). Todo lo que llega se valida aquí
 * antes de tocar la base; nada de lo que se acepta lleva texto: solo números, una zona
 * horaria y una dirección de envío de un servicio de push conocido.
 */

export const MAX_BODY = 8 * 1024;
/** Suscripciones en total y teléfonos por familia. */
export const MAX_SUBS = 1000;
export const MAX_PER_FAMILY = 20;
/** Despertares por teléfono (un día con todo prendido rara vez pasa de 15). */
export const MAX_WAKES = 96;
/** Peticiones por IP por minuto; suscripciones nuevas por IP al día; avisos por familia al día. */
export const REQUESTS_PER_IP_MIN = 60;
export const SUBSCRIBES_PER_IP_DAY = 10;
export const FAMILY_WAKES_PER_DAY = 30;
/** Una suscripción sin actualizar se borra sola a los 400 días; «enviado» y «saltar», a los 2. */
export const SUB_TTL_SECONDS = 400 * 24 * 3600;
export const FLAG_TTL_SECONDS = 2 * 24 * 3600;
/** Envíos simultáneos del disparador. */
export const SEND_CONCURRENCY = 20;

export const idField = z
  .string()
  .length(22)
  .regex(/^[A-Za-z0-9_-]+$/);
const endpointField = z.string().refine(allowedEndpoint, "endpoint");
const tzField = z.string().refine(validTimeZone, "tz");
const wakesField = z
  .array(
    z
      .object({
        m: z.number().int().min(0).max(1439),
        d: z.number().int().min(1).max(127),
      })
      .strict(),
  )
  .max(MAX_WAKES);
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Prueba de pertenencia a la familia: su código y su token de escritura (S7). */
const familyProof = z
  .object({ code: familyField, token: tokenField })
  .strict()
  .nullable();

export const bodies = {
  subscribe: z
    .object({
      endpoint: endpointField,
      token: tokenField,
      tz: tzField,
      wakes: wakesField,
      family: familyProof,
    })
    .strict(),
  update: z
    .object({
      id: idField,
      endpoint: endpointField,
      tz: tzField,
      wakes: wakesField,
      family: familyProof,
    })
    .strict(),
  skip: z
    .object({
      id: idField,
      date: dateField,
      m: z.number().int().min(0).max(1439),
      on: z.boolean(),
    })
    .strict(),
  unsubscribe: z.object({ id: idField }).strict(),
  family: z.object({ family: familyField, from: idField.nullable() }).strict(),
} as const;
