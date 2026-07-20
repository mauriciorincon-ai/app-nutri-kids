"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  getDayRecord,
  getDoneIds,
  setNote,
  toggleDone,
  type DayNote,
  type DayRecord,
} from "@/lib/diet/day-log";
import { trackMark, trackNote } from "@/lib/diet/day-events";
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

/**
 * Instante vivo con hora (para el recordatorio "qué toca AHORA"). null hasta
 * hidratar; tras hidratar refresca cada minuto y al volver a la pestaña. A
 * diferencia de useToday, conserva la HORA — por eso vive aparte y solo lo usa
 * el bloque de recordatorio (no re-renderiza todo "Hoy" cada minuto).
 * Mockeable con el clock de Playwright (controla `new Date()` en e2e).
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

const EMPTY_RECORD: DayRecord = { marks: {}, notes: {} };

/**
 * Registro del día con persistencia (day-log v2), sincronizado vía local-store.
 * Devuelve el registro completo (marcas con hora + notas), los checkIds hechos
 * (compatibilidad), y las acciones marcar/desmarcar y guardar-nota.
 */
export function useDayLog(today: Date | null) {
  const record = useLocalStore(
    () => (today ? getDayRecord(today) : EMPTY_RECORD),
    EMPTY_RECORD,
    today ? dateKey(today) : "",
  );
  const doneIds = useMemo(() => Object.keys(record.marks), [record]);

  const toggle = (checkId: string) => {
    if (!today) return;
    const wasDone = getDoneIds(today).includes(checkId);
    toggleDone(today, checkId);
    notifyLocalStore();
    if (!wasDone) trackMark(checkId); // evento solo al MARCAR, jamás al desmarcar
  };

  const saveNote = (checkId: string, note: DayNote | null) => {
    if (!today) return;
    setNote(today, checkId, note);
    notifyLocalStore();
    if (note && (note.chips.length > 0 || note.text.trim().length > 0)) {
      trackNote(note);
    }
  };

  return { record, doneIds, toggle, saveNote };
}
