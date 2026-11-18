/**
 * Plan B — código primero (ADR-014, regla dura 5). Cuando algo falla («se acabó X»,
 * «no hay nevera», «llegamos tarde»), propone SOLO lo que el plan cargado ya dice:
 * una equivalencia (`whenMissing`), otra opción verde del mismo grupo, la franja de
 * comida o una opción marcada «aguanta sin nevera». Si el plan no lo dice, devuelve
 * `not-in-plan`: jamás se inventa un alimento ni se da una indicación médica.
 *
 * Puro: la hora y las marcas entran por parámetro; no lee storage ni red.
 */
import { currentMealSlot, resolveItemStatus } from "./logic";
import {
  avoidedByNotes,
  isSafeOption,
  planOptionsFor,
  type Options,
} from "./options";
import { normalizeText } from "./search";
import type { DietPlan, LocalizedText, Meal, Texture } from "./schema";
import { orderByTexture, type OrderedOption } from "./texture";

export type Situation = "out" | "no-fridge" | "late";
export const SITUATIONS: readonly Situation[] = ["out", "no-fridge", "late"];

/** De dónde sale una opción que aguanta sin nevera. */
export type FridgeOrigin =
  | { kind: "equivalence"; title: LocalizedText }
  | { kind: "group"; group: LocalizedText };

export type FridgeOption = OrderedOption & {
  /** plan = el plan lo dice · adult = lo marcó quien cuida en el teléfono. */
  marked: "plan" | "adult";
  origin: FridgeOrigin;
};

export type PlanB =
  | {
      situation: "out";
      kind: "options";
      food: LocalizedText;
      options: Options;
    }
  | { situation: "no-fridge"; kind: "options"; items: FridgeOption[] }
  | {
      situation: "late";
      kind: "late";
      /** La franja que corre ahora (null si estamos entre dos o fuera del día). */
      current: Meal | null;
      /** La última que ya pasó. */
      prev: Meal | null;
      next: Meal | null;
    }
  | {
      situation: Situation;
      kind: "not-in-plan";
      /** unknown-food: el alimento no está en el plan · no-options: sin reemplazo en el plan · no-marks: el plan no marca nada que aguante sin nevera · no-menu: el plan no trae menú. */
      reason: "unknown-food" | "no-options" | "no-marks" | "no-menu";
      food?: LocalizedText;
    };

/**
 * La clave con la que se marca una opción: su nombre en español, sin mayúsculas, tildes,
 * signos ni espacios de más. Quien marca y quien lee usan ESTA misma función, así que una
 * marca escrita a mano («Pera », «PERA») sigue casando con la opción.
 */
export function fridgeKeyText(text: string): string {
  return normalizeText(text, "es");
}
export function fridgeKey(name: LocalizedText): string {
  return fridgeKeyText(name.es);
}

/** Las marcas «aguanta sin nevera» de las anotaciones de quien cuida, ya como clave. */
export function fridgeMarks(
  notes: readonly { kind: string; text: string }[],
): string[] {
  return notes
    .filter((n) => n.kind === "fridge")
    .map((n) => fridgeKeyText(n.text));
}

type Candidate = {
  name: LocalizedText;
  texture?: Texture;
  keepsWithoutFridge?: boolean;
  origin: FridgeOrigin;
};

/** Toda opción segura del plan (equivalencias y verdes), sin repetir nombres. */
function safeCandidates(
  diet: DietPlan,
  now: Date,
  avoid: readonly string[] = [],
): Candidate[] {
  const seen = new Map<string, Candidate>();
  const out: Candidate[] = [];
  const push = (c: Candidate) => {
    const key = fridgeKey(c.name);
    const prior = seen.get(key);
    if (prior) {
      // El mismo alimento nombrado dos veces (una equivalencia y su grupo): si cualquiera de las
      // dos lo marca «aguanta sin nevera», la marca no se pierde por llegar segunda.
      if (c.keepsWithoutFridge && !prior.keepsWithoutFridge)
        prior.keepsWithoutFridge = true;
      return;
    }
    if (!isSafeOption(diet, c.name, now, avoid)) return;
    seen.set(key, c);
    out.push(c);
  };
  for (const eq of diet.equivalences)
    for (const u of eq.use)
      push({ ...u, origin: { kind: "equivalence", title: eq.title } });
  for (const g of diet.trafficLight.green.groups)
    for (const i of g.items)
      if (resolveItemStatus(diet, i.id, now)?.kind === "green")
        push({
          name: i.name,
          keepsWithoutFridge: i.keepsWithoutFridge,
          origin: { kind: "group", group: g.name },
        });
  return out;
}

/**
 * Lo que quien cuida puede marcar «aguanta sin nevera»: toda opción segura del plan, con
 * quién la marcó (el plan, un adulto, nadie).
 */
export function fridgeCandidates(
  diet: DietPlan,
  now: Date,
  marks: readonly string[],
  avoid: readonly string[] = [],
): { name: LocalizedText; marked: "plan" | "adult" | null }[] {
  const adult = new Set(marks.map(fridgeKeyText));
  const out = safeCandidates(diet, now, avoid).map((c) => ({
    name: c.name,
    marked: (c.keepsWithoutFridge
      ? "plan"
      : adult.has(fridgeKey(c.name))
        ? "adult"
        : null) as "plan" | "adult" | null,
  }));
  // Los amarillos (con su medida) también se pueden marcar: solo la lonchera (S11) los usa; el plan B
  // «no hay nevera» sigue ofreciendo únicamente verdes y opciones de equivalencia.
  for (const y of diet.trafficLight.yellow.items) {
    if (resolveItemStatus(diet, y.id, now)?.kind !== "yellow") continue;
    if (avoidedByNotes(y.name, avoid)) continue;
    out.push({
      name: y.name,
      marked: adult.has(fridgeKey(y.name)) ? "adult" : null,
    });
  }
  return out;
}

/** «Se acabó X»: los reemplazos del plan para X, o `not-in-plan`. */
export function planBOut(
  diet: DietPlan,
  itemId: string,
  now: Date,
  accepted: readonly Texture[] = [],
  avoid: readonly string[] = [],
): PlanB {
  const status = resolveItemStatus(diet, itemId, now);
  if (!status)
    return { situation: "out", kind: "not-in-plan", reason: "unknown-food" };
  const options = planOptionsFor(status, diet, now, accepted, avoid);
  if (!options)
    return {
      situation: "out",
      kind: "not-in-plan",
      reason: "no-options",
      food: status.name,
    };
  return { situation: "out", kind: "options", food: status.name, options };
}

/** «No hay nevera»: solo las opciones que el plan o un adulto marcó como «aguanta sin nevera». */
export function planBNoFridge(
  diet: DietPlan,
  now: Date,
  marks: readonly string[] = [],
  accepted: readonly Texture[] = [],
  avoid: readonly string[] = [],
): PlanB {
  const adult = new Set(marks.map(fridgeKeyText));
  const marked = safeCandidates(diet, now, avoid).flatMap<{
    c: Candidate;
    by: "plan" | "adult";
  }>((c) =>
    c.keepsWithoutFridge
      ? [{ c, by: "plan" }]
      : adult.has(fridgeKey(c.name))
        ? [{ c, by: "adult" }]
        : [],
  );
  if (marked.length === 0)
    return { situation: "no-fridge", kind: "not-in-plan", reason: "no-marks" };
  const ordered = orderByTexture(
    marked.map(({ c }) => ({ name: c.name, texture: c.texture })),
    accepted,
  );
  // orderByTexture reordena: se vuelve a casar cada opción con su marca y su origen por nombre.
  const byName = new Map(
    marked.map(({ c, by }) => [fridgeKey(c.name), { c, by }]),
  );
  return {
    situation: "no-fridge",
    kind: "options",
    items: ordered.map((o) => {
      const hit = byName.get(fridgeKey(o.name))!;
      return { ...o, marked: hit.by, origin: hit.c.origin };
    }),
  };
}

/** «Llegamos tarde»: la franja que toca y la que sigue, tal como las escribió el plan. */
export function planBLate(diet: DietPlan, now: Date): PlanB {
  const slot = currentMealSlot(diet, now);
  if (!slot)
    return { situation: "late", kind: "not-in-plan", reason: "no-menu" };
  switch (slot.kind) {
    case "during":
      return {
        situation: "late",
        kind: "late",
        current: slot.meal,
        prev: null,
        next: slot.next,
      };
    case "between":
      return {
        situation: "late",
        kind: "late",
        current: null,
        prev: slot.prev,
        next: slot.next,
      };
    case "before-first":
      return {
        situation: "late",
        kind: "late",
        current: null,
        prev: null,
        next: slot.next,
      };
    case "after-last":
      return {
        situation: "late",
        kind: "late",
        current: null,
        prev: slot.prev,
        next: null,
      };
  }
}

/** La puerta única del plan B para «no hay nevera» y «llegamos tarde» (el «se acabó» pide el alimento). */
export function planB(
  situation: Exclude<Situation, "out">,
  diet: DietPlan,
  now: Date,
  ctx: {
    marks?: readonly string[];
    accepted?: readonly Texture[];
    avoid?: readonly string[];
  } = {},
): PlanB {
  return situation === "no-fridge"
    ? planBNoFridge(
        diet,
        now,
        ctx.marks ?? [],
        ctx.accepted ?? [],
        ctx.avoid ?? [],
      )
    : planBLate(diet, now);
}
