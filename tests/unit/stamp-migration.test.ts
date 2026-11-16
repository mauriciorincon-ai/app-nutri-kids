import { beforeEach, describe, expect, it } from "vitest";

import { clearDevice, getDeviceId } from "@/lib/device";
import {
  DAY_LOG_KEY,
  DAY_LOG_KEY_V2,
  getDayRecord,
  readDayRegs,
  unmark,
} from "@/lib/diet/day-log";
import {
  PROFILE_NOTES_KEY,
  PROFILE_NOTES_KEY_V1,
  loadProfileNotes,
  readProfileRegs,
  removeProfileNote,
} from "@/lib/diet/profile-notes";

// Sprint 007: lo viejo (sin sellos) sube a lo nuevo (con sello) sin perder nada.

const DAY = "2026-11-10";
const DATE = new Date(2026, 10, 10, 12, 0, 0);

beforeEach(() => {
  window.localStorage.clear();
  clearDevice();
});

describe("registro del día: v2 → v3", () => {
  const v2 = {
    [DAY]: {
      marks: { "meal:desayuno": { at: "07:30" }, "supp:vit": { at: null } },
      notes: { "meal:desayuno": { chips: ["ate-well"], text: "todo" } },
    },
  };

  it("conserva marcas y notas con t = 0 y este teléfono, y borra la v2", () => {
    window.localStorage.setItem(DAY_LOG_KEY_V2, JSON.stringify(v2));
    const me = getDeviceId();

    const regs = readDayRegs()[DAY];
    expect(regs.marks["meal:desayuno"]).toEqual({
      t: 0,
      by: me,
      v: { at: "07:30" },
    });
    expect(regs.marks["supp:vit"]).toMatchObject({ t: 0, by: me });
    expect(regs.notes["meal:desayuno"]).toMatchObject({ t: 0, by: me });

    expect(window.localStorage.getItem(DAY_LOG_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(DAY_LOG_KEY_V2)).toBeNull();

    const live = getDayRecord(DATE);
    expect(live.marks["meal:desayuno"]).toEqual({ at: "07:30", by: me });
    expect(live.notes["meal:desayuno"].text).toBe("todo");
  });

  it("un cambio posterior supera lo migrado (t = 0 siempre pierde)", () => {
    window.localStorage.setItem(DAY_LOG_KEY_V2, JSON.stringify(v2));
    unmark(DATE, "meal:desayuno");
    const reg = readDayRegs()[DAY].marks["meal:desayuno"];
    expect(reg.v).toBeNull(); // lápida
    expect(reg.t).toBeGreaterThan(0);
    expect(getDayRecord(DATE).marks["meal:desayuno"]).toBeUndefined();
  });
});

describe("notas del perfil: v1 → v2", () => {
  const v1 = {
    acceptedTextures: ["puree"],
    notes: [
      { id: "n1", kind: "allergy", text: "ejemplo uno", at: "2026-11-01" },
      { id: "n2", kind: "other", text: "ejemplo dos", at: "2026-11-02" },
    ],
  };

  it("conserva texturas y notas con t = 0 y este teléfono, y borra la v1", () => {
    window.localStorage.setItem(PROFILE_NOTES_KEY_V1, JSON.stringify(v1));
    const me = getDeviceId();

    const regs = readProfileRegs();
    expect(regs.textures).toEqual({ t: 0, by: me, v: ["puree"] });
    expect(Object.keys(regs.notes).sort()).toEqual(["n1", "n2"]);
    expect(regs.notes.n1).toMatchObject({ t: 0, by: me });

    expect(window.localStorage.getItem(PROFILE_NOTES_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(PROFILE_NOTES_KEY_V1)).toBeNull();

    const live = loadProfileNotes();
    expect(live.acceptedTextures).toEqual(["puree"]);
    expect(live.notes.map((n) => n.text).sort()).toEqual([
      "ejemplo dos",
      "ejemplo uno",
    ]);
  });

  it("borrar una nota migrada deja lápida y la saca de la lectura", () => {
    window.localStorage.setItem(PROFILE_NOTES_KEY_V1, JSON.stringify(v1));
    removeProfileNote("n1", 5000);
    expect(readProfileRegs().notes.n1).toMatchObject({ t: 5000, v: null });
    expect(loadProfileNotes().notes.map((n) => n.id)).toEqual(["n2"]);
  });

  it("una v1 rota se descarta sin romper nada", () => {
    window.localStorage.setItem(PROFILE_NOTES_KEY_V1, "{roto");
    expect(loadProfileNotes()).toEqual({ acceptedTextures: [], notes: [] });
  });
});
