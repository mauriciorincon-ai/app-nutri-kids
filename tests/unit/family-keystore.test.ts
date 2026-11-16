// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import { deriveKeys, newSalt, open, seal } from "@/lib/family/crypto";
import { clearKeys, loadKeys, saveKeys } from "@/lib/family/keystore";

const FAMILY = "ABCDEFGHJK";

describe("almacén de claves del teléfono (IndexedDB)", () => {
  it("guarda claves NO exportables y las devuelve funcionando; el token no queda en claro", async () => {
    const idb = new IDBFactory();
    const keys = await deriveKeys("ABCDEFGHJKMNPQRSTVWX", newSalt());
    await saveKeys(FAMILY, keys, idb);

    const back = await loadKeys(FAMILY, idb);
    expect(back).not.toBeNull();
    expect(back!.token).toBe(keys.token);
    // Sigue sin poder exportarse y descifra lo que cifró la original.
    await expect(crypto.subtle.exportKey("raw", back!.enc)).rejects.toThrow();
    const sealed = await seal(keys.enc, { a: 1 }, "aad");
    expect(await open(back!.enc, sealed, "aad")).toEqual({ a: 1 });

    // Lo guardado en IndexedDB no contiene el token (ni su forma hex) en claro.
    const raw = await new Promise<unknown>((resolve, reject) => {
      const req = idb.open("nutrikids-family", 1);
      req.onsuccess = () => {
        const get = req.result
          .transaction("keys")
          .objectStore("keys")
          .get("main");
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      };
    });
    const row = raw as { token: unknown };
    expect(typeof row.token).toBe("object");
    expect(JSON.stringify(row.token)).not.toContain(keys.token);
  });

  it("otra familia, nada guardado o una fila alterada devuelven null", async () => {
    const idb = new IDBFactory();
    expect(await loadKeys(FAMILY, idb)).toBeNull();
    const keys = await deriveKeys("ABCDEFGHJKMNPQRSTVWX", newSalt());
    await saveKeys(FAMILY, keys, idb);
    expect(await loadKeys("ZZZZZZZZZZ", idb)).toBeNull();
  });

  it("salir borra las claves", async () => {
    const idb = new IDBFactory();
    const keys = await deriveKeys("ABCDEFGHJKMNPQRSTVWX", newSalt());
    await saveKeys(FAMILY, keys, idb);
    await clearKeys(idb);
    expect(await loadKeys(FAMILY, idb)).toBeNull();
  });
});
