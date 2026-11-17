import { parseDietJson, type DietPlan } from "./schema";

/**
 * El segundo plan (S9 · ADR-014): vive aparte, en su propia clave, hasta que un padre lo
 * une con el plan activo o lo descarta; en los dos casos se borra. Así dos planes no
 * duplican lo que se guarda. Solo en este teléfono: no se comparte con la familia (lo que
 * se comparte es el plan unido, ya firmado por quien lo unió). Lo que se lee pasa por Zod.
 * «Borrar datos» lo elimina.
 */
export const SECOND_PLAN_SLOT = "nutrikids.second-plan.v1";
/** Marca de «el próximo plan que cargue es el segundo» (se limpia al guardarlo o descartarlo). */
export const LOAD_SECOND_FLAG = "nutrikids.load-second.v1";

/** El almacén del aparato, o null si no hay o el navegador lo niega (modo privado, datos bloqueados). */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadSecondPlan(): DietPlan | null {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(SECOND_PLAN_SLOT) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  const parsed = parseDietJson(raw);
  return parsed.ok ? parsed.diet : null;
}

/** Guarda un plan ya validado como segundo plan. false si no cabe (cuota llena o sin storage). */
export function storeSecondPlan(diet: DietPlan): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(SECOND_PLAN_SLOT, JSON.stringify(diet));
    s.removeItem(LOAD_SECOND_FLAG);
    return true;
  } catch {
    return false;
  }
}

export function clearSecondPlan(): void {
  try {
    const s = storage();
    s?.removeItem(SECOND_PLAN_SLOT);
    s?.removeItem(LOAD_SECOND_FLAG);
  } catch {
    /* sin almacén no hay nada que borrar */
  }
}

export function isLoadingSecond(): boolean {
  try {
    return storage()?.getItem(LOAD_SECOND_FLAG) === "1";
  } catch {
    return false;
  }
}

export function setLoadingSecond(on: boolean): void {
  const s = storage();
  if (!s) return;
  try {
    if (on) s.setItem(LOAD_SECOND_FLAG, "1");
    else s.removeItem(LOAD_SECOND_FLAG);
  } catch {
    /* cuota llena o almacén negado: la marca simplemente no queda */
  }
}
