/**
 * El cotejo de una etiqueta con el plan cargado (S13 · ADR-019). Código primero: el lector solo
 * devuelve TEXTO; aquí se busca, con los datos del plan y nada más, lo que choca:
 *  - los aditivos rojos del plan, por código en cualquiera de sus formas, por su nombre en el plan y
 *    por su nombre público (`additive-aliases`), y su clase cuando el plan evita «colorantes
 *    artificiales» o «endulzantes artificiales»;
 *  - los rojos, las restricciones vigentes y los amarillos del plan, por su nombre (es/en);
 *  - las alergias y las intolerancias del plan y las que anotó quien cuida, con sus familias.
 * Lo que va tras «puede contener» son TRAZAS: una alergia en trazas también es «no va»; una
 * intolerancia o un alimento del plan solo en trazas es «revisa».
 * Un texto mal leído JAMÁS da «no vi nada que choque»: da «no pude leerla». Puro: sin storage ni red.
 * Lo mismo sirve para la foto y para un producto del catálogo (S13 · F2).
 */
import { expandAvoid } from "@/lib/diet/allergen-families";
import { allItemIds, resolveItemStatus } from "@/lib/diet/logic";
import type { DietPlan, LocalizedText } from "@/lib/diet/schema";
import { ALTERNATIVES, containsPhrase, toTokens } from "@/lib/diet/search";

import { ADDITIVE_ALIASES, CLASS_PHRASES } from "./additive-aliases";
import {
  findCodes,
  foldText,
  guessCodes,
  splitSections,
  textQuality,
  type Quality,
} from "./normalize";

export type Where = "ingredients" | "traces";

export type LabelHit =
  /** Un aditivo rojo del plan: `seen` es como venía escrito (código o nombre). */
  | {
      kind: "additive";
      where: Where;
      code: string;
      name: LocalizedText;
      seen: string;
    }
  | { kind: "red"; where: Where; id: string; name: LocalizedText }
  /** Restricción del plan: `active` es si rige hoy; vencida, la reintroducción la guía el profesional. */
  | {
      kind: "restricted";
      where: Where;
      id: string;
      name: LocalizedText;
      active: boolean;
    }
  | {
      kind: "yellow";
      where: Where;
      id: string;
      name: LocalizedText;
      limit: LocalizedText;
    }
  /** Una alergia o intolerancia: `name` es como la nombra el plan o como la anotó quien cuida. */
  | { kind: "allergy" | "intolerance"; where: Where; name: LocalizedText }
  /**
   * Algo que se PARECE a lo que el plan evita (una letra mal leída: «camar6n», «E9S9»): no es un
   * «no va», pero tampoco se calla. `seen` es lo que se leyó y `name` lo que el plan nombra.
   */
  | { kind: "similar"; where: Where; name: LocalizedText; seen: string };

export type Verdict =
  /** «No va»: algo del plan lo descarta. */
  | "no"
  /** «Revisa»: lleva algo con límite, o una intolerancia solo en trazas. */
  | "check"
  /** «No pude leerla»: el texto no se leyó bien (o, del catálogo, no trae ingredientes). */
  | "unreadable"
  /** «No vi nada que choque»: SOLO con un texto bien leído. */
  | "ok";

export type LabelCheck = {
  verdict: Verdict;
  hits: LabelHit[];
  quality: Quality;
  /** Hay un «no va» o un «revisa», pero el resto del texto no se leyó bien: se dice. */
  partial: boolean;
  /** Los aditivos que se vieron con su número (estén o no en el plan): se muestran, no deciden. */
  codes: string[];
};

export type LabelInput = {
  /** Lo que el lector leyó, o el texto de ingredientes del catálogo. */
  text: string;
  /** Confianza media del lector (0–100). El catálogo no la trae. */
  confidence?: number;
  diet: DietPlan;
  now: Date;
  /** Lo anotado por quien cuida (`profile-notes`): cuentan las alergias y las intolerancias. */
  notes?: readonly { kind: string; text: string }[];
  /**
   * Lo que el catálogo declara aparte del texto (S13 · F2): aditivos por código, alérgenos y trazas
   * en palabras. Suman, jamás restan: una declaración vacía no vuelve apto un texto.
   */
  declared?: { codes?: string[]; contains?: string[]; traces?: string[] };
};

type Hay = { tokens: string[]; where: Where };

const tokens = (text: string) => toTokens(text, "es");

/** ¿Alguna forma del nombre (completo o una de sus alternativas, en es o en) aparece en el texto? */
function namedIn(hay: string[], name: LocalizedText): boolean {
  for (const locale of ["es", "en"] as const) {
    const whole = toTokens(name[locale], locale);
    if (whole.length && containsPhrase(hay, whole)) return true;
    for (const part of name[locale].split(ALTERNATIVES)) {
      const p = toTokens(part, locale);
      if (p.length && p.length !== whole.length && containsPhrase(hay, p))
        return true;
    }
  }
  return false;
}

/** ¿Se distinguen `a` y `b` por una sola letra (cambiada, puesta, quitada o dos juntas cambiadas)? */
export function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  const d = a.length - b.length;
  if (d > 1 || d < -1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (d === 0) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // una letra cambiada
    return (
      a[i] === b[i + 1] &&
      a[i + 1] === b[i] &&
      a.slice(i + 2) === b.slice(i + 2)
    ); // dos juntas
  }
  return d === 1
    ? a.slice(i + 1) === b.slice(i)
    : b.slice(i + 1) === a.slice(i);
}

/** Palabras de un nombre que el cotejo vigila de forma aproximada: de 6 letras o más, solas. */
const MIN_FUZZY = 6;

/** Las palabras sueltas (de 6 letras o más) que nombra un texto, en es y en; sus alternativas también. */
function singleWords(text: LocalizedText | string): string[] {
  const out = new Set<string>();
  const parts =
    typeof text === "string"
      ? [
          [text, "es"],
          [text, "en"],
        ]
      : (["es", "en"] as const).flatMap((l) =>
          text[l].split(ALTERNATIVES).map((p) => [p, l] as const),
        );
  for (const [part, locale] of parts) {
    const t = toTokens(part, locale as "es" | "en");
    if (t.length === 1 && t[0].length >= MIN_FUZZY) out.add(t[0]);
  }
  return [...out];
}

/** ¿Lo anotado (con su familia) aparece en el texto? Un solo sentido: el texto es largo. */
function avoidIn(hay: string[], avoid: readonly string[]): boolean {
  for (const text of expandAvoid(avoid)) {
    for (const locale of ["es", "en"] as const) {
      const n = toTokens(text, locale);
      if (n.length && containsPhrase(hay, n)) return true;
    }
  }
  return false;
}

export function checkLabel(input: LabelInput): LabelCheck {
  const { diet, now } = input;
  const folded = foldText(input.text);
  const sections = splitSections(folded);
  const declared = input.declared ?? {};

  const hays: Hay[] = [
    {
      tokens: tokens(
        [sections.ingredients, ...(declared.contains ?? [])].join(" , "),
      ),
      where: "ingredients",
    },
    {
      tokens: tokens([sections.traces, ...(declared.traces ?? [])].join(" , ")),
      where: "traces",
    },
  ];

  const hits: LabelHit[] = [];
  const push = (hit: LabelHit) => {
    const key = `${hit.kind}|${"id" in hit ? hit.id : "code" in hit ? hit.code : hit.name.es}`;
    const prev = hits.findIndex(
      (h) =>
        `${h.kind}|${"id" in h ? h.id : "code" in h ? h.code : h.name.es}` ===
        key,
    );
    // Lo mismo en ingredientes y en trazas: manda «ingredientes».
    if (prev === -1) hits.push(hit);
    else if (hit.where === "ingredients") hits[prev] = hit;
  };

  // Aditivos: por número (en cada sección), por nombre del plan y por nombre público.
  const planAdditives = diet.trafficLight.red.additives;
  const seenCodes = new Map<string, { seen: string; where: Where }>();
  for (const where of ["ingredients", "traces"] as const)
    for (const c of findCodes(sections[where]))
      if (!seenCodes.has(c.code) || where === "ingredients")
        seenCodes.set(c.code, { ...c, where });
  for (const raw of declared.codes ?? []) {
    // «E150D» se mira como «E150»: así lo guarda el plan (`^E\d+$`), sin el sufijo.
    const code = /^E\d{3,4}/.exec(raw.toUpperCase())?.[0];
    if (code && !seenCodes.has(code))
      seenCodes.set(code, { seen: raw.toUpperCase(), where: "ingredients" });
  }
  for (const hay of hays)
    for (const [code, alias] of Object.entries(ADDITIVE_ALIASES))
      for (const name of alias.names) {
        if (!containsPhrase(hay.tokens, tokens(name))) continue;
        const prev = seenCodes.get(code);
        if (!prev || (hay.where === "ingredients" && prev.where === "traces"))
          seenCodes.set(code, { seen: name, where: hay.where });
        break;
      }
  for (const a of planAdditives) {
    const found = seenCodes.get(a.code.toUpperCase());
    if (found) {
      push({
        kind: "additive",
        where: found.where,
        code: a.code,
        name: a.name,
        seen: found.seen,
      });
      continue;
    }
    for (const hay of hays)
      if (namedIn(hay.tokens, a.name)) {
        push({
          kind: "additive",
          where: hay.where,
          code: a.code,
          name: a.name,
          seen: a.name.es,
        });
        break;
      }
  }

  // Lo que un aditivo visto dice de sí (su clase y sus nombres): se coteja como texto con el plan,
  // así «E102» designa un rojo «Colorantes artificiales» y «E420» una intolerancia «Sorbitol».
  const implied: Record<Where, string[]> = { ingredients: [], traces: [] };
  for (const [code, { where }] of seenCodes) {
    const alias = ADDITIVE_ALIASES[code];
    if (!alias) continue;
    implied[where].push(...alias.names);
    if (alias.class) implied[where].push(...CLASS_PHRASES[alias.class]);
  }
  const withImplied = hays.map((h) => ({
    ...h,
    tokens: implied[h.where].length
      ? [...h.tokens, ",", ...tokens(implied[h.where].join(" , "))]
      : h.tokens,
  }));

  // Rojos, restricciones (vigentes o vencidas) y amarillos del plan, por nombre.
  for (const id of allItemIds(diet)) {
    const status = resolveItemStatus(diet, id, now);
    if (!status || status.kind === "green") continue;
    for (const hay of withImplied) {
      if (!namedIn(hay.tokens, status.name)) continue;
      if (status.kind === "yellow")
        push({
          kind: "yellow",
          where: hay.where,
          id,
          name: status.name,
          limit: status.limit,
        });
      else if (status.kind === "restricted")
        push({
          kind: "restricted",
          where: hay.where,
          id,
          name: status.name,
          active: status.restrictionActive,
        });
      else push({ kind: "red", where: hay.where, id, name: status.name });
    }
  }

  // Parecidos: un código con letras donde irían cifras («E9S9») que cuadra con un aditivo del plan.
  const guesses = [
    ...guessCodes(sections.ingredients).map((g) => ({
      ...g,
      where: "ingredients" as Where,
    })),
    ...guessCodes(sections.traces).map((g) => ({
      ...g,
      where: "traces" as Where,
    })),
  ];
  for (const a of planAdditives) {
    const digits = a.code.toUpperCase().replace(/^E/, "").toLowerCase();
    for (const g of guesses) {
      if (g.pattern.length !== digits.length) continue;
      if ([...g.pattern].every((c, i) => /[a-z]/.test(c) || c === digits[i]))
        push({ kind: "similar", where: g.where, name: a.name, seen: g.seen });
    }
  }

  // Alergias e intolerancias: las del plan y las que anotó quien cuida, con sus familias.
  const avoid: { kind: "allergy" | "intolerance"; name: LocalizedText }[] = [
    ...(diet.profile?.allergies ?? []).map((a) => ({
      kind: "allergy" as const,
      name: a.name,
    })),
    ...(diet.profile?.intolerances ?? []).map((a) => ({
      kind: "intolerance" as const,
      name: a.name,
    })),
  ];
  const notes = input.notes ?? [];
  for (const n of notes) {
    if (n.kind !== "allergy" && n.kind !== "intolerance") continue;
    if (n.text.trim())
      avoid.push({ kind: n.kind, name: { es: n.text, en: n.text } });
  }
  for (const a of avoid)
    for (const hay of withImplied)
      if (avoidIn(hay.tokens, [a.name.es, a.name.en]))
        push({ kind: a.kind, where: hay.where, name: a.name });

  // Palabras a una letra de lo que el plan evita (el lector cambió una): «revisa», jamás «no va».
  const exact = new Set(hits.map((h) => ("name" in h ? h.name.es : "")));
  const watched: { name: LocalizedText; words: string[] }[] = [];
  for (const id of allItemIds(diet)) {
    const status = resolveItemStatus(diet, id, now);
    if (status && status.kind !== "green")
      watched.push({ name: status.name, words: singleWords(status.name) });
  }
  for (const a of avoid)
    watched.push({
      name: a.name,
      words: expandAvoid([a.name.es, a.name.en]).flatMap((t) => singleWords(t)),
    });
  for (const w of watched) {
    if (exact.has(w.name.es) || !w.words.length) continue;
    for (const hay of withImplied) {
      const near = hay.tokens.find((t) =>
        w.words.some(
          (word) =>
            t !== word && t.length >= MIN_FUZZY - 1 && withinOne(t, word),
        ),
      );
      if (near) {
        push({ kind: "similar", where: hay.where, name: w.name, seen: near });
        break;
      }
    }
  }

  const quality = textQuality(input.text, input.confidence);

  const isNo = hits.some(
    (h) =>
      h.kind === "additive" ||
      h.kind === "allergy" ||
      // Un rojo del plan («Snacks de paquete») no es algo que se cuele como traza: si aparece tras
      // «puede contener» sin un punto de por medio, lo más probable es que sea un ingrediente.
      h.kind === "red" ||
      (((h.kind === "restricted" && h.active) || h.kind === "intolerance") &&
        h.where === "ingredients"),
  );
  const verdict: Verdict = isNo
    ? "no"
    : hits.length > 0
      ? "check"
      : quality.ok
        ? "ok"
        : "unreadable";

  return {
    verdict,
    hits: sortHits(hits),
    quality,
    partial: !quality.ok && (verdict === "no" || verdict === "check"),
    codes: [...seenCodes.keys()],
  };
}

/** Primero lo que descarta, luego lo que pide revisar; dentro, ingredientes antes que trazas. */
const RANK: Record<LabelHit["kind"], number> = {
  allergy: 0,
  additive: 1,
  restricted: 2,
  red: 3,
  intolerance: 4,
  yellow: 5,
  similar: 6,
};
function sortHits(hits: LabelHit[]): LabelHit[] {
  return [...hits].sort(
    (a, b) =>
      (a.where === b.where ? 0 : a.where === "ingredients" ? -1 : 1) ||
      RANK[a.kind] - RANK[b.kind],
  );
}
