// @vitest-environment node
import { describe, expect, it } from "vitest";

import { fromB64u } from "@/lib/family/crypto";
import { allowedEndpoint } from "@/lib/push/hosts";
import { bodyHash, signLikeQstash, verifyQstash } from "@/lib/push/qstash";
import {
  JWT_SECONDS,
  generateVapidKeys,
  importVapid,
  vapidAuthorization,
} from "@/lib/push/vapid";

const td = new TextDecoder();
const NOW = Date.UTC(2026, 10, 16, 12, 0);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

describe("VAPID con WebCrypto (ES256, sin dependencias)", () => {
  it("firma un JWT que la llave pública verifica, con aud del servicio y vigencia de 12 h", async () => {
    const pair = await generateVapidKeys();
    const keys = await importVapid(
      pair.publicKey,
      pair.privateKey,
      "mailto:avisos@example.org",
    );
    expect(keys).not.toBeNull();
    const header = await vapidAuthorization(ENDPOINT, keys!, NOW);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const [, h, p, s, k] = m!;
    expect(k).toBe(pair.publicKey);
    expect(JSON.parse(td.decode(fromB64u(h)))).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    expect(JSON.parse(td.decode(fromB64u(p)))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: NOW / 1000 + JWT_SECONDS,
      sub: "mailto:avisos@example.org",
    });
    const pub = await crypto.subtle.importKey(
      "raw",
      fromB64u(pair.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const sig = fromB64u(s);
    expect(sig.length).toBe(64);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      sig,
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
    // Con otra llave pública, no verifica.
    const other = await generateVapidKeys();
    const otherPub = await crypto.subtle.importKey(
      "raw",
      fromB64u(other.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    expect(
      await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        otherPub,
        sig,
        new TextEncoder().encode(`${h}.${p}`),
      ),
    ).toBe(false);
  });

  it("rechaza llaves mal formadas o un sujeto que no es mailto/https", async () => {
    const pair = await generateVapidKeys();
    expect(
      await importVapid("corta", pair.privateKey, "mailto:a@b.c"),
    ).toBeNull();
    expect(
      await importVapid(pair.publicKey, "corta", "mailto:a@b.c"),
    ).toBeNull();
    expect(
      await importVapid(pair.publicKey, pair.privateKey, "avisos"),
    ).toBeNull();
    const other = await generateVapidKeys();
    // Escalar de otro par: WebCrypto lo rechaza al importar.
    expect(
      await importVapid(pair.publicKey, other.privateKey, "mailto:a@b.c"),
    ).toBeNull();
  });
});

describe("la firma del disparador (QStash, HS256)", () => {
  const URL = "https://app.example/api/push/tick";
  const PATH = "/api/push/tick";

  it("acepta la firma con la llave actual o con la siguiente", async () => {
    const sig = await signLikeQstash("actual", URL, "", NOW);
    expect(
      await verifyQstash(sig, "", ["actual", "siguiente"], PATH, NOW),
    ).toBe(true);
    const next = await signLikeQstash("siguiente", URL, "", NOW);
    expect(
      await verifyQstash(next, "", ["actual", "siguiente"], PATH, NOW),
    ).toBe(true);
  });

  it("sin firma, con otra llave, vencida, aún no válida, de otro emisor, a otra ruta u otro cuerpo: no", async () => {
    const keys = ["actual"];
    expect(await verifyQstash(null, "", keys, PATH, NOW)).toBe(false);
    expect(await verifyQstash("a.b", "", keys, PATH, NOW)).toBe(false);
    expect(await verifyQstash("x.y.z", "", keys, PATH, NOW)).toBe(false);
    expect(await verifyQstash("x".repeat(5000), "", keys, PATH, NOW)).toBe(
      false,
    );
    const cases = await Promise.all([
      signLikeQstash("otra", URL, "", NOW),
      signLikeQstash("actual", URL, "", NOW, { exp: NOW / 1000 - 120 }),
      signLikeQstash("actual", URL, "", NOW, { nbf: NOW / 1000 + 120 }),
      signLikeQstash("actual", URL, "", NOW, { iss: "Otro" }),
      signLikeQstash("actual", "https://app.example/api/family/push", "", NOW),
      signLikeQstash("actual", URL, "otro cuerpo", NOW),
      signLikeQstash("actual", "no es url", "", NOW),
      signLikeQstash("actual", URL, "", NOW, { exp: "mañana" }),
      signLikeQstash("actual", URL, "", NOW, { sub: 7 }),
      signLikeQstash("actual", URL, "", NOW, { body: 1 }),
    ]);
    for (const sig of cases)
      expect(await verifyQstash(sig, "", keys, PATH, NOW)).toBe(false);
    // Sin llaves configuradas, nada pasa.
    const good = await signLikeQstash("actual", URL, "", NOW);
    expect(await verifyQstash(good, "", [], PATH, NOW)).toBe(false);
    expect(await verifyQstash(good, "", [""], PATH, NOW)).toBe(false);
  });

  it("un JWT con alg distinto de HS256 (p. ej. «none») no pasa aunque la firma calce", async () => {
    const good = await signLikeQstash("actual", URL, "", NOW);
    const [, p, s] = good.split(".");
    const none = Buffer.from(JSON.stringify({ alg: "none" })).toString(
      "base64url",
    );
    expect(
      await verifyQstash(`${none}.${p}.${s}`, "", ["actual"], PATH, NOW),
    ).toBe(false);
    expect(await verifyQstash(`${none}.${p}.`, "", ["actual"], PATH, NOW)).toBe(
      false,
    );
  });

  it("la huella del cuerpo se compara sin relleno «=»", async () => {
    const hash = await bodyHash("{}");
    const sig = await signLikeQstash("actual", URL, "{}", NOW, {
      body: `${hash}=`,
    });
    expect(await verifyQstash(sig, "{}", ["actual"], PATH, NOW)).toBe(true);
  });
});

describe("a dónde puede enviar el servidor", () => {
  it("solo servicios de push conocidos, por https y sin puerto ni credenciales", () => {
    for (const ok of [
      ENDPOINT,
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/QWERTY",
      "https://api.push.apple.com/3/device/x",
      "https://wns2-db5p.notify.windows.com/w/?token=x",
    ])
      expect(allowedEndpoint(ok)).toBe(true);
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilpush.apple.com.example/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "no es url",
      `https://fcm.googleapis.com/${"x".repeat(1100)}`,
    ])
      expect(allowedEndpoint(bad)).toBe(false);
  });
});
