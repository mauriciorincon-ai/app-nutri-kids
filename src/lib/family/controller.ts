import { setDeviceName } from "@/lib/device";
import { notifyLocalStore } from "@/lib/local-store";

import { familyApi, type FamilyApi } from "./client";
import { clearKeys, loadKeys, saveKeys } from "./keystore";
import { browserLocal } from "./local";
import { formatCode } from "./phrase";
import {
  createFamily,
  destroyFamily,
  joinFamily,
  rotateFamily,
  type Failure,
  type FamilyCtx,
} from "./session";
import {
  clearFamilyLocal,
  freshFamilyState,
  loadFamilyState,
  saveFamilyState,
  type FamilyState,
} from "./state";
import {
  collectShared,
  countPending,
  syncOnce,
  type LocalData,
  type StateStore,
} from "./sync";
import type { FamilyKeys } from "./crypto";

/**
 * El director de la familia en este teléfono (S7): sabe si hay familia, sincroniza cuando toca
 * (al abrir, al volver a la app, al volver la red, tras cada cambio y cada 30 s con la app a la
 * vista) y ejecuta las acciones de Ajustes. Sin React: la pantalla lo lee con `useFamily`.
 * Todo entra por `ControllerDeps` para que las pruebas lo corran contra el doble del servidor.
 */

export type FamilyPhase =
  | "off"
  | "idle"
  | "syncing"
  | "offline"
  | "locked"
  | "unavailable"
  | "full"
  | "error";

export type PhoneRow = {
  id: string;
  name: string;
  seen: number;
  self: boolean;
};

export type FamilyView = {
  phase: FamilyPhase;
  /** Código de la familia con guiones; null sin familia. */
  code: string | null;
  lastSync: number;
  pending: number;
  planNotice: "theirs" | "mine" | null;
  planTooBig: boolean;
  /** Días o perfil que no caben en lo compartido y se quedan solo en este teléfono. */
  oversize: number;
  unreadable: number;
  phones: PhoneRow[];
  ownId: string;
  ownName: string;
};

export type Keystore = {
  save(family: string, keys: FamilyKeys): Promise<void>;
  load(family: string): Promise<FamilyKeys | null>;
  clear(): Promise<void>;
};

export type ControllerDeps = {
  api: FamilyApi;
  local: LocalData;
  state: StateStore & { clear(): void };
  keys: Keystore;
  now(): number;
  online(): boolean;
  /** Avisa a la pantalla que los datos locales cambiaron (relee). */
  notify(): void;
  today(): string;
};

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; reason: Failure | "no-family" | "no-name" };

export const OFF_VIEW: FamilyView = {
  phase: "off",
  code: null,
  lastSync: 0,
  pending: 0,
  planNotice: null,
  planTooBig: false,
  oversize: 0,
  unreadable: 0,
  phones: [],
  ownId: "",
  ownName: "",
};

function phaseOf(reason: Failure): FamilyPhase {
  if (reason === "offline") return "offline";
  if (reason === "unavailable") return "unavailable";
  if (reason === "denied") return "locked";
  if (reason === "full") return "full";
  return "error";
}

export function createController(deps: ControllerDeps) {
  let ctx: FamilyCtx | null = null;
  let view: FamilyView = OFF_VIEW;
  let phase: FamilyPhase = "off";
  let running: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  async function render(): Promise<void> {
    const st = deps.state.load();
    if (!st) {
      view = OFF_VIEW;
    } else {
      const own = { id: deps.local.deviceId(), name: deps.local.deviceName() };
      const phones: PhoneRow[] = [
        { id: own.id, name: own.name, seen: st.lastSync, self: true },
        ...Object.entries(st.devices)
          .filter(([id]) => id !== own.id)
          .map(([id, d]) => ({ id, name: d.name, seen: d.seen, self: false }))
          .sort((a, b) => b.seen - a.seen),
      ];
      const pending = await countPending(
        { local: deps.local, state: deps.state, now: deps.now },
        st,
      );
      view = {
        phase,
        code: formatCode(st.family),
        lastSync: st.lastSync,
        pending,
        planNotice: st.planNotice,
        planTooBig: st.planTooBig,
        oversize: st.oversize,
        unreadable: st.unreadable,
        phones,
        ownId: own.id,
        ownName: own.name,
      };
    }
    for (const l of listeners) l();
  }

  async function setPhase(next: FamilyPhase): Promise<void> {
    phase = next;
    await render();
  }

  /** Una pasada de sincronización; si ya hay una corriendo, espera a esa. */
  function sync(): Promise<void> {
    if (running) return running;
    running = (async () => {
      const st = deps.state.load();
      if (!st) {
        await setPhase("off");
        return;
      }
      if (!ctx) {
        const keys = await deps.keys.load(st.family);
        if (!keys) {
          // Sin claves en este teléfono no se puede descifrar ni subir: hay que volver a entrar.
          await setPhase("locked");
          return;
        }
        ctx = { family: st.family, epoch: st.epoch, keys };
      }
      if (!deps.online()) {
        await setPhase("offline");
        return;
      }
      await setPhase("syncing");
      const r = await syncOnce({
        api: deps.api,
        ctx,
        local: deps.local,
        state: deps.state,
        now: deps.now,
      });
      if (r.ok && r.changed) deps.notify();
      await setPhase(r.ok ? "idle" : phaseOf(r.reason));
    })().finally(() => {
      running = null;
    });
    return running;
  }

  /**
   * Guarda las claves en este teléfono. Si IndexedDB falla, la familia sigue viva en memoria
   * (el servidor ya cambió: abortar aquí dejaría a todos sin acceso) y se avisa que al cerrar la
   * app habrá que volver a entrar con la frase.
   */
  async function persistKeys(
    family: string,
    keys: FamilyKeys,
  ): Promise<boolean> {
    try {
      await deps.keys.save(family, keys);
      return true;
    } catch {
      return false;
    }
  }

  async function begin(
    next: FamilyCtx,
    name: string,
  ): Promise<ActionResult<{ keysSaved: boolean }>> {
    const keysSaved = await persistKeys(next.family, next.keys);
    ctx = next;
    setDeviceName(name);
    deps.state.save(freshFamilyState(next.family, next.epoch, deps.today()));
    await sync();
    return { ok: true, keysSaved };
  }

  /** El contexto de la familia; si la app acaba de abrirse, lo arma con las claves guardadas. */
  async function ensureCtx(): Promise<FamilyCtx | null> {
    if (ctx) return ctx;
    const st = deps.state.load();
    if (!st) return null;
    const keys = await deps.keys.load(st.family);
    if (!keys) return null;
    ctx = { family: st.family, epoch: st.epoch, keys };
    return ctx;
  }

  const cleanName = (n: string) => n.trim();
  let changeTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getView: () => view,
    sync,

    /** ¿Responde el servicio de compartir? (para no ofrecer crear una familia que no se puede crear). */
    async health(): Promise<"ready" | "unavailable" | "offline"> {
      const r = await deps.api.health();
      if (!r.ok) return r.status === 0 ? "offline" : "unavailable";
      return r.data.available ? "ready" : "unavailable";
    },

    async create(
      name: string,
    ): Promise<
      ActionResult<{ phrase: string; code: string; keysSaved: boolean }>
    > {
      if (!cleanName(name)) return { ok: false, reason: "no-name" };
      const r = await createFamily(deps.api);
      if (!r.ok) return r;
      const done = await begin(r.value.ctx, cleanName(name));
      if (!done.ok) return done;
      return {
        ok: true,
        phrase: r.value.phrase,
        code: formatCode(r.value.ctx.family),
        keysSaved: done.keysSaved,
      };
    },

    async join(
      code: string,
      phrase: string,
      name: string,
    ): Promise<ActionResult<{ keysSaved: boolean }>> {
      if (!cleanName(name)) return { ok: false, reason: "no-name" };
      const r = await joinFamily(deps.api, code, phrase);
      if (!r.ok) return r;
      return begin(r.value, cleanName(name));
    },

    async rename(name: string): Promise<ActionResult> {
      if (!cleanName(name)) return { ok: false, reason: "no-name" };
      setDeviceName(name);
      await render();
      void sync();
      return { ok: true };
    },

    /** Frase nueva: sirve para sacar a un teléfono o si se perdió. Los demás vuelven a entrar. */
    async rotate(): Promise<
      ActionResult<{ phrase: string; keysSaved: boolean }>
    > {
      const st = deps.state.load();
      const here = await ensureCtx();
      if (!st || !here) return { ok: false, reason: "no-family" };
      const keep = await collectShared(
        {
          api: deps.api,
          ctx: here,
          local: deps.local,
          state: deps.state,
          now: deps.now,
        },
        st,
      );
      const r = await rotateFamily(deps.api, here, keep);
      if (!r.ok) {
        if (r.reason === "denied") await setPhase("locked");
        return r;
      }
      const keysSaved = await persistKeys(r.value.ctx.family, r.value.ctx.keys);
      ctx = r.value.ctx;
      deps.state.save({
        ...freshFamilyState(st.family, r.value.ctx.epoch, st.consent),
        planNotice: null,
      });
      await sync();
      return { ok: true, phrase: r.value.phrase, keysSaved };
    },

    /** Salir de la familia en este teléfono: sus datos se quedan, las claves se van. */
    async leave(): Promise<ActionResult> {
      // Un sync en curso terminaría después y reescribiría el estado de una familia que
      // ya no es nuestra: primero se espera a que acabe y se cancela el turno pendiente.
      clearTimeout(changeTimer);
      if (running) await running.catch(() => undefined);
      ctx = null;
      deps.state.clear();
      await deps.keys.clear();
      await setPhase("off");
      return { ok: true };
    },

    /** Borra lo compartido del servidor (cada teléfono conserva su copia) y sale. */
    async destroy(): Promise<ActionResult> {
      const here = await ensureCtx();
      if (!here) return { ok: false, reason: "no-family" };
      const r = await destroyFamily(deps.api, here);
      // Si ya no existe o ya no autoriza, igual hay que salir de aquí.
      if (!r.ok && r.reason !== "denied" && r.reason !== "wrong-code") return r;
      return this.leave();
    },

    async dismissNotice(): Promise<void> {
      const st = deps.state.load();
      if (!st?.planNotice) return;
      deps.state.save({ ...st, planNotice: null });
      await render();
    },

    /** Engancha los disparadores. Devuelve la función que los quita. */
    start(): () => void {
      const onVisible = () => {
        if (document.visibilityState === "visible") void sync();
      };
      const onOnline = () => void sync();
      const onOffline = () => void render();
      const poll = setInterval(() => {
        if (document.visibilityState === "visible") void sync();
      }, 30_000);
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      void sync();
      return () => {
        clearTimeout(changeTimer);
        clearInterval(poll);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    },

    /** Disparador «tras cada cambio»: lo llama el proveedor cuando cambia lo local. */
    changed(): void {
      if (!deps.state.load()) return;
      void render();
      // Un cambio propio sube pronto, sin esperar al turno de 30 s.
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => void sync(), 1500);
    },
  };
}

export type Controller = ReturnType<typeof createController>;

let singleton: Controller | null = null;

/** El director de este teléfono, con el navegador de verdad. */
export function getFamily(): Controller {
  singleton ??= createController({
    api: familyApi(),
    local: browserLocal(),
    state: {
      load: loadFamilyState,
      save: (s: FamilyState) => void saveFamilyState(s),
      clear: clearFamilyLocal,
    },
    keys: {
      save: (family, keys) => saveKeys(family, keys),
      load: (family) => loadKeys(family),
      clear: () => clearKeys(),
    },
    now: () => Date.now(),
    online: () => (typeof navigator === "undefined" ? true : navigator.onLine),
    notify: notifyLocalStore,
    today: () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
  });
  return singleton;
}
