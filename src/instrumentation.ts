import * as Sentry from "@sentry/nextjs";

export async function register() {
  // DSN por env (Vercel / .env.local). Sin DSN, Sentry queda inactivo (dev local).
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Regla dura de la app: jamás datos del niño ni contenido de la dieta en eventos.
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
