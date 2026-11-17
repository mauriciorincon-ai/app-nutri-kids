import type { DayRegs } from "@/lib/diet/day-log";
import type { ProfileRegs } from "@/lib/diet/profile-notes";

import type { FamilyApi } from "./client";
import { acceptLog, sealLog } from "./log";
import { mergePlan } from "./merge";
import {
  dayName,
  deviceName,
  logName,
  noticeName,
  type DeviceShared,
  type LogShared,
  type Named,
  type NoticeShared,
} from "./records";
import { appendEvent } from "./log";
import {
  appendOp,
  chooseChain,
  foldRoster,
  opHash,
  ROSTER_MAX_OPS,
  type OpBody,
} from "./roster";
import { canon, sign, type Signer } from "./sign";
import {
  checkDay,
  checkDevice,
  checkNotice,
  checkPlan,
  checkProfile,
  devicePayload,
  noticePayload,
  planPayload,
  rosterOf,
  signOwn,
} from "./trust";
import {
  pullSince,
  pushNamed,
  type Failure,
  type FamilyCtx,
  type Outgoing,
} from "./session";
import { ITEM_MAX_CT, PLAN_MAX_CT } from "./server/limits";
import type { FamilyState } from "./state";

/**
 * Una pasada de sincronización (S7 · ADR-011): baja lo nuevo, lo mezcla con lo de este
 * teléfono, y sube lo que el servidor aún no tiene de él. Sin pantalla, sin reloj propio y sin
 * almacenamiento fijo: todo entra por `SyncDeps`, así las pruebas corren dos teléfonos juntos.
 *
 * Lo que viaja: el plan, el día (marcas, horas, notas y quién), el perfil con sus notas y el
 * registro de cada teléfono (nombre cifrado). Idioma, tema y preferencias del teléfono: jamás.
 *
 * «Cola sin red»: no hay una lista aparte. Lo pendiente es lo que difiere de la huella de lo
 * último que el servidor aceptó; sin red no se sube nada y al volver se sube todo junto.
 */

export type PlanSide = { t: number; by: string; diet: unknown };

export type LocalData = {
  deviceId(): string;
  deviceName(): string;
  days(): Record<string, DayRegs>;
  mergeDay(day: string, regs: DayRegs): boolean;
  profile(): ProfileRegs;
  mergeProfile(regs: ProfileRegs): boolean;
  /** El plan real con su sello; null si este teléfono no tiene uno. */
  plan(): PlanSide | null;
  /** Aplica el plan que llegó (lo valida); false si no encaja. */
  applyPlan(plan: PlanSide): boolean;
  /** Los avisos de la familia de hoy y ayer, por id (S8). */
  notices(): Record<string, NoticeShared>;
  /** Suma un aviso que llegó; true si es nuevo en este teléfono. */
  mergeNotice(id: string, notice: NoticeShared): boolean;
};

export type StateStore = {
  load(): FamilyState | null;
  save(state: FamilyState): void;
};

export type SyncDeps = {
  api: FamilyApi;
  ctx: FamilyCtx;
  local: LocalData;
  state: StateStore;
  now(): number;
  /** La llave de firma de este teléfono (S9): no exportable, en IndexedDB. */
  signer(): Promise<Signer>;
};

export type SyncResult =
  | {
      ok: true;
      changed: boolean;
      pushed: number;
      pending: number;
      /** Avisos propios que acaban de subir: hay que despertar a los otros teléfonos. */
      noticesPushed: number;
    }
  | { ok: false; reason: Failure };

/**
 * Lo que pesará un registro ya cifrado (base64url), calculado ANTES de cifrar y en bytes
 * (no en caracteres: un acento pesa 2 bytes y un emoji 4), con margen por el relleno y la
 * etiqueta de AES-GCM. Si pasa el tope del servidor, ese registro no viaja y la pantalla lo dice:
 * mandarlo haría que el servidor rechazara TODA la subida, y nada más se compartiría.
 */
export function sealedSize(value: unknown): number {
  const bytes = new TextEncoder().encode(canon(value)).length;
  return Math.ceil(((Math.ceil((bytes + 64) / 256) + 1) * 256 * 4) / 3);
}
const DEVICE_REFRESH_MS = 10 * 60 * 1000;
const ROUNDS = 3;

export { canon };

/** Huella corta (SHA-256) del contenido. Solo se guarda en este teléfono. */
export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canon(value));
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h).slice(0, 8)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const planKey = (p: { t: number; by: string }) => `${p.t}.${p.by}`;
const hasDay = (r: DayRegs) =>
  Object.keys(r.marks).length > 0 || Object.keys(r.notes).length > 0;
const hasProfile = (r: ProfileRegs) =>
  r.textures !== undefined || Object.keys(r.notes).length > 0;

type Candidate = { named: Named; hash: string };
type CandidateDeps = Omit<SyncDeps, "api" | "ctx" | "signer"> & {
  signer?: SyncDeps["signer"];
};

const rosterRef = (b: OpBody): string =>
  b.type === "genesis"
    ? "genesis"
    : b.type === "set"
      ? `set:${b.member.id}:${b.member.role}`
      : b.type === "remove"
        ? `remove:${b.id}`
        : `invite:${b.role}`;

/**
 * Suma un cambio de roster firmado por este teléfono, si encadena y vale (quien firma es padre,
 * queda al menos un padre, cabe). Lo anota en la bitácora propia. Dice POR QUÉ no entró:
 * `full` (la lista de la familia ya no admite más cambios: tope de 120 o de peso) o `invalid`
 * (no encadena o no vale), porque a quien lo intenta le toca hacer cosas distintas.
 */
export async function addOpResult(
  st: FamilyState,
  signer: Signer,
  own: string,
  now: number,
  body: OpBody,
): Promise<"ok" | "full" | "invalid"> {
  if (st.roster.length >= ROSTER_MAX_OPS) return "full";
  const op = await appendOp(st.roster, signer, own, now, body);
  const next = [...st.roster, op];
  // El tope también es de peso: una cadena que no cabe en un registro haría que el servidor
  // rechazara TODA la subida. Con los nombres y comidas más largos llegaría antes de las 120.
  if (sealedSize({ ops: next }) > ITEM_MAX_CT) return "full";
  const r = await foldRoster({ ops: next });
  if (!r) return "invalid";
  st.roster = next;
  st.pin ??= r.pin;
  st.log.own = await appendEvent(st.log.own, now, "roster", rosterRef(body));
  return "ok";
}

export async function addOp(
  st: FamilyState,
  signer: Signer,
  own: string,
  now: number,
  body: OpBody,
): Promise<boolean> {
  return (await addOpResult(st, signer, own, now, body)) === "ok";
}

/**
 * Todo lo de este teléfono que se comparte, con la huella de cada cosa. Con `signer`, firma lo
 * propio que aún no tiene firma (plan, avisos, el registro del teléfono, la bitácora) y guarda
 * la firma en el estado: firmar de nuevo daría otra firma (ECDSA es al azar) y otra subida.
 */
async function candidates(
  d: CandidateDeps,
  st: FamilyState,
): Promise<{ list: Candidate[]; planTooBig: boolean; oversize: number }> {
  const out: Candidate[] = [];
  let planTooBig = false;
  let oversize = 0;
  const signer = d.signer ? await d.signer() : null;
  const own = d.local.deviceId();
  const plan = d.local.plan();
  if (plan) {
    if (sealedSize(plan) > PLAN_MAX_CT) planTooBig = true;
    else {
      const key = planKey(plan);
      let s = st.sigs.plan?.h === key ? st.sigs.plan.s : undefined;
      if (!s && signer && plan.by === own) {
        s = await sign(signer, planPayload(plan));
        st.sigs.plan = { h: key, s };
        // Un padre que cambió una línea del plan unido deja `merged.last` con el mismo
        // sello del plan: la bitácora lo anota como `plan-line` (ADR-014), con la línea.
        const last = (
          plan.diet as { merged?: { last?: { key?: unknown; t?: unknown } } }
        )?.merged?.last;
        const line =
          last && last.t === plan.t && typeof last.key === "string"
            ? last.key.slice(0, 100)
            : null;
        st.log.own = await appendEvent(
          st.log.own,
          plan.t || d.now(),
          line ? "plan-line" : "plan",
          line ?? "plan",
        );
      }
      out.push({ named: { name: "plan", data: { ...plan, s } }, hash: key });
    }
  }
  const profile = d.local.profile();
  if (hasProfile(profile) && sealedSize(profile) > ITEM_MAX_CT) oversize++;
  else if (hasProfile(profile))
    out.push({
      named: { name: "profile", data: profile },
      hash: await digest(profile),
    });
  for (const [day, regs] of Object.entries(d.local.days()))
    if (hasDay(regs) && sealedSize(regs) > ITEM_MAX_CT) oversize++;
    else if (hasDay(regs))
      out.push({
        named: { name: dayName(day), data: regs },
        hash: await digest(regs),
      });
  for (const [nid, notice] of Object.entries(d.local.notices())) {
    const name = noticeName(nid);
    const h = `${notice.t}`;
    let s = notice.s ?? (st.sigs[name]?.h === h ? st.sigs[name].s : undefined);
    if (!s && signer && notice.by === own) {
      s = await sign(signer, noticePayload(name, notice));
      st.sigs[name] = { h, s };
      st.log.own = await appendEvent(st.log.own, notice.t, "notice", nid);
    }
    out.push({ named: { name, data: { ...notice, s } }, hash: h });
  }
  // Las firmas de avisos que ya no están (solo viven hoy y ayer) se sueltan.
  const live = new Set(Object.keys(d.local.notices()).map(noticeName));
  for (const k of Object.keys(st.sigs))
    if (k.startsWith("notice:") && !live.has(k as `notice:${string}`))
      delete st.sigs[k];
  const name = d.local.deviceName();
  if (name) {
    const dev: DeviceShared = {
      id: own,
      name,
      seen: d.now(),
      consent: st.consent,
      pub: signer?.pub,
      invite: st.invite ?? undefined,
    };
    const key = deviceName(own);
    if (signer) {
      const h = await digest(devicePayload(dev));
      if (st.sigs[key]?.h !== h)
        st.sigs[key] = { h, s: await sign(signer, devicePayload(dev)) };
      dev.s = st.sigs[key].s;
    }
    out.push({
      named: { name: key, data: dev },
      hash: await digest({
        id: own,
        name,
        consent: st.consent,
        invite: st.invite,
        signed: !!dev.s,
        bucket: Math.floor(d.now() / DEVICE_REFRESH_MS),
      }),
    });
  }
  if (st.roster.length)
    out.push({
      named: { name: "roster", data: { ops: st.roster } },
      hash: await opHash(st.roster.at(-1)!),
    });
  if (st.log.own.length) {
    const last = st.log.own.at(-1)!;
    const h = `${last.i}.${last.t}`;
    let s = st.sigs.log?.h === h ? st.sigs.log.s : undefined;
    if (!s && signer) {
      s = (await sealLog(signer, own, st.log.own)).s;
      st.sigs.log = { h, s };
    }
    if (s) {
      const data: LogShared = { by: own, ev: st.log.own, s };
      out.push({ named: { name: logName(own), data }, hash: h });
    }
  }
  return { list: out, planTooBig, oversize };
}

async function outgoing(
  d: CandidateDeps,
  st: FamilyState,
): Promise<{ list: Candidate[]; planTooBig: boolean; oversize: number }> {
  const all = await candidates(d, st);
  return {
    planTooBig: all.planTooBig,
    oversize: all.oversize,
    list: all.list.filter((c) => st.pushed[c.named.name] !== c.hash),
  };
}

/** Cuántos cambios del niño (plan, día, perfil) faltan por subir; el registro del teléfono no cuenta. */
export async function countPending(
  d: CandidateDeps,
  st: FamilyState,
): Promise<number> {
  // Sin llave: solo se cuenta, nada se firma ni se toca del estado.
  const copy = structuredClone(st);
  const { list } = await outgoing({ ...d, signer: undefined }, copy);
  return list.filter(
    (c) =>
      !c.named.name.startsWith("device:") && !c.named.name.startsWith("log:"),
  ).length;
}

/** TODO lo compartible de este teléfono (para subirlo tras cambiar la frase). */
export async function collectShared(
  d: SyncDeps,
  st: FamilyState,
): Promise<Named[]> {
  return (await candidates(d, st)).list.map((c) => c.named);
}

/** Orden al procesar lo que bajó: primero el roster, luego los teléfonos, luego lo demás. */
const rank = (name: string) =>
  name === "roster"
    ? 0
    : name.startsWith("device:")
      ? 1
      : name.startsWith("log:")
        ? 2
        : 3;

export async function syncOnce(d: SyncDeps): Promise<SyncResult> {
  const st = d.state.load();
  if (!st) return { ok: false, reason: "error" };
  const own = d.local.deviceId();
  const signer = await d.signer();
  let changed = false;
  let pushedCount = 0;
  let noticesPushed = 0;

  const fail = (reason: Failure): SyncResult => {
    if (reason === "denied") st.locked = true;
    d.state.save(st);
    return { ok: false, reason };
  };

  // 0 · Firmar lo que este teléfono anotó desde la última vez (y anotarlo en su bitácora).
  const signed = await signOwn(
    signer,
    own,
    d.local.days(),
    d.local.profile(),
    st.log.own,
  );
  for (const [day, regs] of Object.entries(signed.days))
    d.local.mergeDay(day, regs);
  if (signed.profile) d.local.mergeProfile(signed.profile);
  st.log.own = signed.log;

  for (let round = 0; round < ROUNDS; round++) {
    // 1 · Bajar lo nuevo.
    const pulled = await pullSince(d.api, d.ctx, st.since);
    if (!pulled.ok) return fail(pulled.reason);
    st.locked = false;
    // Se acumula: lo que no se pudo abrir se salta para siempre, y el aviso no debe desaparecer solo.
    st.unreadable += pulled.value.unreadable;
    let remotePlan: (PlanSide & { s?: string }) | null = null;
    let roster = await rosterOf(st.roster);
    const items = [...pulled.value.items].sort(
      (a, b) => rank(a.named.name) - rank(b.named.name),
    );

    for (const { named, ver } of items) {
      st.vers[named.name] = ver;
      if (named.name === "roster") {
        const data = named.data as { ops: FamilyState["roster"] };
        const choice = await chooseChain(st.roster, data, st.pin, own);
        if (choice.take === "remote") {
          st.roster = data.ops;
          st.pin ??= choice.roster.pin;
          st.rosterIssue = null;
          st.migrate = false;
          // Dos padres cambiaron a la vez y el de este teléfono perdió: lo firma de nuevo encima.
          for (const op of choice.replay)
            await addOp(st, signer, own, d.now(), op.body);
          roster = await rosterOf(st.roster);
          changed = true;
        } else if (choice.take === "reject") {
          if (st.roster.length === 0) st.rosterIssue = choice.why;
          else st.rejected++;
        }
        st.pushed.roster = await opHash(data.ops.at(-1)!);
      } else if (named.name.startsWith("device:")) {
        const dev = named.data as DeviceShared;
        // Alguien pisó el registro de este teléfono: se vuelve a subir el bueno.
        if (dev.id === own && dev.s !== st.sigs[named.name]?.s)
          delete st.pushed[named.name];
        if (dev.id !== own) {
          const kind = await checkDevice(roster, dev);
          if (kind)
            st.devices[dev.id] = {
              name: dev.name,
              seen: dev.seen,
              pub: dev.pub,
              invite: kind === "pending" ? dev.invite : undefined,
            };
          else if (!dev.pub && !roster?.members[dev.id])
            // Un teléfono del S7 que aún no se actualiza: se muestra, pero no escribe.
            st.devices[dev.id] = { name: dev.name, seen: dev.seen };
          else st.rejected++;
        }
      } else if (named.name.startsWith("log:")) {
        const id = named.name.slice(4);
        if (id === own && (named.data as LogShared).s !== st.sigs.log?.s)
          delete st.pushed[named.name];
        if (id !== own) {
          const v = await acceptLog(
            st.log.others[id] ?? [],
            named.data,
            roster?.members[id]?.pub,
          );
          if (v.ok) {
            if (v.changed) {
              st.log.others[id] = v.ev;
              changed = true;
            }
          } else if (v.why === "rewritten") {
            if (!st.log.rewritten.includes(id)) st.log.rewritten.push(id);
          } else st.rejected++;
        }
      } else if (named.name === "plan") {
        const plan = named.data as PlanSide & { s?: string };
        if (await checkPlan(roster, plan, d.now())) remotePlan = plan;
        else {
          if (plan.by !== own) st.rejected++;
          // Un padre vuelve a subir el plan bueno para que nadie se quede con el falso.
          if (roster?.members[own]?.role === "parent") delete st.pushed.plan;
        }
      } else if (named.name === "profile") {
        const c = await checkProfile(
          roster,
          named.data as ProfileRegs,
          own,
          d.now(),
        );
        st.rejected += c.dropped;
        if (d.local.mergeProfile(c.regs)) changed = true;
        st.pushed.profile = await digest(named.data);
      } else if (named.name.startsWith("day:")) {
        const c = await checkDay(
          roster,
          named.name,
          named.data as DayRegs,
          own,
          d.now(),
        );
        st.rejected += c.dropped;
        if (d.local.mergeDay(named.name.slice(4), c.regs)) changed = true;
        st.pushed[named.name] = await digest(named.data);
      } else if (named.name.startsWith("notice:")) {
        const notice = named.data as NoticeShared;
        // Un aviso ajeno o el eco del propio: el almacén local solo suma lo nuevo.
        if (await checkNotice(roster, named.name, notice, d.now())) {
          if (d.local.mergeNotice(named.name.slice(7), notice)) changed = true;
          st.pushed[named.name] = `${notice.t}`;
        } else {
          if (notice.by !== own) st.rejected++;
          // Si el aviso bueno vive aquí, se vuelve a subir encima del falso.
          if (d.local.notices()[named.name.slice(7)])
            delete st.pushed[named.name];
          else st.pushed[named.name] = `${notice.t}`;
        }
      }
    }
    st.since = Math.max(st.since, pulled.value.seq);

    // 1b · Familia del S7 sin roster: este teléfono firma el génesis con él como padre.
    if (st.roster.length === 0 && st.migrate && !st.rosterIssue) {
      const others = Object.keys(st.devices).filter((id) => id !== own);
      const ok = await addOp(st, signer, own, d.now(), {
        type: "genesis",
        members: [
          {
            id: own,
            name: d.local.deviceName() || "—",
            role: "parent",
            pub: signer.pub,
          },
        ],
      });
      if (ok) {
        st.migrate = false;
        st.legacy = others;
        roster = await rosterOf(st.roster);
      }
    }
    // 1c · Los teléfonos que ya estaban (S7) entran como cuidadores al mandar su llave.
    if (roster?.members[own]?.role === "parent" && st.legacy.length) {
      for (const id of [...st.legacy]) {
        const dev = st.devices[id];
        if (roster.members[id]) {
          st.legacy = st.legacy.filter((x) => x !== id);
        } else if (dev?.pub) {
          const ok = await addOp(st, signer, own, d.now(), {
            type: "set",
            member: {
              id,
              name: dev.name || "—",
              role: "caregiver",
              pub: dev.pub,
            },
          });
          if (ok) st.legacy = st.legacy.filter((x) => x !== id);
        }
      }
      roster = await rosterOf(st.roster);
    }

    // 2 · El plan, entero y por versión.
    if (remotePlan) {
      const local = d.local.plan();
      const rkey = planKey(remotePlan);
      const keepSig = () => {
        if (remotePlan?.s) st.sigs.plan = { h: rkey, s: remotePlan.s };
      };
      if (rkey === st.pushed.plan) {
        // Es el eco de lo último que subió este mismo teléfono: no hay nada nuevo que mezclar.
      } else if (!local) {
        if (d.local.applyPlan(remotePlan)) {
          st.pushed.plan = rkey;
          keepSig();
          changed = true;
        }
      } else if (planKey(local) === rkey) {
        st.pushed.plan = rkey;
        keepSig();
      } else {
        const dirty = planKey(local) !== st.pushed.plan;
        const m = mergePlan(local, dirty, remotePlan);
        if (m.winner === remotePlan) {
          if (d.local.applyPlan(remotePlan)) {
            st.pushed.plan = rkey;
            keepSig();
            changed = true;
            if (m.conflict) st.planNotice = "theirs";
          }
        } else if (m.conflict) {
          st.planNotice = "mine";
        }
      }
    }

    // 3 · Subir lo que el servidor aún no tiene.
    const out = await outgoing(d, st);
    st.planTooBig = out.planTooBig;
    st.oversize = out.oversize;
    if (out.list.length === 0) break;
    const batch: Outgoing[] = out.list.map((c) => ({
      named: c.named,
      ver: st.vers[c.named.name] ?? 0,
    }));
    const pushed = await pushNamed(d.api, d.ctx, batch);
    if (!pushed.ok) return fail(pushed.reason);
    let conflicts = 0;
    for (const res of pushed.value) {
      const mine = out.list.find((c) => c.named.name === res.name)!;
      if (res.status === "ok") {
        st.vers[res.name] = res.ver;
        st.pushed[res.name] = mine.hash;
        pushedCount++;
        if (res.name.startsWith("notice:")) noticesPushed++;
      } else if (res.status === "conflict") {
        st.vers[res.name] = res.ver;
        conflicts++;
      } else {
        return fail("full");
      }
    }
    if (conflicts === 0) break;
    // Alguien escribió en medio: se vuelve a bajar y a mezclar antes de reintentar.
  }

  st.lastSync = d.now();
  d.state.save(st);
  const pending = await countPending(d, st);
  return { ok: true, changed, pushed: pushedCount, pending, noticesPushed };
}
