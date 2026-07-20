import { z } from "zod";

/**
 * Schema zod v1 del plan de dieta (dietPlan).
 * TODO el contenido nutricional de la app entra por aquí (regla de dominio):
 * el import FALLA si el JSON está malformado (fail-safe). Ningún alimento
 * hardcodeado en componentes.
 *
 * El schema anticipa multi-fuente futura vía `meta.source` y `schemaVersion`.
 */

/** Texto bilingüe — paridad ES/EN exigida a nivel de datos. */
export const localizedTextSchema = z.object({
  es: z.string().min(1),
  en: z.string().min(1),
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/** Hora "HH:MM" de 24h VÁLIDA (00–23:00–59) para los momentos del menú. */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM (24h, valid range)");

/** Minutos desde medianoche de un "HH:MM" ya validado (para comparar start/end). */
function minutesOfTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export const weekdaySchema = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);

const namedItemSchema = z.object({
  id: z.string().min(1),
  name: localizedTextSchema,
});

const redItemSchema = namedItemSchema.extend({
  why: localizedTextSchema,
});

const additiveSchema = z.object({
  code: z.string().regex(/^E\d+$/),
  name: localizedTextSchema,
  foundIn: localizedTextSchema,
});

const yellowItemSchema = namedItemSchema.extend({
  limit: localizedTextSchema,
});

const greenGroupSchema = z.object({
  id: z.string().min(1),
  name: localizedTextSchema,
  portion: localizedTextSchema,
  items: z.array(namedItemSchema).min(1),
});

const equivalenceSchema = z.object({
  /** id del alimento/categoría que falta o está restringido. */
  whenMissing: z.string().min(1),
  title: localizedTextSchema,
  use: z.array(localizedTextSchema).min(1),
  note: localizedTextSchema.optional(),
});

const supplementSchema = z.object({
  id: z.string().min(1),
  name: localizedTextSchema,
  days: z.array(weekdaySchema).min(1),
  dose: localizedTextSchema,
  when: localizedTextSchema,
});

const mealSchema = z.object({
  id: z.string().min(1),
  name: localizedTextSchema,
  start: timeSchema,
  end: timeSchema,
  content: localizedTextSchema,
});

export const dietPlanSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    id: z.string().min(1),
    title: localizedTextSchema,
    source: localizedTextSchema,
    issuedAt: isoDateSchema,
    languages: z.array(z.enum(["es", "en"])).min(2),
    childAlias: localizedTextSchema,
    disclaimer: localizedTextSchema,
  }),
  restrictions: z.object({
    validFrom: isoDateSchema,
    validUntil: isoDateSchema,
    note: localizedTextSchema,
    foods: z.array(namedItemSchema).min(1),
  }),
  trafficLight: z.object({
    red: z.object({
      label: localizedTextSchema,
      items: z.array(redItemSchema),
      additives: z.array(additiveSchema),
      alsoAvoid: z.array(namedItemSchema),
    }),
    yellow: z.object({
      label: localizedTextSchema,
      note: localizedTextSchema.optional(),
      items: z.array(yellowItemSchema).min(1),
    }),
    green: z.object({
      label: localizedTextSchema,
      groups: z.array(greenGroupSchema).min(1),
    }),
  }),
  equivalences: z.array(equivalenceSchema),
  supplements: z.array(supplementSchema).min(1),
  supplementNotes: localizedTextSchema.optional(),
  dailyMenu: z
    .array(mealSchema)
    .min(1)
    .superRefine((meals, ctx) => {
      // El `end` de una comida no puede caer antes que su `start` (una franja
      // 22:00→01:00 no se modela así): el recordatorio daría salidas absurdas.
      meals.forEach((meal, i) => {
        if (minutesOfTime(meal.end) < minutesOfTime(meal.start)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, "end"],
            message: "meal end must be >= start",
          });
        }
      });
    }),
  hydration: z.object({
    targetLitersMin: z.number().positive(),
    targetLitersMax: z.number().positive(),
    /** Vasos del checklist de "Hoy". El plan real no lo trae → default 4 en logic. */
    glassesPerDay: z.number().int().positive().optional(),
    habit: localizedTextSchema,
  }),
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type Weekday = z.infer<typeof weekdaySchema>;
export type DietPlan = z.infer<typeof dietPlanSchema>;
export type GreenGroup = DietPlan["trafficLight"]["green"]["groups"][number];
export type Supplement = DietPlan["supplements"][number];
export type Meal = DietPlan["dailyMenu"][number];
export type Equivalence = DietPlan["equivalences"][number];

/** Resultado tipado del parseo — el llamador decide el mensaje legible (i18n). */
export type ParseDietResult =
  | { ok: true; diet: DietPlan }
  | { ok: false; error: "invalid-json" | "invalid-schema"; detail: string };

export function parseDietJson(text: string): ParseDietResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // OJO: jamás incluir el mensaje de JSON.parse — V8 adjunta un EXTRACTO del
    // texto de entrada y este detail termina en logs (regla: cero contenido).
    return { ok: false, error: "invalid-json", detail: "unparseable JSON" };
  }
  const parsed = dietPlanSchema.safeParse(raw);
  if (!parsed.success) {
    // detail = paths inválidos (metadatos, nunca contenido) — apto para logs.
    const paths = parsed.error.issues
      .slice(0, 5)
      .map((i) => i.path.join(".") || "(root)")
      .join(", ");
    return { ok: false, error: "invalid-schema", detail: paths };
  }
  return { ok: true, diet: parsed.data };
}

/** Conteos para el resumen de carga y los logs (SOLO metadatos, jamás contenido). */
export function dietCounts(diet: DietPlan) {
  return {
    schemaVersion: diet.schemaVersion,
    greenGroups: diet.trafficLight.green.groups.length,
    greenItems: diet.trafficLight.green.groups.reduce(
      (n, g) => n + g.items.length,
      0,
    ),
    yellowItems: diet.trafficLight.yellow.items.length,
    redItems:
      diet.trafficLight.red.items.length +
      diet.trafficLight.red.alsoAvoid.length,
    additives: diet.trafficLight.red.additives.length,
    restrictedFoods: diet.restrictions.foods.length,
    equivalences: diet.equivalences.length,
    supplements: diet.supplements.length,
    meals: diet.dailyMenu.length,
  };
}
