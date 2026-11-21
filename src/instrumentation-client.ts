import { loadProfileNotes } from "@/lib/diet/profile-notes";
import { loadActiveDiet } from "@/lib/diet/storage";
import {
  scrubSentryEvent,
  scrubSentryTransaction,
  sensitiveTerms,
} from "@/lib/privacy/sentry-scrub";

type SentryModule = typeof import("@/lib/sentry-client");

function termsOnThisDevice(): string[] {
  try {
    return sensitiveTerms(loadActiveDiet().diet, loadProfileNotes());
  } catch {
    return [];
  }
}

/**
 * Sentry arranca cuando el teléfono queda libre tras cargar la página, no antes de hidratar:
 * importarlo e inicializarlo de entrada era una parte fija de la tarea larga al abrir Hoy (TBT,
 * S12). Lo que se pierde es un error en el primer segundo, antes del arranque; las mismas
 * reglas de privacidad rigen igual (`beforeSend` limpia todo evento).
 */
let sentry: SentryModule | null = null;

function start() {
  void import("@/lib/sentry-client").then((S) => {
    S.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      // Regla dura de la app: jamás datos del niño ni contenido de la dieta en eventos.
      sendDefaultPii: false,
      // Perfil y anotaciones de quien cuida jamás viajan en claro (regla dura 6, ADR-009, ADR-011).
      beforeSend: (event) => scrubSentryEvent(event, termsOnThisDevice()),
      beforeSendTransaction: (event) =>
        scrubSentryTransaction(event, termsOnThisDevice()),
    });
    sentry = S;
  });
}

if (typeof window !== "undefined") {
  const whenIdle = () => {
    if (typeof window.requestIdleCallback === "function")
      window.requestIdleCallback(start, { timeout: 4000 });
    else setTimeout(start, 1);
  };
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
) {
  sentry?.captureRouterTransitionStart(...args);
}
