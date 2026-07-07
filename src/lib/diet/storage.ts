import demoRaw from "../../../data/demo-diet.json";
import { log } from "../log";
import {
  dietCounts,
  dietPlanSchema,
  parseDietJson,
  type DietPlan,
} from "./schema";
import { clearDayLog } from "./day-log";

/**
 * Almacenamiento local (ADR: localStorage con claves versionadas).
 * La dieta real vive SOLO en el dispositivo; el repo solo conoce la demo.
 * Fail-safe: dato guardado corrupto ⇒ se descarta y se vuelve a demo.
 */

export const STORAGE_KEYS = {
  diet: "nutrikids.diet.v1",
  source: "nutrikids.source.v1",
  prefs: "nutrikids.prefs.v1",
} as const;

export type DietSource = "demo" | "real";

/** La demo del repo, validada por el mismo schema (si está malformada, los tests fallan). */
export function getDemoDiet(): DietPlan {
  return dietPlanSchema.parse(demoRaw);
}

function storage(): Storage | null {
  // SSR/prerender: no hay window; los llamadores caen a demo.
  return typeof window === "undefined" ? null : window.localStorage;
}

export type ActiveDiet = { diet: DietPlan; source: DietSource };

export function loadActiveDiet(): ActiveDiet {
  const s = storage();
  if (s && s.getItem(STORAGE_KEYS.source) === "real") {
    const stored = s.getItem(STORAGE_KEYS.diet);
    if (stored) {
      const parsed = parseDietJson(stored);
      if (parsed.ok) return { diet: parsed.diet, source: "real" };
      // Corrupto: descartar y volver a demo (solo metadatos al log).
      log.warn(
        { event: "stored-diet-invalid", error: parsed.error },
        "stored diet discarded",
      );
      s.removeItem(STORAGE_KEYS.diet);
      s.removeItem(STORAGE_KEYS.source);
    }
  }
  return { diet: getDemoDiet(), source: "demo" };
}

export type ImportResult =
  | { ok: true; counts: ReturnType<typeof dietCounts> }
  | { ok: false; error: "invalid-json" | "invalid-schema" | "no-storage" };

/** Importa una dieta (texto del file picker o del textarea). Logs SOLO con metadatos. */
export function importDiet(jsonText: string): ImportResult {
  const parsed = parseDietJson(jsonText);
  if (!parsed.ok) {
    log.warn({
      event: "diet-import-rejected",
      error: parsed.error,
      detail: parsed.detail,
    });
    return { ok: false, error: parsed.error };
  }
  const s = storage();
  if (!s) return { ok: false, error: "no-storage" };
  s.setItem(STORAGE_KEYS.diet, JSON.stringify(parsed.diet));
  s.setItem(STORAGE_KEYS.source, "real");
  const counts = dietCounts(parsed.diet);
  log.info({ event: "diet-imported", ...counts });
  return { ok: true, counts };
}

/** Vuelve a la demo sin borrar el checklist (selector demo↔real de /cargar). */
export function switchToDemo(): void {
  storage()?.setItem(STORAGE_KEYS.source, "demo");
}

export function switchToReal(): boolean {
  const s = storage();
  if (!s || !s.getItem(STORAGE_KEYS.diet)) return false;
  s.setItem(STORAGE_KEYS.source, "real");
  return true;
}

export function hasStoredRealDiet(): boolean {
  return storage()?.getItem(STORAGE_KEYS.diet) != null;
}

/**
 * "Borrar datos": elimina dieta importada + checklist del día (day-log) y vuelve a demo.
 * Conserva la preferencia de idioma (no es dato del niño).
 */
export function clearAllData(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(STORAGE_KEYS.diet);
  s.removeItem(STORAGE_KEYS.source);
  clearDayLog();
  log.info({ event: "data-cleared" });
}

// ---------------------------------------------------------------------------
// Preferencias (idioma, disclaimer visto) — no son datos del niño.
// ---------------------------------------------------------------------------

export type Prefs = { locale: "es" | "en"; disclaimerSeen: boolean };

const DEFAULT_PREFS: Prefs = { locale: "es", disclaimerSeen: false };

export function loadPrefs(): Prefs {
  const raw = storage()?.getItem(STORAGE_KEYS.prefs);
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      locale: parsed.locale === "en" ? "en" : "es",
      disclaimerSeen: parsed.disclaimerSeen === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  storage()?.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
}
