"use client";

import { useCallback, useRef, useState } from "react";

import type { DietPlan } from "@/lib/diet/schema";
import { matchLookup, type LocalVerdict } from "@/lib/diet/search";

/**
 * Hilo del chat: la única fuente de verdad de la conversación (efímera, en
 * memoria — NO se persiste, decisión de privacidad del S2).
 *
 * Enruta cada envío entre los dos caminos:
 *  - Camino A (lookup local): `matchLookup` responde al instante, SIN tocar la
 *    red. La entrada `verdict` lleva la tarjeta de veredicto.
 *  - Camino B (pregunta abierta): POST a `/api/chat` y se va acumulando el
 *    streaming (SSE del UIMessageStream) en la entrada `assistant`.
 *
 * Se hace con fetch manual (no `useChat`) para tener UN hilo unificado que
 * intercala veredictos locales y respuestas del LLM, y control exacto de cuándo
 * se llama a `/api/chat` (los lookups NUNCA lo llaman — lo verifica el e2e).
 */
export type Entry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "verdict"; verdict: LocalVerdict }
  | { id: string; role: "assistant"; text: string; kind: "ai" | "rejection" };

export type ChatStatus = "idle" | "streaming" | "error" | "disabled";

const AI_ENABLED = process.env.NEXT_PUBLIC_CHAT_ENABLED === "true";

export function useChatThread(
  diet: DietPlan,
  locale: "es" | "en",
  today: Date | null,
) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const counter = useRef(0);
  const nextId = () => `e${counter.current++}`;

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || status === "streaming") return;
      const date = today ?? new Date();

      setEntries((prev) => [...prev, { id: nextId(), role: "user", text }]);

      // Camino A — lookup local (sin red).
      const verdict = matchLookup(diet, text, locale, date);
      if (verdict) {
        setEntries((prev) => [
          ...prev,
          { id: nextId(), role: "verdict", verdict },
        ]);
        return;
      }

      // Kill-switch conocido en cliente: ni siquiera intentamos la red.
      if (!AI_ENABLED) {
        setStatus("disabled");
        return;
      }

      // Camino B — LLM en streaming.
      setStatus("streaming");
      const assistantId = nextId();
      setEntries((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", text: "", kind: "ai" },
      ]);

      const appendDelta = (delta: string) =>
        setEntries((prev) =>
          prev.map((e) =>
            e.id === assistantId && e.role === "assistant"
              ? { ...e, text: e.text + delta }
              : e,
          ),
        );
      const dropEmptyAssistant = () =>
        setEntries((prev) =>
          prev.filter(
            (e) =>
              !(
                e.id === assistantId &&
                e.role === "assistant" &&
                e.text === ""
              ),
          ),
        );

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: [
              { id: "u", role: "user", parts: [{ type: "text", text }] },
            ],
            diet,
            locale,
          }),
        });

        if (res.status === 503) {
          dropEmptyAssistant();
          setStatus("disabled");
          return;
        }
        if (!res.ok || !res.body) {
          dropEmptyAssistant();
          setStatus("error");
          return;
        }

        // Un rechazo de guardrail (médico/off-topic) llega como texto estático
        // con este header → se pinta sin la etiqueta "Respuesta de IA".
        const outcome = res.headers.get("x-chat-outcome");
        if (outcome === "medical" || outcome === "off-topic") {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === assistantId && e.role === "assistant"
                ? { ...e, kind: "rejection" }
                : e,
            ),
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[done]") continue;
            try {
              const evt = JSON.parse(payload) as {
                type?: string;
                delta?: string;
              };
              if (evt.type === "text-delta" && typeof evt.delta === "string") {
                appendDelta(evt.delta);
              }
            } catch {
              // líneas de control del SSE → se ignoran
            }
          }
        }
        setStatus("idle");
      } catch {
        dropEmptyAssistant();
        setStatus("error");
      }
    },
    [diet, locale, today, status],
  );

  const dismissError = useCallback(() => setStatus("idle"), []);

  return { entries, status, send, dismissError, aiEnabled: AI_ENABLED };
}
