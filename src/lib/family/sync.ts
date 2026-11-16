import type { DayRegs } from "@/lib/diet/day-log";
import type { ProfileRegs } from "@/lib/diet/profile-notes";

import type { FamilyApi } from "./client";
import { mergePlan } from "./merge";
import {
  dayName,
  deviceName,
  noticeName,
  type Named,
  type NoticeShared,
} from "./records";
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

/** JSON con claves ordenadas: el mismo contenido da el mismo texto, en cualquier orden. */
export function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

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

/** Todo lo de este teléfono que se comparte, con la huella de cada cosa. */
async function candidates(
  d: SyncDeps,
  st: FamilyState,
): Promise<{ list: Candidate[]; planTooBig: boolean; oversize: number }> {
  const out: Candidate[] = [];
  let planTooBig = false;
  let oversize = 0;
  const plan = d.local.plan();
  if (plan) {
    if (sealedSize(plan) > PLAN_MAX_CT) planTooBig = true;
    else
      out.push({
        named: { name: "plan", data: plan },
        hash: planKey(plan),
      });
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
  for (const [nid, notice] of Object.entries(d.local.notices()))
    out.push({
      named: { name: noticeName(nid), data: notice },
      hash: `${notice.t}`,
    });
  const id = d.local.deviceId();
  const name = d.local.deviceName();
  if (name) {
    const own = {
      id,
      name,
      seen: d.now(),
      consent: st.consent,
    };
    out.push({
      named: { name: deviceName(id), data: own },
      hash: await digest({
        id,
        name,
        consent: st.consent,
        bucket: Math.floor(d.now() / DEVICE_REFRESH_MS),
      }),
    });
  }
  return { list: out, planTooBig, oversize };
}

async function outgoing(
  d: SyncDeps,
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
  d: Omit<SyncDeps, "api" | "ctx">,
  st: FamilyState,
): Promise<number> {
  const { list } = await outgoing(d as SyncDeps, st);
  return list.filter((c) => !c.named.name.startsWith("device:")).length;
}

/** TODO lo compartible de este teléfono (para subirlo tras cambiar la frase). */
export async function collectShared(
  d: SyncDeps,
  st: FamilyState,
): Promise<Named[]> {
  return (await candidates(d, st)).list.map((c) => c.named);
}

export async function syncOnce(d: SyncDeps): Promise<SyncResult> {
  const st = d.state.load();
  if (!st) return { ok: false, reason: "error" };
  const own = d.local.deviceId();
  let changed = false;
  let pushedCount = 0;
  let noticesPushed = 0;

  const fail = (reason: Failure): SyncResult => {
    if (reason === "denied") st.locked = true;
    d.state.save(st);
    return { ok: false, reason };
  };

  for (let round = 0; round < ROUNDS; round++) {
    // 1 · Bajar lo nuevo.
    const pulled = await pullSince(d.api, d.ctx, st.since);
    if (!pulled.ok) return fail(pulled.reason);
    st.locked = false;
    // Se acumula: lo que no se pudo abrir se salta para siempre, y el aviso no debe desaparecer solo.
    st.unreadable += pulled.value.unreadable;
    let remotePlan: PlanSide | null = null;

    for (const { named, ver } of pulled.value.items) {
      st.vers[named.name] = ver;
      if (named.name === "plan") {
        remotePlan = named.data;
      } else if (named.name === "profile") {
        if (d.local.mergeProfile(named.data)) changed = true;
        st.pushed.profile = await digest(named.data);
      } else if (named.name.startsWith("day:")) {
        if (d.local.mergeDay(named.name.slice(4), named.data as DayRegs))
          changed = true;
        st.pushed[named.name] = await digest(named.data);
      } else if (named.name.startsWith("notice:")) {
        // Un aviso ajeno o el eco del propio: el almacén local solo suma lo nuevo.
        if (
          d.local.mergeNotice(named.name.slice(7), named.data as NoticeShared)
        )
          changed = true;
        st.pushed[named.name] = `${(named.data as NoticeShared).t}`;
      } else if (named.name.startsWith("device:")) {
        const dev = named.data as { id: string; name: string; seen: number };
        if (dev.id !== own)
          st.devices[dev.id] = { name: dev.name, seen: dev.seen };
      }
    }
    st.since = Math.max(st.since, pulled.value.seq);

    // 2 · El plan, entero y por versión.
    if (remotePlan) {
      const local = d.local.plan();
      const rkey = planKey(remotePlan);
      if (rkey === st.pushed.plan) {
        // Es el eco de lo último que subió este mismo teléfono: no hay nada nuevo que mezclar.
      } else if (!local) {
        if (d.local.applyPlan(remotePlan)) {
          st.pushed.plan = rkey;
          changed = true;
        }
      } else if (planKey(local) === rkey) {
        st.pushed.plan = rkey;
      } else {
        const dirty = planKey(local) !== st.pushed.plan;
        const m = mergePlan(local, dirty, remotePlan);
        if (m.winner === remotePlan) {
          if (d.local.applyPlan(remotePlan)) {
            st.pushed.plan = rkey;
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
