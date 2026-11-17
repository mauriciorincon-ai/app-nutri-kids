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
  ROSTER_MAX_OPS,
  WRITE_KINDS,
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
import { addOp, addOpResult, sealedSize, syncOnce } from "@/lib/family/sync";
import { ITEM_MAX_CT } from "@/lib/family/server/limits";
import { entryPayload, noticePayload } from "@/lib/family/trust";
import { foodKey, MAP_CAPS } from "@/lib/wellbeing/values";

import { network, phone, setup } from "./family-harness";

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

  it("una marca con la hora en el futuro lejano no gana para siempre: se descarta y la de ahora se queda", async () => {
    const { a, c, sync } = await family();
    const FAR = a.now.t + 6 * 60_000; // pasa de la holgura de 5 min
    c.mark(DAY, "meal:almuerzo", "08:00", FAR);
    await sync(c);
    a.mark(DAY, "meal:almuerzo", "12:30", a.now.t + 500);
    await sync(a);
    expect(a.data.days[DAY]!.marks["meal:almuerzo"]!.v).toEqual({
      at: "12:30",
    });
    expect(a.state!.rejected).toBe(1);
    // Con la hora dentro de la holgura (relojes que no coinciden) sí vale.
    c.mark(DAY, "meal:cena", "19:00", a.now.t + 60_000);
    await sync(c);
    await sync(a);
    expect(a.data.days[DAY]!.marks["meal:cena"]!.v).toEqual({ at: "19:00" });
  });

  it("alguien que sabe la frase pero no está en el roster (llave propia) no escribe marcas ni avisos", async () => {
    const { a, forge, sync } = await family();
    const ghost = await newSigner();
    const mark = { t: 60, by: "GHOST-0009", v: { at: "07:00" } };
    const notice = {
      text: "inventado",
      name: "SENTINEL-NAME Intruso",
      by: "GHOST-0009",
      t: 61,
      date: DAY,
    };
    await forge(
      // cualquier teléfono con la frase sirve para subir bytes; lo que cuenta es la firma
      a,
      {
        name: `day:${DAY}`,
        data: {
          marks: {
            "meal:desayuno": {
              ...mark,
              s: await sign(
                ghost,
                entryPayload(`day:${DAY}`, "meal:desayuno", mark),
              ),
            },
          },
          notes: {},
        },
      },
    );
    await forge(a, {
      name: "notice:fantasma1",
      data: {
        ...notice,
        s: await sign(ghost, noticePayload("notice:fantasma1", notice)),
      },
    });
    await sync(a);
    expect(a.data.days[DAY]?.marks ?? {}).toEqual({});
    expect(Object.keys(a.data.notices)).toEqual([]);
    expect(a.state!.rejected).toBe(2);
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

describe("el tope del roster también es de peso", () => {
  it("120 cambios corrientes caben en un registro; el 121 no entra", async () => {
    const { a } = await family();
    const sa = await a.signer;
    const st = a.state!;
    let n = st.roster.length;
    while (n < ROSTER_MAX_OPS) {
      const ok = await addOp(st, sa, a.id, 10 + n, {
        type: "invite",
        tag: "ABCD",
        role: "caregiver",
      });
      expect(ok).toBe(true);
      n = st.roster.length;
    }
    expect(sealedSize({ ops: st.roster })).toBeLessThan(ITEM_MAX_CT);
    expect(
      await addOp(st, sa, a.id, 999, {
        type: "invite",
        tag: "ABCD",
        role: "caregiver",
      }),
    ).toBe(false);
    expect(st.roster.length).toBe(ROSTER_MAX_OPS);
  });

  it("addOpResult dice por qué: «full» al llenarse (por número y por peso), «invalid» si el cambio no vale", async () => {
    const { a } = await family();
    const sa = await a.signer;
    const st = a.state!;
    // No vale: quitar a alguien que no es de la familia.
    expect(
      await addOpResult(st, sa, a.id, 5, { type: "remove", id: "NADIE-9999" }),
    ).toBe("invalid");
    expect(st.roster.length).toBe(1);
    // Por número.
    while (st.roster.length < ROSTER_MAX_OPS)
      expect(
        await addOpResult(st, sa, a.id, 10 + st.roster.length, {
          type: "invite",
          tag: "ABCD",
          role: "caregiver",
        }),
      ).toBe("ok");
    expect(
      await addOpResult(st, sa, a.id, 999, {
        type: "invite",
        tag: "ABCD",
        role: "caregiver",
      }),
    ).toBe("full");
    // Por peso (la lista no llega a 120 con nombres y comidas largos): también «full».
    const heavy = await family();
    const sh = await heavy.a.signer;
    let last: Awaited<ReturnType<typeof addOpResult>> = "ok";
    for (let i = 0; i < ROSTER_MAX_OPS && last === "ok"; i++)
      last = await addOpResult(heavy.a.state!, sh, heavy.a.id, 10 + i, {
        type: "set",
        member: {
          id: `GUEST-${i}`,
          name: "N".repeat(30),
          role: "school",
          pub: (await newSigner()).pub,
          meals: Array.from({ length: 12 }, (_, k) => `${k}`.padEnd(60, "m")),
        },
      });
    expect(last).toBe("full");
    expect(heavy.a.state!.roster.length).toBeLessThan(ROSTER_MAX_OPS);
  });

  it("un teléfono del S7 que no cabe en la lista llena no se pierde en silencio: queda pendiente y el padre lo ve", async () => {
    const { a, sync } = await family();
    const sa = await a.signer;
    const st = a.state!;
    while (st.roster.length < ROSTER_MAX_OPS)
      await addOp(st, sa, a.id, 10 + st.roster.length, {
        type: "invite",
        tag: "ABCD",
        role: "caregiver",
      });
    st.legacy = ["LEGACY-0009"];
    st.devices["LEGACY-0009"] = {
      name: "Tía vieja",
      seen: 1,
      pub: (await newSigner()).pub,
    };
    expect(st.rosterFull).toBe(false);
    await sync(a);
    expect(a.state!.rosterFull).toBe(true);
    expect(a.state!.legacy).toEqual(["LEGACY-0009"]); // se reintenta, no se descarta
    expect(a.state!.roster.length).toBe(ROSTER_MAX_OPS);
  });

  it("dos padres cambian a la vez con la lista a un paso de llenarse: el que pierde no se queda en silencio, el padre ve el aviso", async () => {
    const { a, b, net, ctxA, ctxB } = await setup();
    const sa = await a.signer;
    const sb = await b.signer;
    const body = (tag: string) => ({
      type: "invite" as const,
      tag,
      role: "caregiver" as const,
    });
    // Los dos parten de la misma cadena de 119 cambios.
    while (a.state!.roster.length < ROSTER_MAX_OPS - 1)
      await addOp(a.state!, sa, a.id, 2 + a.state!.roster.length, body("ABCD"));
    b.state!.roster = [...a.state!.roster];
    b.state!.pin = a.state!.pin;
    // A llena la lista primero y la sube; B hizo otro cambio distinto, más tarde, sin subirlo.
    expect(await addOp(a.state!, sa, a.id, 1000, body("AAAA"))).toBe(true);
    expect(await addOp(b.state!, sb, b.id, 2000, body("BBBB"))).toBe(true);
    expect((await syncOnce(a.deps(net.api, ctxA))).ok).toBe(true);
    expect((await syncOnce(b.deps(net.api, ctxB))).ok).toBe(true);
    // B adopta la cadena de A (más temprana), y su cambio ya no cabe para volver a firmarlo.
    expect(b.state!.roster.at(-1)!.s).toBe(a.state!.roster.at(-1)!.s);
    expect(b.state!.rosterFull).toBe(true);
  });

  it("con los nombres y comidas más largos, para antes de pasar el peso y nunca lo pasa", async () => {
    const { a } = await family();
    const sa = await a.signer;
    const st = a.state!;
    let added = 0;
    for (let i = 0; i < ROSTER_MAX_OPS; i++) {
      const member = {
        id: `GUEST-${i}`,
        name: "N".repeat(30),
        role: "school" as const,
        pub: (await newSigner()).pub,
        meals: Array.from({ length: 12 }, (_, k) => `${k}`.padEnd(60, "m")),
      };
      if (!(await addOp(st, sa, a.id, 10 + i, { type: "set", member }))) break;
      added++;
    }
    expect(added).toBeGreaterThan(0);
    expect(added).toBeLessThan(ROSTER_MAX_OPS - 4);
    expect(sealedSize({ ops: st.roster })).toBeLessThanOrEqual(ITEM_MAX_CT);
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

  it("un padre que cambia una línea del plan unido deja `plan-line` con la línea en la bitácora; un cuidador no puede subir un plan unido", async () => {
    const { a, c, sync, serverCopy } = await family();
    const merged = {
      v: "plan unido",
      merged: { last: { key: "food:SENTINEL-LINE", t: 40 } },
    };
    a.data.plan = { t: 40, by: a.id, diet: merged };
    await sync(a);
    const ev = a.state!.log.own.at(-1)!;
    expect(ev.k).toBe("plan-line");
    expect(ev.r).toBe("food:SENTINEL-LINE");
    await sync(c);
    expect(c.data.plan?.diet).toEqual(merged);
    // La tía, con un cliente modificado, sube otra versión del plan unido: el padre la descarta.
    c.data.plan = {
      t: 90,
      by: c.id,
      diet: { v: "plan unido, falso", merged: { last: { key: "x", t: 90 } } },
    };
    await sync(c);
    await sync(a);
    expect(a.data.plan?.diet).toEqual(merged);
    expect(await serverCopy("plan")).toMatchObject({ by: a.id });
    // El teléfono del padre contó el rechazo.
    expect(a.state!.rejected).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// S10 · bienestar (ADR-015): semáforo, aceptación, cómo está, hábitos y franja de edad
// ---------------------------------------------------------------------------

describe("bienestar: qué puede escribir cada rol", () => {
  const writes: Write[] = [
    { k: "mood", check: "meal:almuerzo" },
    { k: "mood", check: "meal:cena" },
    { k: "mood", check: "water:1" },
    { k: "food", meal: "almuerzo" },
    { k: "food", meal: "cena" },
    { k: "well" },
    { k: "habit" },
    { k: "age" },
  ];
  const label = (w: Write) =>
    "check" in w ? `${w.k}:${w.check}` : "meal" in w ? `${w.k}:${w.meal}` : w.k;
  const expected: Record<Role, string[]> = {
    parent: writes.map(label),
    caregiver: [
      "mood:meal:almuerzo",
      "mood:meal:cena",
      "mood:water:1",
      "food:almuerzo",
      "food:cena",
      "well",
      "habit",
    ],
    school: ["mood:meal:almuerzo", "food:almuerzo"],
    nutritionist: [],
  };
  for (const role of ROLES)
    it(`${role}: solo lo suyo`, () => {
      const m = { role, meals: role === "school" ? ["almuerzo"] : undefined };
      expect(writes.filter((w) => may(m, w)).map(label)).toEqual(
        expected[role],
      );
    });

  it("sin rol no escribe nada del bienestar, y la lista de clases de escritura no se queda corta", () => {
    for (const w of writes) expect(may(null, w)).toBe(false);
    const covered = new Set<string>([
      ...writes.map((w) => w.k),
      "plan",
      "textures",
      "profile-note",
      "mark",
      "day-note",
      "notice",
      "roster",
    ]);
    expect([...covered].sort()).toEqual([...WRITE_KINDS].sort());
  });
});

describe("bienestar contra el doble del servidor", () => {
  const T = 20;
  const wb = (p: Phone, t: number) => ({
    moods: { "meal:cena": { t, by: p.id, v: "tired" as const } },
    food: {
      [foodKey("cena", "brocoli")]: {
        t,
        by: p.id,
        v: {
          stage: "tasted" as const,
          verdict: "accepts" as const,
          texture: "soft" as const,
          presentation: "apart" as const,
          isNew: true,
        },
      },
    },
    well: {
      energy: { t, by: p.id, v: "low" },
      note: { t, by: p.id, v: "SENTINEL-NOTE durmió poco" },
    },
    habits: { sleep: { t, by: p.id, v: 570 } },
  });

  it("cada registro viaja de un cuidador al padre, firmado, y llega entero", async () => {
    const { a, c, sync } = await family();
    c.data.days[DAY] = { marks: {}, notes: {}, ...wb(c, T) };
    await sync(c);
    await sync(a);
    const got = a.data.days[DAY];
    expect(got.moods?.["meal:cena"]).toMatchObject({ by: c.id, v: "tired" });
    expect(got.moods?.["meal:cena"].s).toBeTruthy();
    expect(got.food?.[foodKey("cena", "brocoli")].v).toMatchObject({
      stage: "tasted",
      verdict: "accepts",
      isNew: true,
    });
    expect(got.well?.energy.v).toBe("low");
    expect(got.well?.note.v).toBe("SENTINEL-NOTE durmió poco");
    expect(got.habits?.sleep.v).toBe(570);
    expect(a.state!.rejected).toBe(0);
  });

  it("el padre anota la franja de edad y los demás la reciben; nadie más puede cambiarla", async () => {
    const { a, c, n, sync } = await family();
    a.data.profile = {
      notes: {},
      age: { t: T, by: a.id, v: "3-4" },
    };
    await sync(a);
    await sync(c);
    expect(c.data.profile.age?.v).toBe("3-4");
    // La tía y la nutricionista intentan ponerla (más nueva): el padre la descarta.
    c.data.profile = {
      ...c.data.profile,
      age: { t: T + 5, by: c.id, v: "13-17" },
    };
    n.data.profile = { notes: {}, age: { t: T + 6, by: n.id, v: "1" } };
    await sync(c);
    await sync(n);
    await sync(a);
    expect(a.data.profile.age).toMatchObject({ by: a.id, v: "3-4" });
    // El perfil es un solo registro en el servidor: llega la última versión subida.
    expect(a.state!.rejected).toBeGreaterThan(0);
  });

  it("la nutricionista no escribe nada del bienestar del día", async () => {
    const { a, n, sync } = await family();
    n.data.days[DAY] = { marks: {}, notes: {}, ...wb(n, T) };
    await sync(n);
    await sync(a);
    const got = a.data.days[DAY];
    expect(got?.moods).toBeUndefined();
    expect(got?.food).toBeUndefined();
    expect(got?.well).toBeUndefined();
    expect(got?.habits).toBeUndefined();
    expect(a.state!.rejected).toBe(5);
  });

  it("el colegio solo anota el semáforo y la aceptación de las comidas de su franja", async () => {
    const { a, s, sync } = await family();
    s.data.days[DAY] = {
      marks: {},
      notes: {},
      moods: {
        "meal:almuerzo": { t: T, by: s.id, v: "happy" },
        "meal:cena": { t: T, by: s.id, v: "happy" },
      },
      food: {
        [foodKey("almuerzo", "arroz")]: {
          t: T,
          by: s.id,
          v: {
            stage: "looked",
            verdict: null,
            texture: null,
            presentation: null,
            isNew: false,
          },
        },
        [foodKey("cena", "arroz")]: {
          t: T,
          by: s.id,
          v: {
            stage: "looked",
            verdict: null,
            texture: null,
            presentation: null,
            isNew: false,
          },
        },
      },
      // Cómo está y los hábitos son de la casa: el colegio no los anota.
      well: { energy: { t: T, by: s.id, v: "low" } },
      habits: { screen: { t: T, by: s.id, v: 30 } },
    };
    await sync(s);
    await sync(a);
    const got = a.data.days[DAY];
    expect(Object.keys(got.moods ?? {})).toEqual(["meal:almuerzo"]);
    expect(Object.keys(got.food ?? {})).toEqual([foodKey("almuerzo", "arroz")]);
    expect(got.well).toBeUndefined();
    expect(got.habits).toBeUndefined();
    expect(a.state!.rejected).toBe(4);
  });

  it("sin firma, con la firma de otra persona, con una clave inventada o con una opción que no existe, se descarta (aunque venga de un padre)", async () => {
    const { a, c, forge, sync } = await family();
    const sc = await c.signer;
    const unsigned = { t: 50, by: c.id, v: "happy" as const };
    const posing = { t: 51, by: a.id, v: "anxious" as const };
    const posingSig = await sign(
      sc,
      entryPayload(`day:${DAY}`, "meal:desayuno", posing),
    );
    await forge(c, {
      name: `day:${DAY}`,
      data: {
        marks: {},
        notes: {},
        moods: {
          "meal:cena": unsigned,
          "meal:desayuno": { ...posing, s: posingSig },
        },
      },
    });
    await sync(a);
    expect(a.data.days[DAY]?.moods).toBeUndefined();
    // Solo cuenta lo ajeno: la que dice ser del propio padre y no lo es se descarta sin contar.
    expect(a.state!.rejected).toBe(1);

    // Un padre, bien firmado, pero con una clave que no es de nada y una opción inexistente.
    const sa = await a.signer;
    const sign1 = async <V>(_map: string, key: string, v: V) => {
      const r = { t: 60, by: a.id, v };
      return { ...r, s: await sign(sa, entryPayload(`day:${DAY}`, key, r)) };
    };
    await forge(a, {
      name: `day:${DAY}`,
      data: {
        marks: {},
        notes: {},
        food: {
          sin_separador: await sign1("food", "sin_separador", {
            stage: "tasted",
            verdict: null,
            texture: null,
            presentation: null,
            isNew: false,
          }),
        } as never,
        habits: {
          "ritmo-cardiaco": await sign1("habits", "ritmo-cardiaco", 70),
        },
        well: { pain: await sign1("well", "pain", "muy-fuerte") },
      },
    });
    await sync(c);
    expect(c.data.days[DAY]?.food).toBeUndefined();
    expect(c.data.days[DAY]?.habits).toBeUndefined();
    expect(c.data.days[DAY]?.well).toBeUndefined();
    expect(c.state!.rejected).toBeGreaterThanOrEqual(3);
  });

  it("el servidor no ve tipos, nombres ni contenidos (centinela en todo lo que cruza la red)", async () => {
    const { net, c, sync } = await family();
    c.data.days[DAY] = { marks: {}, notes: {}, ...wb(c, T) };
    c.data.profile = { notes: {}, age: { t: T, by: c.id, v: "5" } };
    await sync(c);
    const wire = net.wire.join("\n");
    for (const word of [
      "SENTINEL-NAME",
      "SENTINEL-NOTE",
      "tired",
      "brocoli",
      "accepts",
      "moods",
      "habits",
      "energy",
      "wellbeing",
      "3-4",
    ])
      expect(wire).not.toContain(word);
  });

  it("un día muy lleno, con los mapas del bienestar al tope, sigue cabiendo en un registro (64 KB cifrados)", () => {
    const s = "A".repeat(86);
    const regs = { marks: {}, notes: {} } as Record<string, unknown>;
    const fill = (n: number, key: (i: number) => string, v: () => unknown) =>
      Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          key(i),
          { t: 1_800_000_000_000, by: "PHONE-0000000000000000", s, v: v() },
        ]),
      );
    const long = "x".repeat(40);
    // Un día muy lleno: 24 marcas y 8 notas de 140 letras, más TODOS los mapas del bienestar al tope.
    regs.marks = fill(
      24,
      (i) => `meal:${long}-${i}`,
      () => ({ at: "12:30" }),
    );
    regs.notes = fill(
      8,
      (i) => `meal:${long}-${i}`,
      () => ({
        chips: ["rejected", "pain", "craving", "other"],
        text: "x".repeat(140),
      }),
    );
    regs.moods = fill(
      MAP_CAPS.moods,
      (i) => `meal:${long}-${i}`,
      () => "not-hungry",
    );
    regs.food = fill(
      MAP_CAPS.food,
      (i) => foodKey(`${long}-${i}`, `${long}-${i}`).slice(0, 160),
      () => ({
        stage: "tasted",
        verdict: "accepts",
        texture: "crunchy",
        presentation: "with-favorite",
        isNew: true,
      }),
    );
    regs.well = fill(
      MAP_CAPS.well,
      (i) => `k${i}`,
      () => "x".repeat(140),
    );
    regs.habits = fill(
      MAP_CAPS.habits,
      (i) => `h${i}`,
      () => 1440,
    );
    expect(sealedSize(regs)).toBeLessThan(ITEM_MAX_CT);
  });
});
