import { fromB64u } from "@/lib/family/crypto";

/**
 * Lo que el navegador del teléfono sabe hacer con los avisos, detrás de una interfaz pequeña
 * para que el director (`controller.ts`) se pruebe sin navegador. El permiso se pide aquí y
 * solo cuando la persona toca el botón (regla 24).
 */

export type Support = "supported" | "needs-install" | "unsupported";
export type Permission = "default" | "granted" | "denied";

export type BrowserPush = {
  support(): Support;
  permission(): Permission;
  requestPermission(): Promise<Permission>;
  /** ¿Hay una versión nueva de la app esperando turno (su trabajador aún no manda)? */
  updatePending(): Promise<boolean>;
  /** La dirección de push de este teléfono; null si no hay trabajador listo. */
  subscribe(applicationServerKey: string): Promise<string | null>;
  endpoint(): Promise<string | null>;
  unsubscribe(): Promise<void>;
};

const WORKER_WAIT_MS = 4000;

function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), WORKER_WAIT_MS),
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export function browserPush(): BrowserPush {
  return {
    support() {
      if (typeof window === "undefined") return "unsupported";
      if (isIos() && !isStandalone()) return "needs-install";
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        return "unsupported";
      return "supported";
    },
    permission() {
      return "Notification" in window ? Notification.permission : "denied";
    },
    async requestPermission() {
      return Notification.requestPermission();
    },
    async updatePending() {
      if (!("serviceWorker" in navigator)) return false;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        return Boolean(reg?.waiting);
      } catch {
        return false;
      }
    },
    async subscribe(key) {
      const reg = await registration();
      if (!reg) return null;
      try {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: fromB64u(key),
        });
        return sub.endpoint;
      } catch {
        return null;
      }
    },
    async endpoint() {
      const reg = await registration();
      if (!reg) return null;
      try {
        return (await reg.pushManager.getSubscription())?.endpoint ?? null;
      } catch {
        return null;
      }
    },
    async unsubscribe() {
      const reg = await registration();
      try {
        await (await reg?.pushManager.getSubscription())?.unsubscribe();
      } catch {
        /* sin suscripción que quitar */
      }
    },
  };
}
