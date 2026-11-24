"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { kidModeOn, subscribeKidMode } from "@/lib/adventure/kidmode";

/**
 * Modo niño (S14 · ADR-020 · G-Plan 2a): mientras el teléfono está en la aventura, cualquier
 * pantalla lo devuelve a `/aventura` — también con el botón Atrás. Para una URL escrita a mano ya
 * lo hizo el script del `<head>`, antes de pintar. Solo la salida del adulto apaga la bandera.
 */
export function KidGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const kid = useSyncExternalStore(subscribeKidMode, kidModeOn, () => false);
  useEffect(() => {
    if (kid && pathname !== "/aventura") router.replace("/aventura");
  }, [kid, pathname, router]);
  return null;
}
