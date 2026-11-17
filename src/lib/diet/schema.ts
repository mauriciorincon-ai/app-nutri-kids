import { z } from "zod";

import { migrateV1toV2 } from "./migrate";

/**
 * Schema zod v2 del plan de dieta (dietPlan) — ADR-009. La v1 sigue aceptándose
 * al importar o leer y se migra a v2 (`migrate.ts`), sin perder nada.
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
  items: z
    .array(
      namedItemSchema.extend({ keepsWithoutFridge: z.boolean().optional() }),
    )
    .min(1),
});

/**
 * Texturas: lista CERRADA (la etiqueta {es, en} vive en i18n, `t.texture`). Quien
 * cuida marca en el teléfono las que el niño hoy acepta; el plan dice la de cada opción.
 */
export const TEXTURES = [
  "liquid",
  "puree",
  "mashed",
  "soft",
  "chopped",
  "crunchy",
] as const;
export const textureSchema = z.enum(TEXTURES);

/** Una opción de reemplazo del plan, con su textura si el plan la dice. */
const optionSchema = z.object({
  name: localizedTextSchema,
  texture: textureSchema.optional(),
  /** El plan dice que esta opción aguanta sin nevera (S9). Quien cuida también puede marcarla. */
  keepsWithoutFridge: z.boolean().optional(),
});

const equivalenceFields = {
  /** id del alimento/categoría que falta o está restringido. */
  whenMissing: z.string().min(1),
  title: localizedTextSchema,
  note: localizedTextSchema.optional(),
};

const equivalenceV1Schema = z.object({
  ...equivalenceFields,
  use: z.array(localizedTextSchema).min(1),
});

const equivalenceSchema = z.object({
  ...equivalenceFields,
  use: z.array(optionSchema).min(1),
});

/** Lo que el PLAN dice del niño (todo opcional: el plan puede no traerlo). */
const medicationSchema = namedItemSchema.extend({
  dose: localizedTextSchema.optional(),
  when: localizedTextSchema.optional(),
});

const profileSchema = z.object({
  condition: localizedTextSchema.optional(),
  allergies: z.array(namedItemSchema).optional(),
  intolerances: z.array(namedItemSchema).optional(),
  medications: z.array(medicationSchema).optional(),
});

/** Objetivos del profesional tal como los escribe el plan (sin cifras del cuerpo). */
const goalsSchema = z.object({
  activity: localizedTextSchema.optional(),
  sleep: localizedTextSchema.optional(),
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

const planFields = {
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
    // Puede venir vacía: un plan sin restricción temporal (S6, «mi plan no lo trae»).
    foods: z.array(namedItemSchema),
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
      // La plantilla no trae amarillo propio: puede quedar vacío (S6).
      items: z.array(yellowItemSchema),
    }),
    green: z.object({
      label: localizedTextSchema,
      groups: z.array(greenGroupSchema).min(1),
    }),
  }),
  // Un plan puede no traer suplementos (S6, «mi plan no lo trae»).
  supplements: z.array(supplementSchema),
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
};

/** El plan v1 (S1–S4): solo se lee para migrarlo. */
export const dietPlanV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...planFields,
  equivalences: z.array(equivalenceV1Schema),
});

// ---------------------------------------------------------------------------
// Plan unido (S9, ADR-014): de dónde salió cada línea y la otra cara de cada choque
// ---------------------------------------------------------------------------

const planRefSchema = z.object({
  id: z.string().min(1),
  title: localizedTextSchema,
  source: localizedTextSchema,
});

/** Busca un elemento de una lista por uno de sus campos (los planes no tienen índices estables). */
const selectorSchema = z.object({
  k: z.enum(["id", "whenMissing", "code", "nameEs", "eq"]),
  v: z.string().min(1),
});

/** Dónde queda un alimento: la lista del semáforo y lo que esa lista guarda de él. */
export const PLACE_COLORS = [
  "restricted",
  "red",
  "alsoAvoid",
  "yellow",
  "green",
] as const;
const placeSchema = z.object({
  color: z.enum(PLACE_COLORS),
  id: z.string().min(1),
  name: localizedTextSchema,
  why: localizedTextSchema.optional(),
  limit: localizedTextSchema.optional(),
  group: z
    .object({
      id: z.string().min(1),
      name: localizedTextSchema,
      portion: localizedTextSchema,
    })
    .optional(),
  keepsWithoutFridge: z.boolean().optional(),
});

/** La otra cara de una línea: o un alimento en otra lista, o campos de un registro del plan. */
const altSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("place"), place: placeSchema }),
  z.object({
    t: z.literal("patch"),
    path: z.array(z.union([z.string(), selectorSchema])).min(1),
    patch: z.record(z.string(), z.unknown()),
  }),
]);

export const LINE_RULES = ["only", "same", "red", "picked", "parent"] as const;
const mergedLineSchema = z.object({
  /** De cuál plan salió lo que hoy dice la línea. */
  from: z.enum(["a", "b", "both"]),
  /** only = estaba en uno · same = en los dos, igual · red = lo prohibido ganó solo · picked = lo eligió un padre al unir · parent = un padre la cambió después. */
  rule: z.enum(LINE_RULES),
  /** Qué decía cada plan (solo cuando decían cosas distintas). */
  a: localizedTextSchema.optional(),
  b: localizedTextSchema.optional(),
  alt: altSchema.optional(),
});

const mergedSchema = z.object({
  from: z.tuple([planRefSchema, planRefSchema]),
  lines: z.record(z.string().min(1).max(100), mergedLineSchema),
  /** El último cambio de un padre a una línea: la sincronía lo anota en la bitácora como `plan-line`. */
  last: z
    .object({ key: z.string().min(1).max(100), t: z.number().int() })
    .optional(),
});

export const dietPlanSchema = z.object({
  schemaVersion: z.literal(2),
  ...planFields,
  equivalences: z.array(equivalenceSchema),
  profile: profileSchema.optional(),
  goals: goalsSchema.optional(),
  /**
   * Página del PDF de donde salió cada dato (`<sección>` o `<sección>.<id>`), cuando el
   * plan se leyó de un PDF (ADR-010). Opcional: un JSON v2 sin ella sigue igual.
   */
  pages: z.record(z.string(), z.number().int().positive()).optional(),
  /** Solo en un plan unido de dos (S9): el origen de cada línea. */
  merged: mergedSchema.optional(),
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type Weekday = z.infer<typeof weekdaySchema>;
export type DietPlan = z.infer<typeof dietPlanSchema>;
export type DietPlanV1 = z.infer<typeof dietPlanV1Schema>;
export type Texture = z.infer<typeof textureSchema>;
export type MergedInfo = z.infer<typeof mergedSchema>;
export type MergedLine = z.infer<typeof mergedLineSchema>;
export type MergedAlt = z.infer<typeof altSchema>;
export type Place = z.infer<typeof placeSchema>;
export type PathSeg = string | z.infer<typeof selectorSchema>;
export type PlanOption = z.infer<typeof optionSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Medication = z.infer<typeof medicationSchema>;
export type GreenGroup = DietPlan["trafficLight"]["green"]["groups"][number];
export type Supplement = DietPlan["supplements"][number];
export type Meal = DietPlan["dailyMenu"][number];
export type Equivalence = DietPlan["equivalences"][number];

/** Resultado tipado del parseo — el llamador decide el mensaje legible (i18n). */
export type ParseDietResult =
  | { ok: true; diet: DietPlan; migratedFrom?: 1 }
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
  // v1 guardada o importada: se valida como v1 y se migra (ADR-009).
  if (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { schemaVersion?: unknown }).schemaVersion === 1
  ) {
    const v1 = dietPlanV1Schema.safeParse(raw);
    if (!v1.success) return schemaError(v1.error);
    const v2 = dietPlanSchema.safeParse(migrateV1toV2(v1.data));
    if (!v2.success) return schemaError(v2.error);
    return { ok: true, diet: v2.data, migratedFrom: 1 };
  }
  const parsed = dietPlanSchema.safeParse(raw);
  if (!parsed.success) return schemaError(parsed.error);
  return { ok: true, diet: parsed.data };
}

function schemaError(error: z.ZodError): ParseDietResult {
  // detail = paths inválidos (metadatos, nunca contenido) — apto para logs.
  const paths = error.issues
    .slice(0, 5)
    .map((i) => i.path.join(".") || "(root)")
    .join(", ");
  return { ok: false, error: "invalid-schema", detail: paths };
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
    // Del perfil, solo CUÁNTOS (jamás cuáles): regla dura 6.
    allergies: diet.profile?.allergies?.length ?? 0,
    intolerances: diet.profile?.intolerances?.length ?? 0,
    medications: diet.profile?.medications?.length ?? 0,
  };
}
