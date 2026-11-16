"use client";

import { useEffect } from "react";

import { getFamily } from "@/lib/family/controller";
import { subscribe } from "@/lib/local-store";

/**
 * Pone a sincronizar a la familia mientras la app está abierta: al abrir, al volver a la app, al
 * volver la red, cada 30 s a la vista y poco después de cada cambio. No pinta nada. Sin familia
 * no hace ninguna llamada a la red.
 */
export function FamilySync() {
  useEffect(() => {
    const family = getFamily();
    const stop = family.start();
    const off = subscribe(() => family.changed());
    return () => {
      off();
      stop();
    };
  }, []);
  return null;
}
