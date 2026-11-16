import { z } from "zod";

import { DEFAULT_TYPES } from "./schedule";

/**
 * Lo que este teléfono recuerda de sus avisos (S8 · ADR-012): quién es en el servidor (id y
 * token de ESTE teléfono), qué tipos quiere, si oculta el detalle, qué le dijo ya al servidor
 * (una huella, para no repetir) y qué despertares de hoy le pidió saltar. Solo existe mientras
 * los avisos están prendidos; «Dejar de recibir avisos» y «Borrar datos» lo borran.
 */

export const PUSH_STATE_ITEM = "nutrikids.push.v1";

export const pushStateSchema = z.object({
  v: z.literal(1),
  id: z.string().length(22),
  token: z.string().length(43),
  types: z.object({
    supplements: z.boolean(),
    meals: z.boolean(),
    water: z.boolean(),
    family: z.boolean(),
  }),
  hide: z.boolean(),
  /** Huella de lo último que el servidor aceptó (dirección, huso, horas, familia). */
  sent: z.string().max(64),
  /** Despertares de hoy que se le pidió saltar (minutos del día). */
  skipped: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ms: z.array(z.number().int().min(0).max(1439)).max(96),
  }),
});

export type PushState = z.infer<typeof pushStateSchema>;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function freshPushState(id: string, token: string): PushState {
  return {
    v: 1,
    id,
    token,
    types: { ...DEFAULT_TYPES },
    hide: false,
    sent: "",
    skipped: { date: "1970-01-01", ms: [] },
  };
}

export function loadPushState(): PushState | null {
  try {
    const raw = storage()?.getItem(PUSH_STATE_ITEM);
    if (!raw) return null;
    const parsed = pushStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function savePushState(state: PushState): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(PUSH_STATE_ITEM, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearPushState(): void {
  try {
    storage()?.removeItem(PUSH_STATE_ITEM);
  } catch {
    /* nada */
  }
}
