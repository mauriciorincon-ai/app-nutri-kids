import type { ErrorEvent } from "@sentry/nextjs";

import type { DietPlan } from "../diet/schema";
import type { ProfileNotes } from "../diet/profile-notes";

/**
 * Depurador de eventos de Sentry (regla dura 6, ADR-009): un evento lleva solo
 * metadatos técnicos. Se quita todo lo que pueda cargar datos del niño (extra,
 * usuario, cuerpo de la petición, breadcrumbs de consola o de entrada) y se tapa
 * cualquier texto que contenga un término del perfil o de lo anotado por quien
 * cuida, aunque viaje dentro del mensaje de un error.
 */
export const REDACTED = "[redacted]";

const MIN_TERM = 3;

/** Términos sensibles del perfil del plan y de las anotaciones (los dos idiomas). */
export function sensitiveTerms(
  diet: DietPlan | null,
  notes: ProfileNotes | null,
): string[] {
  const out: string[] = [];
  const p = diet?.profile;
  if (p) {
    if (p.condition) out.push(p.condition.es, p.condition.en);
    for (const list of [p.allergies, p.intolerances, p.medications])
      for (const item of list ?? []) out.push(item.name.es, item.name.en);
  }
  for (const n of notes?.notes ?? []) out.push(n.text);
  return [
    ...new Set(out.map((t) => t.trim()).filter((t) => t.length >= MIN_TERM)),
  ];
}

function redact(text: string | undefined, terms: string[]): string | undefined {
  if (!text) return text;
  const low = text.toLowerCase();
  return terms.some((t) => low.includes(t.toLowerCase())) ? REDACTED : text;
}

export function scrubSentryEvent(
  event: ErrorEvent,
  terms: string[],
): ErrorEvent {
  const out: ErrorEvent = { ...event };
  delete out.extra;
  delete out.user;
  if (out.request)
    out.request = { ...out.request, data: undefined, cookies: undefined };
  if (out.breadcrumbs)
    out.breadcrumbs = out.breadcrumbs
      .filter((b) => b.category !== "console" && !b.category?.startsWith("ui."))
      .map((b) => ({
        ...b,
        message: redact(b.message, terms),
        data: undefined,
      }));
  if (typeof out.message === "string") out.message = redact(out.message, terms);
  if (out.exception?.values)
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => ({
        ...v,
        value: redact(v.value, terms),
      })),
    };
  return out;
}
