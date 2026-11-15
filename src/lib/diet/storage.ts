import demoRaw from "../../../data/demo-diet.json";
import { log } from "../log";
import {
  dietCounts,
  dietPlanSchema,
  parseDietJson,
  type DietPlan,
} from "./schema";
import { clearDayLog } from "./day-log";
import { clearProfileNotes } from "./profile-notes";
import { clearPlanDraft } from "./plan-draft";
import { dateKey } from "./logic";
import { rebaseDemoWindow } from "./demo";

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

let demoDietCache: DietPlan | null = null;

/** La demo del repo, validada por el mismo schema (si está malformada, los tests fallan). */
export function getDemoDiet(): DietPlan {
  demoDietCache ??= dietPlanSchema.parse(demoRaw);
  return demoDietCache;
}

let rebasedDemo: { key: string; diet: DietPlan } | null = null;

/** La demo con su ventana corrida al día del aparato (misma referencia durante el día). */
export function getDemoDietFor(now: Date): DietPlan {
  const key = dateKey(now);
  if (rebasedDemo?.key !== key) {
    rebasedDemo = { key, diet: rebaseDemoWindow(getDemoDiet(), now) };
  }
  return rebasedDemo.diet;
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
      if (parsed.ok) {
        // Un plan v1 guardado se migra al leer: se reescribe en v2 SOLO después de
        // que la v2 validó (ADR-009); hasta entonces el original queda intacto.
        if (parsed.migratedFrom === 1) {
          try {
            s.setItem(STORAGE_KEYS.diet, JSON.stringify(parsed.diet));
            log.info({ event: "stored-diet-migrated", from: 1, to: 2 });
          } catch {
            // Cuota llena o modo privado: el plan migrado sirve igual esta vez.
            log.warn({ event: "stored-diet-migrate-write-failed" });
          }
        }
        return { diet: parsed.diet, source: "real" };
      }
      // Corrupto: descartar y volver a demo (solo metadatos al log).
      log.warn(
        { event: "stored-diet-invalid", error: parsed.error },
        "stored diet discarded",
      );
      s.removeItem(STORAGE_KEYS.diet);
      s.removeItem(STORAGE_KEYS.source);
    }
  }
  return { diet: getDemoDietFor(new Date()), source: "demo" };
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
  return storeDiet(parsed.diet, "diet-imported");
}

/** Guarda una dieta ya validada como la real (JSON o PDF revisado). Logs: solo conteos. */
export function storeDiet(
  diet: DietPlan,
  event: "diet-imported" | "diet-saved-from-pdf" = "diet-imported",
): ImportResult {
  const s = storage();
  if (!s) return { ok: false, error: "no-storage" };
  s.setItem(STORAGE_KEYS.diet, JSON.stringify(diet));
  s.setItem(STORAGE_KEYS.source, "real");
  const counts = dietCounts(diet);
  log.info({ event, ...counts });
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
 * "Borrar datos": elimina dieta importada + checklist del día (day-log) + lo que
 * quien cuida anotó del niño (profile-notes) + la revisión a medias de un PDF (plan-draft) y vuelve a demo.
 * Conserva la preferencia de idioma (no es dato del niño).
 */
export function clearAllData(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(STORAGE_KEYS.diet);
  s.removeItem(STORAGE_KEYS.source);
  clearDayLog();
  clearProfileNotes();
  clearPlanDraft();
  log.info({ event: "data-cleared" });
}

// ---------------------------------------------------------------------------
// Preferencias (idioma, disclaimer visto) — no son datos del niño.
// ---------------------------------------------------------------------------

export type Prefs = {
  locale: "es" | "en";
  disclaimerSeen: boolean;
  /** Nota de transparencia IA del chat vista (Sprint 002). */
  chatIntroSeen: boolean;
};

const DEFAULT_PREFS: Prefs = {
  locale: "es",
  disclaimerSeen: false,
  chatIntroSeen: false,
};

export function loadPrefs(): Prefs {
  const raw = storage()?.getItem(STORAGE_KEYS.prefs);
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      locale: parsed.locale === "en" ? "en" : "es",
      disclaimerSeen: parsed.disclaimerSeen === true,
      chatIntroSeen: parsed.chatIntroSeen === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  storage()?.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
}
