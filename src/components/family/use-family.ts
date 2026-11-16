"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useI18n } from "@/i18n";
import { getFamily, OFF_VIEW, type FamilyView } from "@/lib/family/controller";

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
      const phone = view.phones.find((p) => p.id === id);
      return phone?.name
        ? t.family.by.replace("{name}", phone.name)
        : undefined;
    },
    [view, t],
  );
}
