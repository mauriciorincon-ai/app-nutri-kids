import type { PlanDraft } from "./pdf-reader";
import {
  type DietPlan,
  type LocalizedText,
  type ParseDietResult,
  dietPlanSchema,
} from "./schema";

/**
 * Del borrador revisado al `DietPlan` v2 (ADR-010). Lo que el PDF no trae como dato
 * (etiquetas del semáforo, título, aviso) lo pone la app con su propio texto {es, en};
 * lo del plan va tal cual. El resultado pasa por el schema: nada se guarda sin validar.
 */

/** Días de vigencia de la restricción: la plantilla dice «90 días» y no trae «hasta». */
export const RESTRICTION_DAYS = 90;

const LABELS = {
  red: { es: "Rojo — evitar", en: "Red — avoid" },
  yellow: { es: "Amarillo — con límite", en: "Yellow — limited" },
  green: {
    es: "Verde — permitido y recomendado",
    en: "Green — allowed and encouraged",
  },
};

const RESTRICTION_NOTE: LocalizedText = {
  es: `Restricción temporal de tu plan: ${RESTRICTION_DAYS} días desde la fecha del plan. Al terminar, la reintroducción la guía tu profesional.`,
  en: `Temporary restriction from your plan: ${RESTRICTION_DAYS} days from the plan's date. Afterwards, your professional guides the reintroduction.`,
};

const RED_WHY: LocalizedText = {
  es: "Tu plan pide evitarlo.",
  en: "Your plan asks to avoid it.",
};

const NOT_SAID: LocalizedText = {
  es: "Tu plan no lo dice.",
  en: "Your plan doesn't say.",
};

const DISCLAIMER: LocalizedText = {
  es: "Esta guía organiza el plan de tu profesional. No es diagnóstico ni tratamiento médico: ante cualquier duda, consulta a tu pediatra o nutricionista.",
  en: "This guide organizes your professional's plan. It is not a diagnosis or medical treatment: if in doubt, ask your pediatrician or dietitian.",
};

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fecha local «YYYY-MM-DD» (la de quien cuida, no la UTC). */
export function localIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function assembleDietPlan(
  draft: PlanDraft,
  pages: Record<string, number>,
  readAt: Date,
  /** Ítems del rojo fijo que quien cuida añadió a mano (la plantilla los trae en prosa). */
  redItems: { id: string; name: LocalizedText }[] = [],
): ParseDietResult {
  // La hidratación es obligatoria y jamás se inventa: sin ella, la revisión la pide.
  if (!draft.hydration)
    return { ok: false, error: "invalid-schema", detail: "hydration" };
  const read = localIso(readAt);
  const issuedAt = draft.issuedAt ?? read;
  const note: LocalizedText = draft.restrictedNotes.length
    ? {
        es: `${RESTRICTION_NOTE.es} ${draft.restrictedNotes.join(" ")}`,
        en: `${RESTRICTION_NOTE.en} ${draft.restrictedNotes.join(" ")}`,
      }
    : RESTRICTION_NOTE;
  const plan: DietPlan = {
    schemaVersion: 2,
    meta: {
      id: `pdf-${issuedAt}`,
      title: { es: "Tu plan", en: "Your plan" },
      source: {
        es: `Leído del PDF el ${read}, revisado por ti.`,
        en: `Read from the PDF on ${read}, reviewed by you.`,
      },
      issuedAt,
      languages: ["es", "en"],
      childAlias: { es: "tu peque", en: "your child" },
      disclaimer: DISCLAIMER,
    },
    restrictions: {
      validFrom: issuedAt,
      validUntil: addDaysIso(issuedAt, RESTRICTION_DAYS),
      note,
      foods: draft.restricted,
    },
    trafficLight: {
      red: {
        label: LABELS.red,
        items: redItems.map((r) => ({ ...r, why: RED_WHY })),
        additives: draft.additives.map((a) => ({
          code: a.code,
          name: a.name,
          foundIn: a.foundIn ?? NOT_SAID,
        })),
        alsoAvoid: draft.alsoAvoid,
      },
      yellow: { label: LABELS.yellow, items: draft.yellow },
      green: { label: LABELS.green, groups: draft.green },
    },
    supplements: draft.supplements,
    ...(draft.supplementNotes
      ? { supplementNotes: draft.supplementNotes }
      : {}),
    dailyMenu: [...draft.menu].sort((a, b) => a.start.localeCompare(b.start)),
    hydration: draft.hydration,
    equivalences: draft.equivalences,
    ...(draft.goals.activity || draft.goals.sleep
      ? { goals: draft.goals }
      : {}),
    pages,
  };
  const parsed = dietPlanSchema.safeParse(plan);
  if (!parsed.success)
    return {
      ok: false,
      error: "invalid-schema",
      detail: parsed.error.issues
        .slice(0, 3)
        .map((i) => i.path.join("."))
        .join(", "),
    };
  return { ok: true, diet: parsed.data };
}
