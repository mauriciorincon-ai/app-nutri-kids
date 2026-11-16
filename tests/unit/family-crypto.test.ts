// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  IV_BYTES,
  PBKDF2_ITERATIONS,
  aadFor,
  deriveKeys,
  fromB64u,
  newSalt,
  open,
  recordId,
  seal,
  toB64u,
} from "@/lib/family/crypto";

const PHRASE = "ABCDEFGHJKMNPQRSTVWX";
const OTHER = "ABCDEFGHJKMNPQRSTVW0";

describe("cifrado de la familia (WebCrypto)", () => {
  it("PBKDF2 con al menos 600 000 vueltas y sal de 16 bytes", () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(fromB64u(newSalt())).toHaveLength(16);
    expect(newSalt()).not.toBe(newSalt());
  });

  it("deriveKeys le pide de verdad a WebCrypto ≥ 600 000 vueltas de PBKDF2-SHA-256 con la sal de la familia", async () => {
    const spy = vi.spyOn(crypto.subtle, "deriveBits");
    try {
      const salt = newSalt();
      await deriveKeys(PHRASE, salt);
      const call = spy.mock.calls.find(
        ([algo]) => (algo as Pbkdf2Params).name === "PBKDF2",
      );
      expect(call).toBeTruthy();
      const algo = call![0] as Pbkdf2Params;
      expect(algo.iterations).toBeGreaterThanOrEqual(600_000);
      expect(algo.hash).toBe("SHA-256");
      expect([...new Uint8Array(algo.salt as ArrayBuffer)]).toEqual([
        ...fromB64u(salt),
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it("base64url de ida y vuelta, sin + / ni =", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const s = toB64u(bytes);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect([...fromB64u(s)]).toEqual([...bytes]);
  });

  it("cifra y descifra de ida y vuelta; la clave no se puede exportar", async () => {
    const salt = newSalt();
    const keys = await deriveKeys(PHRASE, salt);
    expect(keys.enc.extractable).toBe(false);
    expect(keys.id.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", keys.enc)).rejects.toThrow();
    const value = {
      n: "day:2026-11-15",
      d: { marks: { "meal:a": { t: 1, by: "x", v: { at: "08:00" } } } },
    };
    const sealed = await seal(keys.enc, value, aadFor("F", 1, "id"));
    expect(await open(keys.enc, sealed, aadFor("F", 1, "id"))).toEqual(value);
    // La misma frase y sal dan las mismas piezas (otro teléfono abre lo mismo).
    const again = await deriveKeys(PHRASE, salt);
    expect(again.token).toBe(keys.token);
    expect(await open(again.enc, sealed, aadFor("F", 1, "id"))).toEqual(value);
  });

  it("un IV nuevo en cada registro: 1 000 cifrados del mismo texto, ningún IV repetido", async () => {
    const keys = await deriveKeys(PHRASE, newSalt());
    const ivs = new Set<string>();
    const cts = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const s = await seal(keys.enc, { same: true }, "aad");
      expect(fromB64u(s.iv)).toHaveLength(IV_BYTES);
      ivs.add(s.iv);
      cts.add(s.ct);
    }
    expect(ivs.size).toBe(1000);
    expect(cts.size).toBe(1000);
  });

  it("frase equivocada: no abre nada, devuelve null sin pistas; y el token es otro", async () => {
    const salt = newSalt();
    const good = await deriveKeys(PHRASE, salt);
    const bad = await deriveKeys(OTHER, salt);
    expect(bad.token).not.toBe(good.token);
    const sealed = await seal(good.enc, { secreto: "SENTINEL" }, "aad");
    expect(await open(bad.enc, sealed, "aad")).toBeNull();
  });

  it("otra sal con la misma frase da otras claves (cambiar la frase = sal nueva)", async () => {
    const a = await deriveKeys(PHRASE, newSalt());
    const b = await deriveKeys(PHRASE, newSalt());
    expect(a.token).not.toBe(b.token);
  });

  it("el cifrado queda atado a familia, época y registro; un byte cambiado no abre", async () => {
    const keys = await deriveKeys(PHRASE, newSalt());
    const sealed = await seal(keys.enc, { a: 1 }, aadFor("F", 1, "id1"));
    expect(await open(keys.enc, sealed, aadFor("F", 2, "id1"))).toBeNull();
    expect(await open(keys.enc, sealed, aadFor("F", 1, "id2"))).toBeNull();
    expect(await open(keys.enc, sealed, aadFor("G", 1, "id1"))).toBeNull();
    const ct = fromB64u(sealed.ct);
    ct[0] ^= 1;
    expect(
      await open(
        keys.enc,
        { iv: sealed.iv, ct: toB64u(ct) },
        aadFor("F", 1, "id1"),
      ),
    ).toBeNull();
    expect(await open(keys.enc, { iv: "!!", ct: "??" }, "x")).toBeNull();
  });

  it("el tamaño va relleno a múltiplos de 256: un día con una marca y con diez pesan igual", async () => {
    const keys = await deriveKeys(PHRASE, newSalt());
    const one = await seal(keys.enc, { m: ["a"] }, "x");
    const ten = await seal(
      keys.enc,
      { m: Array.from({ length: 10 }, (_, i) => `m${i}`) },
      "x",
    );
    expect(fromB64u(one.ct).length).toBe(fromB64u(ten.ct).length);
    expect((fromB64u(one.ct).length - 16) % 256).toBe(0);
  });

  it("el id de un registro es opaco, estable y de 16 bytes", async () => {
    const keys = await deriveKeys(PHRASE, newSalt());
    const a = await recordId(keys.id, "day:2026-11-15");
    expect(a).toBe(await recordId(keys.id, "day:2026-11-15"));
    expect(a).not.toBe(await recordId(keys.id, "day:2026-11-16"));
    expect(fromB64u(a)).toHaveLength(16);
    expect(a).not.toContain("2026");
  });
});
