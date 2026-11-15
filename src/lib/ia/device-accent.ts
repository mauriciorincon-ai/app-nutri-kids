/**
 * Acento opcional del modelo del APARATO (regla dura 5 · ADR-008).
 *
 * Si el navegador trae un modelo de lenguaje propio, ya instalado DENTRO del
 * teléfono (Prompt API: el global `LanguageModel`), se usa solo para re-redactar
 * con calidez una frase que el código ya decidió. Nunca decide, nunca agrega
 * datos y nunca sale a la red:
 *  - solo se usa si `availability()` dice «available» (jamás se pide descarga);
 *  - la salida pasa por un esquema Zod: largo acotado, conserva los nombres del
 *    plan, no trae cifras nuevas, ni enlaces, ni palabras vetadas;
 *  - si algo falla, tarda o no pasa el esquema → se muestra el texto del código.
 * Sin ese modelo, la app responde exactamente igual.
 */
import { z } from "zod";

import { normalizeText, type Locale } from "@/lib/diet/search";

type PromptSession = {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
};

type LanguageModelApi = {
  availability: (options?: unknown) => Promise<string>;
  create: (options?: unknown) => Promise<PromptSession>;
};

export const ACCENT_TIMEOUT_MS = 4000;

/** Palabras que el texto de esta app jamás dice (regla dura 2: sin cifras del cuerpo, sin culpa ni premio). */
const BANNED = [
  "caloria",
  "calorie",
  "kcal",
  "peso",
  "weight",
  "imc",
  "bmi",
  "percentil",
  "percentile",
  "culpa",
  "guilt",
  "premio",
  "reward",
  "castigo",
  "punish",
  "debes",
  "must",
];

function numbersIn(text: string): Set<string> {
  return new Set(text.match(/\d+(?:[.,]\d+)?/g) ?? []);
}

/** Esquema de la salida del modelo para UNA frase de origen. */
export function accentSchema(source: string, required: string[], locale: Locale) {
  const srcNumbers = numbersIn(source);
  const max = Math.max(source.length * 2, source.length + 160);
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((out) => !/https?:|www\./i.test(out), "no-links")
    .refine((out) => {
      const norm = normalizeText(out, locale);
      return required.every((r) => norm.includes(normalizeText(r, locale)));
    }, "lost-plan-terms")
    .refine((out) => [...numbersIn(out)].every((n) => srcNumbers.has(n)), "new-numbers")
    .refine((out) => {
      const words = normalizeText(out, locale).split(" ");
      return !BANNED.some((b) => words.some((w) => w.startsWith(b)));
    }, "banned-words");
}

function deviceModel(): LanguageModelApi | null {
  const api = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
  return api && typeof api.availability === "function" && typeof api.create === "function"
    ? api
    : null;
}

/** ¿Hay un modelo del aparato listo, sin descargar nada? */
export async function hasDeviceModel(locale: Locale): Promise<boolean> {
  const api = deviceModel();
  if (!api) return false;
  try {
    const state = await api.availability({
      expectedInputs: [{ type: "text", languages: [locale] }],
      expectedOutputs: [{ type: "text", languages: [locale] }],
    });
    return state === "available";
  } catch {
    return false;
  }
}

const SYSTEM = {
  es: "Reescribe la frase con calidez y en una sola oración, en español sencillo. No agregues alimentos, cantidades, horas ni consejos. Conserva cada nombre de alimento o comida tal cual. Responde solo con la frase.",
  en: "Rewrite the sentence warmly as a single sentence in plain English. Do not add foods, amounts, times or advice. Keep every food or meal name exactly as written. Reply with the sentence only.",
} as const;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Re-redacta `source` con el modelo del aparato. Devuelve la frase validada o
 * null (sin modelo, error, demora o salida que no pasa el esquema).
 */
export async function accentWithDevice(
  source: string,
  required: string[],
  locale: Locale,
): Promise<string | null> {
  if (!(await hasDeviceModel(locale))) return null;
  const api = deviceModel();
  if (!api) return null;
  let session: PromptSession | null = null;
  try {
    session = await withTimeout(
      api.create({
        initialPrompts: [{ role: "system", content: SYSTEM[locale] }],
        expectedOutputs: [{ type: "text", languages: [locale] }],
      }),
      ACCENT_TIMEOUT_MS,
    );
    if (!session) return null;
    const out = await withTimeout(session.prompt(source), ACCENT_TIMEOUT_MS);
    if (out === null) return null;
    const parsed = accentSchema(source, required, locale).safeParse(out);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    session?.destroy?.();
  }
}
