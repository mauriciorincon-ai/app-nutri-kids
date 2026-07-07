"use client";

import { createContext, useContext } from "react";

import type { DietPlan } from "@/lib/diet/schema";
import {
  getDemoDiet,
  loadActiveDiet,
  type ActiveDiet,
  type DietSource,
} from "@/lib/diet/storage";
import {
  notifyLocalStore,
  useHydrated,
  useLocalStore,
} from "@/lib/local-store";

/**
 * Dieta activa (demo↔real) para toda la UI. El servidor prerenderiza con la demo
 * (estática, LCP); al hidratar se lee el almacenamiento del dispositivo.
 * Los componentes NUNCA leen localStorage directo: pasan por aquí o por lib/diet.
 */

type DietContextValue = {
  diet: DietPlan;
  source: DietSource;
  /** Notifica que el almacenamiento cambió (tras importar, cambiar fuente o borrar). */
  refresh: () => void;
  /** false hasta hidratar: la UI evita afirmar "demo" antes de saberlo. */
  ready: boolean;
};

const DietContext = createContext<DietContextValue | null>(null);

// Referencia estable para el snapshot del servidor (exigencia de useSyncExternalStore).
const SERVER_SNAPSHOT: ActiveDiet = { diet: getDemoDiet(), source: "demo" };

export function DietProvider({ children }: { children: React.ReactNode }) {
  const active = useLocalStore(loadActiveDiet, SERVER_SNAPSHOT);
  const ready = useHydrated();

  return (
    <DietContext.Provider
      value={{ ...active, refresh: notifyLocalStore, ready }}
    >
      {children}
    </DietContext.Provider>
  );
}

export function useDiet(): DietContextValue {
  const ctx = useContext(DietContext);
  if (!ctx) throw new Error("useDiet must be used within DietProvider");
  return ctx;
}
