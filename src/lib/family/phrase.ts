/**
 * Código y frase de la familia (S7 · ADR-011).
 *
 * - El CÓDIGO (10 caracteres, 50 bits) solo identifica a la familia ante el servidor.
 * - La FRASE (20 caracteres, 100 bits) abre lo compartido: de ella salen la clave y el
 *   token en el aparato. Jamás se guarda ni viaja; la genera la app, nunca la persona.
 *
 * Alfabeto Crockford base32: sin I, L, O ni U, para dictarla sin confusiones. Al leerla
 * se perdona lo que se suele confundir (O→0, I/L→1), espacios, guiones y minúsculas.
 */

export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PHRASE_LENGTH = 20; // 20 × 5 bits = 100 bits
export const CODE_LENGTH = 10; // 10 × 5 bits = 50 bits

type Random = (bytes: Uint8Array) => Uint8Array;
const systemRandom: Random = (bytes) => crypto.getRandomValues(bytes);

/** n caracteres al azar: 256 es múltiplo de 32, así que `byte & 31` es uniforme. */
function randomChars(n: number, random: Random): string {
  const bytes = random(new Uint8Array(n));
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}

function group(raw: string, size: number): string {
  return raw.match(new RegExp(`.{1,${size}}`, "g"))!.join("-");
}

/** Frase nueva, en 5 grupos de 4: «7K2M-…». */
export function newPhrase(random: Random = systemRandom): string {
  return group(randomChars(PHRASE_LENGTH, random), 4);
}

/** Código nuevo de familia, en 2 grupos de 5: «A1B2C-…». */
export function newFamilyCode(random: Random = systemRandom): string {
  return randomChars(CODE_LENGTH, random);
}

export function formatCode(code: string): string {
  return group(code, 5);
}

function clean(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

function normalize(input: string, length: number): string | null {
  const raw = clean(input);
  if (raw.length !== length) return null;
  for (const c of raw) if (!ALPHABET.includes(c)) return null;
  return raw;
}

/** La frase tal como se deriva: 20 caracteres del alfabeto, sin guiones. null si no lo es. */
export function normalizePhrase(input: string): string | null {
  return normalize(input, PHRASE_LENGTH);
}

export function normalizeCode(input: string): string | null {
  return normalize(input, CODE_LENGTH);
}

/**
 * La INVITACIÓN (S9 · ADR-013): el código de la familia, la huella del roster (12 caracteres,
 * 60 bits: el teléfono nuevo solo acepta un roster que empiece en ese génesis) y, si un padre
 * invitó con un rol, la etiqueta de esa invitación (4). Se dicta o se copia junto con la frase.
 */
export const PIN_LENGTH = 12;
export const TAG_LENGTH = 4;
export type Invitation = { family: string; pin: string; tag: string | null };

export function formatInvite(family: string, pin: string, tag?: string | null): string {
  return [group(family, 5), group(pin, 4), tag ?? ""].filter(Boolean).join("-");
}

export function parseInvite(input: string): Invitation | null {
  const raw = clean(input);
  if (![CODE_LENGTH + PIN_LENGTH, CODE_LENGTH + PIN_LENGTH + TAG_LENGTH].includes(raw.length))
    return null;
  for (const c of raw) if (!ALPHABET.includes(c)) return null;
  return {
    family: raw.slice(0, CODE_LENGTH),
    pin: raw.slice(CODE_LENGTH, CODE_LENGTH + PIN_LENGTH),
    tag: raw.length > CODE_LENGTH + PIN_LENGTH ? raw.slice(CODE_LENGTH + PIN_LENGTH) : null,
  };
}

/** Id de este teléfono dentro de la familia (no es secreto: desempata la mezcla). */
export function newDeviceId(random: Random = systemRandom): string {
  return randomChars(12, random);
}
