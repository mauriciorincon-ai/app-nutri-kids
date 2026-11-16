"use client";

import { useEffect } from "react";

import { useDiet } from "@/components/diet-provider";
import { useI18n } from "@/i18n";
import { getFamily } from "@/lib/family/controller";
import { subscribe } from "@/lib/local-store";
import { configurePush, getPush } from "@/lib/push/controller";

/**
 * Mantiene al día los avisos mientras la app está abierta: al abrir, al cambiar el plan o el
 * idioma, tras cada marca, tras cada sincronía de la familia y al volver a la app. No pinta
 * nada y, sin avisos prendidos, no hace ninguna llamada a la red.
 */
export function PushSync() {
  const { diet } = useDiet();
  const { locale } = useI18n();

  useEffect(() => {
    configurePush(diet, locale);
    const push = getPush();
    void push.init();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void push.refresh(), 600);
    };
    const offStore = subscribe(soon);
    const offFamily = getFamily().subscribe(soon);
    const onVisible = () => {
      if (document.visibilityState === "visible") soon();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      offStore();
      offFamily();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [diet, locale]);

  return null;
}
