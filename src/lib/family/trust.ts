import type { DayRegs } from "@/lib/diet/day-log";
import type { ProfileRegs } from "@/lib/diet/profile-notes";

import { appendEvent, type LogEvent, type LogKind } from "./log";
import type { Reg, RegMap } from "./merge";
import type { DeviceShared, NoticeShared } from "./records";
import {
  foldRoster,
  may,
  type Member,
  type Roster,
  type Write,
} from "./roster";
import { sign, verify, type Signer } from "./sign";

/**
 * Firmar lo propio y comprobar lo ajeno (S9 · ADR-013). Cada marca, nota y cambio del perfil
 * lleva la firma de quien lo escribió, por separado: la mezcla del S7 junta entradas de varios
 * teléfonos en un mismo registro, y una firma del registro entero la pondría quien lo sube,
 * no quien lo escribió. Lo que llega sin firma válida, de alguien fuera del roster o de un rol
 * que no puede escribir eso, se descarta antes de mezclar.
 */

export const entryPayload = <T>(name: string, key: string, r: Reg<T>) => ({
  n: name,
  k: key,
  t: r.t,
  by: r.by,
  v: r.v,
});
export const planPayload = (p: { t: number; by: string; diet: unknown }) => ({
  n: "plan",
  t: p.t,
  by: p.by,
  diet: p.diet,
});
export const noticePayload = (name: string, n: NoticeShared) => ({
  n: name,
  text: n.text,
  name: n.name,
  by: n.by,
  t: n.t,
  date: n.date,
});
export const devicePayload = (d: DeviceShared) => ({
  n: `device:${d.id}`,
  id: d.id,
  name: d.name,
  consent: d.consent,
  pub: d.pub,
  invite: d.invite,
});

const cache = new Map<string, Roster | null>();
/** El roster que resulta de la cadena guardada (memorizado por su último eslabón). */
export async function rosterOf(ops: { s: string }[]): Promise<Roster | null> {
  if (ops.length === 0) return null;
  const key = `${ops.length}.${ops.at(-1)!.s}`;
  if (!cache.has(key)) {
    if (cache.size > 20) cache.clear();
    cache.set(key, await foldRoster({ ops }));
  }
  return cache.get(key) ?? null;
}

async function allowed<T>(
  roster: Roster | null,
  name: string,
  key: string,
  r: Reg<T>,
  w: Write,
): Promise<boolean> {
  const m: Member | undefined = roster?.members[r.by];
  if (!m || !may(m, w)) return false;
  return verify(m.pub, entryPayload(name, key, r), r.s);
}

type Checked<T> = { regs: T; dropped: number };

async function filterMap<T>(
  roster: Roster | null,
  name: string,
  map: RegMap<T>,
  write: (key: string) => Write,
  own: string,
): Promise<Checked<RegMap<T>>> {
  const out: RegMap<T> = {};
  let dropped = 0;
  for (const [k, r] of Object.entries(map)) {
    if (await allowed(roster, name, k, r, write(k))) out[k] = r;
    else if (r.by !== own) dropped++;
  }
  return { regs: out, dropped };
}

/** Lo que vale de un día que llegó. */
export async function checkDay(
  roster: Roster | null,
  name: string,
  regs: DayRegs,
  own: string,
): Promise<Checked<DayRegs>> {
  const marks = await filterMap(
    roster,
    name,
    regs.marks,
    (check) => ({ k: "mark", check }),
    own,
  );
  const notes = await filterMap(
    roster,
    name,
    regs.notes,
    (check) => ({ k: "day-note", check }),
    own,
  );
  return {
    regs: { marks: marks.regs, notes: notes.regs },
    dropped: marks.dropped + notes.dropped,
  };
}

/** Lo que vale del perfil que llegó. */
export async function checkProfile(
  roster: Roster | null,
  regs: ProfileRegs,
  own: string,
): Promise<Checked<ProfileRegs>> {
  const notes = await filterMap(
    roster,
    "profile",
    regs.notes,
    () => ({ k: "profile-note" }),
    own,
  );
  let dropped = notes.dropped;
  const out: ProfileRegs = { notes: notes.regs };
  if (regs.textures) {
    if (
      await allowed(roster, "profile", "textures", regs.textures, {
        k: "textures",
      })
    )
      out.textures = regs.textures;
    else if (regs.textures.by !== own) dropped++;
  }
  return { regs: out, dropped };
}

export async function checkPlan(
  roster: Roster | null,
  plan: { t: number; by: string; diet: unknown; s?: string },
): Promise<boolean> {
  const m = roster?.members[plan.by];
  if (!m || !may(m, { k: "plan" })) return false;
  return verify(m.pub, planPayload(plan), plan.s);
}

export async function checkNotice(
  roster: Roster | null,
  name: string,
  n: NoticeShared,
): Promise<boolean> {
  const m = roster?.members[n.by];
  if (!m || !may(m, { k: "notice" })) return false;
  return verify(m.pub, noticePayload(name, n), n.s);
}

/**
 * El registro de un teléfono: si está en el roster, su firma se comprueba con la llave del
 * roster (y la llave que dice tener debe ser esa); si aún no está, con la suya propia (queda
 * «esperando rol»: no puede escribir nada hasta que un padre lo confirme).
 */
export async function checkDevice(
  roster: Roster | null,
  d: DeviceShared,
): Promise<"member" | "pending" | false> {
  const m = roster?.members[d.id];
  if (m) {
    if (d.pub !== m.pub) return false;
    return (await verify(m.pub, devicePayload(d), d.s)) ? "member" : false;
  }
  if (!d.pub) return false;
  return (await verify(d.pub, devicePayload(d), d.s)) ? "pending" : false;
}

/** Quién puede mandar avisos según el roster (id → llave pública), para el trabajador. */
export async function noticeSenders(
  ops: { s: string }[],
): Promise<Record<string, string>> {
  const r = await rosterOf(ops);
  return Object.fromEntries(
    Object.values(r?.members ?? {})
      .filter((m) => may(m, { k: "notice" }))
      .map((m) => [m.id, m.pub]),
  );
}

type OwnSigned = {
  days: Record<string, DayRegs>;
  profile: ProfileRegs | null;
  log: LogEvent[];
  count: number;
};

/**
 * Firma las entradas de ESTE teléfono que aún no tienen firma (lo que se anotó desde la última
 * vez) y suma a la bitácora propia un evento por cada una. Devuelve solo lo que firmó, para
 * mezclarlo con lo local (la mezcla se queda con la versión firmada del mismo cambio).
 */
export async function signOwn(
  signer: Signer,
  own: string,
  days: Record<string, DayRegs>,
  profile: ProfileRegs,
  log: LogEvent[],
): Promise<OwnSigned> {
  const out: OwnSigned = { days: {}, profile: null, log, count: 0 };
  const note = async (t: number, k: LogKind, r: string) => {
    out.log = await appendEvent(out.log, t, k, r);
  };
  for (const [day, regs] of Object.entries(days)) {
    const name = `day:${day}`;
    const signed: DayRegs = { marks: {}, notes: {} };
    let any = false;
    for (const [k, r] of Object.entries(regs.marks))
      if (r.by === own && !r.s) {
        signed.marks[k] = {
          ...r,
          s: await sign(signer, entryPayload(name, k, r)),
        };
        await note(r.t, r.v ? "mark" : "unmark", `${day}|${k}`);
        any = true;
      }
    for (const [k, r] of Object.entries(regs.notes))
      if (r.by === own && !r.s) {
        signed.notes[k] = {
          ...r,
          s: await sign(signer, entryPayload(name, k, r)),
        };
        await note(r.t, "day-note", `${day}|${k}`);
        any = true;
      }
    if (any) {
      out.days[day] = signed;
      out.count++;
    }
  }
  const p: ProfileRegs = { notes: {} };
  let anyP = false;
  for (const [k, r] of Object.entries(profile.notes))
    if (r.by === own && !r.s) {
      p.notes[k] = {
        ...r,
        s: await sign(signer, entryPayload("profile", k, r)),
      };
      await note(r.t, "profile-note", k);
      anyP = true;
    }
  if (profile.textures && profile.textures.by === own && !profile.textures.s) {
    p.textures = {
      ...profile.textures,
      s: await sign(
        signer,
        entryPayload("profile", "textures", profile.textures),
      ),
    };
    await note(profile.textures.t, "textures", "textures");
    anyP = true;
  }
  if (anyP) {
    out.profile = p;
    out.count++;
  }
  return out;
}
