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
  // El día también rueda con la pestaña ABIERTA: un tick por minuto detecta el
  // cruce de medianoche sin depender de re-renders de otros componentes (así
  // "Hoy" amanece vacío y el historial deja de rotularse "Hoy" solos, sin reload).
  const id = window.setInterval(listener, 60_000);
  return () => {
    document.removeEventListener("visibilitychange", listener);
    window.clearInterval(id);
  };
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
 * diferencia de useToday, conserva la HORA — por eso vive aparte y SOLO lo
 * consume ReminderCard (el tick por minuto re-renderiza esa tarjeta, no toda
 * "Hoy"; el rollover del día lo lleva `subscribeToDayChange` por su cuenta).
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

  // Si cruzamos la medianoche con la pestaña abierta (antes de que el día ruede
  // en pantalla), la escritura pertenece al día REAL, no al que renderizó este
  // árbol — así una marca a las 00:00:30 no cae en el historial de ayer.
  const writeTarget = (): Date => {
    const now = new Date();
    return today && dateKey(now) === dateKey(today) ? today : now;
  };

  const toggle = (checkId: string) => {
    if (!today) return;
    const target = writeTarget();
    // Camino común (mismo día): `record` ya está en scope → sin re-leer el store.
    const wasDone =
      target === today
        ? checkId in record.marks
        : getDoneIds(target).includes(checkId);
    toggleDone(target, checkId);
    notifyLocalStore();
    if (!wasDone) trackMark(checkId); // evento solo al MARCAR, jamás al desmarcar
  };

  const saveNote = (checkId: string, note: DayNote | null) => {
    if (!today) return;
    setNote(writeTarget(), checkId, note);
    notifyLocalStore();
    if (note && (note.chips.length > 0 || note.text.trim().length > 0)) {
      trackNote(note);
    }
  };

  return { record, doneIds, toggle, saveNote };
}
