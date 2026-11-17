import { setDeviceName } from "@/lib/device";
import { notifyLocalStore } from "@/lib/local-store";
import { touchFamily } from "@/lib/push/touch";

import { familyApi, type FamilyApi } from "./client";
import { clearKeys, loadKeys, loadSigner, saveKeys } from "./keystore";
import { browserLocal } from "./local";
import type { LogKind } from "./log";
import { newNoticeId } from "./notices";
import { formatCode, formatInvite } from "./phrase";
import {
  INVITE_TTL_MS,
  may,
  newInviteTag,
  type Member,
  type OpBody,
  type Role,
} from "./roster";
import { keyMark, type Signer } from "./sign";
import { rosterOf } from "./trust";
import { NOTICE_TEXT_MAX } from "./records";
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
  addOp,
  addOpResult,
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

export type MemberRow = {
  id: string;
  name: string;
  role: Role;
  meals: string[];
  self: boolean;
  seen: number;
};
/** Un teléfono que entró y aún no tiene rol (o es del S7 y aún no se actualiza). */
export type PendingRow = {
  id: string;
  name: string;
  /** La invitación con la que entró, si sigue abierta: el rol que el padre eligió al invitar. */
  invited: { role: Role; meals: string[] } | null;
  /** Ya mandó su llave: un padre puede darle un rol. false = debe actualizar la app. */
  ready: boolean;
  /** Huella de su llave («ABCD-EFGH»): el padre la compara con la que esa persona ve. */
  mark: string | null;
};
export type LogRow = {
  t: number;
  by: string;
  name: string;
  role: Role | null;
  k: LogKind;
  r: string;
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
  /** S9 · quién puede qué. null = este teléfono aún no tiene rol (espera a un padre). */
  role: Role | null;
  /** Comidas del colegio, si este teléfono es del colegio. */
  meals: string[];
  members: MemberRow[];
  waiting: PendingRow[];
  /** Huella de la llave de ESTE teléfono, para que quien confirma la compare. */
  mark: string | null;
  /** Invitación para dictar (código + huella); null si aún no hay roster. */
  invite: string | null;
  log: LogRow[];
  /** Cambios que llegaron sin firma válida o sin permiso, y no se aceptaron. */
  rejected: number;
  rosterIssue: "pin" | "invalid" | null;
  /** La lista de personas está llena: ya no admite cambios (lo ve el padre). */
  rosterFull: boolean;
  /** Nombres de quienes reescribieron su bitácora (se conservó lo ya visto). */
  rewritten: string[];
};

export type Keystore = {
  save(family: string, keys: FamilyKeys): Promise<void>;
  load(family: string): Promise<FamilyKeys | null>;
  clear(): Promise<void>;
  /** La llave de firma de este teléfono (S9); la crea la primera vez. */
  signer(): Promise<Signer>;
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
  /** Tras subir un aviso propio: despierta a los otros teléfonos (S8). Opcional en las pruebas. */
  touch?(ctx: FamilyCtx): Promise<unknown>;
};

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      reason:
        | Failure
        | "no-family"
        | "no-name"
        | "not-allowed"
        | "invalid"
        | "roster-full";
    };

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
  role: "parent",
  meals: [],
  members: [],
  waiting: [],
  mark: null,
  invite: null,
  log: [],
  rejected: 0,
  rosterIssue: null,
  rosterFull: false,
  rewritten: [],
};

const LOG_ROWS = 60;

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
  /**
   * Turno único para todo lo que lee el estado de la familia, espera la red o la firma y lo
   * vuelve a guardar: una sincronía lenta y un cambio de roster (o dos seguidos) escribirían
   * cada uno el estado que cargaron al empezar y el último borraría al primero (un `quitar`
   * perdido dejaría con derechos a quien ya salió; dos ops con el mismo `n` bifurcarían la
   * cadena del roster). En cola, cada uno carga el estado que dejó el anterior.
   */
  let turn: Promise<unknown> = Promise.resolve();
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = turn.then(fn, fn);
    turn = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
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
      const roster = await rosterOf(st.roster);
      const me = roster?.members[own.id];
      const nameOf = (id: string) =>
        id === own.id
          ? own.name
          : (st.devices[id]?.name ?? roster?.members[id]?.name ?? "—");
      const members: MemberRow[] = Object.values(roster?.members ?? {})
        .map((m: Member) => ({
          id: m.id,
          name: nameOf(m.id),
          role: m.role,
          meals: m.meals ?? [],
          self: m.id === own.id,
          seen: m.id === own.id ? st.lastSync : (st.devices[m.id]?.seen ?? 0),
        }))
        .sort((a, b) => Number(b.self) - Number(a.self) || b.seen - a.seen);
      const open = (tag: string | undefined) => {
        const inv = tag ? roster?.invites[tag] : undefined;
        return inv && deps.now() - inv.t < INVITE_TTL_MS
          ? { role: inv.role, meals: inv.meals ?? [] }
          : null;
      };
      const pendingRows: PendingRow[] = await Promise.all(
        Object.entries(st.devices)
          .filter(([id]) => id !== own.id && !roster?.members[id])
          .map(async ([id, d]) => ({
            id,
            name: d.name,
            invited: open(d.invite),
            ready: !!d.pub,
            mark: d.pub ? await keyMark(d.pub) : null,
          })),
      );
      const logRows: LogRow[] = [
        ...st.log.own.map((e) => ({ ...e, by: own.id })),
        ...Object.entries(st.log.others).flatMap(([by, ev]) =>
          ev.map((e) => ({ ...e, by })),
        ),
      ]
        .sort((a, b) => b.t - a.t || b.i - a.i)
        .slice(0, LOG_ROWS)
        .map((e) => ({
          t: e.t,
          by: e.by,
          name: nameOf(e.by),
          role: roster?.members[e.by]?.role ?? null,
          k: e.k,
          r: e.r,
        }));
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
        role: me?.role ?? null,
        meals: me?.meals ?? [],
        members,
        waiting: pendingRows,
        mark: await keyMark((await deps.keys.signer()).pub),
        invite: roster ? formatInvite(st.family, roster.pin) : null,
        log: logRows,
        rejected: st.rejected,
        rosterIssue: st.rosterIssue,
        rosterFull: st.rosterFull,
        rewritten: st.log.rewritten.map(nameOf),
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
    running = exclusive(async () => {
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
        signer: deps.keys.signer,
      });
      if (r.ok && r.changed) deps.notify();
      await setPhase(r.ok ? "idle" : phaseOf(r.reason));
      // Un aviso propio acaba de subir: el servidor despierta a los demás (sin saber qué dice).
      if (r.ok && r.noticesPushed > 0 && ctx)
        await deps.touch?.(ctx).catch(() => null);
    }).finally(() => {
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

  /**
   * Arranca la familia en este teléfono. Quien la crea firma el génesis (es padre) y su huella
   * queda fija; quien entra fija la huella que trajo la invitación y espera el roster.
   */
  async function begin(
    next: FamilyCtx,
    name: string,
    entry: { founder: true } | { pin: string; tag: string | null },
  ): Promise<ActionResult<{ keysSaved: boolean }>> {
    const keysSaved = await persistKeys(next.family, next.keys);
    ctx = next;
    setDeviceName(name);
    const st = freshFamilyState(next.family, next.epoch, deps.today());
    if ("founder" in entry) {
      const signer = await deps.keys.signer();
      const own = deps.local.deviceId();
      await addOp(st, signer, own, deps.now(), {
        type: "genesis",
        members: [{ id: own, name, role: "parent", pub: signer.pub }],
      });
    } else {
      st.pin = entry.pin;
      st.invite = entry.tag;
    }
    deps.state.save(st);
    await sync();
    return { ok: true, keysSaved };
  }

  /** Un cambio de roster firmado por este teléfono (solo si es padre). */
  async function rosterChange(body: OpBody): Promise<ActionResult> {
    const r = await exclusive(() => rosterChangeNow(body));
    if (r.ok) await sync();
    return r;
  }

  async function rosterChangeNow(body: OpBody): Promise<ActionResult> {
    const st = deps.state.load();
    if (!st || !(await ensureCtx())) return { ok: false, reason: "no-family" };
    const roster = await rosterOf(st.roster);
    if (roster?.members[deps.local.deviceId()]?.role !== "parent")
      return { ok: false, reason: "not-allowed" };
    const signer = await deps.keys.signer();
    const done = await addOpResult(
      st,
      signer,
      deps.local.deviceId(),
      deps.now(),
      body,
    );
    if (done === "full") {
      st.rosterFull = true;
      deps.state.save(st);
      await render();
      return { ok: false, reason: "roster-full" };
    }
    if (done === "invalid") return { ok: false, reason: "invalid" };
    deps.state.save(st);
    await render();
    return { ok: true };
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

    async create(name: string): Promise<
      ActionResult<{
        phrase: string;
        code: string;
        invite: string;
        keysSaved: boolean;
      }>
    > {
      if (!cleanName(name)) return { ok: false, reason: "no-name" };
      const r = await createFamily(deps.api);
      if (!r.ok) return r;
      const done = await begin(r.value.ctx, cleanName(name), { founder: true });
      if (!done.ok) return done;
      return {
        ok: true,
        phrase: r.value.phrase,
        code: formatCode(r.value.ctx.family),
        invite: formatInvite(r.value.ctx.family, deps.state.load()?.pin ?? ""),
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
      return begin(r.value.ctx, cleanName(name), {
        pin: r.value.invite.pin,
        tag: r.value.invite.tag,
      });
    },

    /**
     * Invitar con rol (solo un padre): deja la invitación firmada en el roster y devuelve lo que
     * se dicta (código + huella + etiqueta). Quien entre con ella aparece «esperando», con el
     * rol elegido, y un padre lo confirma con un toque.
     */
    async invite(
      role: Role,
      meals: string[] = [],
    ): Promise<ActionResult<{ invite: string }>> {
      const tag = newInviteTag();
      const r = await rosterChange({
        type: "invite",
        tag,
        role,
        meals: role === "school" ? meals : undefined,
      });
      if (!r.ok) return r;
      const st = deps.state.load()!;
      const roster = await rosterOf(st.roster);
      return { ok: true, invite: formatInvite(st.family, roster!.pin, tag) };
    },

    /** Dar o cambiar el rol de alguien (solo un padre). */
    async setRole(
      id: string,
      role: Role,
      meals: string[] = [],
    ): Promise<ActionResult> {
      const st = deps.state.load();
      if (!st) return { ok: false, reason: "no-family" };
      const roster = await rosterOf(st.roster);
      const known = roster?.members[id];
      const dev = st.devices[id];
      const pub =
        known?.pub ??
        dev?.pub ??
        (id === deps.local.deviceId()
          ? (await deps.keys.signer()).pub
          : undefined);
      if (!pub) return { ok: false, reason: "invalid" };
      const name =
        (id === deps.local.deviceId() ? deps.local.deviceName() : dev?.name) ||
        known?.name ||
        "—";
      const invite = !known && dev?.invite ? dev.invite : undefined;
      return rosterChange({
        type: "set",
        member: {
          id,
          name,
          role,
          pub,
          meals: role === "school" ? meals : undefined,
        },
        invite: invite && roster?.invites[invite] ? invite : undefined,
      });
    },

    /**
     * Quitar a alguien (solo un padre): sale del roster y la frase cambia (ADR-011 § 6), para
     * que su teléfono deje de poder leer lo nuevo. Devuelve la frase nueva.
     */
    async removeMember(
      id: string,
    ): Promise<ActionResult<{ phrase: string; keysSaved: boolean }>> {
      if (id === deps.local.deviceId()) return { ok: false, reason: "invalid" };
      const st = deps.state.load();
      const roster = st ? await rosterOf(st.roster) : null;
      if (roster?.members[id]) {
        const r = await rosterChange({ type: "remove", id });
        if (!r.ok) return r;
      } else if (roster?.members[deps.local.deviceId()]?.role !== "parent") {
        return { ok: false, reason: "not-allowed" };
      }
      return this.rotate();
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
      const done = await exclusive(
        async (): Promise<
          ActionResult<{ phrase: string; keysSaved: boolean }>
        > => {
          const st = deps.state.load();
          const here = await ensureCtx();
          if (!st || !here) return { ok: false, reason: "no-family" };
          const roster = await rosterOf(st.roster);
          if (
            roster &&
            roster.members[deps.local.deviceId()]?.role !== "parent"
          )
            return { ok: false, reason: "not-allowed" };
          const keep = await collectShared(
            {
              api: deps.api,
              ctx: here,
              local: deps.local,
              state: deps.state,
              now: deps.now,
              signer: deps.keys.signer,
            },
            st,
          );
          const r = await rotateFamily(deps.api, here, keep);
          if (!r.ok) {
            if (r.reason === "denied") await setPhase("locked");
            return r;
          }
          const keysSaved = await persistKeys(
            r.value.ctx.family,
            r.value.ctx.keys,
          );
          ctx = r.value.ctx;
          // El roster, su huella, la bitácora y las firmas siguen: la familia es la misma.
          deps.state.save({
            ...freshFamilyState(st.family, r.value.ctx.epoch, st.consent),
            planNotice: null,
            roster: st.roster,
            pin: st.pin,
            sigs: st.sigs,
            log: st.log,
            legacy: st.legacy,
          });
          return { ok: true, phrase: r.value.phrase, keysSaved };
        },
      );
      if (done.ok) await sync();
      return done;
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

    /**
     * «Avisar a la familia»: guarda la nota aquí, la sube con el resto (cifrada, como todo) y
     * despierta a los otros teléfonos. Sin red queda guardada y sale al volver (`queued`).
     */
    async sendNotice(text: string): Promise<ActionResult<{ queued: boolean }>> {
      const here = await ensureCtx();
      if (!here) return { ok: false, reason: "no-family" };
      const name = deps.local.deviceName();
      if (!name) return { ok: false, reason: "no-name" };
      // Con roster, solo un rol que avisa (todos menos nutricionista): lo demás nadie lo aceptaría.
      const st0 = deps.state.load();
      const roster = st0 ? await rosterOf(st0.roster) : null;
      if (
        roster &&
        !may(roster.members[deps.local.deviceId()], { k: "notice" })
      )
        return { ok: false, reason: "not-allowed" };
      const clean = text.trim();
      if (!clean || clean.length > NOTICE_TEXT_MAX)
        return { ok: false, reason: "error" };
      deps.local.mergeNotice(newNoticeId(), {
        text: clean,
        name,
        by: deps.local.deviceId(),
        t: deps.now(),
        date: deps.today(),
      });
      deps.notify();
      await sync();
      const st = deps.state.load();
      const pending = Object.keys(deps.local.notices()).some(
        (id) => st?.pushed[`notice:${id}`] === undefined,
      );
      return { ok: true, queued: pending };
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
      signer: () => loadSigner(),
    },
    now: () => Date.now(),
    online: () => (typeof navigator === "undefined" ? true : navigator.onLine),
    notify: notifyLocalStore,
    touch: (ctx) => touchFamily(ctx.family, ctx.keys.token),
    today: () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
  });
  return singleton;
}
