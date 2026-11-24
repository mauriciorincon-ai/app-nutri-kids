/**
 * Códigos de barras (S13 · ADR-019): el dígito de control de un GTIN-8, 12 (UPC-A) o 13 (EAN-13) y
 * las claves con que se busca en el catálogo. Puro. Un código que no pasa el dígito de control
 * NUNCA se busca: se pide leerlo de nuevo.
 */

export type CodeProblem = "empty" | "length" | "checksum";

/** Solo las cifras: «770 2535-016688» se escribe con o sin separadores. */
export const digitsOf = (input: string): string => input.replace(/\D/g, "");

/** ¿Tiene 8, 12 o 13 cifras y su dígito de control cuadra? */
export function validGtin(code: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

export type CodeResult =
  | { ok: true; code: string }
  | { ok: false; problem: CodeProblem };

/** Lo que alguien escribe o lo que lee el escáner → un código válido, o por qué no. */
export function checkCode(input: string): CodeResult {
  const code = digitsOf(input);
  if (!code) return { ok: false, problem: "empty" };
  if (!/^(?:\d{8}|\d{12}|\d{13})$/.test(code))
    return { ok: false, problem: "length" };
  if (!validGtin(code)) return { ok: false, problem: "checksum" };
  return { ok: true, code };
}

/**
 * Un UPC-A (12) es un EAN-13 con un cero delante: el mismo producto puede estar guardado de
 * cualquiera de las dos maneras.
 */
export function lookupKeys(code: string): string[] {
  if (code.length === 12) return [code, `0${code}`];
  if (code.length === 13 && code.startsWith("0")) return [code, code.slice(1)];
  return [code];
}
