// Arnés compartido de las pruebas de familia: teléfonos en memoria contra el doble del servidor.
import { WELLBEING_MAPS } from "@/lib/wellbeing/values";
import type { DayRegs } from "@/lib/diet/day-log";
import type { ProfileRegs } from "@/lib/diet/profile-notes";
import { familyApi } from "@/lib/family/client";
import { mergeMap, mergeReg, type RegMap } from "@/lib/family/merge";
import { handle } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import type { FamilyStore } from "@/lib/family/server/store";
import { createFamily, joinFamily, type FamilyCtx } from "@/lib/family/session";
import type { NoticeShared } from "@/lib/family/records";
import { formatInvite } from "@/lib/family/phrase";
import { appendOp, foldRoster } from "@/lib/family/roster";
import { newSigner, type Signer } from "@/lib/family/sign";
import { freshFamilyState, type FamilyState } from "@/lib/family/state";
import type { LocalData, PlanSide } from "@/lib/family/sync";
import type { PressureStore } from "@/lib/pressure/store";

export const SENTINELS = [
  "SENTINEL-NAME",
  "SENTINEL-NOTE",
  "SENTINEL-FOOD",
  "es-LOCALE",
  "dark-THEME",
];

export type Hook = (op: string) => Promise<void> | void;

export function network(store: FamilyStore) {
  const wire: string[] = [];
  let offline = false;
  let hook: Hook | null = null;
  const fetcher = (async (url: string, init: RequestInit) => {
    if (offline) throw new TypeError("Failed to fetch");
    const headers = init.headers as Record<string, string>;
    wire.push(`${url} ${JSON.stringify(headers)} ${String(init.body)}`);
    const op = url.replace("/api/family/", "");
    if (hook) {
      const h = hook;
      hook = null;
      await h(op);
    }
    const out = await handle(
      {
        op,
        method: "POST",
        body: String(init.body ?? ""),
        authorization: headers.authorization ?? null,
        ip: "203.0.113.9",
      },
      store,
    );
    return new Response(JSON.stringify(out.json), { status: out.status });
  }) as unknown as typeof fetch;
  return {
    api: familyApi(fetcher),
    wire,
    setOffline: (v: boolean) => (offline = v),
    onNext: (h: Hook): void => {
      hook = h;
    },
  };
}

/** Un teléfono: sus datos y su estado en memoria, con las MISMAS mezclas que el aparato. */
export function phone(id: string, name: string, now = { t: 1_000 }) {
  const data = {
    days: {} as Record<string, DayRegs>,
    profile: { notes: {} } as ProfileRegs,
    plan: null as PlanSide | null,
    name,
    notices: {} as Record<string, NoticeShared>,
    // S14 · «cuando le ofrecen algo»: lo propio y, solo en madre o padre, lo de los demás.
    pressure: { own: [], others: {} } as PressureStore,
  };
  let state: FamilyState | null = null;
  const signer: Promise<Signer> = newSigner();
  const local: LocalData = {
    deviceId: () => id,
    deviceName: () => data.name,
    days: () => data.days,
    mergeDay(day, regs) {
      const cur = data.days[day] ?? { marks: {}, notes: {} };
      const next: DayRegs = {
        marks: mergeMap(cur.marks, regs.marks),
        notes: mergeMap(cur.notes, regs.notes),
      };
      // S10 y S15: los mapas del bienestar y el contexto se mezclan igual que las marcas y las notas.
      for (const m of WELLBEING_MAPS) {
        const merged = mergeMap(
          (cur[m] ?? {}) as RegMap<unknown>,
          (regs[m] ?? {}) as RegMap<unknown>,
        );
        if (Object.keys(merged).length)
          (next as Record<string, unknown>)[m] = merged;
      }
      const changed = JSON.stringify(next) !== JSON.stringify(cur);
      data.days[day] = next;
      return changed;
    },
    profile: () => data.profile,
    mergeProfile(regs) {
      const textures = mergeReg(data.profile.textures, regs.textures);
      const age = mergeReg(data.profile.age, regs.age);
      const next: ProfileRegs = {
        ...(textures ? { textures } : {}),
        ...(age ? { age } : {}),
        notes: mergeMap(data.profile.notes, regs.notes),
      };
      const changed = JSON.stringify(next) !== JSON.stringify(data.profile);
      data.profile = next;
      return changed;
    },
    notices: () => data.notices,
    mergeNotice(nid, n) {
      if (data.notices[nid]) return false;
      data.notices[nid] = n;
      return true;
    },
    pressure: () => data.pressure.own,
    mergePressure(by, ev) {
      const before = JSON.stringify(data.pressure.others[by] ?? []);
      if (before === JSON.stringify(ev)) return false;
      if (ev.length) data.pressure.others[by] = ev;
      else delete data.pressure.others[by];
      return true;
    },
    dropPressureOthers() {
      if (Object.keys(data.pressure.others).length === 0) return false;
      data.pressure.others = {};
      return true;
    },
    plan: () => data.plan,
    applyPlan(p) {
      if (typeof p.diet !== "object" || p.diet === null) return false;
      data.plan = p;
      return true;
    },
  };
  return {
    id,
    data,
    local,
    now,
    signer,
    get state() {
      return state;
    },
    set state(s: FamilyState | null) {
      state = s;
    },
    deps(api: ReturnType<typeof network>["api"], ctx: FamilyCtx) {
      return {
        api,
        ctx,
        local,
        state: {
          load: () => (state ? structuredClone(state) : null),
          save: (s: FamilyState) => {
            state = structuredClone(s);
          },
        },
        now: () => now.t,
        signer: () => signer,
      };
    },
    mark(day: string, check: string, at: string, t: number) {
      const cur = data.days[day] ?? { marks: {}, notes: {} };
      cur.marks[check] = { t, by: id, v: { at } };
      data.days[day] = cur;
    },
    unmark(day: string, check: string, t: number) {
      data.days[day].marks[check] = { t, by: id, v: null };
    },
  };
}

/** El génesis con A y B como padres (las pruebas de roles viven en family-roles.test.ts). */
export async function genesis(
  a: ReturnType<typeof phone>,
  b: ReturnType<typeof phone>,
) {
  const [sa, sb] = [await a.signer, await b.signer];
  const g = await appendOp([], sa, a.id, 1, {
    type: "genesis",
    members: [
      { id: a.id, name: "SENTINEL-NAME Mamá", role: "parent", pub: sa.pub },
      { id: b.id, name: "Abuela", role: "parent", pub: sb.pub },
    ],
  });
  return { ops: [g], pin: (await foldRoster({ ops: [g] }))!.pin };
}

export async function setup() {
  const store = createMemoryStore({ isolated: true });
  const net = network(store);
  const a = phone("PHONE-A-0001", "SENTINEL-NAME Mamá");
  const created = await createFamily(net.api);
  if (!created.ok) throw new Error("create");
  const { ctx: ctxA, phrase } = created.value;
  const b = phone("PHONE-B-0002", "Abuela");
  const g = await genesis(a, b);
  a.state = {
    ...freshFamilyState(ctxA.family, ctxA.epoch, "2026-11-16"),
    roster: g.ops,
    pin: g.pin,
  };
  const joined = await joinFamily(
    net.api,
    formatInvite(ctxA.family, g.pin),
    phrase,
  );
  if (!joined.ok) throw new Error("join");
  b.state = {
    ...freshFamilyState(
      joined.value.ctx.family,
      joined.value.ctx.epoch,
      "2026-11-16",
    ),
    pin: joined.value.invite.pin,
  };
  return { store, net, a, b, ctxA, ctxB: joined.value.ctx, phrase, pin: g.pin };
}
