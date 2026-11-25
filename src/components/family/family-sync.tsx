"use client";

import { useEffect } from "react";

import { getFamily } from "@/lib/family/controller";
import { subscribe } from "@/lib/local-store";
import { subscribePressure } from "@/lib/pressure/store";

/**
 * Pone a sincronizar a la familia mientras la app está abierta: al abrir, al volver a la app, al
 * volver la red, cada 30 s a la vista y poco después de cada cambio. No pinta nada. Sin familia
 * no hace ninguna llamada a la red. El registro de presión (S14) avisa con su propio evento: sin
 * escucharlo, lo anotado esperaba al sondeo de 30 s.
 */
export function FamilySync() {
  useEffect(() => {
    const family = getFamily();
    const stop = family.start();
    const off = subscribe(() => family.changed());
    const offPressure = subscribePressure(() => family.changed());
    return () => {
      off();
      offPressure();
      stop();
    };
  }, []);
  return null;
}
