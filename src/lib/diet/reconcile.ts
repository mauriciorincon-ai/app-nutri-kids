/**
 * Unir dos planes en uno (S9 · ADR-014). Puro: recibe los dos planes y las elecciones del
 * padre y devuelve el plan unido, la lista de choques y cuáles faltan por elegir.
 *
 * Reglas (G-Plan del S9):
 *  - Lo PROHIBIDO gana solo: si un plan pone un alimento en rojo (rojo fijo, «además
 *    evitar» o restricción) y el otro no, queda en rojo y la línea guarda su origen.
 *    Alergias e intolerancias se suman; la ventana de una restricción se queda con la más
 *    ancha. El plan unido nunca es menos estricto que ninguno de los dos en lo rojo.
 *  - Todo otro choque (amarillo contra verde, medida, dosis, horario, textura, porción,
 *    hidratación, textos) lo elige un padre, uno por uno, con los dos lados a la vista.
 *    Sin elección, el plan unido usa el plan A y el choque queda en `pending`.
 *  - Cada línea guarda de dónde salió (`merged.lines`) y, cuando había dos caras, la otra
 *    cara (`alt`): así un padre puede cambiarla después (`switchLine`), también una roja,
 *    sin que el segundo plan siga guardado.
 *  - Jamás se inventa texto: solo se copian líneas que uno de los dos planes ya traía.
 */
import {
  dietPlanSchema,
  type DietPlan,
  type LocalizedText,
  type MergedAlt,
  type MergedLine,
  type PathSeg,
  type Place,
} from "./schema";
import { toTokens } from "./search";

export type Side = "a" | "b";
export type Choices = Readonly<Record<string, Side>>;

export type ConflictKind =
  | "color"
  | "limit"
  | "portion"
  | "dose"
  | "schedule"
  | "texture"
  | "content"
  | "hydration"
  | "text";

export type Conflict = {
  /** Clave de la línea: la misma de `merged.lines` y de `Choices`. */
  key: string;
  kind: ConflictKind;
  /** Qué línea es (nombre del alimento, suplemento, comida…). */
  label: LocalizedText;
  a: LocalizedText;
  b: LocalizedText;
};

export type Reconciled = {
  plan: DietPlan;
  conflicts: Conflict[];
  /** Choques sin elección todavía. */
  pending: string[];
  /** El plan unido pasa el schema (si no, no se guarda). */
  valid: boolean;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

const lt = (x: LocalizedText): string =>
  `${toTokens(x.es, "es").join(" ")}|${toTokens(x.en, "en").join(" ")}`;
const sameText = (x?: LocalizedText, y?: LocalizedText): boolean =>
  !!x && !!y && lt(x) === lt(y);
const sameName = (x: LocalizedText, y: LocalizedText): boolean =>
  toTokens(x.es, "es").join(" ") === toTokens(y.es, "es").join(" ") ||
  toTokens(x.en, "en").join(" ") === toTokens(y.en, "en").join(" ");
const both = (s: string): LocalizedText => ({ es: s, en: s });
const key = (k: string) => k.slice(0, 100);
const isRed = (c: Place["color"]) =>
  c === "restricted" || c === "red" || c === "alsoAvoid";
const rank = (c: Place["color"]) => (isRed(c) ? 3 : c === "yellow" ? 2 : 1);

function matchSel(el: unknown, sel: { k: string; v: string }): boolean {
  const o = el as Obj;
  switch (sel.k) {
    case "id":
      return o.id === sel.v;
    case "whenMissing":
      return o.whenMissing === sel.v;
    case "code":
      return o.code === sel.v;
    case "nameEs":
      return (o.name as LocalizedText | undefined)?.es === sel.v;
    case "eq":
      return (
        `${o.whenMissing as string}|${(o.title as LocalizedText).es}` === sel.v
      );
  }
  return false;
}

/** El registro del plan al que apunta un camino con selectores (null si ya no existe). */
function locate(plan: DietPlan, path: readonly PathSeg[]): Obj | null {
  let node: unknown = plan;
  for (const seg of path) {
    if (typeof seg === "string") {
      node = (node as Obj | undefined)?.[seg];
    } else {
      node = Array.isArray(node)
        ? node.find((el) => matchSel(el, seg))
        : undefined;
    }
    if (node === undefined || node === null) return null;
  }
  return typeof node === "object" && !Array.isArray(node)
    ? (node as Obj)
    : null;
}

/** Los valores de hoy de esos campos (`null` = no existe), para guardar la otra cara. */
function readPatch(rec: Obj, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, rec[k] ?? null]));
}
function applyPatch(rec: Obj, patch: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete rec[k];
    else rec[k] = v;
  }
}

// --- Alimentos: una lista por color ------------------------------------------------------

type Entry = Place;

function entriesOf(plan: DietPlan): Entry[] {
  const out: Entry[] = [];
  for (const f of plan.restrictions.foods)
    out.push({ color: "restricted", id: f.id, name: f.name });
  for (const i of plan.trafficLight.red.items)
    out.push({ color: "red", id: i.id, name: i.name, why: i.why });
  for (const i of plan.trafficLight.red.alsoAvoid)
    out.push({ color: "alsoAvoid", id: i.id, name: i.name });
  for (const i of plan.trafficLight.yellow.items)
    out.push({ color: "yellow", id: i.id, name: i.name, limit: i.limit });
  for (const g of plan.trafficLight.green.groups)
    for (const i of g.items)
      out.push({
        color: "green",
        id: i.id,
        name: i.name,
        group: { id: g.id, name: g.name, portion: g.portion },
        ...(i.keepsWithoutFridge ? { keepsWithoutFridge: true } : {}),
      });
  return out;
}

function removeFood(plan: DietPlan, id: string): void {
  plan.restrictions.foods = plan.restrictions.foods.filter((f) => f.id !== id);
  const tl = plan.trafficLight;
  tl.red.items = tl.red.items.filter((i) => i.id !== id);
  tl.red.alsoAvoid = tl.red.alsoAvoid.filter((i) => i.id !== id);
  tl.yellow.items = tl.yellow.items.filter((i) => i.id !== id);
  for (const g of tl.green.groups) g.items = g.items.filter((i) => i.id !== id);
  tl.green.groups = tl.green.groups.filter((g) => g.items.length > 0);
}

/** Pone el alimento en su lista. Solo restaura formas que un plan ya traía (con su porqué o su medida). */
function placeFood(plan: DietPlan, p: Place): boolean {
  const tl = plan.trafficLight;
  switch (p.color) {
    case "restricted":
      plan.restrictions.foods.push({ id: p.id, name: p.name });
      return true;
    case "alsoAvoid":
      tl.red.alsoAvoid.push({ id: p.id, name: p.name });
      return true;
    case "red":
      if (!p.why) return false;
      tl.red.items.push({ id: p.id, name: p.name, why: p.why });
      return true;
    case "yellow":
      if (!p.limit) return false;
      tl.yellow.items.push({ id: p.id, name: p.name, limit: p.limit });
      return true;
    case "green": {
      if (!p.group) return false;
      let g = tl.green.groups.find(
        (x) => x.id === p.group!.id || sameName(x.name, p.group!.name),
      );
      if (!g) {
        g = { ...p.group, items: [] };
        tl.green.groups.push(g);
      }
      g.items.push({
        id: p.id,
        name: p.name,
        ...(p.keepsWithoutFridge ? { keepsWithoutFridge: true } : {}),
      });
      return true;
    }
  }
}

const strongest = (list: Entry[]): Entry =>
  list.reduce((best, e) => (rank(e.color) > rank(best.color) ? e : best));

// ---------------------------------------------------------------------------
// La unión
// ---------------------------------------------------------------------------

export function reconcile(
  a: DietPlan,
  b: DietPlan,
  choices: Choices = {},
): Reconciled {
  const m = structuredClone(a) as DietPlan;
  const lines: Record<string, MergedLine> = {};
  const conflicts: Conflict[] = [];
  const pick = (k: string): Side => choices[k] ?? "a";

  const mark = (
    k: string,
    from: MergedLine["from"],
    rule: MergedLine["rule"],
    extra: Partial<MergedLine> = {},
  ) => {
    lines[key(k)] = { from, rule, ...extra };
  };

  /** Un choque sobre campos de un registro: el padre elige un lado; la otra cara queda en `alt`. */
  const clash = (
    k: string,
    kind: ConflictKind,
    label: LocalizedText,
    path: PathSeg[],
    rec: Obj,
    aVal: Record<string, unknown>,
    bVal: Record<string, unknown>,
    aSum: LocalizedText,
    bSum: LocalizedText,
  ) => {
    const side = pick(key(k));
    conflicts.push({ key: key(k), kind, label, a: aSum, b: bSum });
    if (side === "b") applyPatch(rec, bVal);
    mark(k, side, "picked", {
      a: aSum,
      b: bSum,
      alt: { t: "patch", path, patch: side === "a" ? bVal : aVal },
    });
  };

  // --- Cabecera -------------------------------------------------------------------------
  m.meta = {
    ...a.meta,
    id: `merged-${a.meta.id}-${b.meta.id}`.slice(0, 80),
    title: {
      es: `${a.meta.title.es} + ${b.meta.title.es}`,
      en: `${a.meta.title.en} + ${b.meta.title.en}`,
    },
    source: {
      es: `${a.meta.source.es} + ${b.meta.source.es}`,
      en: `${a.meta.source.en} + ${b.meta.source.en}`,
    },
    issuedAt:
      a.meta.issuedAt >= b.meta.issuedAt ? a.meta.issuedAt : b.meta.issuedAt,
  };
  delete m.pages; // las páginas del PDF eran de cada plan; ya no apuntan a nada

  // --- Restricción con vigencia: la ventana más ancha (la más estricta) ----------------
  const aFoods = a.restrictions.foods.length > 0;
  const bFoods = b.restrictions.foods.length > 0;
  if (!aFoods && bFoods) {
    m.restrictions = { ...b.restrictions, foods: [] };
  } else if (aFoods && bFoods) {
    const r = m.restrictions;
    const widened =
      a.restrictions.validFrom !== b.restrictions.validFrom ||
      a.restrictions.validUntil !== b.restrictions.validUntil;
    r.validFrom =
      a.restrictions.validFrom <= b.restrictions.validFrom
        ? a.restrictions.validFrom
        : b.restrictions.validFrom;
    r.validUntil =
      a.restrictions.validUntil >= b.restrictions.validUntil
        ? a.restrictions.validUntil
        : b.restrictions.validUntil;
    if (!sameText(a.restrictions.note, b.restrictions.note))
      r.note = {
        es: `${a.restrictions.note.es} · ${b.restrictions.note.es}`,
        en: `${a.restrictions.note.en} · ${b.restrictions.note.en}`,
      };
    if (widened)
      mark("restrictions", "both", "red", {
        a: both(`${a.restrictions.validFrom} → ${a.restrictions.validUntil}`),
        b: both(`${b.restrictions.validFrom} → ${b.restrictions.validUntil}`),
      });
    else mark("restrictions", "both", "same");
  }

  // --- Alimentos --------------------------------------------------------------------------
  const labelOf = (plan: DietPlan, c: Place["color"]): LocalizedText =>
    isRed(c)
      ? plan.trafficLight.red.label
      : c === "yellow"
        ? plan.trafficLight.yellow.label
        : plan.trafficLight.green.label;

  const aEntries = entriesOf(a);
  for (const e of aEntries) mark(`food:${e.id}`, "a", "only");

  for (const e of entriesOf(b)) {
    const hits = entriesOf(m).filter(
      (x) => x.id === e.id || sameName(x.name, e.name),
    );
    const k = (id: string) => `food:${id}`;
    if (hits.length === 0) {
      placeFood(m, e);
      mark(k(e.id), "b", "only");
      continue;
    }
    const top = strongest(hits);
    const id = top.id;
    const aLabel = labelOf(a, top.color);
    const bLabel = labelOf(b, e.color);

    if (isRed(e.color)) {
      if (isRed(top.color)) {
        // Los dos lo prohíben. Si lo prohíben en listas distintas, quedan las dos.
        if (!hits.some((x) => x.color === e.color)) placeFood(m, { ...e, id });
        else if (e.color === "red") {
          const mine = m.trafficLight.red.items.find((i) => i.id === id);
          if (mine && e.why && !sameText(mine.why, e.why))
            mine.why = {
              es: `${mine.why.es} · ${e.why.es}`,
              en: `${mine.why.en} · ${e.why.en}`,
            };
        }
        mark(k(id), "both", "same");
      } else {
        // A lo permitía (amarillo o verde) y B lo prohíbe: gana lo prohibido, y es B.
        const aPlace = hits.find((x) => x.color === top.color)!;
        for (const hid of new Set(hits.map((x) => x.id))) removeFood(m, hid);
        placeFood(m, { ...e, id });
        mark(k(id), "b", "red", {
          a: aLabel,
          b: bLabel,
          alt: { t: "place", place: aPlace },
        });
      }
      continue;
    }

    // B lo permite (amarillo o verde)
    if (isRed(top.color)) {
      // A lo prohíbe: gana A. La cara de B queda por si un padre quiere cambiarla.
      mark(k(id), "a", "red", {
        a: aLabel,
        b: bLabel,
        alt: { t: "place", place: { ...e, id } },
      });
      continue;
    }
    if (top.color === "yellow" && e.color === "yellow") {
      if (sameText(top.limit, e.limit)) mark(k(id), "both", "same");
      else {
        const rec = m.trafficLight.yellow.items.find((i) => i.id === id)!;
        clash(
          `${k(id)}:limit`,
          "limit",
          top.name,
          ["trafficLight", "yellow", "items", { k: "id", v: id }],
          rec as unknown as Obj,
          { limit: top.limit },
          { limit: e.limit },
          top.limit!,
          e.limit!,
        );
      }
      continue;
    }
    if (top.color === e.color) {
      // verde con verde
      mark(k(id), "both", "same");
      continue;
    }
    // amarillo contra verde: lo elige un padre
    const side = pick(key(k(id)));
    conflicts.push({
      key: key(k(id)),
      kind: "color",
      label: top.name,
      a: aLabel,
      b: bLabel,
    });
    const aPlace = hits.find((x) => x.color === top.color)!;
    const bPlace = { ...e, id };
    if (side === "b") {
      for (const hid of new Set(hits.map((x) => x.id))) removeFood(m, hid);
      placeFood(m, bPlace);
    }
    mark(k(id), side, "picked", {
      a: aLabel,
      b: bLabel,
      alt: { t: "place", place: side === "a" ? bPlace : aPlace },
    });
  }

  const idOf = (b: DietPlan, id: string): string => {
    const bFood = entriesOf(b).find((x) => x.id === id);
    if (!bFood) return id;
    const hit = entriesOf(m).find(
      (x) => x.id === id || sameName(x.name, bFood.name),
    );
    return hit?.id ?? id;
  };

  // --- Grupos verdes: porción ------------------------------------------------------------
  for (const gb of b.trafficLight.green.groups) {
    const ga = m.trafficLight.green.groups.find(
      (x) => x.id === gb.id || sameName(x.name, gb.name),
    );
    if (!ga) continue;
    if (sameText(ga.portion, gb.portion))
      mark(`group:${ga.id}`, "both", "same");
    else
      clash(
        `group:${ga.id}:portion`,
        "portion",
        ga.name,
        ["trafficLight", "green", "groups", { k: "id", v: ga.id }],
        ga as unknown as Obj,
        { portion: ga.portion },
        { portion: gb.portion },
        ga.portion,
        gb.portion,
      );
  }

  // --- Aditivos ----------------------------------------------------------------------------
  for (const ad of a.trafficLight.red.additives)
    mark(`additive:${ad.code}`, "a", "only");
  for (const ad of b.trafficLight.red.additives) {
    if (m.trafficLight.red.additives.some((x) => x.code === ad.code))
      mark(`additive:${ad.code}`, "both", "same");
    else {
      m.trafficLight.red.additives.push(ad);
      mark(`additive:${ad.code}`, "b", "only");
    }
  }

  // --- Equivalencias -----------------------------------------------------------------------
  for (const eq of m.equivalences)
    mark(`equivalence:${eq.whenMissing}:${eq.title.es}`, "a", "only");
  for (const eb of b.equivalences) {
    const wm = idOf(b, eb.whenMissing);
    const ek = `equivalence:${wm}:${eb.title.es}`;
    const ea = m.equivalences.find(
      (x) => x.whenMissing === wm && sameText(x.title, eb.title),
    );
    if (!ea) {
      m.equivalences.push({ ...eb, whenMissing: wm });
      mark(ek, "b", "only");
      continue;
    }
    mark(ek, "both", "same");
    if (!ea.note && eb.note) ea.note = eb.note;
    for (const ob of eb.use) {
      const oa = ea.use.find((x) => sameName(x.name, ob.name));
      if (!oa) {
        ea.use.push(ob);
        continue;
      }
      if (ob.keepsWithoutFridge) oa.keepsWithoutFridge = true;
      if (!oa.texture && ob.texture) oa.texture = ob.texture;
      else if (oa.texture && ob.texture && oa.texture !== ob.texture) {
        clash(
          `${ek}:texture:${oa.name.es}`,
          "texture",
          oa.name,
          [
            "equivalences",
            { k: "eq", v: `${wm}|${ea.title.es}` },
            "use",
            { k: "nameEs", v: oa.name.es },
          ],
          oa as unknown as Obj,
          { texture: oa.texture },
          { texture: ob.texture },
          both(oa.texture),
          both(ob.texture),
        );
      }
    }
  }

  // --- Suplementos: dosis y horario ------------------------------------------------------
  for (const s of m.supplements) mark(`supplement:${s.id}`, "a", "only");
  for (const sb of b.supplements) {
    const sa = m.supplements.find(
      (x) => x.id === sb.id || sameName(x.name, sb.name),
    );
    if (!sa) {
      m.supplements.push(sb);
      mark(`supplement:${sb.id}`, "b", "only");
      continue;
    }
    mark(`supplement:${sa.id}`, "both", "same");
    if (!sameText(sa.dose, sb.dose))
      clash(
        `supplement:${sa.id}:dose`,
        "dose",
        sa.name,
        ["supplements", { k: "id", v: sa.id }],
        sa as unknown as Obj,
        { dose: sa.dose },
        { dose: sb.dose },
        sa.dose,
        sb.dose,
      );
    const days = (x: string[]) => [...x].sort().join(",");
    if (!sameText(sa.when, sb.when) || days(sa.days) !== days(sb.days))
      clash(
        `supplement:${sa.id}:schedule`,
        "schedule",
        sa.name,
        ["supplements", { k: "id", v: sa.id }],
        sa as unknown as Obj,
        { when: sa.when, days: sa.days },
        { when: sb.when, days: sb.days },
        {
          es: `${sa.when.es} (${sa.days.join(", ")})`,
          en: `${sa.when.en} (${sa.days.join(", ")})`,
        },
        {
          es: `${sb.when.es} (${sb.days.join(", ")})`,
          en: `${sb.when.en} (${sb.days.join(", ")})`,
        },
      );
  }
  if (!m.supplementNotes && b.supplementNotes)
    m.supplementNotes = b.supplementNotes;

  // --- Comidas: horario y contenido -----------------------------------------------------
  for (const ml of m.dailyMenu) mark(`meal:${ml.id}`, "a", "only");
  for (const mb of b.dailyMenu) {
    const ma = m.dailyMenu.find(
      (x) => x.id === mb.id || sameName(x.name, mb.name),
    );
    if (!ma) {
      m.dailyMenu.push(mb);
      mark(`meal:${mb.id}`, "b", "only");
      continue;
    }
    mark(`meal:${ma.id}`, "both", "same");
    if (ma.start !== mb.start || ma.end !== mb.end)
      clash(
        `meal:${ma.id}:schedule`,
        "schedule",
        ma.name,
        ["dailyMenu", { k: "id", v: ma.id }],
        ma as unknown as Obj,
        { start: ma.start, end: ma.end },
        { start: mb.start, end: mb.end },
        both(`${ma.start}–${ma.end}`),
        both(`${mb.start}–${mb.end}`),
      );
    if (!sameText(ma.content, mb.content))
      clash(
        `meal:${ma.id}:content`,
        "content",
        ma.name,
        ["dailyMenu", { k: "id", v: ma.id }],
        ma as unknown as Obj,
        { content: ma.content },
        { content: mb.content },
        ma.content,
        mb.content,
      );
  }

  // --- Perfil: alergias e intolerancias se SUMAN; medicamento y condición, si chocan, se eligen
  if (a.profile || b.profile) {
    m.profile ??= {};
    const pm = m.profile;
    const union = (
      kind: "allergy" | "intolerance",
      list: "allergies" | "intolerances",
    ) => {
      const mine = pm[list] ?? [];
      for (const x of a.profile?.[list] ?? [])
        mark(`${kind}:${x.id}`, "a", "only");
      for (const x of b.profile?.[list] ?? []) {
        if (mine.some((y) => y.id === x.id || sameName(y.name, x.name)))
          mark(`${kind}:${x.id}`, "both", "same");
        else {
          mine.push(x);
          mark(`${kind}:${x.id}`, "b", "only");
        }
      }
      if (mine.length > 0) pm[list] = mine;
    };
    union("allergy", "allergies");
    union("intolerance", "intolerances");

    const meds = pm.medications ?? [];
    for (const x of a.profile?.medications ?? [])
      mark(`medication:${x.id}`, "a", "only");
    for (const x of b.profile?.medications ?? []) {
      const mine = meds.find((y) => y.id === x.id || sameName(y.name, x.name));
      if (!mine) {
        meds.push(x);
        mark(`medication:${x.id}`, "b", "only");
        continue;
      }
      mark(`medication:${mine.id}`, "both", "same");
      const aMed =
        a.profile?.medications?.find(
          (y) => y.id === mine.id || sameName(y.name, mine.name),
        ) ?? mine;
      if (!mine.dose && x.dose) mine.dose = x.dose;
      if (!mine.when && x.when) mine.when = x.when;
      const diff =
        (aMed.dose && x.dose && !sameText(aMed.dose, x.dose)) ||
        (aMed.when && x.when && !sameText(aMed.when, x.when));
      if (diff) {
        const sum = (y: typeof x): LocalizedText => ({
          es: [y.dose?.es, y.when?.es].filter(Boolean).join(" · "),
          en: [y.dose?.en, y.when?.en].filter(Boolean).join(" · "),
        });
        clash(
          `medication:${mine.id}:dose`,
          "dose",
          mine.name,
          ["profile", "medications", { k: "id", v: mine.id }],
          mine as unknown as Obj,
          { dose: aMed.dose ?? null, when: aMed.when ?? null },
          { dose: x.dose ?? null, when: x.when ?? null },
          sum(aMed),
          sum(x),
        );
      }
    }
    if (meds.length > 0) pm.medications = meds;

    if (!pm.condition && b.profile?.condition)
      pm.condition = b.profile.condition;
    else if (
      a.profile?.condition &&
      b.profile?.condition &&
      !sameText(a.profile.condition, b.profile.condition)
    )
      clash(
        "condition",
        "text",
        a.profile.condition,
        ["profile"],
        pm as unknown as Obj,
        { condition: a.profile.condition },
        { condition: b.profile.condition },
        a.profile.condition,
        b.profile.condition,
      );
    if (!pm.allergies && !pm.intolerances && !pm.medications && !pm.condition)
      delete m.profile;
  }

  // --- Hidratación y objetivos ----------------------------------------------------------
  const h = (x: DietPlan["hydration"]) =>
    `${x.targetLitersMin}-${x.targetLitersMax}-${x.glassesPerDay ?? ""}`;
  if (h(a.hydration) !== h(b.hydration))
    clash(
      "hydration",
      "hydration",
      both("hydration"),
      ["hydration"],
      m.hydration as unknown as Obj,
      {
        targetLitersMin: a.hydration.targetLitersMin,
        targetLitersMax: a.hydration.targetLitersMax,
        glassesPerDay: a.hydration.glassesPerDay ?? null,
        habit: a.hydration.habit,
      },
      {
        targetLitersMin: b.hydration.targetLitersMin,
        targetLitersMax: b.hydration.targetLitersMax,
        glassesPerDay: b.hydration.glassesPerDay ?? null,
        habit: b.hydration.habit,
      },
      both(`${a.hydration.targetLitersMin}–${a.hydration.targetLitersMax} L`),
      both(`${b.hydration.targetLitersMin}–${b.hydration.targetLitersMax} L`),
    );
  else mark("hydration", "both", "same");

  if (a.goals || b.goals) {
    m.goals ??= {};
    for (const g of ["activity", "sleep"] as const) {
      const ta = a.goals?.[g];
      const tb = b.goals?.[g];
      if (!ta && tb) m.goals[g] = tb;
      else if (ta && tb && !sameText(ta, tb))
        clash(
          `goal:${g}`,
          "text",
          both(g),
          ["goals"],
          m.goals as unknown as Obj,
          { [g]: ta },
          { [g]: tb },
          ta,
          tb,
        );
    }
    if (!m.goals.activity && !m.goals.sleep) delete m.goals;
  }

  // --- El registro del plan unido -------------------------------------------------------
  const ref = (p: DietPlan) => ({
    id: p.meta.id,
    title: p.meta.title,
    source: p.meta.source,
  });
  m.merged = { from: [ref(a), ref(b)], lines };

  const valid = dietPlanSchema.safeParse(m).success;
  return {
    plan: m,
    conflicts,
    pending: conflicts.filter((c) => !choices[c.key]).map((c) => c.key),
    valid,
  };
}

// ---------------------------------------------------------------------------
// Cambiar una línea después (solo un padre; la firma lo hace cumplir)
// ---------------------------------------------------------------------------

/** Las líneas con dos orígenes distintos: lo que un padre puede cambiar. */
export function switchableLines(plan: DietPlan): string[] {
  return Object.entries(plan.merged?.lines ?? {})
    .filter(([, l]) => l.alt)
    .map(([k]) => k);
}

/**
 * Cambia una línea al otro origen y deja el actual como `alt`: se puede volver. `null` si la
 * línea no tiene otra cara o el resultado no pasa el schema (no se toca nada).
 */
export function switchLine(
  plan: DietPlan,
  lineKey: string,
  at: number,
): DietPlan | null {
  const line = plan.merged?.lines[lineKey];
  if (!plan.merged || !line?.alt) return null;
  const next = structuredClone(plan) as DietPlan;
  let alt: MergedAlt;
  if (line.alt.t === "place") {
    const place = line.alt.place;
    const here = entriesOf(next).filter((x) => x.id === place.id);
    if (here.length === 0) return null;
    const current = strongest(here);
    removeFood(next, place.id);
    if (!placeFood(next, place)) return null;
    alt = { t: "place", place: current };
  } else {
    const rec = locate(next, line.alt.path);
    if (!rec) return null;
    const before = readPatch(rec, Object.keys(line.alt.patch));
    applyPatch(rec, line.alt.patch);
    alt = { t: "patch", path: line.alt.path, patch: before };
  }
  const from: MergedLine["from"] =
    line.from === "a" ? "b" : line.from === "b" ? "a" : "both";
  next.merged!.lines[lineKey] = { ...line, from, rule: "parent", alt };
  next.merged!.last = { key: lineKey, t: at };
  return dietPlanSchema.safeParse(next).success ? next : null;
}

/** ¿Cambiar esta línea relaja algo que hoy está prohibido? (pide confirmar con los dos orígenes a la vista). */
export function relaxesRed(plan: DietPlan, lineKey: string): boolean {
  const alt = plan.merged?.lines[lineKey]?.alt;
  if (alt?.t !== "place" || isRed(alt.place.color)) return false;
  const here = entriesOf(plan).filter((x) => x.id === alt.place.id);
  return here.length > 0 && isRed(strongest(here).color);
}

/** El nombre que la pantalla muestra para una línea del plan unido (null si la línea es un bloque, como la hidratación). */
export function lineLabel(
  plan: DietPlan,
  lineKey: string,
): LocalizedText | null {
  const [kind, id, rest] = lineKey.split(":");
  switch (kind) {
    case "food":
      return entriesOf(plan).find((x) => x.id === id)?.name ?? null;
    case "supplement":
      return plan.supplements.find((x) => x.id === id)?.name ?? null;
    case "meal":
      return plan.dailyMenu.find((x) => x.id === id)?.name ?? null;
    case "allergy":
      return plan.profile?.allergies?.find((x) => x.id === id)?.name ?? null;
    case "intolerance":
      return plan.profile?.intolerances?.find((x) => x.id === id)?.name ?? null;
    case "medication":
      return plan.profile?.medications?.find((x) => x.id === id)?.name ?? null;
    case "additive":
      return (
        plan.trafficLight.red.additives.find((x) => x.code === id)?.name ?? null
      );
    case "group":
      return (
        plan.trafficLight.green.groups.find((x) => x.id === id)?.name ?? null
      );
    case "equivalence":
      return (
        plan.equivalences.find(
          (x) => x.whenMissing === id && x.title.es === rest,
        )?.title ?? null
      );
    default:
      return null;
  }
}
