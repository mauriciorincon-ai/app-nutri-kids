import type { PushTypes, WakeItem } from "./schedule";

/**
 * La copia mínima que el trabajador lee al llegar un toque (S8 · ADR-012). El trabajador
 * no ve `localStorage`: la página deja aquí, en IndexedDB del propio teléfono, lo que toca
 * a cada hora (ya en el idioma elegido), lo marcado hoy y, si hay familia, dónde leer sus
 * avisos. Nada de esto sale del teléfono. Contrato con `scripts/sw-push.js` (regla 19).
 */

export const PUSH_DB = "nutrikids-push";
export const PUSH_STORE = "kv";
export const COPY_VERSION = 1;

export type NoticeText = { title: string; body: string };

export type PushCopy = {
  v: typeof COPY_VERSION;
  types: PushTypes;
  /** «Ocultar el detalle»: con el teléfono bloqueado solo se ve un aviso genérico. */
  hide: boolean;
  items: WakeItem[];
  done: { date: string; ids: string[] };
  text: {
    generic: NoticeText;
    hidden: NoticeText;
    allDone: NoticeText;
    many: string;
    /** «Aviso de {name}». */
    familyFrom: string;
    familyGeneric: NoticeText;
  };
};

/** Dónde leer los avisos de la familia: su código, su época, desde qué seq y quién soy. */
export type FamilyPointer = {
  family: string;
  epoch: number;
  seq: number;
  self: string;
};

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function open(idb: IDBFactory): Promise<IDBDatabase> {
  const req = idb.open(PUSH_DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(PUSH_STORE);
  return wrap(req);
}

async function write(
  idb: IDBFactory,
  fn: (s: IDBObjectStore) => void,
): Promise<void> {
  const d = await open(idb);
  try {
    const tx = d.transaction(PUSH_STORE, "readwrite");
    fn(tx.objectStore(PUSH_STORE));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    d.close();
  }
}

const defaultIdb = (): IDBFactory | null =>
  typeof indexedDB === "undefined" ? null : indexedDB;

export async function saveCopy(
  copy: PushCopy,
  idb: IDBFactory | null = defaultIdb(),
): Promise<boolean> {
  if (!idb) return false;
  try {
    await write(idb, (s) => s.put(copy, "copy"));
    return true;
  } catch {
    return false;
  }
}

export async function saveFamilyPointer(
  pointer: FamilyPointer | null,
  idb: IDBFactory | null = defaultIdb(),
): Promise<boolean> {
  if (!idb) return false;
  try {
    await write(idb, (s) =>
      pointer ? s.put(pointer, "family") : s.delete("family"),
    );
    return true;
  } catch {
    return false;
  }
}

export async function readKey(
  key: string,
  idb: IDBFactory | null = defaultIdb(),
): Promise<unknown> {
  if (!idb) return undefined;
  const d = await open(idb);
  try {
    return await wrap(
      d.transaction(PUSH_STORE).objectStore(PUSH_STORE).get(key),
    );
  } finally {
    d.close();
  }
}

/** «Dejar de recibir avisos» y «Borrar datos»: la copia se va entera. */
export async function clearCopy(
  idb: IDBFactory | null = defaultIdb(),
): Promise<void> {
  if (!idb) return;
  try {
    await write(idb, (s) => s.clear());
  } catch {
    /* sin IndexedDB: no hay nada que borrar */
  }
}
