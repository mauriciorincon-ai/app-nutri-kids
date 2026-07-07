"use client";

import { useEffect } from "react";

/** Registra el service worker (solo producción; en dev estorba al hot reload). */
export function SwRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin SW la app funciona igual (solo pierde el caché estático offline).
    });
  }, []);
  return null;
}
