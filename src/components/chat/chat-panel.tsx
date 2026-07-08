"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, TriangleAlert } from "lucide-react";

import { VerdictCard } from "@/components/chat/verdict-card";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { useDiet } from "@/components/diet-provider";
import { useToday } from "@/components/day-checklist/use-today";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

/**
 * Panel interactivo del chat. Su primer render (hilo vacío + sugerencias) es
 * idéntico en servidor y cliente → el candidato LCP (título/sugerencias) nace
 * estático, sin motion desde opacity:0 (patrón lcp-nace-estatico).
 */
export function ChatPanel() {
  const { diet } = useDiet();
  const { t, locale } = useI18n();
  const today = useToday();
  const { entries, status, send, dismissError, aiEnabled } = useChatThread(
    diet,
    locale,
    today,
  );
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries, status]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput("");
    void send(text);
  };

  const suggestions = [t.chat.sugg1, t.chat.sugg2, t.chat.sugg3];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">{t.chat.title}</h1>
        <p className="text-sm text-muted-foreground">{t.chat.intro}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span
            aria-hidden
            className={
              aiEnabled
                ? "size-2 rounded-full bg-tl-green"
                : "size-2 rounded-full bg-muted-foreground/50"
            }
          />
          {aiEnabled ? t.settings.aiStatusEnabled : t.settings.aiStatusDisabled}
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
              onClick={() => void send(s)}
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
            // assistant (ai | rejection)
            return (
              <li key={entry.id} className="flex flex-col gap-1">
                <div className="max-w-[92%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm leading-relaxed">
                  {entry.text || (
                    <span className="text-muted-foreground">
                      {t.chat.thinking}
                    </span>
                  )}
                </div>
                {entry.kind === "ai" && entry.text && (
                  <span className="inline-flex items-center gap-1 pl-1 text-xs font-medium text-muted-foreground">
                    <Sparkles aria-hidden className="size-3" />
                    {t.chat.aiBadge} · {t.chat.aiDisclaimer}
                  </span>
                )}
              </li>
            );
          })}
          <div ref={endRef} />
        </ol>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">{t.chat.errorTitle}</p>
            <p className="mt-0.5">{t.chat.errorBody}</p>
            <button
              type="button"
              onClick={dismissError}
              className="mt-1 min-h-11 text-xs font-semibold underline"
            >
              OK
            </button>
          </div>
        </div>
      )}
      {status === "disabled" && (
        <div
          role="status"
          className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          <p className="font-semibold text-foreground">
            {t.chat.disabledTitle}
          </p>
          <p className="mt-0.5">{t.chat.disabledBody}</p>
        </div>
      )}

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
          className="h-12 flex-1 rounded-xl border bg-card px-4 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          size="lg"
          className="h-12 w-12 shrink-0 p-0"
          disabled={status === "streaming" || input.trim().length === 0}
          aria-label={t.chat.send}
        >
          <Send aria-hidden className="size-5" />
        </Button>
      </form>
    </div>
  );
}
