"use client";

import { useMemo, useSyncExternalStore } from "react";

import { getDoneIds, toggleDone } from "@/lib/diet/day-log";
import { dateKey } from "@/lib/diet/logic";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";

/**
 * Fecha viva del dispositivo: null hasta hidratar (el prerender no conoce el
 * día real) y se refresca al volver a la pestaña (cruce de medianoche incluido).
 * El snapshot es el dateKey (string): solo re-renderiza cuando CAMBIA el día.
 */

function subscribeToDayChange(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

export function useToday(): Date | null {
  const key = useSyncExternalStore(
    subscribeToDayChange,
    () => dateKey(new Date()),
    () => "",
  );
  // Mediodía local: los cálculos del motor son a nivel de día (weekday/fecha).
  return useMemo(() => (key ? new Date(`${key}T12:00:00`) : null), [key]);
}

const NO_MARKS: string[] = [];

/** Marcas del día con persistencia (day-log), sincronizadas vía local-store. */
export function useDayLog(today: Date | null) {
  const doneIds = useLocalStore(
    () => (today ? getDoneIds(today) : NO_MARKS),
    NO_MARKS,
    today ? dateKey(today) : "",
  );

  const toggle = (checkId: string) => {
    if (!today) return;
    toggleDone(today, checkId);
    notifyLocalStore();
  };

  return { doneIds, toggle };
}
