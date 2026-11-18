/**
 * El QR de la etiqueta (S11 · ADR-017): se dibuja en el teléfono, sin red, y lleva TEXTO
 * plano, nunca un enlace. La librería (`qrcode-generator`, MIT, sin dependencias) se carga
 * solo al abrir la etiqueta: ninguna otra pantalla la baja.
 */

/** Cuántos bytes caben con nivel M y versión ≤ 14: una etiqueta que se lee bien impresa pequeña. */
export const QR_MAX_BYTES = 360;

/** Módulos del QR: `true` = oscuro. Texto en UTF-8 (las tildes y la ñ se leen igual en cualquier lector). */
export async function qrModules(text: string): Promise<boolean[][]> {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > QR_MAX_BYTES) throw new RangeError("qr-too-long");
  const { default: qrcode } = await import("qrcode-generator");
  qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
}
