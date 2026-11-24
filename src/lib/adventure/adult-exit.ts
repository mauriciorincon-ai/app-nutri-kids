import type { Locale } from "@/i18n";

/**
 * La salida del adulto del modo niño (S14 · ADR-020 · G-Plan 2a). Dos pasos, los dos hacen falta:
 * mantener pulsado `HOLD_MS` y escribir el resultado de una suma que se lee EN PALABRAS (un
 * niño que aún no lee de corrido, o que no suma de memoria, no la pasa). Puro: el azar y el
 * tiempo los trae quien llama.
 */

export const HOLD_MS = 2000;

export type Challenge = { a: number; b: number };

const ES = [
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const EN = [
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
export const OPERAND_MIN = 6;
export const OPERAND_MAX = 19;

export function makeChallenge(rand: () => number = Math.random): Challenge {
  const pick = () =>
    OPERAND_MIN + Math.floor(rand() * (OPERAND_MAX - OPERAND_MIN + 1));
  return { a: pick(), b: pick() };
}

export const wordsOf = (n: number, locale: Locale): string =>
  (locale === "en" ? EN : ES)[n - OPERAND_MIN] ?? String(n);

/** Solo dígitos, exactos: «26», no «veintiséis» ni «26 »; un campo vacío nunca pasa. */
export function checkAnswer(c: Challenge, input: string): boolean {
  const s = input.trim();
  return /^\d{1,3}$/.test(s) && Number(s) === c.a + c.b;
}

/** Sin las dos cosas (la pulsación larga completa Y la cuenta bien) no se sale. */
export function canExit(args: {
  heldMs: number;
  challenge: Challenge;
  input: string;
}): boolean {
  return args.heldMs >= HOLD_MS && checkAnswer(args.challenge, args.input);
}
