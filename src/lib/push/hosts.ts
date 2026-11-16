/**
 * A dónde puede enviar el servidor (S8 · ADR-012). La dirección de envío la manda el
 * teléfono: sin esta lista, cualquiera haría que el servidor llamara a una URL suya. Solo
 * los servicios de push de los navegadores, solo por https y en el puerto de siempre.
 */

const EXACT = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);
const SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export const ENDPOINT_MAX = 1024;

export function allowedEndpoint(raw: string): boolean {
  if (raw.length > ENDPOINT_MAX) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return EXACT.has(host) || SUFFIXES.some((s) => host.endsWith(s));
}
