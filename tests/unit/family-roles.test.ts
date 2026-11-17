// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  acceptLog,
  appendEvent,
  sealLog,
  type LogEvent,
} from "@/lib/family/log";
import { formatInvite } from "@/lib/family/phrase";
import type { Named } from "@/lib/family/records";
import {
  appendOp,
  chooseChain,
  foldRoster,
  may,
  ROLES,
  type Member,
  type Op,
  type Role,
  type Write,
} from "@/lib/family/roster";
import { createMemoryStore } from "@/lib/family/server/memory";
import {
  createFamily,
  joinFamily,
  pullSince,
  pushNamed,
  type FamilyCtx,
} from "@/lib/family/session";
import { keyMark, newSigner, sign, verify } from "@/lib/family/sign";
import { freshFamilyState } from "@/lib/family/state";
import { addOp, syncOnce } from "@/lib/family/sync";
import { entryPayload } from "@/lib/family/trust";

import { network, phone } from "./family-harness";

/**
 * Roles con permisos, firmados (S9 · ADR-013), probados como atacante: un registro sin firma,
 * firmado con la llave de otro, un roster alterado o repetido, un rol que se sube a sí mismo y
 * una bitácora reescrita. Todos los nombres y roles son inventados.
 */

const DAY = "2026-11-16";
type Phone = ReturnType<typeof phone>;

// ---------------------------------------------------------------------------
// Qué puede cada rol (la tabla que usan la pantalla y la sincronía)
// ---------------------------------------------------------------------------

describe("qué puede escribir cada rol", () => {
  const writes: Write[] = [
    { k: "plan" },
    { k: "textures" },
    { k: "profile-note" },
    { k: "mark", check: "meal:almuerzo" },
    { k: "mark", check: "meal:cena" },
    { k: "mark", check: "water:1" },
    { k: "day-note", check: "meal:almuerzo" },
    { k: "notice" },
    { k: "roster" },
  ];
  const label = (w: Write) => ("check" in w ? `${w.k}:${w.check}` : w.k);
  const expected: Record<Role, string[]> = {
    parent: writes.map(label),
    caregiver: [
      "mark:meal:almuerzo",
      "mark:meal:cena",
      "mark:water:1",
      "day-note:meal:almuerzo",
      "notice",
    ],
    school: ["mark:meal:almuerzo", "day-note:meal:almuerzo", "notice"],
    nutritionist: ["profile-note", "day-note"],
  };

  for (const role of ROLES)
    it(`${role}: solo lo suyo`, () => {
      const m = { role, meals: role === "school" ? ["almuerzo"] : undefined };
      const got = writes.filter((w) => may(m, w)).map(label);
      const want = expected[role].flatMap((x) =>
        x === "day-note" ? ["day-note:meal:almuerzo"] : [x],
      );
      expect(got).toEqual(want);
    });

  it("sin rol (o fuera del roster) no escribe nada", () => {
    for (const w of writes) {
      expect(may(null, w)).toBe(false);
      expect(may(undefined, w)).toBe(false);
    }
  });

  it("el colegio solo marca las comidas de su franja, nunca otra cosa con el mismo prefijo", () => {
    const school = { role: "school" as const, meals: ["almuerzo"] };
    expect(may(school, { k: "mark", check: "meal:almuerzo" })).toBe(true);
    expect(may(school, { k: "mark", check: "meal:almuerzo-2" })).toBe(false);
    expect(may(school, { k: "mark", check: "supplement:almuerzo" })).toBe(
      false,
    );
    expect(may({ role: "school" }, { k: "mark", check: "meal:almuerzo" })).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Firmas
// ---------------------------------------------------------------------------

describe("firma por persona (ECDSA P-256, llave que no se exporta)", () => {
  it("firma y verifica; otro contenido, otra llave o basura no verifican", async () => {
    const a = await newSigner();
    const b = await newSigner();
    expect(a.key.extractable).toBe(false);
    const s = await sign(a, { n: "x", v: 1 });
    expect(await verify(a.pub, { n: "x", v: 1 }, s)).toBe(true);
    expect(await verify(a.pub, { n: "x", v: 2 }, s)).toBe(false);
    expect(await verify(b.pub, { n: "x", v: 1 }, s)).toBe(false);
    expect(await verify(a.pub, { n: "x", v: 1 }, "A".repeat(86))).toBe(false);
    expect(await verify(undefined, { n: "x", v: 1 }, s)).toBe(false);
    expect(await verify("no-es-llave", { n: "x", v: 1 }, s)).toBe(false);
    expect(await verify(a.pub, { n: "x", v: 1 }, undefined)).toBe(false);
  });

  it("la huella de una llave es corta, estable y distinta entre llaves", async () => {
    const a = await newSigner();
    const b = await newSigner();
    const ma = await keyMark(a.pub);
    expect(ma).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(await keyMark(a.pub)).toBe(ma);
    expect(await keyMark(b.pub)).not.toBe(ma);
  });
});

// ---------------------------------------------------------------------------
// El roster: cadena firmada por padres
// ---------------------------------------------------------------------------

async function people() {
  const [pa, pc, ps, pn] = await Promise.all([
    newSigner(),
    newSigner(),
    newSigner(),
    newSigner(),
  ]);
  const members: Member[] = [
    { id: "PARENT-0001", name: "Mamá Inventada", role: "parent", pub: pa.pub },
    {
      id: "CARER-00002",
      name: "Tía Inventada",
      role: "caregiver",
      pub: pc.pub,
    },
    {
      id: "SCHOOL-0003",
      name: "Colegio Inventado",
      role: "school",
      pub: ps.pub,
      meals: ["almuerzo"],
    },
    {
      id: "NUTRI-00004",
      name: "Nutri Inventada",
      role: "nutritionist",
      pub: pn.pub,
    },
  ];
  const g = await appendOp([], pa, members[0].id, 1, {
    type: "genesis",
    members,
  });
  return { pa, pc, ps, pn, members, ops: [g] as Op[] };
}

describe("roster: solo un padre lo cambia, y lo alterado no encadena", () => {
  it("el génesis firmado por un padre vale y da una huella de 12", async () => {
    const { ops } = await people();
    const r = await foldRoster({ ops });
    expect(r?.members["CARER-00002"].role).toBe("caregiver");
    expect(r?.pin).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
  });

  it("un cuidador que se sube a sí mismo a padre: la cadena no vale", async () => {
    const { pc, members, ops } = await people();
    const op = await appendOp(ops, pc, "CARER-00002", 2, {
      type: "set",
      member: { ...members[1], role: "parent" },
    });
    expect(await foldRoster({ ops: [...ops, op] })).toBeNull();
  });

  it("un cambio firmado con la llave de otro (no de quien dice) no vale", async () => {
    const { pc, members, ops } = await people();
    // Dice ser la madre, pero lo firma la tía.
    const op = await appendOp(ops, pc, "PARENT-0001", 2, {
      type: "set",
      member: { ...members[1], role: "parent" },
    });
    expect(await foldRoster({ ops: [...ops, op] })).toBeNull();
  });

  it("un eslabón alterado después de firmado no vale", async () => {
    const { pa, members, ops } = await people();
    const op = await appendOp(ops, pa, "PARENT-0001", 2, {
      type: "set",
      member: { ...members[1], role: "caregiver" },
    });
    const forged: Op = {
      ...op,
      body: { type: "set", member: { ...members[1], role: "parent" } },
    };
    expect(await foldRoster({ ops: [...ops, forged] })).toBeNull();
    const genesisForged: Op = {
      ...ops[0],
      body: {
        type: "genesis",
        members: members.map((m) => ({ ...m, role: "parent" as const })),
      },
    };
    expect(await foldRoster({ ops: [genesisForged] })).toBeNull();
  });

  it("un eslabón repetido (el mismo cambio dos veces) no encadena", async () => {
    const { pa, ops } = await people();
    const op = await appendOp(ops, pa, "PARENT-0001", 2, {
      type: "remove",
      id: "NUTRI-00004",
    });
    expect(await foldRoster({ ops: [...ops, op] })).not.toBeNull();
    expect(await foldRoster({ ops: [...ops, op, op] })).toBeNull();
  });

  it("no se cambia la llave de alguien ni se queda la familia sin padre", async () => {
    const { pa, members, ops } = await people();
    const other = await newSigner();
    const keySwap = await appendOp(ops, pa, "PARENT-0001", 2, {
      type: "set",
      member: { ...members[1], pub: other.pub },
    });
    expect(await foldRoster({ ops: [...ops, keySwap] })).toBeNull();
    const orphan = await appendOp(ops, pa, "PARENT-0001", 2, {
      type: "remove",
      id: "PARENT-0001",
    });
    expect(await foldRoster({ ops: [...ops, orphan] })).toBeNull();
    const mealsOnCarer = await appendOp(ops, pa, "PARENT-0001", 2, {
      type: "set",
      member: { ...members[1], meals: ["almuerzo"] },
    });
    expect(await foldRoster({ ops: [...ops, mealsOnCarer] })).toBeNull();
  });

  it("elegir cadena: continúa → la remota; pedazo viejo → la local; otra huella → rechazo", async () => {
    const { pa, ops } = await people();
    const pin = (await foldRoster({ ops }))!.pin;
    const op = await appendOp(ops, pa, "PARENT-0001", 2, {
      type: "remove",
      id: "NUTRI-00004",
    });
    const longer = [...ops, op];
    expect((await chooseChain(ops, { ops: longer }, pin, "X")).take).toBe(
      "remote",
    );
    expect((await chooseChain(longer, { ops }, pin, "X")).take).toBe("local");
    const other = await people();
    expect(await chooseChain(ops, { ops: other.ops }, pin, "X")).toEqual({
      take: "reject",
      why: "pin",
    });
    expect(
      await chooseChain(
        ops,
        { ops: [{ ...ops[0], s: "A".repeat(86) }] },
        pin,
        "X",
      ),
    ).toEqual({ take: "reject", why: "invalid" });
  });

  it("dos padres cambian a la vez: gana el cambio más temprano y el otro se vuelve a firmar encima", async () => {
    const pa = await newSigner();
    const pb = await newSigner();
    const g = await appendOp([], pa, "PARENT-A", 1, {
      type: "genesis",
      members: [
        { id: "PARENT-A", name: "A", role: "parent", pub: pa.pub },
        { id: "PARENT-B", name: "B", role: "parent", pub: pb.pub },
      ],
    });
    const early = await appendOp([g], pa, "PARENT-A", 5, {
      type: "invite",
      tag: "AAAA",
      role: "caregiver",
    });
    const late = await appendOp([g], pb, "PARENT-B", 9, {
      type: "invite",
      tag: "BBBB",
      role: "school",
      meals: ["almuerzo"],
    });
    const pin = (await foldRoster({ ops: [g] }))!.pin;
    const atB = await chooseChain(
      [g, late],
      { ops: [g, early] },
      pin,
      "PARENT-B",
    );
    expect(atB.take).toBe("remote");
    expect(atB.take === "remote" && atB.replay.map((o) => o.s)).toEqual([
      late.s,
    ]);
    const atA = await chooseChain(
      [g, early],
      { ops: [g, late] },
      pin,
      "PARENT-A",
    );
    expect(atA.take).toBe("local");
  });
});

// ---------------------------------------------------------------------------
// La bitácora
// ---------------------------------------------------------------------------

describe("bitácora encadenada y firmada por teléfono", () => {
  async function chain(n: number) {
    let ev: LogEvent[] = [];
    for (let i = 0; i < n; i++)
      ev = await appendEvent(ev, 100 + i, "mark", `${DAY}|meal:m${i}`);
    return ev;
  }

  it("lo nuevo se suma; un pedazo viejo deja lo que había", async () => {
    const s = await newSigner();
    const ev = await chain(3);
    const first = await acceptLog([], await sealLog(s, "CARER", ev), s.pub);
    expect(first).toMatchObject({ ok: true, changed: true });
    const old = await acceptLog(
      ev,
      await sealLog(s, "CARER", ev.slice(0, 2)),
      s.pub,
    );
    expect(old).toEqual({ ok: true, ev, changed: false });
  });

  it("reescribir un evento ya visto (aun firmado por su dueño) queda a la vista", async () => {
    const s = await newSigner();
    const ev = await chain(3);
    const rewritten = await appendEvent(
      [{ ...ev[0], r: `${DAY}|meal:otra` }],
      101,
      "mark",
      "x",
    );
    const v = await acceptLog(ev, await sealLog(s, "CARER", rewritten), s.pub);
    expect(v).toEqual({ ok: false, why: "rewritten" });
  });

  it("firma de otro, cadena rota o forma inválida: se descarta", async () => {
    const s = await newSigner();
    const other = await newSigner();
    const ev = await chain(3);
    expect(
      await acceptLog([], await sealLog(other, "CARER", ev), s.pub),
    ).toEqual({
      ok: false,
      why: "signature",
    });
    const broken = [ev[0], { ...ev[1], p: "0".repeat(32) }];
    expect(
      await acceptLog([], await sealLog(s, "CARER", broken), s.pub),
    ).toEqual({
      ok: false,
      why: "signature",
    });
    expect(await acceptLog([], { by: "CARER", ev: [] }, s.pub)).toEqual({
      ok: false,
      why: "signature",
    });
  });
});

// ---------------------------------------------------------------------------
// Contra el doble del servidor: cuatro teléfonos, cuatro roles
// ---------------------------------------------------------------------------

async function family() {
  const store = createMemoryStore({ isolated: true });
  const net = network(store);
  const created = await createFamily(net.api);
  if (!created.ok) throw new Error("create");
  const { ctx: ctxA, phrase } = created.value;
  const a = phone("PARENT-0001", "SENTINEL-NAME Mamá");
  const c = phone("CARER-00002", "SENTINEL-NAME Tía");
  const s = phone("SCHOOL-0003", "SENTINEL-NAME Colegio");
  const n = phone("NUTRI-00004", "SENTINEL-NAME Nutri");
  const [sa, sc, ss, sn] = await Promise.all([a, c, s, n].map((p) => p.signer));
  const g = await appendOp([], sa, a.id, 1, {
    type: "genesis",
    members: [
      { id: a.id, name: a.data.name, role: "parent", pub: sa.pub },
      { id: c.id, name: c.data.name, role: "caregiver", pub: sc.pub },
      {
        id: s.id,
        name: s.data.name,
        role: "school",
        pub: ss.pub,
        meals: ["almuerzo"],
      },
      { id: n.id, name: n.data.name, role: "nutritionist", pub: sn.pub },
    ],
  });
  const pin = (await foldRoster({ ops: [g] }))!.pin;
  a.state = {
    ...freshFamilyState(ctxA.family, ctxA.epoch, DAY),
    roster: [g],
    pin,
  };
  const ctx = new Map<Phone, FamilyCtx>([[a, ctxA]]);
  for (const p of [c, s, n]) {
    const j = await joinFamily(net.api, formatInvite(ctxA.family, pin), phrase);
    if (!j.ok) throw new Error("join");
    ctx.set(p, j.value.ctx);
    p.state = { ...freshFamilyState(ctxA.family, j.value.ctx.epoch, DAY), pin };
  }
  const sync = async (p: Phone) => {
    const r = await syncOnce(p.deps(net.api, ctx.get(p)!));
    expect(r.ok).toBe(true);
    return r;
  };
  for (const p of [a, c, s, n]) await sync(p);
  /** Lo que haría un cliente modificado: subir a mano un registro, sin pasar por la app. */
  const forge = async (p: Phone, named: Named) => {
    const pulled = await pullSince(net.api, ctx.get(p)!, 0);
    if (!pulled.ok) throw new Error("pull");
    const ver =
      pulled.value.items.find((i) => i.named.name === named.name)?.ver ?? 0;
    const r = await pushNamed(net.api, ctx.get(p)!, [{ named, ver }]);
    expect(r.ok && r.value[0].status).toBe("ok");
  };
  const serverCopy = async (name: string) => {
    const pulled = await pullSince(net.api, ctxA, 0);
    if (!pulled.ok) throw new Error("pull");
    return pulled.value.items.find((i) => i.named.name === name)?.named.data;
  };
  return { net, a, c, s, n, sync, forge, serverCopy, pin, ctxA, phrase };
}

describe("roles contra el doble del servidor (cada teléfono descarta lo que no le toca a ese rol)", () => {
  it("cada teléfono adopta el roster firmado y conoce su rol", async () => {
    const { a, c, s, n } = await family();
    for (const p of [a, c, s, n]) expect(p.state!.roster).toHaveLength(1);
    expect(c.state!.rosterIssue).toBeNull();
  });

  it("un cuidador con un cliente modificado cambia el plan: el teléfono del padre lo descarta y el plan bueno vuelve al servidor", async () => {
    const { a, c, n, sync, serverCopy } = await family();
    a.data.plan = { t: 10, by: a.id, diet: { v: "plan del padre" } };
    await sync(a);
    await sync(c);
    expect(c.data.plan?.diet).toEqual({ v: "plan del padre" });
    // El cliente modificado: la tía escribe un plan suyo, más nuevo, y lo sube firmado con SU llave.
    c.data.plan = { t: 99, by: c.id, diet: { v: "plan falso" } };
    await sync(c);
    expect((await serverCopy("plan")) as { by: string }).toMatchObject({
      by: c.id,
    });
    await sync(a);
    expect(a.data.plan?.diet).toEqual({ v: "plan del padre" });
    expect(a.state!.rejected).toBeGreaterThan(0);
    // El padre volvió a subir el suyo: quien llega después no ve el falso.
    expect(await serverCopy("plan")).toMatchObject({ by: a.id });
    await sync(n);
    expect(n.data.plan?.diet).toEqual({ v: "plan del padre" });
  });

  it("cuidador: marca y anota el día; las texturas y las notas del perfil no pasan", async () => {
    const { a, c, sync } = await family();
    c.mark(DAY, "meal:cena", "19:00", 20);
    c.data.days[DAY].notes["meal:cena"] = {
      t: 21,
      by: c.id,
      v: { chips: [], text: "comió bien" },
    };
    c.data.profile = {
      textures: { t: 22, by: c.id, v: ["puree"] },
      notes: {
        x1: {
          t: 22,
          by: c.id,
          v: { kind: "allergy", text: "inventada", at: DAY },
        },
      },
    };
    await sync(c);
    await sync(a);
    expect(a.data.days[DAY].marks["meal:cena"].by).toBe(c.id);
    expect(a.data.days[DAY].notes["meal:cena"].v?.text).toBe("comió bien");
    expect(a.data.profile.textures).toBeUndefined();
    expect(a.data.profile.notes.x1).toBeUndefined();
    expect(a.state!.rejected).toBe(2);
  });

  it("colegio: solo las comidas de su franja", async () => {
    const { a, s, sync } = await family();
    s.mark(DAY, "meal:almuerzo", "12:30", 30);
    s.mark(DAY, "meal:cena", "19:00", 31);
    s.mark(DAY, "water:1", "10:00", 32);
    await sync(s);
    await sync(a);
    expect(Object.keys(a.data.days[DAY].marks)).toEqual(["meal:almuerzo"]);
    expect(a.state!.rejected).toBe(2);
  });

  it("nutricionista: deja notas del perfil y del día, no marca", async () => {
    const { a, n, sync } = await family();
    n.mark(DAY, "meal:almuerzo", "12:30", 40);
    n.data.days[DAY].notes["meal:almuerzo"] = {
      t: 41,
      by: n.id,
      v: { chips: [], text: "probar en puré" },
    };
    n.data.profile = {
      notes: {
        y1: {
          t: 42,
          by: n.id,
          v: { kind: "other", text: "inventada", at: DAY },
        },
      },
    };
    await sync(n);
    await sync(a);
    expect(a.data.days[DAY].marks["meal:almuerzo"]).toBeUndefined();
    expect(a.data.days[DAY].notes["meal:almuerzo"].by).toBe(n.id);
    expect(a.data.profile.notes.y1.by).toBe(n.id);
  });

  it("una marca sin firma, o firmada con la llave de otro, se descarta", async () => {
    const { a, c, forge, sync } = await family();
    const sc = await c.signer;
    const unsigned = { t: 50, by: c.id, v: { at: "08:00" } };
    // Dice ser del padre, pero la firma la tía.
    const posing = { t: 51, by: a.id, v: { at: "09:00" } };
    const posingSig = await sign(
      sc,
      entryPayload(`day:${DAY}`, "meal:desayuno", posing),
    );
    await forge(c, {
      name: `day:${DAY}`,
      data: {
        marks: {
          "meal:once": unsigned,
          "meal:desayuno": { ...posing, s: posingSig },
        },
        notes: {},
      },
    });
    await sync(a);
    expect(a.data.days[DAY]?.marks ?? {}).toEqual({});
    expect(a.state!.rejected).toBe(1); // la que dice ser propia no se cuenta como ajena
  });

  it("un roster alterado (la tía se sube a sí misma) no se adopta, y el bueno vuelve al servidor", async () => {
    const { a, c, n, forge, sync, serverCopy } = await family();
    const sc = await c.signer;
    const ops = c.state!.roster;
    const self = await appendOp(ops, sc, c.id, 60, {
      type: "set",
      member: { id: c.id, name: "x", role: "parent", pub: sc.pub },
    });
    await forge(c, { name: "roster", data: { ops: [...ops, self] } });
    await sync(a);
    expect(a.state!.roster).toHaveLength(1);
    expect(a.state!.rejected).toBeGreaterThan(0);
    expect(((await serverCopy("roster")) as { ops: Op[] }).ops).toHaveLength(1);
    await sync(n);
    expect(n.state!.roster).toEqual(a.state!.roster);
  });

  it("un roster viejo repetido no deshace un cambio del padre", async () => {
    const { a, c, forge, sync } = await family();
    const old = a.state!.roster;
    const st = a.state!;
    expect(
      await addOp(st, await a.signer, a.id, 70, {
        type: "remove",
        id: "NUTRI-00004",
      }),
    ).toBe(true);
    a.state = st;
    await sync(a);
    await sync(c);
    expect(c.state!.roster).toHaveLength(2);
    await forge(c, { name: "roster", data: { ops: old } });
    await sync(c);
    expect(c.state!.roster).toHaveLength(2);
  });

  it("la bitácora reescrita se marca; nadie escribe en la de otro", async () => {
    const { a, c, forge, sync, serverCopy } = await family();
    a.mark(DAY, "meal:almuerzo", "12:00", 79);
    c.mark(DAY, "meal:cena", "19:00", 80);
    await sync(a);
    await sync(c);
    await sync(a);
    expect(a.state!.log.others[c.id]?.length).toBeGreaterThan(0);
    // La tía reescribe su propia bitácora (con su llave): el padre ya la había visto.
    const sc = await c.signer;
    const ev = c.state!.log.own.map((e, i) =>
      i === 0 ? { ...e, r: `${DAY}|meal:desayuno` } : e,
    );
    await forge(c, { name: `log:${c.id}`, data: await sealLog(sc, c.id, ev) });
    await sync(a);
    expect(a.state!.log.rewritten).toContain(c.id);
    // Y la tía no puede escribir en la del padre: no tiene su llave.
    const fake = await sealLog(
      sc,
      a.id,
      await appendEvent([], 81, "plan", "plan"),
    );
    const before = a.state!.rejected;
    await forge(c, { name: `log:${a.id}`, data: fake });
    await sync(c);
    expect(c.state!.log.others[a.id]?.some((e) => e.t === 81)).not.toBe(true);
    // El padre vuelve a subir su bitácora buena encima.
    await sync(a);
    expect(a.state!.rejected).toBe(before);
    expect(await serverCopy(`log:${a.id}`)).toMatchObject({
      s: a.state!.sigs.log?.s,
    });
  });

  it("el registro de un teléfono pisado por otro vuelve a subirse bueno", async () => {
    const { a, c, forge, sync, serverCopy } = await family();
    const sc = await c.signer;
    await forge(c, {
      name: `device:${a.id}`,
      data: { id: a.id, name: "impostor", seen: 1, consent: DAY, pub: sc.pub },
    });
    await sync(a);
    expect(await serverCopy(`device:${a.id}`)).toMatchObject({
      name: "SENTINEL-NAME Mamá",
      pub: (await a.signer).pub,
    });
  });

  it("aviso: lo manda el cuidador; el de la nutricionista se descarta", async () => {
    const { a, c, n, sync } = await family();
    c.data.notices["avisoc1"] = {
      text: "llego tarde",
      name: c.data.name,
      by: c.id,
      t: 90,
      date: DAY,
    };
    n.data.notices["avison1"] = {
      text: "inventado",
      name: n.data.name,
      by: n.id,
      t: 91,
      date: DAY,
    };
    await sync(c);
    await sync(n);
    await sync(a);
    expect(Object.keys(a.data.notices)).toEqual(["avisoc1"]);
  });

  it("el servidor jamás ve roles ni nombres (centinela en todo lo que cruza la red)", async () => {
    const { net, c, sync } = await family();
    c.mark(DAY, "meal:cena", "19:00", 95);
    await sync(c);
    const wire = net.wire.join("\n");
    for (const word of [
      "SENTINEL-NAME",
      "parent",
      "caregiver",
      "school",
      "nutritionist",
      "almuerzo",
      "meal:cena",
    ])
      expect(wire).not.toContain(word);
  });
});

describe("una familia del S7 migra sola, y la huella protege a quien entra", () => {
  it("el primer teléfono actualizado firma el génesis como padre; el otro entra como cuidador al mandar su llave", async () => {
    const store = createMemoryStore({ isolated: true });
    const net = network(store);
    const created = await createFamily(net.api);
    if (!created.ok) throw new Error("create");
    const { ctx: ctxA, phrase } = created.value;
    const a = phone("OLD-PHONE-A1", "Papá Inventado");
    const b = phone("OLD-PHONE-B2", "Abuelo Inventado");
    // Estados del S7: sin roster ni huella (migrate por defecto).
    a.state = {
      ...freshFamilyState(ctxA.family, ctxA.epoch, DAY),
      migrate: true,
      pin: null,
    };
    const pinless = await joinFamily(
      net.api,
      formatInvite(ctxA.family, "000000000000"),
      phrase,
    );
    if (!pinless.ok) throw new Error("join");
    const ctxB = pinless.value.ctx;
    b.state = {
      ...freshFamilyState(ctxB.family, ctxB.epoch, DAY),
      migrate: true,
      pin: null,
    };
    // B ya estaba antes del S9 (A lo conoce como teléfono, sin llave).
    a.state.devices[b.id] = { name: b.data.name, seen: 1 };

    await syncOnce(a.deps(net.api, ctxA));
    expect(a.state!.roster).toHaveLength(1);
    expect(a.state!.legacy).toEqual([b.id]);
    await syncOnce(b.deps(net.api, ctxB)); // adopta el roster y manda su llave
    expect(b.state!.roster).toHaveLength(1);
    expect(b.state!.migrate).toBe(false);
    await syncOnce(a.deps(net.api, ctxA)); // A ve la llave de B y lo pone de cuidador
    const r = await foldRoster({ ops: a.state!.roster });
    expect(r?.members[a.id].role).toBe("parent");
    expect(r?.members[b.id].role).toBe("caregiver");
    expect(a.state!.legacy).toEqual([]);
    // Y desde ahí B ya no cambia el plan.
    b.data.plan = { t: 5, by: b.id, diet: { v: "de B" } };
    await syncOnce(b.deps(net.api, ctxB));
    await syncOnce(a.deps(net.api, ctxA));
    expect(a.data.plan).toBeNull();
  });

  it("un teléfono que entra con otra huella no adopta el roster del servidor", async () => {
    const { net, ctxA, phrase } = await family();
    const x = phone("NEWCOMER-001", "Visita Inventada");
    const j = await joinFamily(
      net.api,
      formatInvite(ctxA.family, "ZZZZZZZZZZZZ"),
      phrase,
    );
    if (!j.ok) throw new Error("join");
    x.state = {
      ...freshFamilyState(ctxA.family, j.value.ctx.epoch, DAY),
      pin: "ZZZZZZZZZZZZ",
    };
    await syncOnce(x.deps(net.api, j.value.ctx));
    expect(x.state!.roster).toEqual([]);
    expect(x.state!.rosterIssue).toBe("pin");
  });
});
