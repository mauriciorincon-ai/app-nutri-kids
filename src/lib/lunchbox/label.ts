/**
 * El texto de la etiqueta de la lonchera (S11 · ADR-017): lo que lleva el QR y lo que se imprime.
 * Texto plano en los dos idiomas — alergias, intolerancias y qué lleva hoy —; el nombre del niño
 * solo si un padre lo escribió. NUNCA un enlace (regla «cero enlaces»): cualquier texto que parezca
 * una dirección se quita. Puro.
 */
import { dateKey } from "@/lib/diet/logic";
import type { DietPlan, LocalizedText } from "@/lib/diet/schema";

import { QR_MAX_BYTES } from "./qr";
import type { LunchItem } from "./engine";

const URLISH = /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S*/gi;

/** Texto sin nada que parezca un enlace, sin saltos de línea y de largo acotado. */
export function plain(text: string, max = 60): string {
  return text
    .replace(URLISH, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

const both = (t: LocalizedText): string => {
  const es = plain(t.es);
  const en = plain(t.en);
  return es.toLowerCase() === en.toLowerCase() ? es : `${es} / ${en}`;
};

const bytes = (s: string) => new TextEncoder().encode(s).length;

export type LabelInput = {
  diet: DietPlan;
  now: Date;
  notes: readonly { kind: string; text: string }[];
  /** Lo que lleva hoy (la lonchera del día). */
  items: readonly Pick<LunchItem, "name">[];
  /** Lo escribió un padre; null si no hay (entonces no sale ningún nombre). */
  childName: string | null;
};

export type Label = {
  /** Las líneas que se imprimen. */
  lines: string[];
  /** Lo mismo, unido: es lo que codifica el QR. */
  text: string;
  /** true si no cupo todo en el QR y se acortó la lista de hoy. */
  cut: boolean;
};

function noted(
  notes: readonly { kind: string; text: string }[],
  kind: "allergy" | "intolerance",
): LocalizedText[] {
  return notes
    .filter((n) => n.kind === kind)
    .map((n) => ({ es: n.text, en: n.text }));
}

export function buildLabel(input: LabelInput): Label {
  const { diet, now, notes, items, childName } = input;
  const dedupe = (list: string[]) => [...new Set(list.filter(Boolean))];
  const allergies = dedupe(
    [...(diet.profile?.allergies ?? []).map((a) => a.name), ...noted(notes, "allergy")].map(both),
  );
  const intolerances = dedupe(
    [...(diet.profile?.intolerances ?? []).map((a) => a.name), ...noted(notes, "intolerance")].map(both),
  );
  const name = childName ? plain(childName, 40) : "";
  const today = items.map((i) => both(i.name));

  const build = (food: string[], cutMark: boolean): string[] => {
    const lines = [`NUTRIKIDS · LONCHERA / LUNCHBOX · ${dateKey(now)}`];
    if (name) lines.push(name);
    if (allergies.length)
      lines.push(`ALERGIAS / ALLERGIES: ${allergies.join("; ")}`);
    if (intolerances.length)
      lines.push(`INTOLERANCIAS / INTOLERANCES: ${intolerances.join("; ")}`);
    lines.push(
      `LLEVA HOY / TODAY: ${food.length ? food.join("; ") : "—"}${cutMark ? "; …" : ""}`,
    );
    return lines;
  };

  let food = [...today];
  let lines = build(food, false);
  let cut = false;
  // Si no cabe, se acorta lo de hoy (de atrás hacia adelante): las alergias nunca se sueltan.
  while (bytes(lines.join("\n")) > QR_MAX_BYTES && food.length > 0) {
    food = food.slice(0, -1);
    cut = true;
    lines = build(food, true);
  }
  return { lines, text: lines.join("\n"), cut };
}
