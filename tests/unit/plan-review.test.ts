// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { readPlanText, type PlanReading } from "@/lib/diet/pdf-reader";
import { extractPdfPages, type PdfJsLike } from "@/lib/diet/pdf-text";
import {
  REVIEW_KEYS,
  absentBlock,
  buildPlan,
  hasContent,
  isComplete,
  markSection,
  pageOf,
  parseReviewState,
  pendingKeys,
  removeRow,
  rowsOf,
  startReview,
  upsertRow,
  validateValues,
  wasUnrecognized,
  type ReviewKey,
  type ReviewState,
} from "@/lib/diet/plan-review";

let reading: PlanReading;
const NOW = new Date("2030-01-07T10:00:00");

beforeAll(async () => {
  const pdfjs =
    (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsLike;
  const pages = await extractPdfPages(
    pdfjs,
    new Uint8Array(
      readFileSync(join(__dirname, "../fixtures/plan-ejemplo.pdf")),
    ),
  );
  reading = readPlanText(pages);
});

const fresh = () => startReview(reading, NOW);
const ok = (r: ReturnType<typeof upsertRow>): ReviewState => {
  if (!r.ok) throw new Error(`bad: ${r.bad.join(",")}`);
  return r.state;
};
const confirm = (s: ReviewState, k: ReviewKey): ReviewState => {
  const r = markSection(s, k, "ok");
  if (!r.ok) throw new Error(`cannot confirm ${k}: ${r.reason}`);
  return r.state;
};

describe("startReview", () => {
  it("todo parte por revisar y el rojo fijo parte vacío (viene en prosa)", () => {
    const s = fresh();
    expect(pendingKeys(s)).toEqual([...REVIEW_KEYS]);
    expect(s.red).toEqual([]);
    expect(isComplete(s)).toBe(false);
    expect(rowsOf(s, "red")).toEqual([]);
    expect(wasUnrecognized(s, "red")).toBe(false);
    expect(wasUnrecognized(s, "menu")).toBe(false);
  });

  it("cada fila trae su página del PDF; lo añadido a mano, ninguna", () => {
    const s = fresh();
    const first = rowsOf(s, "restricted")[0];
    expect(pageOf(s, "restricted", first.id)).toBeGreaterThan(0);
    expect(pageOf(s, "validity")).toBeGreaterThan(0);
    expect(pageOf(s, "red", "x")).toBeUndefined();
  });
});

describe("marcar secciones", () => {
  it("«está bien» exige que haya algo que confirmar", () => {
    const s = fresh();
    const r = markSection(s, "red", "ok");
    expect(r).toEqual({ ok: false, reason: "empty" });
    expect(confirm(s, "restricted").marks.restricted).toBe("ok");
  });

  it("«mi plan no lo trae» no existe para verde, menú ni hidratación", () => {
    const s = fresh();
    for (const k of ["green", "menu", "hydration"] as const) {
      expect(markSection(s, k, "absent")).toEqual({
        ok: false,
        reason: "required",
      });
      expect(absentBlock(s, k)).toBe("required");
    }
  });

  it("«mi plan no lo trae» se bloquea si la sección tiene contenido y se permite si está vacía", () => {
    const s = fresh();
    expect(absentBlock(s, "restricted")).toBe("has-content");
    expect(markSection(s, "restricted", "absent").ok).toBe(false);
    const r = markSection(s, "red", "absent");
    expect(r.ok && r.state.marks.red).toBe("absent");
    expect(absentBlock(s, "red")).toBeNull();
  });

  it("confirmar tras corregir conserva la marca «corregida»", () => {
    let s = fresh();
    const row = rowsOf(s, "restricted")[0];
    s = ok(upsertRow(s, "restricted", row.id, { name: "Otro nombre" }));
    expect(s.marks.restricted).toBe("corrected");
    expect(confirm(s, "restricted").marks.restricted).toBe("corrected");
  });
});

describe("corregir: renombrar, quitar y añadir", () => {
  it("renombra un restringido en los dos idiomas y deja la sección corregida", () => {
    const s = fresh();
    const row = rowsOf(s, "restricted")[0];
    const n = ok(
      upsertRow(s, "restricted", row.id, { name: " Nombre nuevo " }),
    );
    const hit = n.draft.restricted.find((r) => r.id === row.id)!;
    expect(hit.name).toEqual({ es: "Nombre nuevo", en: "Nombre nuevo" });
    expect(n.marks.restricted).toBe("corrected");
    // el original no se muta
    expect(s.draft.restricted.find((r) => r.id === row.id)!.name.es).not.toBe(
      "Nombre nuevo",
    );
  });

  it("quita una fila y su sección queda corregida", () => {
    const s = fresh();
    const before = rowsOf(s, "alsoAvoid").length;
    const n = removeRow(s, "alsoAvoid", rowsOf(s, "alsoAvoid")[0].id);
    expect(rowsOf(n, "alsoAvoid")).toHaveLength(before - 1);
    expect(n.marks.alsoAvoid).toBe("corrected");
  });

  it("añade al rojo fijo a mano, con id único aunque el nombre se repita", () => {
    let s = fresh();
    s = ok(upsertRow(s, "red", null, { name: "Bebida de ejemplo" }));
    s = ok(upsertRow(s, "red", null, { name: "Bebida de ejemplo" }));
    expect(s.red.map((r) => r.id)).toEqual([
      "bebida-de-ejemplo",
      "bebida-de-ejemplo-2",
    ]);
    expect(pageOf(s, "red", s.red[0].id)).toBeUndefined();
    expect(removeRow(s, "red", s.red[0].id).red).toHaveLength(1);
  });

  it("aditivos: normaliza el código, exige E+número y reemplaza por código", () => {
    const s = fresh();
    expect(validateValues("additives", { code: "XX1", name: "a" })).toContain(
      "code",
    );
    const n = ok(
      upsertRow(s, "additives", null, {
        code: "e999",
        name: "Aditivo nuevo",
        foundIn: "",
      }),
    );
    expect(n.draft.additives.at(-1)).toMatchObject({ code: "E999" });
    expect(n.draft.additives.at(-1)?.foundIn).toBeUndefined();
    const again = ok(
      upsertRow(n, "additives", "E999", {
        code: "E999",
        name: "Cambiado",
        foundIn: "En algo",
      }),
    );
    expect(again.draft.additives.filter((a) => a.code === "E999")).toHaveLength(
      1,
    );
    expect(
      removeRow(again, "additives", "E999").draft.additives,
    ).not.toContainEqual(expect.objectContaining({ code: "E999" }));
  });

  it("verde: lista de alimentos separada por comas; conserva los ítems que ya existían", () => {
    const s = fresh();
    const g = rowsOf(s, "green")[0];
    const firstItem = g.values.items.split(", ")[0];
    const n = ok(
      upsertRow(s, "green", g.id, {
        ...g.values,
        items: `${firstItem}, Alimento nuevo`,
      }),
    );
    const grp = n.draft.green.find((x) => x.id === g.id)!;
    expect(grp.items.map((i) => i.name.es)).toEqual([
      firstItem,
      "Alimento nuevo",
    ]);
    expect(validateValues("green", { ...g.values, items: " , ; " })).toContain(
      "items",
    );
    const added = ok(
      upsertRow(n, "green", null, {
        name: "Grupo",
        portion: "1 porción",
        items: "a",
      }),
    );
    expect(added.draft.green.at(-1)?.id).toBe("grupo");
    expect(removeRow(added, "green", "grupo").draft.green).toHaveLength(
      n.draft.green.length,
    );
  });

  it("amarillo y restringido se añaden y se quitan", () => {
    let s = fresh();
    s = ok(upsertRow(s, "yellow", null, { name: "Cosa", limit: "una vez" }));
    expect(rowsOf(s, "yellow").at(-1)?.values).toEqual({
      name: "Cosa",
      limit: "una vez",
    });
    s = removeRow(s, "yellow", "cosa");
    expect(rowsOf(s, "yellow").some((r) => r.id === "cosa")).toBe(false);
    s = ok(upsertRow(s, "restricted", null, { name: "Algo" }));
    s = removeRow(s, "restricted", "algo");
    expect(rowsOf(s, "restricted").some((r) => r.id === "algo")).toBe(false);
  });

  it("equivalencias: «cuando falta» se resuelve a un alimento conocido y la textura se conserva", () => {
    const s = fresh();
    const eq = s.draft.equivalences[0];
    const row = rowsOf(s, "equivalences")[0];
    const n = ok(upsertRow(s, "equivalences", row.id, row.values));
    expect(n.draft.equivalences[0]).toEqual(eq);
    const named = ok(
      upsertRow(s, "equivalences", null, {
        whenMissing: "Algo inventado",
        title: "Cambia por",
        uses: "uno, dos",
      }),
    );
    const added = named.draft.equivalences.at(-1)!;
    expect(added.whenMissing).toBe("algo-inventado");
    expect(added.use.map((u) => u.name.es)).toEqual(["uno", "dos"]);
    expect(
      removeRow(named, "equivalences", "algo-inventado").draft.equivalences,
    ).toHaveLength(s.draft.equivalences.length);
    // un alimento que sí existe se enlaza por su id real
    const food = s.draft.restricted[0];
    const linked = ok(
      upsertRow(s, "equivalences", null, {
        whenMissing: food.name.es.toUpperCase(),
        title: "t",
        uses: "x",
      }),
    );
    expect(linked.draft.equivalences.map((e) => e.whenMissing)).toContain(
      food.id,
    );
  });

  it("suplementos: días válidos y reemplazo", () => {
    const s = fresh();
    expect(
      validateValues("supplements", {
        name: "x",
        days: "mon,xyz",
        dose: "d",
        when: "w",
      }),
    ).toContain("days");
    const n = ok(
      upsertRow(s, "supplements", null, {
        name: "Suplemento X",
        days: "mon,fri",
        dose: "1",
        when: "al desayuno",
      }),
    );
    expect(n.draft.supplements.at(-1)?.days).toEqual(["mon", "fri"]);
    const id = n.draft.supplements.at(-1)!.id;
    const edit = ok(
      upsertRow(n, "supplements", id, {
        name: "Suplemento X",
        days: "sun",
        dose: "2",
        when: "w",
      }),
    );
    expect(edit.draft.supplements.find((x) => x.id === id)?.days).toEqual([
      "sun",
    ]);
    expect(removeRow(edit, "supplements", id).draft.supplements).toHaveLength(
      s.draft.supplements.length,
    );
  });

  it("menú: hora HH:MM válida y el fin no antes del inicio", () => {
    const s = fresh();
    const base = { name: "Merienda", content: "fruta" };
    expect(
      validateValues("menu", { ...base, start: "9:00", end: "10:00" }),
    ).toContain("start");
    expect(
      validateValues("menu", { ...base, start: "10:00", end: "09:00" }),
    ).toContain("end");
    const n = ok(
      upsertRow(s, "menu", null, { ...base, start: "16:00", end: "16:30" }),
    );
    expect(n.draft.menu.at(-1)).toMatchObject({
      id: "merienda-1600",
      start: "16:00",
    });
    expect(removeRow(n, "menu", "merienda-1600").draft.menu).toHaveLength(
      s.draft.menu.length,
    );
  });

  it("hidratación: números con coma, máximo ≥ mínimo, y se conserva lo ya leído", () => {
    const s = fresh();
    const row = rowsOf(s, "hydration")[0];
    expect(
      validateValues("hydration", { min: "1,5", max: "1", habit: "h" }),
    ).toContain("max");
    expect(
      validateValues("hydration", { min: "0", max: "1", habit: "h" }),
    ).toContain("min");
    const n = ok(
      upsertRow(s, "hydration", "single", {
        ...row.values,
        min: "1,2",
        max: "1,8",
      }),
    );
    expect(n.draft.hydration).toMatchObject({
      targetLitersMin: 1.2,
      targetLitersMax: 1.8,
    });
    expect(n.draft.hydration?.glassesPerDay).toBe(
      s.draft.hydration?.glassesPerDay,
    );
    const gone = removeRow(n, "hydration", "single");
    expect(gone.draft.hydration).toBeUndefined();
    expect(hasContent(gone, "hydration")).toBe(false);
  });

  it("fecha del plan y metas: opcionales donde corresponde", () => {
    const s = fresh();
    expect(validateValues("validity", { issuedAt: "05/01/2030" })).toContain(
      "issuedAt",
    );
    const d = ok(
      upsertRow(s, "validity", "single", { issuedAt: "2030-02-01" }),
    );
    expect(d.draft.issuedAt).toBe("2030-02-01");
    expect(rowsOf(removeRow(d, "validity", "single"), "validity")).toEqual([]);
    const g = ok(
      upsertRow(s, "goals", "single", { activity: "Jugar", sleep: "" }),
    );
    expect(g.draft.goals).toEqual({ activity: { es: "Jugar", en: "Jugar" } });
    const g2 = ok(
      upsertRow(g, "goals", "single", { activity: "", sleep: "Dormir" }),
    );
    expect(g2.draft.goals.activity).toBeUndefined();
    expect(rowsOf(removeRow(g2, "goals", "single"), "goals")).toEqual([]);
    expect(validateValues("goals", {})).toEqual([]);
  });

  it("devuelve los campos con error sin tocar el estado", () => {
    const s = fresh();
    const r = upsertRow(s, "yellow", null, { name: "", limit: "x" });
    expect(r).toEqual({ ok: false, bad: ["name"] });
  });
});

describe("guardar: el plan se arma solo con todo revisado", () => {
  const reviewAll = (s0: ReviewState) => {
    let s = s0;
    for (const k of REVIEW_KEYS) {
      const r = hasContent(s, k)
        ? markSection(s, k, "ok")
        : markSection(s, k, "absent");
      if (!r.ok) throw new Error(`cannot mark ${k}: ${r.reason}`);
      s = r.state;
    }
    return s;
  };

  it("con todo revisado queda lista y arma un plan v2 válido con sus páginas", () => {
    const s = reviewAll(fresh());
    expect(isComplete(s)).toBe(true);
    const plan = buildPlan(s);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.diet.schemaVersion).toBe(2);
      expect(plan.diet.pages).toEqual(s.pages);
      expect(plan.diet.trafficLight.red.items).toEqual([]);
    }
  });

  it("el rojo añadido a mano llega al plan", () => {
    let s = ok(upsertRow(fresh(), "red", null, { name: "Bebida de ejemplo" }));
    s = reviewAll(s);
    const plan = buildPlan(s);
    expect(
      plan.ok && plan.diet.trafficLight.red.items.map((i) => i.id),
    ).toEqual(["bebida-de-ejemplo"]);
  });

  it("sin hidratación no se completa ni se arma, aunque lo demás esté revisado", () => {
    let s = removeRow(fresh(), "hydration", "single");
    for (const k of REVIEW_KEYS) {
      if (k === "hydration") continue;
      const r = hasContent(s, k)
        ? markSection(s, k, "ok")
        : markSection(s, k, "absent");
      if (r.ok) s = r.state;
    }
    expect(isComplete(s)).toBe(false);
    expect(buildPlan(s).ok).toBe(false);
  });

  it("una sección pendiente impide completar", () => {
    const s = reviewAll(fresh());
    const pending = { ...s, marks: { ...s.marks, yellow: "pending" as const } };
    expect(isComplete(pending)).toBe(false);
    expect(pendingKeys(pending)).toEqual(["yellow"]);
  });
});

describe("un PDF de otra forma: todo sin reconocer y se completa a mano", () => {
  it("las secciones vacías se marcan sin reconocer y el plan se arma a mano", () => {
    const blank = readPlanText([
      {
        n: 1,
        height: 800,
        items: [{ str: "Nada conocido", x: 10, y: 20, w: 80 }],
      },
    ]);
    let s = startReview(blank, NOW);
    expect(s.unrecognized).toHaveLength(11);
    expect(wasUnrecognized(s, "green")).toBe(true);
    s = ok(
      upsertRow(s, "green", null, {
        name: "Frutas",
        portion: "1 taza",
        items: "manzana",
      }),
    );
    s = ok(
      upsertRow(s, "menu", null, {
        name: "Desayuno",
        start: "08:00",
        end: "08:30",
        content: "avena",
      }),
    );
    s = ok(
      upsertRow(s, "hydration", "single", {
        min: "1",
        max: "1,5",
        habit: "Agua a sorbos",
      }),
    );
    for (const k of REVIEW_KEYS) {
      const r = hasContent(s, k)
        ? markSection(s, k, "ok")
        : markSection(s, k, "absent");
      if (r.ok) s = r.state;
    }
    expect(isComplete(s)).toBe(true);
    const plan = buildPlan(s);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.diet.meta.issuedAt).toBe("2030-01-07");
      expect(plan.diet.restrictions.foods).toEqual([]);
    }
  });
});

describe("borrador guardado", () => {
  it("ida y vuelta por JSON", () => {
    const s = ok(upsertRow(fresh(), "red", null, { name: "Algo" }));
    expect(parseReviewState(JSON.stringify(s))).toEqual(s);
  });

  it("descarta un borrador malformado, sea cual sea el daño", () => {
    const f = fresh();
    const broken: [string, string | null][] = [
      ["nulo", null],
      ["no es JSON", "{{"],
      ["JSON de otra cosa", "[]"],
      ["otra versión", JSON.stringify({ ...f, v: 2 })],
      ["fecha inválida", JSON.stringify({ ...f, readAt: "nunca" })],
      [
        "marca desconocida",
        JSON.stringify({ ...f, marks: { ...f.marks, menu: "x" } }),
      ],
      ["sin borrador", JSON.stringify({ ...f, draft: undefined })],
      ["lista rota", JSON.stringify({ ...f, draft: { ...f.draft, menu: 3 } })],
    ];
    for (const [name, raw] of broken)
      expect(parseReviewState(raw), name).toBeNull();
  });
});
