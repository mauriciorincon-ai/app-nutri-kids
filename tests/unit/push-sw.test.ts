// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { dietPlanSchema } from "@/lib/diet/schema";
import {
  aadFor,
  deriveKeys,
  newSalt,
  recordId,
  seal,
} from "@/lib/family/crypto";
import { saveKeys } from "@/lib/family/keystore";
import { newSigner, sign, type Signer } from "@/lib/family/sign";
import { noticePayload } from "@/lib/family/trust";
import {
  clearCopy,
  readKey,
  saveCopy,
  saveFamilyPointer,
  type PushCopy,
} from "@/lib/push/copy";
import { DEFAULT_TYPES, planItems } from "@/lib/push/schedule";

import { renderSw } from "../../scripts/build-sw.mjs";

/**
 * Prueba de puente (regla 19): el trabajador real (`scripts/sw-push.js`, tal como entra en
 * `public/sw.js`) lee la copia que escribe `src/lib/push/copy.ts` y abre los registros que
 * sella `src/lib/family/crypto.ts`, con las llaves que guarda `keystore.ts`.
 */

const root = join(__dirname, "../..");
const source = readFileSync(join(root, "scripts/sw-push.js"), "utf8");

type Shown = {
  title: string;
  options: {
    body?: string;
    tag?: string;
    silent?: boolean;
    data?: { url: string };
  };
};
type SwPush = {
  onPush: (d: Date, f: typeof fetch) => Promise<Shown>;
  clickUrl: (data: unknown) => string;
};
const loadSw = () => new Function(`${source}\nreturn NK_PUSH;`)() as SwPush;

const demo = dietPlanSchema.parse(
  JSON.parse(readFileSync(join(root, "data/demo-diet.json"), "utf8")),
);
const items = planItems(demo, "es", {
  supplementTitle: "Suplemento de hoy",
  waterTitle: "Un vaso de agua",
  waterBody: (n, t) => `Vaso ${n} de ${t}`,
});
const copy = (over: Partial<PushCopy> = {}): PushCopy => ({
  v: 1,
  types: { ...DEFAULT_TYPES, family: false },
  hide: false,
  items,
  done: { date: "2026-11-16", ids: [] },
  text: {
    generic: { title: "Nutrikids", body: "Abre la app para ver qué toca." },
    hidden: { title: "Nutrikids", body: "Hay algo del plan para esta hora." },
    allDone: {
      title: "Nutrikids",
      body: "Todo lo de esta hora ya está marcado.",
    },
    many: "Toca ahora",
    familyFrom: "Aviso de {name}",
    familyGeneric: {
      title: "Nutrikids",
      body: "Hay un aviso nuevo de la familia.",
    },
  },
  ...over,
});
/** Lunes 16 de noviembre de 2026, hora local del proceso. */
const at = (hh: number, mm: number) => new Date(2026, 10, 16, hh, mm);
const noFetch = (async () => {
  throw new Error("no debería pedir nada");
}) as unknown as typeof fetch;

let idb: IDBFactory;
beforeEach(() => {
  idb = new IDBFactory();
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = idb;
});

describe("el trabajador arma el aviso con la copia local", () => {
  it("sin copia (nunca se prendieron los avisos), un aviso mínimo y no crea la base", async () => {
    const sw = loadSw();
    const n = await sw.onPush(at(7, 0), noFetch);
    expect(n.title).toBe("Nutrikids");
    expect(n.options.body).toBeUndefined();
    expect((await idb.databases()).map((d) => d.name)).not.toContain(
      "nutrikids-push",
    );
  });

  it("a las 07:00 del lunes: desayuno y suplemento juntos; a las 16:03, la merienda con lo que dice el plan", async () => {
    await saveCopy(copy(), idb);
    const sw = loadSw();
    const seven = await sw.onPush(at(7, 0), noFetch);
    expect(seven.title).toBe("Toca ahora");
    expect(seven.options.body).toBe("Desayuno · Suplemento de hoy");
    expect(seven.options.data).toEqual({ url: "/" });
    const snack = await sw.onPush(at(16, 3), noFetch);
    expect(snack.title).toBe("Merienda");
    expect(snack.options.body).toBe(
      items.find((i) => i.id === "meal:merienda")!.body,
    );
  });

  it("el mismo despertar no se muestra dos veces; uno de hace más de 15 min ya no", async () => {
    await saveCopy(copy(), idb);
    const sw = loadSw();
    expect((await sw.onPush(at(16, 0), noFetch)).title).toBe("Merienda");
    expect((await sw.onPush(at(16, 1), noFetch)).options.body).toBe(
      "Abre la app para ver qué toca.",
    );
    expect((await sw.onPush(at(12, 46), noFetch)).options.body).toBe(
      "Abre la app para ver qué toca.",
    );
  });

  it("lo ya marcado no avisa: si todo está hecho, un aviso silencioso lo dice", async () => {
    await saveCopy(
      copy({ done: { date: "2026-11-16", ids: ["meal:desayuno"] } }),
      idb,
    );
    const half = await loadSw().onPush(at(7, 2), noFetch);
    expect(half.title).toBe("Suplemento de hoy");
    await clearCopy(idb);
    await saveCopy(
      copy({
        done: {
          date: "2026-11-16",
          ids: ["meal:desayuno", "supplement:multivitaminico-demo"],
        },
      }),
      idb,
    );
    const all = await loadSw().onPush(at(7, 2), noFetch);
    expect(all.title).toBe("Nutrikids");
    expect(all.options).toMatchObject({
      body: "Todo lo de esta hora ya está marcado.",
      silent: true,
    });
  });

  it("las marcas de otro día no cuentan", async () => {
    await saveCopy(
      copy({ done: { date: "2026-11-15", ids: ["meal:merienda"] } }),
      idb,
    );
    expect((await loadSw().onPush(at(16, 0), noFetch)).title).toBe("Merienda");
  });

  it("«ocultar el detalle»: con el teléfono bloqueado no se ve qué toca", async () => {
    await saveCopy(copy({ hide: true }), idb);
    const n = await loadSw().onPush(at(16, 0), noFetch);
    expect(n.title).toBe("Nutrikids");
    expect(n.options.body).toBe("Hay algo del plan para esta hora.");
    expect(JSON.stringify(n)).not.toMatch(/Merienda|Multivitam/);
  });

  it("al tocar el aviso solo abre rutas de la propia app", () => {
    const sw = loadSw();
    expect(sw.clickUrl({ url: "/#avisos" })).toBe("/#avisos");
    expect(sw.clickUrl({ url: "https://otro.example" })).toBe("/");
    expect(sw.clickUrl({ url: "//otro.example" })).toBe("/");
    expect(sw.clickUrl({ url: "/\\otro.example" })).toBe("/");
    expect(sw.clickUrl({ url: "/\\/otro.example" })).toBe("/");
    expect(sw.clickUrl({ url: "javascript:alert(1)" })).toBe("/");
    expect(sw.clickUrl({ url: "/dieta/pollo" })).toBe("/dieta/pollo");
    expect(sw.clickUrl(null)).toBe("/");
  });
});

describe("el trabajador abre el aviso de la familia con las llaves del teléfono", () => {
  const FAMILY = "A1B2C3D4E5";

  /** Quienes pueden avisar en esta familia de prueba (S9): cada uno con su llave. */
  const SENDERS = ["otro", "p", "a", "x"];

  async function familySetup() {
    const keys = await deriveKeys("frase de prueba para el puente", newSalt());
    await saveKeys(FAMILY, keys, idb);
    const signers: Record<string, Signer> = {};
    for (const id of SENDERS) signers[id] = await newSigner();
    await saveFamilyPointer(
      {
        family: FAMILY,
        epoch: 1,
        seq: 4,
        self: "yo",
        senders: Object.fromEntries(SENDERS.map((id) => [id, signers[id].pub])),
      },
      idb,
    );
    await saveCopy(copy({ types: { ...DEFAULT_TYPES, family: true } }), idb);
    /** Sella un registro; un aviso va firmado por quien dice (o por `signer`, o sin firma). */
    const record = async (
      n: string,
      d: unknown,
      epoch = 1,
      signer?: Signer | null,
    ) => {
      const id = await recordId(keys.id, n);
      if (n.startsWith("notice:")) {
        const nd = d as Parameters<typeof noticePayload>[1];
        const by = signer === undefined ? signers[nd.by] : signer;
        if (by) d = { ...nd, s: await sign(by, noticePayload(n, nd)) };
      }
      const sealed = await seal(keys.enc, { n, d }, aadFor(FAMILY, epoch, id));
      return { id, kind: "item", ver: 1, seq: 5, ...sealed };
    };
    const requests: { url: string; init: RequestInit }[] = [];
    const serve = (records: unknown[], status = 200) =>
      (async (url: string, init: RequestInit) => {
        requests.push({ url, init });
        return Response.json({ seq: 9, more: false, records }, { status });
      }) as unknown as typeof fetch;
    return { keys, record, requests, serve, signers };
  }

  it("solo un aviso firmado por alguien que puede avisar (S9): sin firma, con la llave de otro o de fuera del roster, el genérico", async () => {
    const { record, serve, signers } = await familySetup();
    const base = { text: "Inventado", name: "X", t: 70, date: "2026-11-16" };
    const unsigned = await record("notice:u", { ...base, by: "p" }, 1, null);
    const otherKey = await record(
      "notice:o",
      { ...base, by: "p", t: 71 },
      1,
      signers.a,
    );
    const outsider = await record(
      "notice:n",
      { ...base, by: "nutri", t: 72 },
      1,
      await newSigner(),
    );
    const sw = loadSw();
    const n = await sw.onPush(at(15, 0), serve([unsigned, otherKey, outsider]));
    expect(n.options.body).toBe("Hay un aviso nuevo de la familia.");
    expect(n.title).toBe("Nutrikids");
    // Y uno firmado por quien dice, sí.
    const good = await record("notice:g", { ...base, by: "p", t: 73 });
    const m = await loadSw().onPush(at(15, 1), serve([good]));
    expect(m.title).toBe("Aviso de X");
  });

  it("sin la lista de quién puede avisar (familia sin roster), ningún texto: el genérico", async () => {
    const { record, serve } = await familySetup();
    await saveFamilyPointer(
      { family: FAMILY, epoch: 1, seq: 4, self: "yo" },
      idb,
    );
    const notice = await record("notice:z", {
      text: "Inventado",
      name: "X",
      by: "p",
      t: 80,
    });
    const n = await loadSw().onPush(at(15, 0), serve([notice]));
    expect(n.options.body).toBe("Hay un aviso nuevo de la familia.");
  });

  it("muestra «Aviso de <nombre>» con la nota; pide con el token, sin nada en claro", async () => {
    const { keys, record, requests, serve } = await familySetup();
    const notice = await record("notice:n1", {
      text: "Hoy no enviar jugo",
      name: "Mamá",
      by: "otro",
      t: 1000,
      date: "2026-11-16",
    });
    const sw = loadSw();
    const n = await sw.onPush(at(15, 0), serve([notice]));
    expect(n.title).toBe("Aviso de Mamá");
    expect(n.options.body).toBe("Hoy no enviar jugo");
    expect(n.options.data).toEqual({ url: "/#avisos" });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("/api/family/pull");
    expect(
      (requests[0].init.headers as Record<string, string>).authorization,
    ).toBe(`Bearer ${keys.token}`);
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      family: FAMILY,
      epoch: 1,
      since: 4,
    });
    // Ya visto: el siguiente toque sin nada nuevo da el aviso genérico de la familia.
    const again = await sw.onPush(at(15, 1), serve([notice]));
    expect(again.options.body).toBe("Hay un aviso nuevo de la familia.");
    expect(await readKey("familySeen", idb)).toBe(1000);
  });

  it("un despertar ya marcado (silencioso) no se traga la nota de la familia que llegó en su ventana", async () => {
    const { record, serve } = await familySetup();
    const allDone = copy({
      types: { ...DEFAULT_TYPES, family: true },
      done: {
        date: "2026-11-16",
        ids: ["meal:desayuno", "supplement:multivitaminico-demo"],
      },
    });
    await saveCopy(allDone, idb);
    const notice = await record("notice:n1", {
      text: "Hoy no enviar jugo",
      name: "Mamá",
      by: "otro",
      t: 1000,
    });
    // 07:08: el despertar de las 07:00 está todo marcado, pero hay una nota nueva.
    const n = await loadSw().onPush(at(7, 8), serve([notice]));
    expect(n.title).toBe("Aviso de Mamá");
    expect(n.options.body).toBe("Hoy no enviar jugo");
  });

  it("ya marcado y sin nota nueva de la familia: sigue siendo el silencioso de «ya está marcado»", async () => {
    const { serve } = await familySetup();
    await saveCopy(
      copy({
        types: { ...DEFAULT_TYPES, family: true },
        done: {
          date: "2026-11-16",
          ids: ["meal:desayuno", "supplement:multivitaminico-demo"],
        },
      }),
      idb,
    );
    const n = await loadSw().onPush(at(7, 8), serve([]));
    expect(n.options).toMatchObject({ silent: true });
    expect(n.options.body).toBe("Todo lo de esta hora ya está marcado.");
  });

  it("de varios, el más reciente; lo propio, lo alterado o de otro sitio no cuenta", async () => {
    const { record, serve } = await familySetup();
    const old = await record("notice:a", {
      text: "Viejo",
      name: "Papá",
      by: "p",
      t: 10,
    });
    const fresh = await record("notice:b", {
      text: "Nuevo",
      name: "Abuela",
      by: "a",
      t: 20,
    });
    const mine = await record("notice:c", {
      text: "Mío",
      name: "Yo",
      by: "yo",
      t: 30,
    });
    const moved = {
      ...(await record("notice:d", {
        text: "Movido",
        name: "X",
        by: "x",
        t: 40,
      })),
      id: old.id,
    };
    const tooLong = await record("notice:e", {
      text: "x".repeat(141),
      name: "X",
      by: "x",
      t: 50,
    });
    const otherEpoch = await record(
      "notice:f",
      { text: "Otra época", name: "X", by: "x", t: 60 },
      2,
    );
    const notNotice = await record("day:2026-11-16", { marks: {}, notes: {} });
    const n = await loadSw().onPush(
      at(15, 0),
      serve([old, fresh, mine, moved, tooLong, otherEpoch, notNotice]),
    );
    expect(n.title).toBe("Aviso de Abuela");
    expect(n.options.body).toBe("Nuevo");
  });

  it("con «ocultar el detalle», ni el nombre ni la nota", async () => {
    const { record, serve } = await familySetup();
    await saveCopy(
      copy({ hide: true, types: { ...DEFAULT_TYPES, family: true } }),
      idb,
    );
    const notice = await record("notice:n1", {
      text: "Hoy no enviar jugo",
      name: "Mamá",
      by: "otro",
      t: 1,
    });
    const n = await loadSw().onPush(at(15, 0), serve([notice]));
    expect(JSON.stringify(n)).not.toMatch(/Mamá|jugo/);
    expect(n.options.body).toBe("Hay un aviso nuevo de la familia.");
  });

  it("sin llaves, de otra familia, sin red o con el servidor fallando: «Hay un aviso nuevo»", async () => {
    const { record, serve } = await familySetup();
    const notice = await record("notice:n1", {
      text: "x",
      name: "Mamá",
      by: "otro",
      t: 1,
    });
    const offline = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    expect((await loadSw().onPush(at(15, 0), offline)).options.body).toBe(
      "Hay un aviso nuevo de la familia.",
    );
    expect(
      (await loadSw().onPush(at(15, 0), serve([notice], 403))).options.body,
    ).toBe("Hay un aviso nuevo de la familia.");
    const junk = (async () =>
      new Response("no json")) as unknown as typeof fetch;
    expect((await loadSw().onPush(at(15, 0), junk)).options.body).toBe(
      "Hay un aviso nuevo de la familia.",
    );
    await saveFamilyPointer(
      { family: "ZZZZZZZZZZ", epoch: 1, seq: 0, self: "yo" },
      idb,
    );
    expect((await loadSw().onPush(at(15, 0), noFetch)).options.body).toBe(
      "Hay un aviso nuevo de la familia.",
    );
    await saveFamilyPointer(null, idb);
    expect((await loadSw().onPush(at(15, 0), noFetch)).options.body).toBe(
      "Hay un aviso nuevo de la familia.",
    );
  });
});

describe("la copia en un teléfono sin IndexedDB", () => {
  it("no guarda nada, no lee nada y no falla", async () => {
    expect(await saveCopy(copy(), null)).toBe(false);
    expect(await saveFamilyPointer(null, null)).toBe(false);
    expect(await readKey("copy", null)).toBeUndefined();
    await expect(clearCopy(null)).resolves.toBeUndefined();
  });

  it("si IndexedDB falla al escribir, devuelve false", async () => {
    const broken = {
      open: () => {
        throw new Error("bloqueado");
      },
    } as unknown as IDBFactory;
    expect(await saveCopy(copy(), broken)).toBe(false);
    expect(await saveFamilyPointer(null, broken)).toBe(false);
    await expect(clearCopy(broken)).resolves.toBeUndefined();
  });

  it("guardar y borrar el puntero de la familia", async () => {
    await saveFamilyPointer({ family: "A", epoch: 1, seq: 0, self: "yo" }, idb);
    expect(await readKey("family", idb)).toMatchObject({ family: "A" });
    await saveFamilyPointer(null, idb);
    expect(await readKey("family", idb)).toBeUndefined();
  });
});

describe("contrato del trabajador con la build (regla 19)", () => {
  it("public/sw.js lleva el módulo de avisos y sus dos eventos, y compila", () => {
    const out = renderSw(
      readFileSync(join(root, "scripts/sw.template.js"), "utf8"),
      "x",
    );
    expect(out).not.toContain("__PUSH_MODULE__");
    expect(out).toContain("const NK_PUSH = (() => {");
    expect(out).toContain('self.addEventListener("push"');
    expect(out).toContain('self.addEventListener("notificationclick"');
    expect(out).toContain("showNotification");
    expect(() => new Function(out)).not.toThrow();
  });

  it("los nombres de la base y del almacén son los mismos en la página y en el trabajador", () => {
    const page = readFileSync(join(root, "src/lib/push/copy.ts"), "utf8");
    const keystore = readFileSync(
      join(root, "src/lib/family/keystore.ts"),
      "utf8",
    );
    expect(page).toContain('PUSH_DB = "nutrikids-push"');
    expect(page).toContain('PUSH_STORE = "kv"');
    expect(source).toContain('PUSH_DB = "nutrikids-push"');
    expect(source).toContain('KV = "kv"');
    expect(keystore).toContain('DB_NAME = "nutrikids-family"');
    expect(keystore).toContain('STORE = "keys"');
    expect(keystore).toContain('ROW = "main"');
    expect(source).toContain('FAMILY_DB = "nutrikids-family"');
    expect(source).toContain('KEYS = "keys"');
    expect(source).toContain('"main"');
    // El AAD del token y de cada registro es el mismo que sella el S7.
    expect(keystore).toContain("`nk1|token|${family}`");
    expect(source).toContain("`nk1|token|${ptr.family}`");
    expect(source).toContain("`nk1|${family}|${epoch}|${rec.id}`");
  });
});
