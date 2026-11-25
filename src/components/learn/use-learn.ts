"use client";

import { useMemo, useSyncExternalStore } from "react";

import { useFamily } from "@/components/family/use-family";
import { useI18n } from "@/i18n";
import { learnText, type LearnText } from "@/i18n/learn";
import { getAgeBand } from "@/lib/diet/profile-notes";
import { listInsightDays, type InsightDay } from "@/lib/diet/day-log";
import type { Joiner } from "@/lib/insights/newcomer";
import { readTwinSince } from "@/lib/insights/twin-store";
import { useLocalStore } from "@/lib/local-store";
import { visibleEntries, type Viewer } from "@/lib/pressure/pattern";
import {
  readPressure,
  subscribePressure,
  type PressureStore,
} from "@/lib/pressure/store";
import type { PressureEntry } from "@/lib/pressure/values";
import type { AgeBand } from "@/lib/wellbeing/values";

/** Los textos de «Lo que aprende» en el idioma activo (aparte del diccionario compartido). */
export function useLearnText(): LearnText {
  const { locale } = useI18n();
  return learnText[locale];
}

const NO_DAYS: InsightDay[] = [];
/** Todos los días del registro, leídos una sola vez (marcas, notas y bienestar). */
export function useInsightDays(): InsightDay[] {
  return useLocalStore(listInsightDays, NO_DAYS);
}

/** Desde cuándo cuenta el gemelo (el último «Borrar lo aprendido»), o null. */
export function useTwinSince(): string | null {
  return useLocalStore(readTwinSince, null);
}

const NO_BAND = null;
export function useAgeBandId(): AgeBand | null {
  return useLocalStore(getAgeBand, NO_BAND)?.band ?? null;
}

/** Quién mira: con familia, su rol; sin familia, el único teléfono (lo ve todo). */
export function useViewer(): Viewer {
  const view = useFamily();
  const inFamily = view.phase !== "off";
  return useMemo(() => ({ inFamily, role: view.role }), [inFamily, view.role]);
}

/** Quién entró a la familia y cuándo, para calcular «alguien nuevo». */
export function useJoiners(): Joiner[] {
  const view = useFamily();
  return useMemo(
    () => view.members.map((m) => ({ id: m.id, joined: m.joined })),
    [view.members],
  );
}

const NO_PRESSURE: PressureStore = { own: [], others: {} };
const readNow = () => readPressure();
const serverPressure = () => NO_PRESSURE;

/** Lo que le ofrecieron al niño, según lo que este teléfono puede ver (madre o padre: todo). */
export function usePressureEntries(viewer: Viewer): PressureEntry[] {
  const store = useSyncExternalStore(
    subscribePressure,
    readNow,
    serverPressure,
  );
  return useMemo(() => visibleEntries(store, viewer), [store, viewer]);
}
