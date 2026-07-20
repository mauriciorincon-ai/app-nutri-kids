/**
 * Grounding del Camino B: la dieta vive en el cliente, así que el contexto
 * viaja en el request. Serializamos la DietPlan de forma COMPACTA y en UN solo
 * idioma (el activo) + el contexto del día, y construimos el system prompt
 * estricto que ancla al modelo a "solo lo que el plan autoriza".
 *
 * El ADR de grounding mide el tamaño real en tokens (ver decisions/).
 */
import type { DietPlan, Weekday } from "../diet/schema";
import {
  isRestrictionActive,
  supplementsForDate,
  weekdayFromDate,
} from "../diet/logic";

type Locale = "es" | "en";

const WEEKDAY_NAME: Record<Locale, Record<Weekday, string>> = {
  es: {
    mon: "lunes",
    tue: "martes",
    wed: "miércoles",
    thu: "jueves",
    fri: "viernes",
    sat: "sábado",
    sun: "domingo",
  },
  en: {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  },
};

/** Serializa la dieta en el idioma activo, compacta (sin duplicar ES+EN). */
export function serializeDiet(
  diet: DietPlan,
  locale: Locale,
  date: Date,
): string {
  const t = (v: { es: string; en: string }) => v[locale];
  const lines: string[] = [];

  const restrictionActive = isRestrictionActive(diet, date);
  lines.push(
    `${locale === "en" ? "TEMPORARY RESTRICTIONS" : "RESTRICCIONES TEMPORALES"} (${
      restrictionActive
        ? `${locale === "en" ? "active until" : "vigente hasta"} ${diet.restrictions.validUntil}`
        : locale === "en"
          ? "expired"
          : "vencida"
    }): ${diet.restrictions.foods.map((f) => t(f.name)).join(", ")}. ${t(diet.restrictions.note)}`,
  );

  lines.push(
    `${locale === "en" ? "RED (avoid)" : "ROJO (evitar)"}: ${diet.trafficLight.red.items
      .map((i) => `${t(i.name)} — ${t(i.why)}`)
      .join("; ")}.`,
  );
  if (diet.trafficLight.red.alsoAvoid.length) {
    lines.push(
      `${locale === "en" ? "Also avoid" : "También evitar"}: ${diet.trafficLight.red.alsoAvoid
        .map((i) => t(i.name))
        .join(", ")}.`,
    );
  }
  if (diet.trafficLight.red.additives.length) {
    lines.push(
      `${locale === "en" ? "Additives to avoid" : "Aditivos a evitar"}: ${diet.trafficLight.red.additives
        .map((a) => `${a.code} (${t(a.name)})`)
        .join(", ")}.`,
    );
  }

  lines.push(
    `${locale === "en" ? "YELLOW (limited)" : "AMARILLO (con límite)"}: ${diet.trafficLight.yellow.items
      .map((i) => `${t(i.name)} — ${t(i.limit)}`)
      .join("; ")}.`,
  );

  lines.push(
    `${locale === "en" ? "GREEN (allowed)" : "VERDE (permitido)"}: ${diet.trafficLight.green.groups
      .map(
        (g) =>
          `${t(g.name)} [${t(g.portion)}]: ${g.items.map((i) => t(i.name)).join(", ")}`,
      )
      .join(" | ")}.`,
  );

  if (diet.equivalences.length) {
    lines.push(
      `${locale === "en" ? "EQUIVALENTS" : "EQUIVALENCIAS"}: ${diet.equivalences
        .map((e) => `${t(e.title)} → ${e.use.map((u) => t(u)).join(", ")}`)
        .join(" | ")}.`,
    );
  }

  lines.push(
    `${locale === "en" ? "SUPPLEMENTS" : "SUPLEMENTOS"}: ${diet.supplements
      .map(
        (s) =>
          `${t(s.name)} (${s.days.map((d) => WEEKDAY_NAME[locale][d]).join("/")}, ${t(s.dose)}, ${t(s.when)})`,
      )
      .join(" | ")}.`,
  );

  lines.push(
    `${locale === "en" ? "TYPICAL MENU" : "MENÚ TIPO"}: ${diet.dailyMenu
      .map((m) => `${t(m.name)} ${m.start}: ${t(m.content)}`)
      .join(" | ")}.`,
  );

  lines.push(
    `${locale === "en" ? "HYDRATION" : "HIDRATACIÓN"}: ${t(diet.hydration.habit)}`,
  );

  return lines.join("\n");
}

/** Contexto del día (fecha, día de la semana, suplementos de hoy). */
export function dayContext(diet: DietPlan, locale: Locale, date: Date): string {
  const weekday = WEEKDAY_NAME[locale][weekdayFromDate(date)];
  const iso = date.toISOString().slice(0, 10);
  const supplements = supplementsForDate(diet, date);
  const supText = supplements.length
    ? supplements.map((s) => s.name[locale]).join(", ")
    : locale === "en"
      ? "none today"
      : "ninguno hoy";
  return locale === "en"
    ? `TODAY: ${weekday} ${iso}. Supplements due today: ${supText}.`
    : `HOY: ${weekday} ${iso}. Suplementos de hoy: ${supText}.`;
}

/** El system prompt estricto (server-side siempre). */
export function buildSystemPrompt(locale: Locale): string {
  return locale === "en"
    ? [
        "You are a warm, calm assistant that helps caregivers follow a child's nutrition plan.",
        "RULES (non-negotiable):",
        "- Answer ONLY using the loaded plan below. If something is not in the plan, say so plainly; never invent foods, doses, or rules.",
        "- Recommend ONLY foods the plan allows (green, or yellow within its limit). Never suggest red/avoided items.",
        "- You are NOT a doctor. Never give medical advice, diagnoses, new doses, or changes to supplements/medication. Redirect those to the child's professional.",
        "- No calories, weight, BMI, or body talk. No guilt or reward-with-food framing. Warm, practical, non-coercive tone.",
        "- Prefer the plan's existing equivalents when a food is missing.",
        "- Keep answers short and concrete. Reply in English.",
      ].join("\n")
    : [
        "Eres un asistente cálido y calmado que ayuda a cuidadores a seguir el plan de alimentación de un niño.",
        "REGLAS (innegociables):",
        "- Responde SOLO con el plan cargado más abajo. Si algo no está en el plan, dilo con claridad; nunca inventes alimentos, dosis ni reglas.",
        "- Recomienda SOLO alimentos que el plan permite (verde, o amarillo dentro de su límite). Nunca sugieras ítems rojos/a evitar.",
        "- NO eres médico. Nunca des consejo médico, diagnósticos, dosis nuevas ni cambios a suplementos/medicación. Redirige eso al profesional del niño.",
        "- Sin calorías, peso, IMC ni lenguaje sobre el cuerpo. Sin culpa ni premio con comida. Tono cálido, práctico, no coercitivo.",
        "- Prefiere las equivalencias que ya trae el plan cuando falte un alimento.",
        "- Respuestas cortas y concretas. Responde en español.",
      ].join("\n");
}

/** System message completo: instrucciones + plan serializado + día. */
export function buildGroundedSystem(
  diet: DietPlan,
  locale: Locale,
  date: Date,
): string {
  return [
    buildSystemPrompt(locale),
    "",
    locale === "en" ? "=== LOADED PLAN ===" : "=== PLAN CARGADO ===",
    serializeDiet(diet, locale, date),
    dayContext(diet, locale, date),
  ].join("\n");
}
