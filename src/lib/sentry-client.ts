/**
 * Lo único de Sentry que usa el cliente, con imports nombrados: así el chunk que se carga
 * diferido (`instrumentation-client.ts`) trae solo esto y no el paquete entero.
 */
export { captureRouterTransitionStart, init } from "@sentry/nextjs";
