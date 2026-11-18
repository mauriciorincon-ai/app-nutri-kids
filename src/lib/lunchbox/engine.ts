/**
 * La lonchera (S11 · ADR-017) — código primero, sin IA. Arma las opciones SOLO con lo que el
 * plan cargado ya dice: alimentos verdes y amarillos (o una opción de sus equivalencias) que
 * aguantan sin nevera, porque el plan lo marca o porque quien cuida lo marcó (S9). Nunca
 * propone un rojo, una restricción vigente, una alergia o intolerancia, una textura que hoy no
 * acepta ni algo que rechazó la última vez (S10). No escribe texto libre: cada nombre sale del
 * plan. Puro: la fecha y todo lo anotado entran por parámetro; no lee storage ni red.
 */
import { resolveItemStatus } from "@/lib/diet/logic";
import { avoidedByNotes, avoidTexts, isSafeOption } from "@/lib/diet/options";
import { fridgeKey, fridgeKeyText } from "@/lib/diet/plan-b";
import type { DietPlan, LocalizedText, Texture } from "@/lib/diet/schema";
import { orderByTexture } from "@/lib/diet/texture";
import type { DayWellbeing } from "@/lib/diet/day-log";
import { foodIdsAnnotated, summarizeFood } from "@/lib/wellbeing/acceptance";
import { LUNCH_KEY_MAX } from "@/lib/wellbeing/values";

export type LunchItem = {
  /** La clave con la que se anota en la lonchera del día (id del plan, u `opt:<nombre>`). */
  key: string;
  name: LocalizedText;
  color: "green" | "yellow";
  /** plan = el plan lo marca · adult = lo marcó quien cuida. */
  by: "plan" | "adult";
  texture?: Texture;
  /** Solo amarillo: la medida tal como la escribió el plan. */
  limit?: LocalizedText;
  /** El grupo del plan o la equivalencia de donde sale. */
  from: LocalizedText | null;
};

export type LunchHeld = {
  /** La misma clave que tendría en la lonchera (para no perder su nombre en lo ya empacado). */
  key: string;
  name: LocalizedText;
  /** texture = hoy no acepta esa textura · refused = lo rechazó la última vez. */
  reason: "texture" | "refused";
};

export type LunchOptions =
  | { kind: "options"; items: LunchItem[]; held: LunchHeld[] }
  /** El plan no marca nada que aguante sin nevera y nadie lo marcó: se dice, no se inventa. */
  | { kind: "no-marks"; held: LunchHeld[] };

export type LunchInput = {
  diet: DietPlan;
  now: Date;
  /** Lo anotado por quien cuida (`profile-notes`): marcas de nevera, alergias, intolerancias. */
  notes: readonly { kind: string; text: string }[];
  /** Texturas que hoy acepta (vacío = no se ha marcado ninguna). */
  accepted?: readonly Texture[];
  /** Ids de alimento que rechazó la última vez (S10). */
  refused?: ReadonlySet<string>;
};

/** Alergias e intolerancias: las del plan (en los dos idiomas) y las que anotó quien cuida. */
export function avoidList(
  diet: DietPlan,
  notes: readonly { kind: string; text: string }[],
): string[] {
  const out = [...avoidTexts(notes)];
  for (const a of [
    ...(diet.profile?.allergies ?? []),
    ...(diet.profile?.intolerances ?? []),
  ])
    out.push(a.name.es, a.name.en);
  return out;
}

/** Los alimentos cuyo último veredicto fue «lo rechazó» (para dejarlos fuera de la lonchera). */
export function refusedFoodIds(
  days: { day: string; wellbeing: DayWellbeing }[],
): Set<string> {
  const out = new Set<string>();
  for (const id of foodIdsAnnotated(days))
    if (summarizeFood(days, id).lastVerdict === "refuses") out.add(id);
  return out;
}

/** La clave de una opción de equivalencia (no tiene id en el plan). */
export const optionKey = (name: LocalizedText): string =>
  `opt:${fridgeKey(name)}`.slice(0, LUNCH_KEY_MAX);

type Raw = Omit<LunchItem, "by"> & { plan: boolean };

export function lunchOptions(input: LunchInput): LunchOptions {
  const { diet, now, notes } = input;
  const accepted = input.accepted ?? [];
  const refused = input.refused ?? new Set<string>();
  const avoid = avoidList(diet, notes);
  const adult = new Set(
    notes.filter((n) => n.kind === "fridge").map((n) => fridgeKeyText(n.text)),
  );

  // Cada alimento una sola vez (por nombre): si el plan lo nombra en dos sitios, vale la marca
  // de cualquiera de los dos y la textura que alguno diga.
  const seen = new Map<string, Raw>();
  const order: string[] = [];
  const add = (raw: Raw) => {
    const k = fridgeKey(raw.name);
    const prior = seen.get(k);
    if (prior) {
      prior.plan ||= raw.plan;
      prior.texture ??= raw.texture;
      return;
    }
    seen.set(k, raw);
    order.push(k);
  };

  for (const g of diet.trafficLight.green.groups)
    for (const i of g.items) {
      if (resolveItemStatus(diet, i.id, now)?.kind !== "green") continue;
      if (!isSafeOption(diet, i.name, now, avoid)) continue;
      add({
        key: i.id.slice(0, LUNCH_KEY_MAX),
        name: i.name,
        color: "green",
        plan: i.keepsWithoutFridge === true,
        from: g.name,
      });
    }
  for (const y of diet.trafficLight.yellow.items) {
    if (resolveItemStatus(diet, y.id, now)?.kind !== "yellow") continue;
    if (avoidedByNotes(y.name, avoid)) continue;
    add({
      key: y.id.slice(0, LUNCH_KEY_MAX),
      name: y.name,
      color: "yellow",
      plan: false,
      limit: y.limit,
      from: null,
    });
  }
  for (const eq of diet.equivalences)
    for (const u of eq.use) {
      if (!isSafeOption(diet, u.name, now, avoid)) continue;
      add({
        key: optionKey(u.name),
        name: u.name,
        color: "green",
        plan: u.keepsWithoutFridge === true,
        texture: u.texture,
        from: eq.title,
      });
    }

  const marked: LunchItem[] = [];
  for (const k of order) {
    const r = seen.get(k)!;
    const by: LunchItem["by"] | null = r.plan
      ? "plan"
      : adult.has(k)
        ? "adult"
        : null;
    if (by) {
      const { plan, ...rest } = r;
      void plan;
      marked.push({ ...rest, by });
    }
  }

  const held: LunchHeld[] = [];
  const kept = marked.filter((i) => {
    if (refused.has(i.key)) {
      held.push({ key: i.key, name: i.name, reason: "refused" });
      return false;
    }
    return true;
  });
  const ordered = orderByTexture(kept, accepted);
  const items = ordered
    .filter((o) => {
      if (o.notAccepted) {
        held.push({ key: o.key, name: o.name, reason: "texture" });
        return false;
      }
      return true;
    })
    .map(({ notAccepted, ...item }) => {
      void notAccepted;
      return item as LunchItem;
    });

  // «Sin marcas» solo si NADA aguanta sin nevera; si hay pero hoy ninguna encaja (textura, lo que
  // rechazó), las opciones quedan vacías y `held` dice por qué: no es lo mismo y la pantalla lo dice.
  return marked.length === 0
    ? { kind: "no-marks", held }
    : { kind: "options", items, held };
}
