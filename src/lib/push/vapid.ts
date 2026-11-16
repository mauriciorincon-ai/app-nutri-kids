import { fromB64u, toB64u } from "@/lib/family/crypto";

/**
 * VAPID (RFC 8292) con WebCrypto, sin dependencias (S8 · ADR-012). El servidor se presenta
 * ante el servicio de push con un JWT ES256 firmado por su llave privada; el teléfono se
 * suscribió con la llave pública, así nadie más puede enviarle toques en nombre de la app.
 *
 * Las llaves viven en variables de entorno (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, en
 * base64url: el punto sin comprimir de 65 bytes y el escalar de 32). En la CI y las e2e
 * son llaves de prueba generadas al vuelo; jamás hay una llave en el repo.
 */

const te = new TextEncoder();
const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
/** Validez del JWT: el servicio de Apple rechaza más de 24 h; 12 h es lo usual. */
export const JWT_SECONDS = 12 * 3600;

export type VapidKeys = { publicKey: string; key: CryptoKey; subject: string };

const json64 = (v: unknown) => toB64u(te.encode(JSON.stringify(v)));

export async function importVapid(
  publicKey: string,
  privateKey: string,
  subject: string,
): Promise<VapidKeys | null> {
  try {
    const pub = fromB64u(publicKey);
    const d = fromB64u(privateKey);
    if (pub.length !== 65 || pub[0] !== 4 || d.length !== 32) return null;
    if (!/^(mailto:|https:)/.test(subject)) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: toB64u(pub.slice(1, 33)),
        y: toB64u(pub.slice(33, 65)),
        d: toB64u(d),
        ext: false,
      },
      ALG,
      false,
      ["sign"],
    );
    return { publicKey, key, subject };
  } catch {
    return null;
  }
}

/** El encabezado `Authorization` para una dirección de envío. */
export async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  now: number,
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const unsigned = `${json64({ typ: "JWT", alg: "ES256" })}.${json64({
    aud,
    exp: Math.floor(now / 1000) + JWT_SECONDS,
    sub: keys.subject,
  })}`;
  // WebCrypto entrega la firma ya como r‖s (64 bytes): justo lo que pide JWS.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.key,
    te.encode(unsigned),
  );
  return `vapid t=${unsigned}.${toB64u(new Uint8Array(sig))}, k=${keys.publicKey}`;
}

/** Un par nuevo (lo usan las pruebas y quien aprovisiona; jamás se guarda en el repo). */
export async function generateVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const pair = (await crypto.subtle.generateKey(ALG, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: toB64u(raw), privateKey: jwk.d! };
}
