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
import { WELL_KEYS } from "./records";
import {
  coerceFood,
  coerceHabit,
  coerceWell,
  isAgeBand,
  isHabit,
  isMood,
  foodKey,
  parseFoodKey,
  WELLBEING_MAPS,
  type WellbeingMap,
} from "@/lib/wellbeing/values";

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

/**
 * Una entrada con la hora en el futuro lejano ganaría para siempre la mezcla (gana la más
 * reciente) y nadie, ni su autor, podría corregirla después: se descarta. Los relojes de dos
 * teléfonos nunca coinciden al segundo, de ahí la holgura.
 */
export const FUTURE_SKEW_MS = 5 * 60_000;
const fromTheFuture = (t: number, now: number) => t > now + FUTURE_SKEW_MS;

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
  now: number,
): Promise<boolean> {
  const m: Member | undefined = roster?.members[r.by];
  if (!m || !may(m, w) || fromTheFuture(r.t, now)) return false;
  return verify(m.pub, entryPayload(name, key, r), r.s);
}

type Checked<T> = { regs: T; dropped: number };

async function filterMap<T>(
  roster: Roster | null,
  name: string,
  map: RegMap<T>,
  write: (key: string) => Write | null,
  own: string,
  now: number,
  /** Además de quién escribe: ¿la clave y el valor tienen la forma de lo que dice ser? */
  valid: (key: string, v: T | null) => boolean = () => true,
): Promise<Checked<RegMap<T>>> {
  const out: RegMap<T> = {};
  let dropped = 0;
  for (const [k, r] of Object.entries(map)) {
    const w = write(k);
    if (w && valid(k, r.v) && (await allowed(roster, name, k, r, w, now)))
      out[k] = r;
    else if (r.by !== own) dropped++;
  }
  return { regs: out, dropped };
}

/** Qué se necesita para escribir en cada mapa del bienestar, y qué forma debe tener. */
const WELLBEING_RULES: Record<
  WellbeingMap,
  {
    write: (key: string) => Write | null;
    valid: (key: string, v: unknown) => boolean;
  }
> = {
  moods: {
    write: (key) => (/^meal:.+/.test(key) ? { k: "mood", check: key } : null),
    valid: (_k, v) => v === null || isMood(v),
  },
  food: {
    write: (key) => {
      const f = parseFoodKey(key);
      // Solo la forma canónica: dos escrituras de la misma comida contarían dos exposiciones.
      return f && foodKey(f.mealId, f.foodId) === key
        ? { k: "food", meal: f.mealId }
        : null;
    },
    valid: (_k, v) => v === null || coerceFood(v) !== null,
  },
  well: {
    write: (key) => (WELL_KEYS.includes(key) ? { k: "well" } : null),
    valid: (k, v) => v === null || coerceWell(k, v) !== null,
  },
  habits: {
    write: (key) => (isHabit(key) ? { k: "habit" } : null),
    valid: (k, v) => v === null || coerceHabit(k, v) !== null,
  },
};

/** Lo que vale de un día que llegó. */
export async function checkDay(
  roster: Roster | null,
  name: string,
  regs: DayRegs,
  own: string,
  now = Date.now(),
): Promise<Checked<DayRegs>> {
  const marks = await filterMap(
    roster,
    name,
    regs.marks,
    (check) => ({ k: "mark", check }),
    own,
    now,
  );
  const notes = await filterMap(
    roster,
    name,
    regs.notes,
    (check) => ({ k: "day-note", check }),
    own,
    now,
  );
  const out: DayRegs = { marks: marks.regs, notes: notes.regs };
  let dropped = marks.dropped + notes.dropped;
  for (const m of WELLBEING_MAPS) {
    const map = regs[m];
    if (!map) continue;
    const rule = WELLBEING_RULES[m];
    const checked = await filterMap(
      roster,
      name,
      map as RegMap<unknown>,
      rule.write,
      own,
      now,
      rule.valid,
    );
    dropped += checked.dropped;
    if (Object.keys(checked.regs).length)
      (out as Record<string, unknown>)[m] = checked.regs;
  }
  return { regs: out, dropped };
}

/** Lo que vale del perfil que llegó. */
export async function checkProfile(
  roster: Roster | null,
  regs: ProfileRegs,
  own: string,
  now = Date.now(),
): Promise<Checked<ProfileRegs>> {
  const notes = await filterMap(
    roster,
    "profile",
    regs.notes,
    () => ({ k: "profile-note" }),
    own,
    now,
  );
  let dropped = notes.dropped;
  const out: ProfileRegs = { notes: notes.regs };
  if (regs.textures) {
    if (
      await allowed(
        roster,
        "profile",
        "textures",
        regs.textures,
        { k: "textures" },
        now,
      )
    )
      out.textures = regs.textures;
    else if (regs.textures.by !== own) dropped++;
  }
  if (regs.age) {
    if (
      (regs.age.v === null || isAgeBand(regs.age.v)) &&
      (await allowed(roster, "profile", "age", regs.age, { k: "age" }, now))
    )
      out.age = regs.age;
    else if (regs.age.by !== own) dropped++;
  }
  return { regs: out, dropped };
}

export async function checkPlan(
  roster: Roster | null,
  plan: { t: number; by: string; diet: unknown; s?: string },
  now = Date.now(),
): Promise<boolean> {
  const m = roster?.members[plan.by];
  if (!m || !may(m, { k: "plan" }) || fromTheFuture(plan.t, now)) return false;
  return verify(m.pub, planPayload(plan), plan.s);
}

export async function checkNotice(
  roster: Roster | null,
  name: string,
  n: NoticeShared,
  now = Date.now(),
): Promise<boolean> {
  const m = roster?.members[n.by];
  if (!m || !may(m, { k: "notice" }) || fromTheFuture(n.t, now)) return false;
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
    for (const m of WELLBEING_MAPS)
      for (const [k, r] of Object.entries((regs[m] ?? {}) as RegMap<unknown>))
        if (r.by === own && !r.s) {
          const map = (((signed as Record<string, unknown>)[m] as
            RegMap<unknown> | undefined) ??= {});
          map[k] = { ...r, s: await sign(signer, entryPayload(name, k, r)) };
          await note(r.t, "wellbeing", `${day}|${m}`);
          any = true;
        }
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
  if (profile.age && profile.age.by === own && !profile.age.s) {
    p.age = {
      ...profile.age,
      s: await sign(signer, entryPayload("profile", "age", profile.age)),
    };
    await note(profile.age.t, "profile-note", "age");
    anyP = true;
  }
  if (anyP) {
    out.profile = p;
    out.count++;
  }
  return out;
}
