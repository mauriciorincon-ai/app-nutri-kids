/**
 * Redacción de las respuestas abiertas: une la decisión del motor (answer.ts)
 * con las plantillas de i18n (`t.answer`). Pura: sin React, sin red.
 */
import type { Dictionary } from "@/i18n/es";
import type { OpenAnswer, OptionItem } from "./answer";
import type { LocalizedText } from "./schema";
import type { Locale } from "./search";

export type AnswerTemplates = Dictionary["answer"];

export type ComposedAnswer = {
  /** Frase principal (la única que el modelo del aparato puede re-redactar). */
  lead: string;
  /** Opciones del plan, tal cual vienen en los datos; `marked` = textura que hoy no acepta. */
  items: { text: string; marked: boolean }[];
  /** Título de la lista, si hay lista. */
  itemsTitle: string | null;
  /** «Lo que sigue», cuando aplica. */
  next: { title: string; text: string } | null;
  /** Lo que una re-redacción NO puede perder (nombres del plan). */
  required: string[];
  /** true = «tu plan no lo dice». */
  notInPlan: boolean;
};

function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}

const lower = (s: string, locale: Locale) => s.toLocaleLowerCase(locale);

const toItems = (items: OptionItem[], locale: Locale) =>
  items.map((i) => ({ text: i.name[locale], marked: i.notAccepted }));

const listOf = (names: LocalizedText[], locale: Locale) =>
  names.map((n) => n[locale]).join(", ");

export function composeAnswer(
  answer: OpenAnswer,
  t: AnswerTemplates,
  locale: Locale,
): ComposedAnswer {
  const base = {
    items: [],
    itemsTitle: null,
    next: null,
    required: [],
    notInPlan: false,
  };
  switch (answer.kind) {
    case "replacement": {
      const food = lower(answer.food[locale], locale);
      const lead =
        answer.options.source === "equivalence"
          ? t.replacementLead
          : t.replacementGroupLead;
      return {
        ...base,
        lead: fill(lead, { food }),
        items: toItems(answer.options.items, locale),
        itemsTitle: t.optionsTitle,
        required: [food],
      };
    }
    case "refused": {
      const food = answer.food ? lower(answer.food[locale], locale) : null;
      const next = answer.next
        ? {
            title: t.nextTitle,
            text: fill(t.refusedNext, {
              meal: answer.next.name[locale],
              start: answer.next.start,
              content: answer.next.content[locale],
            }),
          }
        : { title: t.nextTitle, text: t.refusedNoNext };
      return {
        ...base,
        lead:
          food && answer.options
            ? fill(t.refusedFoodLead, { food })
            : t.refusedLead,
        items: answer.options ? toItems(answer.options.items, locale) : [],
        itemsTitle: answer.options ? t.optionsTitle : null,
        next,
        required: food && answer.options ? [food] : [],
      };
    }
    case "meal": {
      const m = answer.meal;
      const template = {
        now: t.mealNow,
        next: t.mealNext,
        named: t.mealNamed,
        tomorrow: t.mealTomorrow,
      }[answer.timing];
      return {
        ...base,
        lead: fill(template, {
          meal: m.name[locale],
          start: m.start,
          end: m.end,
          content: m.content[locale],
        }),
        // El nombre de la comida y CADA alimento del menú deben sobrevivir al acento.
        required: [
          m.name[locale],
          ...m.content[locale]
            .split(/,|;| y | and /)
            .map((x) => x.trim())
            .filter((x) => x.length > 2),
        ],
      };
    }
    case "hydration": {
      const nf = new Intl.NumberFormat(locale);
      return {
        ...base,
        lead: fill(t.hydration, {
          min: nf.format(answer.litersMin),
          max: nf.format(answer.litersMax),
          glasses: answer.glasses,
          habit: answer.habit[locale],
        }),
      };
    }
    case "sleep":
      return { ...base, lead: answer.text[locale] };
    case "activity":
      return { ...base, lead: answer.text[locale] };
    case "allergy": {
      const { match } = answer;
      const noted = [...answer.notedAllergies, ...answer.notedIntolerances];
      const lead = match
        ? fill(
            match.fromNote
              ? match.as === "allergy"
                ? t.allergyNotedYes
                : t.intoleranceNotedYes
              : match.as === "allergy"
                ? t.allergyYes
                : t.intoleranceYes,
            { food: lower(match.name[locale], locale) },
          )
        : [
            answer.allergies.length > 0
              ? fill(t.allergyList, { list: listOf(answer.allergies, locale) })
              : "",
            answer.intolerances.length > 0
              ? fill(t.intoleranceList, {
                  list: listOf(answer.intolerances, locale),
                })
              : "",
            noted.length > 0
              ? fill(t.notedList, { list: listOf(noted, locale) })
              : "",
            t.allergyOther,
          ]
            .filter(Boolean)
            .join(" ");
      return {
        ...base,
        lead,
        required: [...answer.allergies, ...answer.intolerances, ...noted].map(
          (n) => lower(n[locale], locale),
        ),
      };
    }
    case "medication": {
      const items = answer.items.map((m) => ({
        text: [m.name[locale], m.dose?.[locale], m.when?.[locale]]
          .filter(Boolean)
          .join(" · "),
        marked: false,
      }));
      return {
        ...base,
        lead:
          answer.items.length > 0
            ? t.medicationLead
            : fill(t.notedList, { list: listOf(answer.noted, locale) }),
        items:
          answer.items.length > 0
            ? [
                ...items,
                ...answer.noted.map((n) => ({
                  text: fill(t.medicationNoted, { name: n[locale] }),
                  marked: false,
                })),
              ]
            : [],
        itemsTitle: t.medicationTitle,
        required: [
          ...answer.items.flatMap((m) =>
            [m.name[locale], m.dose?.[locale], m.when?.[locale]].filter(
              (x): x is string => Boolean(x),
            ),
          ),
          ...answer.noted.map((n) => n[locale]),
        ],
      };
    }
    case "not-in-plan":
      return {
        ...base,
        lead: answer.food
          ? fill(t.notInPlanFood, { food: lower(answer.food[locale], locale) })
          : t.notInPlan,
        notInPlan: true,
      };
  }
}
