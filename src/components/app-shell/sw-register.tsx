"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { useI18n } from "@/i18n";

/** Mensaje que la página le manda al SW en espera (contrato con scripts/sw.template.js). */
export const SKIP_WAITING_MESSAGE = "SKIP_WAITING";

/**
 * Registra el service worker (solo producción; en dev estorba al hot reload) y,
 * cuando hay una versión nueva esperando, lo avisa. NUNCA recarga a la fuerza:
 * la persona decide cuándo («Actualizar») y puede seguir con lo que hace («Ahora no»).
 */
export function SwRegister() {
  const { t } = useI18n();
  // ServiceWorker = versión nueva esperando · "reload" = otra pestaña ya la activó y esta quedó con la vieja.
  const [waiting, setWaiting] = useState<ServiceWorker | "reload" | null>(null);
  const accepted = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;

    const sw = navigator.serviceWorker;
    // Tras aceptar, el SW nuevo toma el control y recargamos UNA vez.
    const onControllerChange = () => {
      if (accepted.current) window.location.reload();
      else setWaiting("reload"); // otra pestaña aceptó: esta avisa, no recarga sola
    };
    sw.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | undefined;
    const check = () => {
      // Sin controller es la primera instalación: no hay «versión anterior».
      if (registration?.waiting && sw.controller)
        setWaiting(registration.waiting);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible")
        registration?.update().catch(() => {});
    };

    sw.register("/sw.js")
      .then((reg) => {
        registration = reg;
        check();
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") check();
          });
        });
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {
        // Sin SW la app funciona igual (solo pierde el uso sin internet).
      });

    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sw-update-notice"
      className="fixed inset-x-3 top-2 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg lg:left-48"
    >
      <RefreshCw aria-hidden className="size-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm font-semibold">{t.update.notice}</p>
      <button
        type="button"
        onClick={() => {
          if (waiting === "reload") {
            window.location.reload();
            return;
          }
          accepted.current = true;
          waiting.postMessage({ type: SKIP_WAITING_MESSAGE });
        }}
        className="min-h-11 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
      >
        {t.update.action}
      </button>
      <button
        type="button"
        onClick={() => setWaiting(null)}
        className="min-h-11 rounded-lg px-2 text-sm font-semibold text-muted-foreground"
      >
        {t.update.later}
      </button>
    </div>
  );
}
