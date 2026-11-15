import { parseReviewState, type ReviewState } from "./plan-review";

/**
 * El borrador de la revisión del PDF (ADR-010): solo el plan estructurado y la marca de
 * cada sección, jamás el PDF ni identidad, medidas, resultados o contacto (el lector ya
 * los descartó). Clave propia: «Borrar datos» la elimina y un plan guardado la libera.
 */
export const PLAN_DRAFT_KEY = "nutrikids.plan-draft.v1";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function loadPlanDraft(): ReviewState | null {
  try {
    return parseReviewState(storage()?.getItem(PLAN_DRAFT_KEY) ?? null);
  } catch {
    return null;
  }
}

export function savePlanDraft(state: ReviewState): boolean {
  try {
    storage()?.setItem(PLAN_DRAFT_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearPlanDraft(): void {
  try {
    storage()?.removeItem(PLAN_DRAFT_KEY);
  } catch {
    // sin storage no hay borrador que borrar
  }
}
