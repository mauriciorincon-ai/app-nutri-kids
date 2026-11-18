import {
  captureException,
  captureRouterTransitionStart,
  init,
} from "@sentry/nextjs";

import { loadProfileNotes } from "@/lib/diet/profile-notes";
import { loadActiveDiet } from "@/lib/diet/storage";
import {
  scrubSentryEvent,
  scrubSentryTransaction,
  sensitiveTerms,
} from "@/lib/privacy/sentry-scrub";

/**
 * La iniciación de Sentry en el navegador, en su propio módulo: `instrumentation-client.ts` lo
 * carga cuando el navegador queda libre. Solo se importa lo que se usa, así el paquete se recorta.
 */

function termsOnThisDevice(): string[] {
  try {
    return sensitiveTerms(loadActiveDiet().diet, loadProfileNotes());
  } catch {
    return [];
  }
}

export function startSentry(early: unknown[]) {
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Regla dura de la app: jamás datos del niño ni contenido de la dieta en eventos.
    sendDefaultPii: false,
    // Perfil y anotaciones de quien cuida jamás viajan en claro (regla dura 6, ADR-009, ADR-011).
    beforeSend: (event) => scrubSentryEvent(event, termsOnThisDevice()),
    beforeSendTransaction: (event) =>
      scrubSentryTransaction(event, termsOnThisDevice()),
  });
  for (const error of early) captureException(error);
  return captureRouterTransitionStart;
}
