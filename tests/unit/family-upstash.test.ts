// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SCRIPTS, createUpstashStore } from "@/lib/family/server/upstash";

type Sent = { url: string; auth: string | null; command: string[] };

/** Un Upstash de mentira: anota cada comando y contesta lo que le toca. */
function fake(replies: unknown[], status = 200) {
  const sent: Sent[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    sent.push({
      url,
      auth: headers.authorization ?? null,
      command: JSON.parse(String(init.body)),
    });
    const next = replies.shift();
    return new Response(JSON.stringify(next), { status });
  }) as unknown as typeof fetch;
  return { sent, fetcher };
}

const F = "A1B2C3D4E5";

describe("la base real (Upstash por REST, sin dependencias)", () => {
  it("cada operación que lee y escribe es un solo script Lua, sobre las claves de la familia", async () => {
    const { sent, fetcher } = fake([{ result: 1 }]);
    const store = createUpstashStore("https://db.example/", "SECRET", fetcher);
    expect(store.label).toBe("real");
    expect(await store.create(F, "salt", "hash", 99)).toBe(true);
    expect(sent[0].url).toBe("https://db.example");
    expect(sent[0].auth).toBe("Bearer SECRET");
    expect(sent[0].command).toEqual([
      "EVAL",
      SCRIPTS.CREATE,
      "1",
      `nk:{${F}}:m`,
      "salt",
      "hash",
      "99",
    ]);
  });

  it("meta lee sal, huella y época; sin familia, null", async () => {
    const { sent, fetcher } = fake([
      { result: ["salt", "hash", "3"] },
      { result: [null, null, null] },
    ]);
    const store = createUpstashStore("https://db", "T", fetcher);
    expect(await store.meta(F)).toEqual({
      salt: "salt",
      tokenHash: "hash",
      epoch: 3,
    });
    expect(await store.meta(F)).toBeNull();
    expect(sent[0].command).toEqual([
      "HMGET",
      `nk:{${F}}:m`,
      "salt",
      "th",
      "ep",
    ]);
  });

  it("pull interpreta seq, «hay más» y cada «ver:kind:iv:ct»; época vieja: null", async () => {
    const { sent, fetcher } = fake([
      { result: ["7", 1, "ID1", "5", "2:item:IV1:CT1", "ID2", "6", "basura"] },
      { result: null },
    ]);
    const store = createUpstashStore("https://db", "T", fetcher);
    expect(await store.pull(F, 2, 4, 1000, 9)).toEqual({
      seq: 7,
      more: true,
      records: [
        { id: "ID1", seq: 5, ver: 2, kind: "item", iv: "IV1", ct: "CT1" },
      ],
    });
    expect(sent[0].command.slice(0, 2)).toEqual(["EVAL", SCRIPTS.PULL]);
    expect(sent[0].command.slice(2)).toEqual([
      "3",
      `nk:{${F}}:m`,
      `nk:{${F}}:r`,
      `nk:{${F}}:z`,
      "2",
      "4",
      "1000",
      "9",
    ]);
    expect(await store.pull(F, 1, 0, 1000, 9)).toBeNull();
  });

  it("push manda id·versión·tipo·iv·cifrado por registro y lee ok / conflicto / lleno", async () => {
    const { sent, fetcher } = fake([
      { result: [1, 3, 0, 5, 2, 0] },
      { result: null },
    ]);
    const store = createUpstashStore("https://db", "T", fetcher);
    const items = [
      { id: "A", ver: 2, kind: "item" as const, iv: "i", ct: "c" },
      { id: "B", ver: 1, kind: "plan" as const, iv: "j", ct: "d" },
      { id: "C", ver: 0, kind: "item" as const, iv: "k", ct: "e" },
    ];
    expect(await store.push(F, 1, items, 1000, 9)).toEqual([
      { status: "ok", ver: 3 },
      { status: "conflict", ver: 5 },
      { status: "full", ver: 0 },
    ]);
    expect(sent[0].command.slice(6)).toEqual([
      "1",
      "1000",
      "9",
      "A",
      "2",
      "item",
      "i",
      "c",
      "B",
      "1",
      "plan",
      "j",
      "d",
      "C",
      "0",
      "item",
      "k",
      "e",
    ]);
    expect(await store.push(F, 1, items, 1000, 9)).toBeNull();
  });

  it("rotate devuelve la época nueva; destroy borra las tres claves; count usa su contador", async () => {
    const { sent, fetcher } = fake([
      { result: 4 },
      { result: null },
      { result: 1 },
      { result: 3 },
    ]);
    const store = createUpstashStore("https://db", "T", fetcher);
    expect(await store.rotate(F, 3, "s", "h", 9)).toBe(4);
    expect(await store.rotate(F, 3, "s", "h", 9)).toBeNull();
    await store.destroy(F);
    expect(sent[2].command).toEqual([
      "DEL",
      `nk:{${F}}:m`,
      `nk:{${F}}:r`,
      `nk:{${F}}:z`,
    ]);
    expect(await store.count("m:x:1", 60)).toBe(3);
    expect(sent[3].command).toEqual([
      "EVAL",
      SCRIPTS.COUNT,
      "1",
      "nk:c:m:x:1",
      "60",
    ]);
  });

  it("un error de la base se vuelve un error fijo, sin repetir argumentos ni el token", async () => {
    const bad = createUpstashStore(
      "https://db",
      "SECRET",
      fake([{ error: "ERR SECRET arg" }]).fetcher,
    );
    await expect(bad.meta(F)).rejects.toThrow(/^family-store$/);
    const down = createUpstashStore(
      "https://db",
      "SECRET",
      fake(["x"], 500).fetcher,
    );
    await expect(down.meta(F)).rejects.toThrow(/^family-store$/);
  });

  it("los scripts comprueban la época antes de leer o escribir, y la versión antes de escribir", () => {
    for (const s of [SCRIPTS.PULL, SCRIPTS.PUSH, SCRIPTS.ROTATE]) {
      expect(s.trim().split("\n")[0]).toBe(
        "if redis.call('HGET', KEYS[1], 'ep') ~= ARGV[1] then return false end",
      );
    }
    expect(SCRIPTS.PUSH).toMatch(/if ver ~= exp then/);
    expect(SCRIPTS.ROTATE).toMatch(/redis.call\('DEL', KEYS\[2\], KEYS\[3\]\)/);
  });
});
