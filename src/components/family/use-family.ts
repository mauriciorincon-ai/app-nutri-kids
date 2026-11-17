"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useI18n } from "@/i18n";
import { getFamily, OFF_VIEW, type FamilyView } from "@/lib/family/controller";
import { may, type Write } from "@/lib/family/roster";

const subscribe = (l: () => void) => getFamily().subscribe(l);
const snapshot = () => getFamily().getView();
const server = () => OFF_VIEW;

/** El estado de la familia en este teléfono. Cambia solo cuando algo cambia. */
export function useFamily(): FamilyView {
  return useSyncExternalStore(subscribe, snapshot, server);
}

/**
 * «Por <nombre>»: quién hizo una marca. Solo hay etiqueta si este teléfono está en una familia
 * y se conoce el nombre de quien la hizo; si no, la app se ve igual que siempre.
 */
export function useWho(): (id: string | undefined) => string | undefined {
  const view = useFamily();
  const { t } = useI18n();
  return useCallback(
    (id) => {
      if (!id || view.phase === "off") return undefined;
      const name =
        view.members.find((m) => m.id === id)?.name ??
        view.phones.find((p) => p.id === id)?.name;
      return name ? t.family.by.replace("{name}", name) : undefined;
    },
    [view, t],
  );
}

/**
 * ¿Puede este teléfono escribir esto? (S9 · ADR-013). Sin familia, todo. En una familia, lo
 * que dice su rol; sin rol todavía, nada. Es la MISMA regla que usa la sincronía para
 * descartar lo ajeno: la pantalla solo evita que alguien escriba algo que nadie aceptaría.
 */
export function useCan(): (w: Write) => boolean {
  const view = useFamily();
  return useCallback(
    (w) =>
      view.phase === "off"
        ? true
        : may(view.role ? { role: view.role, meals: view.meals } : null, w),
    [view],
  );
}
