"use client";

import { useSyncExternalStore } from "react";

import { getPush, OFF_PUSH_VIEW, type PushView } from "@/lib/push/controller";

const subscribe = (l: () => void) => getPush().subscribe(l);
const snapshot = () => getPush().getView();
const server = () => OFF_PUSH_VIEW;

/** El estado de los avisos en este teléfono. Cambia solo cuando algo cambia. */
export function usePush(): PushView {
  return useSyncExternalStore(subscribe, snapshot, server);
}
