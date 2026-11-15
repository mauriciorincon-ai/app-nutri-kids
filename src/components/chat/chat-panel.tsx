"use client";

import { useEffect, useRef, useState } from "react";
import { Send, WifiOff } from "lucide-react";

import { AnswerCard } from "@/components/chat/answer-card";
import { VerdictCard } from "@/components/chat/verdict-card";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { useDiet } from "@/components/diet-provider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { MAX_INPUT_CHARS, rejectionMessage } from "@/lib/diet/guardrails";

/**
 * Panel interactivo del chat. Su primer render (hilo vacío + sugerencias) es
 * idéntico en servidor y cliente → el candidato LCP (título/sugerencias) nace
 * estático, sin motion desde opacity:0 (patrón lcp-nace-estatico).
 */
export function ChatPanel() {
  const { diet } = useDiet();
  const { t, locale } = useI18n();
  const { entries, send } = useChatThread(diet, locale, t.answer);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput("");
    send(text);
  };

  const suggestions = [t.chat.sugg1, t.chat.sugg2, t.chat.sugg3, t.chat.sugg4];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">{t.chat.title}</h1>
        <p className="text-sm text-muted-foreground">{t.chat.intro}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <WifiOff aria-hidden className="size-3.5" />
          {t.chat.offlineStatus}
        </p>
      </header>

      {entries.length === 0 ? (
        <section
          aria-labelledby="chat-suggestions"
          className="flex flex-col gap-2"
        >
          <p id="chat-suggestions" className="text-sm font-semibold">
            {t.chat.emptyHint}
          </p>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="min-h-11 rounded-xl border bg-card px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </section>
      ) : (
        <ol
          aria-live="polite"
          aria-label={t.chat.title}
          className="flex flex-col gap-3"
        >
          {entries.map((entry) => {
            if (entry.role === "user") {
              return (
                <li key={entry.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
                    {entry.text}
                  </p>
                </li>
              );
            }
            if (entry.role === "verdict") {
              return (
                <li key={entry.id} className="flex flex-col gap-1">
                  <VerdictCard verdict={entry.verdict} />
                  <span className="pl-1 text-xs font-medium text-muted-foreground">
                    {t.chat.fromPlanBadge}
                  </span>
                </li>
              );
            }
            if (entry.role === "open") {
              return (
                <li key={entry.id} className="flex flex-col gap-1">
                  <AnswerCard answer={entry.answer} accent={entry.accent} />
                  <span className="pl-1 text-xs font-medium text-muted-foreground">
                    {entry.accent ? t.chat.deviceBadge : t.chat.fromPlanBadge}
                  </span>
                </li>
              );
            }
            return (
              <li key={entry.id} className="flex flex-col gap-1">
                <p className="max-w-[92%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm leading-relaxed">
                  {rejectionMessage(entry.reason, locale)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      <div ref={endRef} />

      <form
        onSubmit={submit}
        className="sticky bottom-20 flex gap-2 lg:bottom-2"
      >
        <label htmlFor="chat-input" className="sr-only">
          {t.chat.inputPlaceholder}
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.chat.inputPlaceholder}
          autoComplete="off"
          maxLength={MAX_INPUT_CHARS}
          className="h-12 flex-1 rounded-xl border bg-card px-4 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          size="lg"
          className="h-12 w-12 shrink-0 p-0"
          disabled={input.trim().length === 0}
          aria-label={t.chat.send}
        >
          <Send aria-hidden className="size-5" />
        </Button>
      </form>
    </div>
  );
}
