import * as Sentry from "@sentry/nextjs";

import { loadProfileNotes } from "@/lib/diet/profile-notes";
import { loadActiveDiet } from "@/lib/diet/storage";
import {
  scrubSentryEvent,
  scrubSentryTransaction,
  sensitiveTerms,
} from "@/lib/privacy/sentry-scrub";

function termsOnThisDevice(): string[] {
  try {
    return sensitiveTerms(loadActiveDiet().diet, loadProfileNotes());
  } catch {
    return [];
  }
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Regla dura de la app: jamás datos del niño ni contenido de la dieta en eventos.
  sendDefaultPii: false,
  // Perfil y anotaciones de quien cuida jamás viajan en claro (regla dura 6, ADR-009, ADR-011).
  beforeSend: (event) => scrubSentryEvent(event, termsOnThisDevice()),
  beforeSendTransaction: (event) =>
    scrubSentryTransaction(event, termsOnThisDevice()),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
