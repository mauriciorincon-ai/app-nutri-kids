/**
 * Sentry entra cuando el navegador queda libre, no durante la carga: iniciarlo era más de la
 * mitad del trabajo de arranque de Hoy (medido el 2026-11-17: ~140 → ~65 ms con la CPU ×6). Los
 * errores de esos primeros instantes se guardan y se envían al iniciar, con el mismo filtro de
 * privacidad (`src/lib/privacy/sentry-start.ts`).
 */

type OnTransition =
  typeof import("@sentry/nextjs").captureRouterTransitionStart;

let onTransition: OnTransition | null = null;
const early: unknown[] = [];
const onError = (e: ErrorEvent) => early.push(e.error ?? e.message);
const onRejection = (e: PromiseRejectionEvent) => early.push(e.reason);

function start() {
  void import("@/lib/privacy/sentry-start").then(({ startSentry }) => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    onTransition = startSentry(early.splice(0));
  });
}

function whenIdle() {
  if ("requestIdleCallback" in window)
    window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1);
}

if (typeof window !== "undefined") {
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

export function onRouterTransitionStart(...args: Parameters<OnTransition>) {
  onTransition?.(...args);
}
