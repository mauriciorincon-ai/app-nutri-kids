import { getDoneIds } from "@/lib/diet/day-log";
import type { DietPlan } from "@/lib/diet/schema";
import { getDeviceId } from "@/lib/device";
import { toB64u } from "@/lib/family/crypto";
import { loadKeys } from "@/lib/family/keystore";
import { loadFamilyState } from "@/lib/family/state";
import { digest } from "@/lib/family/sync";

import { browserPush, type BrowserPush } from "./browser";
import { pushApi, type FamilyProof, type PushApi } from "./client";
import {
  clearCopy,
  COPY_VERSION,
  saveCopy,
  saveFamilyPointer,
  type FamilyPointer,
  type PushCopy,
} from "./copy";
import { localParts, WINDOW_MINUTES } from "./due";
import {
  forTypes,
  planItems,
  serverWakes,
  wakeDone,
  type PushTypes,
} from "./schedule";
import {
  clearPushState,
  freshPushState,
  loadPushState,
  savePushState,
  type PushState,
} from "./state";
import { pushTexts } from "./text";

/**
 * El director de los avisos en este teléfono (S8 · ADR-012): prende y apaga, lleva los tipos
 * y «ocultar el detalle», mantiene al servidor al día con las horas del plan (sin etiqueta),
 * deja la copia que lee el trabajador, y pide saltar un despertar cuando ya se marcó. Sin
 * React: la pantalla lo lee con `usePush`. Todo entra por `PushDeps` (pruebas sin navegador).
 */

export type PushStatus =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "unavailable"
  | "off"
  | "denied"
  | "on";

export type PushError =
  "offline" | "worker" | "dismissed" | "server" | "full" | "lost" | null;

export type PushView = {
  status: PushStatus;
  types: PushTypes;
  hide: boolean;
  busy: boolean;
  error: PushError;
  /** Este teléfono está en una familia (los avisos de la familia dependen de eso). */
  inFamily: boolean;
};

export type FamilyInfo = FamilyPointer & { token: string };

export type PushDeps = {
  api: PushApi;
  state: {
    load(): PushState | null;
    save(s: PushState): boolean;
    clear(): void;
  };
  browser: BrowserPush;
  copy: {
    save(c: PushCopy): Promise<boolean>;
    pointer(p: FamilyPointer | null): Promise<boolean>;
    clear(): Promise<void>;
  };
  diet(): DietPlan;
  locale(): "es" | "en";
  family(): Promise<FamilyInfo | null>;
  /** Marcas de HOY (checkIds). */
  doneIds(): string[];
  now(): number;
  timeZone(): string;
  randomToken(): string;
};

export const OFF_PUSH_VIEW: PushView = {
  status: "checking",
  types: { supplements: true, meals: true, water: true, family: true },
  hide: false,
  busy: false,
  error: null,
  inFamily: false,
};

export function createPushController(deps: PushDeps) {
  let view: PushView = OFF_PUSH_VIEW;
  let refreshing: Promise<void> | null = null;
  let again = false;
  const listeners = new Set<() => void>();

  function emit(patch: Partial<PushView>) {
    view = { ...view, ...patch };
    for (const l of listeners) l();
  }

  function proof(fam: FamilyInfo | null, types: PushTypes): FamilyProof {
    return fam && types.family ? { code: fam.family, token: fam.token } : null;
  }

  /** Las horas y los avisos de hoy según el plan, el idioma y los tipos de este teléfono. */
  function build(state: PushState) {
    const text = pushTexts(deps.locale());
    const all = planItems(deps.diet(), deps.locale(), text.schedule);
    const items = forTypes(all, state.types);
    return { items, wakes: serverWakes(items), text: text.copy };
  }

  async function writeCopy(state: PushState, fam: FamilyInfo | null) {
    const { items, text } = build(state);
    const { date } = localParts(deps.now(), deps.timeZone());
    await deps.copy.save({
      v: COPY_VERSION,
      types: state.types,
      hide: state.hide,
      items,
      done: { date, ids: deps.doneIds() },
      text,
    });
    await deps.copy.pointer(
      fam
        ? { family: fam.family, epoch: fam.epoch, seq: fam.seq, self: fam.self }
        : null,
    );
  }

  /** Le dice al servidor lo que cambió; si ya no nos conoce (venció), nos vuelve a registrar. */
  async function syncServer(
    state: PushState,
    endpoint: string,
    fam: FamilyInfo | null,
  ): Promise<{ state: PushState; error: PushError }> {
    const tz = deps.timeZone();
    const { wakes } = build(state);
    const family = proof(fam, state.types);
    const fp = await digest({ endpoint, tz, wakes, fam: family?.code ?? null });
    if (fp === state.sent) return { state, error: null };
    const upd = await deps.api.update(state.token, {
      id: state.id,
      endpoint,
      tz,
      wakes,
      family,
    });
    if (upd.ok) return { state: { ...state, sent: fp }, error: null };
    if (upd.status === 0) return { state, error: "offline" };
    if (upd.error === "family-full") return { state, error: "full" };
    if (upd.status === 403) {
      const token = deps.randomToken();
      const sub = await deps.api.subscribe({
        endpoint,
        token,
        tz,
        wakes,
        family,
      });
      if (!sub.ok)
        return { state, error: sub.status === 0 ? "offline" : "server" };
      return {
        state: {
          ...state,
          id: sub.data.id,
          token,
          sent: fp,
          skipped: { date: "1970-01-01", ms: [] },
        },
        error: null,
      };
    }
    return { state, error: "server" };
  }

  /** Los despertares de hoy que ya están todos marcados: el servidor los salta. */
  async function syncSkips(state: PushState): Promise<PushState> {
    const here = localParts(deps.now(), deps.timeZone());
    const { items } = build(state);
    const done = deps.doneIds();
    const target = new Set<number>();
    for (const w of serverWakes(items)) {
      if (
        w.m > here.minute - WINDOW_MINUTES &&
        wakeDone(items, w.m, here.dow, done)
      )
        target.add(w.m);
    }
    const prev = new Set(
      state.skipped.date === here.date ? state.skipped.ms : [],
    );
    const kept = new Set<number>(
      [...prev].filter((m) => m > here.minute - WINDOW_MINUTES),
    );
    for (const m of target) {
      if (prev.has(m)) continue;
      const r = await deps.api.skip(state.token, {
        id: state.id,
        date: here.date,
        m,
        on: true,
      });
      if (r.ok) kept.add(m);
    }
    for (const m of [...kept]) {
      if (target.has(m)) continue;
      const r = await deps.api.skip(state.token, {
        id: state.id,
        date: here.date,
        m,
        on: false,
      });
      if (r.ok) kept.delete(m);
    }
    return {
      ...state,
      skipped: { date: here.date, ms: [...kept].sort((a, b) => a - b) },
    };
  }

  async function runRefresh(): Promise<void> {
    const state0 = deps.state.load();
    if (!state0) return;
    const fam = await deps.family();
    emit({ inFamily: fam !== null });
    if (deps.browser.permission() !== "granted") {
      emit({ status: "denied" });
      return;
    }
    const endpoint = await deps.browser.endpoint();
    if (!endpoint) {
      // El navegador quitó la suscripción: no hay a dónde enviar. Se limpia y se dice.
      await forget(state0, true);
      emit({ status: "off", error: "lost" });
      return;
    }
    const synced = await syncServer(state0, endpoint, fam);
    let state = synced.state;
    if (synced.error === null) state = await syncSkips(state);
    deps.state.save(state);
    await writeCopy(state, fam);
    emit({
      status: "on",
      types: state.types,
      hide: state.hide,
      error: synced.error === "offline" ? null : synced.error,
    });
  }

  /** Quita todo lo de este teléfono. `server` dice si también se le pide al servidor. */
  async function forget(state: PushState | null, server: boolean) {
    let serverOk = !server || state === null;
    if (server && state) {
      const r = await deps.api.unsubscribe(state.token, state.id);
      serverOk = r.ok || r.status === 403; // 403: el servidor ya no lo conoce
    }
    if (state) await deps.browser.unsubscribe();
    deps.state.clear();
    await deps.copy.clear();
    return serverOk;
  }

  const ctl = {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getView: () => view,

    /** Estado inicial, sin red: lo que el navegador y este teléfono ya saben. */
    async init(): Promise<void> {
      const support = deps.browser.support();
      if (support !== "supported") {
        emit({ status: support });
        return;
      }
      const state = deps.state.load();
      if (!state) {
        emit({
          status: deps.browser.permission() === "denied" ? "denied" : "off",
        });
        return;
      }
      emit({ types: state.types, hide: state.hide, status: "on" });
      await ctl.refresh();
    },

    /** Pone al día al servidor y a la copia con lo que hay ahora. Una a la vez, sin perder la última. */
    refresh(): Promise<void> {
      if (!deps.state.load()) return Promise.resolve();
      if (refreshing) {
        again = true;
        return refreshing;
      }
      refreshing = (async () => {
        do {
          again = false;
          await runRefresh();
        } while (again);
      })().finally(() => {
        refreshing = null;
      });
      return refreshing;
    },

    /** El botón: el permiso se pide aquí, una vez, y solo si el servicio responde. */
    async enable(): Promise<void> {
      if (view.busy) return;
      emit({ busy: true, error: null });
      try {
        const h = await deps.api.health();
        if (!h.ok) {
          emit(
            h.status === 0 ? { error: "offline" } : { status: "unavailable" },
          );
          return;
        }
        if (!h.data.available || !h.data.key) {
          emit({ status: "unavailable" });
          return;
        }
        let perm = deps.browser.permission();
        if (perm === "default") perm = await deps.browser.requestPermission();
        if (perm === "denied") {
          emit({ status: "denied" });
          return;
        }
        if (perm !== "granted") {
          emit({ error: "dismissed" });
          return;
        }
        const endpoint = await deps.browser.subscribe(h.data.key);
        if (!endpoint) {
          emit({ error: "worker" });
          return;
        }
        const fam = await deps.family();
        const token = deps.randomToken();
        const base = freshPushState("", token);
        const { wakes } = build(base);
        const tz = deps.timeZone();
        const family = proof(fam, base.types);
        const sub = await deps.api.subscribe({
          endpoint,
          token,
          tz,
          wakes,
          family,
        });
        if (!sub.ok) {
          emit({
            error:
              sub.status === 0
                ? "offline"
                : sub.error === "family-full"
                  ? "full"
                  : "server",
          });
          return;
        }
        const state: PushState = {
          ...base,
          id: sub.data.id,
          sent: await digest({
            endpoint,
            tz,
            wakes,
            fam: family?.code ?? null,
          }),
        };
        deps.state.save(state);
        const done = await syncSkips(state);
        deps.state.save(done);
        await writeCopy(done, fam);
        emit({
          status: "on",
          types: done.types,
          hide: done.hide,
          inFamily: fam !== null,
        });
      } finally {
        emit({ busy: false });
      }
    },

    async setType(key: keyof PushTypes, on: boolean): Promise<void> {
      const state = deps.state.load();
      if (!state) return;
      const next = { ...state, types: { ...state.types, [key]: on } };
      deps.state.save(next);
      emit({ types: next.types });
      await ctl.refresh();
    },

    async setHide(on: boolean): Promise<void> {
      const state = deps.state.load();
      if (!state) return;
      const next = { ...state, hide: on };
      deps.state.save(next);
      emit({ hide: on });
      await ctl.refresh();
    },

    /** «Dejar de recibir avisos» y «Borrar datos»: devuelve si el servidor también la borró. */
    async disable(): Promise<{ server: boolean }> {
      emit({ busy: true, error: null });
      try {
        const state = deps.state.load();
        const server = await forget(state, true);
        emit({
          status:
            deps.browser.support() === "supported" &&
            deps.browser.permission() === "denied"
              ? "denied"
              : "off",
        });
        return { server };
      } finally {
        emit({ busy: false });
      }
    },
  };
  return ctl;
}

export type PushController = ReturnType<typeof createPushController>;

/** Este teléfono, con el navegador de verdad. Sin tocar nada hasta que se pida. */
let singleton: PushController | null = null;
let holder: { diet: DietPlan | null; locale: "es" | "en" } = {
  diet: null,
  locale: "es",
};

export function configurePush(diet: DietPlan, locale: "es" | "en"): void {
  holder = { diet, locale };
}

export async function realFamilyInfo(): Promise<FamilyInfo | null> {
  const st = loadFamilyState();
  if (!st || st.locked) return null;
  const keys = await loadKeys(st.family);
  if (!keys) return null;
  return {
    family: st.family,
    epoch: st.epoch,
    seq: st.since,
    self: getDeviceId(),
    token: keys.token,
  };
}

export function getPush(): PushController {
  singleton ??= createPushController({
    api: pushApi(),
    state: {
      load: loadPushState,
      save: savePushState,
      clear: clearPushState,
    },
    browser: browserPush(),
    copy: {
      save: (c) => saveCopy(c),
      pointer: (p) => saveFamilyPointer(p),
      clear: () => clearCopy(),
    },
    diet: () => {
      if (!holder.diet) throw new Error("push: no diet configured");
      return holder.diet;
    },
    locale: () => holder.locale,
    family: realFamilyInfo,
    doneIds: () => getDoneIds(new Date()),
    now: () => Date.now(),
    timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    randomToken: () => toB64u(crypto.getRandomValues(new Uint8Array(32))),
  });
  return singleton;
}
