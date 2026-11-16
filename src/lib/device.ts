import { newDeviceId } from "@/lib/family/phrase";

/**
 * La identidad de ESTE teléfono (S7): un id al azar que sella lo que escribe («por quién») y
 * un nombre que la persona le pone («Mamá», «Abuela»). Vive solo en el aparato; el nombre
 * viaja cifrado en el registro del teléfono, jamás en claro. No es un dato del niño.
 */

export const DEVICE_KEY = "nutrikids.device.v1";
export const DEVICE_NAME_MAX = 30;

type Stored = { id: string; name: string };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): Stored | null {
  try {
    const raw = storage()?.getItem(DEVICE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Stored>;
    if (typeof p.id !== "string" || !/^[0-9A-Z]{12}$/.test(p.id)) return null;
    return {
      id: p.id,
      name: typeof p.name === "string" ? p.name.slice(0, DEVICE_NAME_MAX) : "",
    };
  } catch {
    return null;
  }
}

function write(d: Stored): void {
  try {
    storage()?.setItem(DEVICE_KEY, JSON.stringify(d));
  } catch {
    /* sin almacenamiento: el id vive en memoria esta sesión */
  }
}

let memory: Stored | null = null;

function current(): Stored {
  const stored = read();
  if (stored) return stored;
  memory ??= { id: newDeviceId(), name: "" };
  write(memory);
  return memory;
}

/** Id de este teléfono (12 caracteres). Se crea la primera vez que hace falta. */
export function getDeviceId(): string {
  return current().id;
}

export function getDeviceName(): string {
  return current().name;
}

/** Guarda el nombre (recortado y acotado). Devuelve el nombre guardado. */
export function setDeviceName(name: string): string {
  const next = { ...current(), name: name.trim().slice(0, DEVICE_NAME_MAX) };
  memory = next;
  write(next);
  return next.name;
}

/** «Borrar datos» y salir de la familia: el id y el nombre se van con el resto. */
export function clearDevice(): void {
  memory = null;
  try {
    storage()?.removeItem(DEVICE_KEY);
  } catch {
    /* nada */
  }
}
