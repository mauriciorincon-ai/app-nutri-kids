/**
 * Cifrado de punta a punta de lo que la familia comparte (regla dura 6 · ADR-011).
 * Solo WebCrypto, ninguna dependencia.
 *
 *   frase ──PBKDF2-SHA-256 (600 000 vueltas, sal de la familia)──► semilla
 *   semilla ──HKDF──► clave AES-GCM-256 (cifra cada registro, IV nuevo por registro)
 *           ──HKDF──► clave HMAC (nombra cada registro: el servidor no ve qué es)
 *           ──HKDF──► token de escritura (el servidor guarda solo su SHA-256)
 *
 * Las tres claves nacen NO exportables: ni este código puede leerlas una vez creadas.
 * El token es lo único que viaja, y no sirve para descifrar: HKDF lo separa de la clave.
 */

export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
const INFO = {
  enc: "nutrikids/family/v1/enc",
  id: "nutrikids/family/v1/id",
  token: "nutrikids/family/v1/token",
} as const;

const te = new TextEncoder();
const td = new TextDecoder();

export type FamilyKeys = {
  /** AES-GCM-256, no exportable. */
  enc: CryptoKey;
  /** HMAC-SHA-256, no exportable. */
  id: CryptoKey;
  /** base64url de 32 bytes: autoriza escribir; no descifra nada. */
  token: string;
};

export type Sealed = { iv: string; ct: string };

export function toB64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function newSalt(): string {
  return toB64u(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

/** De la frase normalizada y la sal salen las tres piezas. Lento a propósito (~0,5 s). */
export async function deriveKeys(
  phrase: string,
  salt: string,
): Promise<FamilyKeys> {
  const subtle = crypto.subtle;
  const pass = await subtle.importKey(
    "raw",
    te.encode(phrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const seed = await subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromB64u(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    pass,
    256,
  );
  const hkdf = await subtle.importKey("raw", seed, "HKDF", false, [
    "deriveKey",
    "deriveBits",
  ]);
  const params = (info: string) => ({
    name: "HKDF",
    hash: "SHA-256",
    salt: new Uint8Array(0),
    info: te.encode(info),
  });
  const [enc, id, token] = await Promise.all([
    subtle.deriveKey(
      params(INFO.enc),
      hkdf,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    subtle.deriveKey(
      params(INFO.id),
      hkdf,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"],
    ),
    subtle.deriveBits(params(INFO.token), hkdf, 256),
  ]);
  return { enc, id, token: toB64u(new Uint8Array(token)) };
}

/** Nombre opaco de un registro: HMAC(clave de ids, nombre local) → 16 bytes. */
export async function recordId(
  idKey: CryptoKey,
  name: string,
): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", idKey, te.encode(name));
  return toB64u(new Uint8Array(mac).slice(0, 16));
}

/**
 * Relleno a múltiplos de 256 bytes: el tamaño del cifrado no delata cuántas marcas o
 * notas trae un día. JSON tolera espacios al final.
 */
const PAD = 256;
function pad(text: string): Uint8Array<ArrayBuffer> {
  const bytes = te.encode(text);
  const size = Math.ceil((bytes.length + 1) / PAD) * PAD;
  const out = new Uint8Array(size).fill(0x20);
  out.set(bytes);
  return out;
}

/**
 * Cifra con un IV NUEVO de 12 bytes al azar en cada llamada. `aad` ata el cifrado a su
 * familia, época y registro: un servidor que cambie registros de sitio no logra que se
 * descifren.
 */
export async function seal(
  key: CryptoKey,
  value: unknown,
  aad: string,
): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: te.encode(aad) },
    key,
    pad(JSON.stringify(value)),
  );
  return { iv: toB64u(iv), ct: toB64u(new Uint8Array(ct)) };
}

/** Descifra; con otra clave, otro `aad` o un byte cambiado, devuelve null (sin pistas). */
export async function open(
  key: CryptoKey,
  sealed: Sealed,
  aad: string,
): Promise<unknown | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromB64u(sealed.iv),
        additionalData: te.encode(aad),
      },
      key,
      fromB64u(sealed.ct),
    );
    return JSON.parse(td.decode(plain)) as unknown;
  } catch {
    return null;
  }
}

/** Contexto que ata cada cifrado: familia · época · registro. */
export function aadFor(familyId: string, epoch: number, id: string): string {
  return `nk1|${familyId}|${epoch}|${id}`;
}
