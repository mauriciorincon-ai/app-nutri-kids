"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { answerQuestion, type OpenAnswer } from "@/lib/diet/answer";
import { composeAnswer, type AnswerTemplates } from "@/lib/diet/answer-text";
import type { DietPlan } from "@/lib/diet/schema";
import type { LocalVerdict } from "@/lib/diet/search";
import { accentWithDevice, hasDeviceModel } from "@/lib/ia/device-accent";

/**
 * Hilo del chat: la única fuente de verdad de la conversación (efímera, en
 * memoria — NO se persiste, decisión de privacidad del S2).
 *
 * Código primero (ADR-008): cada pregunta la contesta `answerQuestion` en el
 * teléfono, sin red. Si el navegador trae un modelo propio en el aparato, se le
 * pide re-redactar la frase principal DESPUÉS de mostrar la respuesta del código;
 * si no hay modelo o su salida no pasa el esquema, se queda la del código.
 */
export type Entry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "verdict"; verdict: LocalVerdict }
  | { id: string; role: "open"; answer: OpenAnswer; accent: string | null }
  | { id: string; role: "rejection"; reason: "medical" | "off-topic" };

const systemNow = () => new Date();

export function useChatThread(
  diet: DietPlan,
  locale: "es" | "en",
  templates: AnswerTemplates,
  /** Reloj inyectable: «¿qué le doy ahora?» depende de la HORA del envío. */
  now: () => Date = systemNow,
) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const counter = useRef(0);
  const nextId = () => `e${counter.current++}`;

  // Calienta la consulta «¿hay modelo en el aparato?» al abrir el chat (se hace una
  // sola vez por página): así ninguna respuesta la deja en vuelo al cambiar de pantalla.
  useEffect(() => {
    void hasDeviceModel(locale);
  }, [locale]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const result = answerQuestion(text, diet, now(), locale);
      const id = nextId();
      const reply: Entry =
        result.kind === "verdict"
          ? { id, role: "verdict", verdict: result.verdict }
          : result.kind === "rejection"
            ? { id, role: "rejection", reason: result.reason }
            : { id, role: "open", answer: result.answer, accent: null };

      setEntries((prev) => [
        ...prev,
        { id: nextId(), role: "user", text },
        reply,
      ]);

      if (reply.role !== "open" || reply.answer.kind === "not-in-plan") return;
      const composed = composeAnswer(reply.answer, templates, locale);
      void accentWithDevice(composed.lead, composed.required, locale).then(
        (accent) => {
          if (!accent) return;
          setEntries((prev) =>
            prev.map((e) =>
              e.id === id && e.role === "open" ? { ...e, accent } : e,
            ),
          );
        },
      );
    },
    [diet, locale, templates, now],
  );

  return { entries, send };
}
