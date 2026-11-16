// @vitest-environment node
import { describe, expect, it } from "vitest";

import { deriveKeys, newSalt, open, aadFor } from "@/lib/family/crypto";
import {
  dayName,
  deviceName,
  kindOf,
  openNamed,
  parseNamed,
  sealNamed,
  type Named,
} from "@/lib/family/records";

const stamp = { t: 1, by: "A" };
const day: Named = {
  name: dayName("2026-11-15"),
  data: {
    marks: {
      "meal:a": { ...stamp, v: { at: "08:00" } },
      "water:1": { ...stamp, v: null },
    },
    notes: {
      "meal:a": { ...stamp, v: { chips: ["rejected"], text: "no quiso" } },
    },
  },
};
const device: Named = {
  name: deviceName("DEV1"),
  data: { id: "DEV1", name: "Mamá", seen: 5, consent: "2026-11-15" },
};

describe("lo que viaja, antes de cifrarse", () => {
  it("valida cada forma por su nombre", () => {
    const env = (n: string, d: unknown) => parseNamed({ n, d });
    expect(env(day.name, day.data)?.name).toBe("day:2026-11-15");
    expect(env("plan", { ...stamp, diet: { any: 1 } })?.name).toBe("plan");
    expect(
      env("profile", {
        textures: { ...stamp, v: ["puree"] },
        notes: {
          n1: {
            ...stamp,
            v: { kind: "allergy", text: "maní", at: "2026-11-15" },
          },
        },
      })?.name,
    ).toBe("profile");
    expect(env(device.name, device.data)?.name).toBe("device:DEV1");
  });

  it("descarta entero lo que no encaja", () => {
    const env = (n: string, d: unknown) => parseNamed({ n, d });
    expect(parseNamed("x")).toBeNull();
    expect(env("day:ayer", day.data)).toBeNull();
    expect(
      env("day:2026-11-15", {
        marks: { a: { ...stamp, v: { at: "25:00" } } },
        notes: {},
      }),
    ).toBeNull();
    expect(
      env("day:2026-11-15", {
        marks: {},
        notes: { a: { ...stamp, v: { chips: [], text: "x".repeat(141) } } },
      }),
    ).toBeNull();
    expect(env("device:OTRO", device.data)).toBeNull();
    expect(env("device:DEV1", { ...device.data, name: " " })).toBeNull();
    expect(env("plan", { diet: 1 })).toBeNull();
    expect(
      env("profile", {
        notes: {
          n: { ...stamp, v: { kind: "peso", text: "x", at: "2026-11-15" } },
        },
      }),
    ).toBeNull();
    expect(env("otra", {})).toBeNull();
  });

  it("el servidor solo distingue el plan del resto", () => {
    expect(kindOf("plan")).toBe("plan");
    expect(kindOf("day:2026-11-15")).toBe("item");
    expect(kindOf("profile")).toBe("item");
  });

  it("sella y abre; el registro lleva solo id, tipo, IV y cifrado (sin nombres ni fechas)", async () => {
    const keys = await deriveKeys("ABCDEFGHJKMNPQRSTVWX", newSalt());
    const wire = await sealNamed(keys, "FAMILY0001", 1, day);
    expect(Object.keys(wire).sort()).toEqual(["ct", "id", "iv", "kind"]);
    expect(JSON.stringify(wire)).not.toMatch(/2026|meal|quiso|marks/);
    expect(await openNamed(keys, "FAMILY0001", 1, wire)).toEqual(day);
    // Otra época u otra familia: no abre.
    expect(await openNamed(keys, "FAMILY0001", 2, wire)).toBeNull();
    // Un servidor que cambia el tipo o el id de sitio: no abre.
    expect(
      await openNamed(keys, "FAMILY0001", 1, { ...wire, kind: "plan" }),
    ).toBeNull();
    const devWire = await sealNamed(keys, "FAMILY0001", 1, device);
    expect(
      await openNamed(keys, "FAMILY0001", 1, { ...devWire, id: wire.id }),
    ).toBeNull();
  });

  it("un registro que descifra pero cuyo nombre no es el de su id se descarta", async () => {
    const keys = await deriveKeys("ABCDEFGHJKMNPQRSTVWX", newSalt());
    const wire = await sealNamed(keys, "F", 1, device);
    // Re-sellado a mano con el id del día: el AAD cuadra, el HMAC del nombre no.
    const dayWire = await sealNamed(keys, "F", 1, day);
    const { seal } = await import("@/lib/family/crypto");
    const forged = await seal(
      keys.enc,
      { n: device.name, d: device.data },
      aadFor("F", 1, dayWire.id),
    );
    expect(
      await open(keys.enc, forged, aadFor("F", 1, dayWire.id)),
    ).not.toBeNull();
    expect(await openNamed(keys, "F", 1, { ...dayWire, ...forged })).toBeNull();
    expect(wire.kind).toBe("item");
  });
});
