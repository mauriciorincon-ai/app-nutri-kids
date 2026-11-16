import { fromB64u, open, seal, type FamilyKeys, type Sealed } from "./crypto";

/**
 * Dónde se guardan las claves de la familia en el teléfono (regla dura 6): IndexedDB, como
 * claves NO exportables (CryptoKey) — ni este código ni un script ajeno pueden leer sus
 * bytes —, y el token de escritura cifrado con la propia clave de cifrado, jamás en claro.
 * La frase no se guarda: solo se usa para derivar y se olvida.
 */

const DB_NAME = "nutrikids-family";
const STORE = "keys";
const ROW = "main";

type Row = { family: string; enc: CryptoKey; id: CryptoKey; token: Sealed };

const aad = (family: string) => `nk1|token|${family}`;

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function db(idb: IDBFactory): Promise<IDBDatabase> {
  const req = idb.open(DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  return wrap(req);
}

async function run<T>(
  idb: IDBFactory,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db(idb);
  try {
    const tx = d.transaction(STORE, mode);
    const out = await wrap(fn(tx.objectStore(STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return out;
  } finally {
    d.close();
  }
}

const defaultIdb = (): IDBFactory => indexedDB;

export async function saveKeys(
  family: string,
  keys: FamilyKeys,
  idb: IDBFactory = defaultIdb(),
): Promise<void> {
  const token = await seal(keys.enc, keys.token, aad(family));
  const row: Row = { family, enc: keys.enc, id: keys.id, token };
  await run(idb, "readwrite", (s) => s.put(row, ROW));
}

/** Las claves de esa familia, o null si no hay (o son de otra familia, o no se pueden abrir). */
export async function loadKeys(
  family: string,
  idb?: IDBFactory,
): Promise<FamilyKeys | null> {
  try {
    const row = (await run(idb ?? defaultIdb(), "readonly", (s) =>
      s.get(ROW),
    )) as Row | undefined;
    if (!row || row.family !== family) return null;
    const token = await open(row.enc, row.token, aad(family));
    if (typeof token !== "string") return null;
    fromB64u(token); // base64url válido o lanza
    return { enc: row.enc, id: row.id, token };
  } catch {
    return null;
  }
}

export async function clearKeys(idb?: IDBFactory): Promise<void> {
  try {
    await run(idb ?? defaultIdb(), "readwrite", (s) => s.delete(ROW));
  } catch {
    /* sin IndexedDB: no hay nada guardado que borrar */
  }
}
