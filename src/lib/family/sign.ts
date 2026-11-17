import { fromB64u, toB64u } from "./crypto";
import { ALPHABET } from "./phrase";

/**
 * La firma de cada persona (S9 · ADR-013). Cada teléfono crea UNA llave ECDSA P-256 con
 * WebCrypto, NO exportable: ni este código ni un script ajeno pueden leer la parte privada.
 * La pública (65 bytes, base64url) viaja cifrada dentro de la familia; con ella los demás
 * teléfonos comprueban que lo que llega lo escribió quien dice, y que su rol se lo permite.
 *
 * Todo lo que se firma pasa antes por `canon` (JSON con claves ordenadas) y lleva un
 * prefijo de dominio: una firma de un registro no sirve para otro tipo de registro.
 */

const te = new TextEncoder();
export const SIGN_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIG_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;
const DOMAIN = "nutrikids/family/v1/sig";

/** Llave pública: punto sin comprimir de 65 bytes en base64url (87 caracteres). */
export const PUB_RE = /^[A-Za-z0-9_-]{87}$/;
/** Firma ECDSA P-256 en formato IEEE P1363 (64 bytes, 86 caracteres). */
export const SIG_RE = /^[A-Za-z0-9_-]{86}$/;

export type Signer = { key: CryptoKey; pub: string };

/** JSON con claves ordenadas: el mismo contenido da el mismo texto, en cualquier orden. */
export function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const message = (payload: unknown) => te.encode(`${DOMAIN}\n${canon(payload)}`);

/** Llave nueva de este teléfono: la privada no se puede exportar; la pública sí. */
export async function newSigner(): Promise<Signer> {
  const pair = (await crypto.subtle.generateKey(SIGN_ALG, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  return { key: pair.privateKey, pub: toB64u(raw) };
}

export async function sign(signer: Signer, payload: unknown): Promise<string> {
  const sig = await crypto.subtle.sign(
    SIG_PARAMS,
    signer.key,
    message(payload),
  );
  return toB64u(new Uint8Array(sig));
}

const pubCache = new Map<string, Promise<CryptoKey | null>>();

function importPub(pub: string): Promise<CryptoKey | null> {
  let hit = pubCache.get(pub);
  if (!hit) {
    hit = (async () => {
      try {
        if (!PUB_RE.test(pub)) return null;
        const raw = fromB64u(pub);
        if (raw.length !== 65 || raw[0] !== 4) return null;
        return await crypto.subtle.importKey("raw", raw, SIGN_ALG, false, [
          "verify",
        ]);
      } catch {
        return null;
      }
    })();
    if (pubCache.size > 200) pubCache.clear();
    pubCache.set(pub, hit);
  }
  return hit;
}

/** ¿Esta firma la hizo la llave `pub` sobre este contenido? Cualquier rareza = no. */
export async function verify(
  pub: string | undefined,
  payload: unknown,
  sig: string | undefined,
): Promise<boolean> {
  if (!pub || !sig || !SIG_RE.test(sig)) return false;
  const key = await importPub(pub);
  if (!key) return false;
  try {
    return await crypto.subtle.verify(
      SIG_PARAMS,
      key,
      fromB64u(sig),
      message(payload),
    );
  } catch {
    return false;
  }
}

/** SHA-256 del contenido canónico, en hex (los primeros `bytes`). */
export async function hashOf(value: unknown, bytes = 16): Promise<string> {
  const h = new Uint8Array(
    await crypto.subtle.digest("SHA-256", te.encode(canon(value))),
  );
  return [...h.slice(0, bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Huella para dictar: `chars` caracteres Crockford (5 bits cada uno) de un hash en hex. */
export function fingerprint(hex: string, chars = 12): string {
  let bits = "";
  for (const c of hex) bits += parseInt(c, 16).toString(2).padStart(4, "0");
  let out = "";
  for (let i = 0; i < chars; i++)
    out += ALPHABET[parseInt(bits.slice(i * 5, i * 5 + 5), 2)];
  return out;
}

/**
 * La huella de una llave para comparar a ojo («ABCD-EFGH», 40 bits): el teléfono que espera rol
 * la muestra, y el padre confirma solo si ve la misma. Así nadie puede colar su propia llave en
 * el registro de otro teléfono que espera.
 */
export async function keyMark(pub: string): Promise<string> {
  const f = fingerprint(await hashOf({ n: "key", pub }), 8);
  return `${f.slice(0, 4)}-${f.slice(4)}`;
}
