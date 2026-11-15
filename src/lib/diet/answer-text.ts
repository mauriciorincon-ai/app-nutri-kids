/**
 * Redacción de las respuestas abiertas: une la decisión del motor (answer.ts)
 * con las plantillas de i18n (`t.answer`). Pura: sin React, sin red.
 */
import type { Dictionary } from "@/i18n/es";
import type { OpenAnswer } from "./answer";
import type { Locale } from "./search";

export type AnswerTemplates = Dictionary["answer"];

export type ComposedAnswer = {
  /** Frase principal (la única que el modelo del aparato puede re-redactar). */
  lead: string;
  /** Opciones del plan, tal cual vienen en los datos. */
  items: string[];
  /** Título de la lista, si hay lista. */
  itemsTitle: string | null;
  /** «Lo que sigue», cuando aplica. */
  next: { title: string; text: string } | null;
  /** Lo que una re-redacción NO puede perder (nombres del plan). */
  required: string[];
  /** true = «tu plan no lo dice». */
  notInPlan: boolean;
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}

const lower = (s: string, locale: Locale) => s.toLocaleLowerCase(locale);

export function composeAnswer(
  answer: OpenAnswer,
  t: AnswerTemplates,
  locale: Locale,
): ComposedAnswer {
  const base = { items: [], itemsTitle: null, next: null, required: [], notInPlan: false };
  switch (answer.kind) {
    case "replacement": {
      const food = lower(answer.food[locale], locale);
      const lead =
        answer.options.source === "equivalence" ? t.replacementLead : t.replacementGroupLead;
      return {
        ...base,
        lead: fill(lead, { food }),
        items: answer.options.items.map((i) => i[locale]),
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
        lead: food && answer.options ? fill(t.refusedFoodLead, { food }) : t.refusedLead,
        items: answer.options?.items.map((i) => i[locale]) ?? [],
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
        required: [m.name[locale]],
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
