"use client";

import { useRef, useSyncExternalStore } from "react";

/**
 * Puente React ↔ localStorage vía useSyncExternalStore (evita setState en
 * effects y es hidratación-segura: el servidor ve el fallback, el cliente
 * lee el dispositivo al hidratar).
 *
 * Tras CUALQUIER escritura a los stores de lib/diet se llama notifyLocalStore()
 * para que todos los consumidores relean.
 */

const listeners = new Set<() => void>();
let version = 0;

export function notifyLocalStore(): void {
  version++;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Lee un valor derivado de localStorage. `read` corre solo en cliente;
 * `serverFallback` DEBE ser referencia estable (constante de módulo).
 * `key` invalida el cache cuando cambia el contexto de lectura (p.ej. la fecha).
 */
export function useLocalStore<T>(
  read: () => T,
  serverFallback: T,
  key = "",
): T {
  const cache = useRef<{ version: number; key: string; value: T } | null>(null);
  return useSyncExternalStore(
    subscribe,
    () => {
      if (
        !cache.current ||
        cache.current.version !== version ||
        cache.current.key !== key
      ) {
        cache.current = { version, key, value: read() };
      }
      return cache.current.value;
    },
    () => serverFallback,
  );
}

/** true solo tras hidratar — para no afirmar "demo" antes de leer el dispositivo. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
