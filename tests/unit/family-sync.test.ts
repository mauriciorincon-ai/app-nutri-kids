// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { DayRegs } from "@/lib/diet/day-log";
import type { ProfileRegs } from "@/lib/diet/profile-notes";
import { familyApi } from "@/lib/family/client";
import { mergeMap, mergeReg } from "@/lib/family/merge";
import { handle } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import type { FamilyStore } from "@/lib/family/server/store";
import {
  createFamily,
  joinFamily,
  pullSince,
  rotateFamily,
  type FamilyCtx,
} from "@/lib/family/session";
import { freshFamilyState, type FamilyState } from "@/lib/family/state";
import {
  collectShared,
  countPending,
  syncOnce,
  type LocalData,
  type PlanSide,
} from "@/lib/family/sync";

const SENTINELS = [
  "SENTINEL-NAME",
  "SENTINEL-NOTE",
  "SENTINEL-FOOD",
  "es-LOCALE",
  "dark-THEME",
];

type Hook = (op: string) => Promise<void> | void;

function network(store: FamilyStore) {
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
function phone(id: string, name: string, now = { t: 1_000 }) {
  const data = {
    days: {} as Record<string, DayRegs>,
    profile: { notes: {} } as ProfileRegs,
    plan: null as PlanSide | null,
    name,
  };
  let state: FamilyState | null = null;
  const local: LocalData = {
    deviceId: () => id,
    deviceName: () => data.name,
    days: () => data.days,
    mergeDay(day, regs) {
      const cur = data.days[day] ?? { marks: {}, notes: {} };
      const next = {
        marks: mergeMap(cur.marks, regs.marks),
        notes: mergeMap(cur.notes, regs.notes),
      };
      const changed = JSON.stringify(next) !== JSON.stringify(cur);
      data.days[day] = next;
      return changed;
    },
    profile: () => data.profile,
    mergeProfile(regs) {
      const textures = mergeReg(data.profile.textures, regs.textures);
      const next: ProfileRegs = {
        ...(textures ? { textures } : {}),
        notes: mergeMap(data.profile.notes, regs.notes),
      };
      const changed = JSON.stringify(next) !== JSON.stringify(data.profile);
      data.profile = next;
      return changed;
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

async function setup() {
  const store = createMemoryStore({ isolated: true });
  const net = network(store);
  const a = phone("PHONE-A-0001", "SENTINEL-NAME Mamá");
  const created = await createFamily(net.api);
  if (!created.ok) throw new Error("create");
  const { ctx: ctxA, phrase } = created.value;
  a.state = freshFamilyState(ctxA.family, ctxA.epoch, "2026-11-16");
  const b = phone("PHONE-B-0002", "Abuela");
  const joined = await joinFamily(net.api, ctxA.family, phrase);
  if (!joined.ok) throw new Error("join");
  b.state = freshFamilyState(
    joined.value.family,
    joined.value.epoch,
    "2026-11-16",
  );
  return { store, net, a, b, ctxA, ctxB: joined.value, phrase };
}

describe("sincronización entre dos teléfonos (contra el doble del servidor)", () => {
  it("lo que marca uno lo ve el otro, con quién y a qué hora; el plan y el perfil también", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.data.plan = { t: 5, by: a.id, diet: { foods: ["SENTINEL-FOOD"] } };
    a.data.profile = {
      textures: { t: 2, by: a.id, v: ["puree"] },
      notes: {
        n1: {
          t: 2,
          by: a.id,
          v: { kind: "allergy", text: "SENTINEL-NOTE", at: "2026-11-16" },
        },
      },
    };
    a.mark("2026-11-16", "meal:desayuno", "07:30", 10);

    const ra = await syncOnce(a.deps(net.api, ctxA));
    expect(ra).toMatchObject({ ok: true, pending: 0 });
    expect(ra.ok && ra.pushed).toBeGreaterThanOrEqual(4); // plan, perfil, día, teléfono

    const rb = await syncOnce(b.deps(net.api, ctxB));
    expect(rb).toMatchObject({ ok: true, changed: true });
    expect(b.data.plan?.diet).toEqual({ foods: ["SENTINEL-FOOD"] });
    expect(b.data.days["2026-11-16"].marks["meal:desayuno"]).toEqual({
      t: 10,
      by: a.id,
      v: { at: "07:30" },
    });
    expect(b.data.profile.notes.n1.v?.text).toBe("SENTINEL-NOTE");
    // B conoce el nombre de A (viajó cifrado) y no se subió nada de más.
    expect(b.state!.devices[a.id].name).toBe("SENTINEL-NAME Mamá");
    expect(rb.ok && rb.pending).toBe(0);

    // De vuelta: B marca otra cosa y A la ve.
    b.mark("2026-11-16", "meal:almuerzo", "12:40", 20);
    await syncOnce(b.deps(net.api, ctxB));
    await syncOnce(a.deps(net.api, ctxA));
    expect(a.data.days["2026-11-16"].marks["meal:almuerzo"].by).toBe(b.id);
    expect(a.state!.devices[b.id].name).toBe("Abuela");
  });

  it("dos teléfonos tocan lo mismo: gana la marca más reciente y los dos quedan iguales", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.mark("2026-11-16", "meal:cena", "19:00", 30);
    b.mark("2026-11-16", "meal:cena", "19:05", 40);
    for (const p of [a, b, a, b]) {
      const ctx = p === a ? ctxA : ctxB;
      expect((await syncOnce(p.deps(net.api, ctx))).ok).toBe(true);
    }
    expect(a.data.days["2026-11-16"]).toEqual(b.data.days["2026-11-16"]);
    expect(a.data.days["2026-11-16"].marks["meal:cena"].v).toEqual({
      at: "19:05",
    });
  });

  it("quitar una marca no la deja resucitar (lápida)", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.mark("2026-11-16", "water:1", "10:00", 10);
    await syncOnce(a.deps(net.api, ctxA));
    await syncOnce(b.deps(net.api, ctxB));
    b.unmark("2026-11-16", "water:1", 50);
    await syncOnce(b.deps(net.api, ctxB));
    await syncOnce(a.deps(net.api, ctxA));
    expect(a.data.days["2026-11-16"].marks["water:1"].v).toBeNull();
    // A sincroniza de nuevo y la marca NO vuelve.
    await syncOnce(a.deps(net.api, ctxA));
    await syncOnce(b.deps(net.api, ctxB));
    expect(b.data.days["2026-11-16"].marks["water:1"].v).toBeNull();
  });

  it("escritura cruzada en medio de una subida (409): se baja, se mezcla y no se pierde nada", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.mark("2026-11-16", "meal:desayuno", "07:00", 10);
    await syncOnce(a.deps(net.api, ctxA));
    await syncOnce(b.deps(net.api, ctxB));
    a.mark("2026-11-16", "meal:almuerzo", "12:00", 20);
    b.mark("2026-11-16", "meal:cena", "19:00", 30);
    // Justo antes de que A suba, B sube su cambio al mismo día.
    const arm = (): void =>
      net.onNext(async (op) => {
        if (op !== "push") {
          arm();
          return;
        }
        await syncOnce(b.deps(net.api, ctxB));
      });
    arm();
    expect((await syncOnce(a.deps(net.api, ctxA))).ok).toBe(true);
    await syncOnce(b.deps(net.api, ctxB));
    const marks = Object.keys(a.data.days["2026-11-16"].marks).sort();
    expect(marks).toEqual(["meal:almuerzo", "meal:cena", "meal:desayuno"]);
    expect(b.data.days["2026-11-16"]).toEqual(a.data.days["2026-11-16"]);
  });

  it("sin red: queda pendiente (cola) y al volver la red sube todo junto", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    await syncOnce(a.deps(net.api, ctxA));
    net.setOffline(true);
    a.mark("2026-11-16", "meal:desayuno", "07:00", 10);
    a.mark("2026-11-17", "meal:cena", "19:00", 11);
    const off = await syncOnce(a.deps(net.api, ctxA));
    expect(off).toEqual({ ok: false, reason: "offline" });
    expect(await countPending(a.deps(net.api, ctxA), a.state!)).toBe(2);
    net.setOffline(false);
    const on = await syncOnce(a.deps(net.api, ctxA));
    expect(on).toMatchObject({ ok: true, pending: 0 });
    await syncOnce(b.deps(net.api, ctxB));
    expect(Object.keys(b.data.days).sort()).toEqual([
      "2026-11-16",
      "2026-11-17",
    ]);
  });

  it("los dos cambian el plan: queda el más reciente y se avisa a quien perdió", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.data.plan = { t: 100, by: a.id, diet: { v: "de A" } };
    await syncOnce(a.deps(net.api, ctxA));
    await syncOnce(b.deps(net.api, ctxB));
    a.data.plan = { t: 200, by: a.id, diet: { v: "de A, más nuevo" } };
    b.data.plan = { t: 300, by: b.id, diet: { v: "de B, el último" } };
    await syncOnce(a.deps(net.api, ctxA)); // A sube lo suyo
    const rb = await syncOnce(b.deps(net.api, ctxB)); // B baja el de A: el de B es más reciente
    expect(rb.ok).toBe(true);
    expect(b.state!.planNotice).toBe("mine");
    await syncOnce(a.deps(net.api, ctxA));
    expect(a.data.plan?.diet).toEqual({ v: "de B, el último" });
    // A ya había subido lo suyo: no ve un choque, solo recibe el plan más reciente.
    expect(a.state!.planNotice).toBeNull();
  });

  it("si este teléfono cambió el plan y baja uno más reciente de otro, se queda el de ellos y se avisa", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.data.plan = { t: 100, by: a.id, diet: { v: "base" } };
    await syncOnce(a.deps(net.api, ctxA));
    await syncOnce(b.deps(net.api, ctxB));
    b.data.plan = { t: 300, by: b.id, diet: { v: "de B, el último" } };
    await syncOnce(b.deps(net.api, ctxB));
    a.data.plan = { t: 200, by: a.id, diet: { v: "de A, sin subir" } };
    await syncOnce(a.deps(net.api, ctxA));
    expect(a.data.plan?.diet).toEqual({ v: "de B, el último" });
    expect(a.state!.planNotice).toBe("theirs");
  });

  it("un plan que no valida no se aplica y no rompe la sincronización", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.data.plan = { t: 100, by: a.id, diet: { v: 1 } };
    await syncOnce(a.deps(net.api, ctxA));
    const bad = phone("PHONE-C-0003", "C");
    bad.state = b.state;
    bad.local.applyPlan = () => false;
    const r = await syncOnce(bad.deps(net.api, ctxB));
    expect(r.ok).toBe(true);
    expect(bad.data.plan).toBeNull();
  });

  it("un plan demasiado grande se queda en el teléfono y se avisa", async () => {
    const { net, a, ctxA } = await setup();
    a.data.plan = { t: 1, by: a.id, diet: { big: "x".repeat(200_000) } };
    const r = await syncOnce(a.deps(net.api, ctxA));
    expect(r.ok).toBe(true);
    expect(a.state!.planTooBig).toBe(true);
  });

  it("al cambiar la frase, el teléfono que se queda sin ella recibe «denied» y vuelve a entrar con la nueva", async () => {
    const { net, a, b, ctxA, ctxB } = await setup();
    a.mark("2026-11-16", "meal:desayuno", "07:00", 10);
    await syncOnce(a.deps(net.api, ctxA));
    await syncOnce(b.deps(net.api, ctxB));

    const keep = await collectShared(a.deps(net.api, ctxA), a.state!);
    const rot = await rotateFamily(net.api, ctxA, keep);
    expect(rot.ok).toBe(true);
    if (!rot.ok) return;
    a.state = freshFamilyState(ctxA.family, rot.value.ctx.epoch, "2026-11-16");

    const denied = await syncOnce(b.deps(net.api, ctxB));
    expect(denied).toEqual({ ok: false, reason: "denied" });
    expect(b.state!.locked).toBe(true);

    const back = await joinFamily(net.api, ctxA.family, rot.value.phrase);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    b.state = freshFamilyState(
      back.value.family,
      back.value.epoch,
      "2026-11-16",
    );
    expect((await syncOnce(b.deps(net.api, back.value))).ok).toBe(true);
    expect(b.data.days["2026-11-16"].marks["meal:desayuno"].v).toEqual({
      at: "07:00",
    });
    // Y A sigue sincronizando con la clave nueva.
    expect((await syncOnce(a.deps(net.api, rot.value.ctx))).ok).toBe(true);
  });

  it("por la red solo viajan los nombres opacos y cifrados: nada de nombres, notas, comida, idioma ni tema", async () => {
    const { net, a, b, ctxA, ctxB, phrase } = await setup();
    a.data.plan = { t: 5, by: a.id, diet: { foods: ["SENTINEL-FOOD"] } };
    a.data.profile = {
      notes: {
        n1: {
          t: 2,
          by: a.id,
          v: { kind: "other", text: "SENTINEL-NOTE", at: "2026-11-16" },
        },
      },
    };
    a.mark("2026-11-16", "meal:desayuno", "07:30", 10);
    // Lo que NO es de la familia puede estar en este aparato; no debe subir.
    globalThis.localStorage?.setItem?.(
      "nutrikids.prefs.v1",
      '{"locale":"es-LOCALE","theme":"dark-THEME"}',
    );
    await syncOnce(a.deps(net.api, ctxA));
    await syncOnce(b.deps(net.api, ctxB));
    const wire = net.wire.join("\n");
    for (const s of [...SENTINELS, phrase, phrase.replace(/-/g, "")])
      expect(wire).not.toContain(s);
    expect(wire).not.toMatch(/prefs|locale|theme/i);

    // Y lo que llega descifrado, desde un tercero que sí tiene la frase, es solo lo compartido.
    const c = await joinFamily(net.api, ctxA.family, phrase);
    if (!c.ok) throw new Error("join");
    const all = await pullSince(net.api, c.value, 0);
    if (!all.ok) throw new Error("pull");
    const names = all.value.items.map((i) => i.named.name).sort();
    expect(names).toEqual(
      [
        "day:2026-11-16",
        `device:${a.id}`,
        `device:${b.id}`,
        "plan",
        "profile",
      ].sort(),
    );
    expect(JSON.stringify(all.value.items)).not.toMatch(/locale|theme|prefs/i);
  });
});
