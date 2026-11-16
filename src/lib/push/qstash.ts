import { fromB64u, toB64u } from "@/lib/family/crypto";

/**
 * La firma del disparador (decisión 1 del G-Plan · ADR-012): Upstash QStash llama a
 * `/api/push/tick` cada 5 minutos con un JWT HS256 en `Upstash-Signature`, firmado con su
 * llave actual o con la siguiente (para rotarlas sin cortar). Se verifica con WebCrypto:
 * firma (HMAC, comparación en tiempo constante del propio `verify`), emisor, vigencia,
 * destino y la huella del cuerpo. Sin firma válida, la ruta no envía nada.
 */

const te = new TextEncoder();
const td = new TextDecoder();
/** Holgura de reloj entre QStash y el servidor. */
export const CLOCK_SKEW_SECONDS = 60;

type Claims = {
  iss?: unknown;
  sub?: unknown;
  exp?: unknown;
  nbf?: unknown;
  body?: unknown;
};

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function bodyHash(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(body));
  return toB64u(new Uint8Array(digest));
}

/**
 * true solo si alguna de las llaves firma ese JWT, lo emitió Upstash, está vigente, va
 * dirigido a una URL que termina en `path` y su huella es la del cuerpo recibido.
 */
export async function verifyQstash(
  signature: string | null,
  body: string,
  signingKeys: string[],
  path: string,
  now: number,
): Promise<boolean> {
  if (!signature || signature.length > 4096) return false;
  const parts = signature.split(".");
  if (parts.length !== 3) return false;
  const [h, p, s] = parts;
  let header: { alg?: unknown };
  let claims: Claims;
  let sig: Uint8Array<ArrayBuffer>;
  try {
    header = JSON.parse(td.decode(fromB64u(h)));
    claims = JSON.parse(td.decode(fromB64u(p)));
    sig = fromB64u(s);
  } catch {
    return false;
  }
  if (header.alg !== "HS256") return false;
  let signed = false;
  for (const secret of signingKeys.filter(Boolean)) {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      sig,
      te.encode(`${h}.${p}`),
    );
    if (ok) signed = true;
  }
  if (!signed) return false;
  const t = Math.floor(now / 1000);
  if (claims.iss !== "Upstash") return false;
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS < t)
    return false;
  if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SECONDS > t)
    return false;
  if (typeof claims.sub !== "string") return false;
  try {
    if (new URL(claims.sub).pathname !== path) return false;
  } catch {
    return false;
  }
  const strip = (v: string) => v.replace(/=+$/, "");
  return (
    typeof claims.body === "string" &&
    strip(claims.body) === strip(await bodyHash(body))
  );
}

/** Firma como QStash: SOLO para las pruebas (la CI y las e2e usan llaves de prueba). */
export async function signLikeQstash(
  secret: string,
  url: string,
  body: string,
  now: number,
  overrides: Partial<Claims> = {},
): Promise<string> {
  const t = Math.floor(now / 1000);
  const enc = (v: unknown) => toB64u(te.encode(JSON.stringify(v)));
  const unsigned = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({
    iss: "Upstash",
    sub: url,
    exp: t + 300,
    nbf: t,
    iat: t,
    jti: `jwt_${t}`,
    body: await bodyHash(body),
    ...overrides,
  })}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    te.encode(unsigned),
  );
  return `${unsigned}.${toB64u(new Uint8Array(sig))}`;
}
