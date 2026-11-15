"use client";

import { Check, CircleDashed, Info } from "lucide-react";

import { useI18n } from "@/i18n";
import type { OpenAnswer } from "@/lib/diet/answer";
import { composeAnswer } from "@/lib/diet/answer-text";

/**
 * Respuesta abierta del chat, armada con datos del plan (ADR-008). Sin lógica:
 * el motor decide, `composeAnswer` redacta y esta tarjeta solo presenta.
 * `accent` es la frase re-redactada por el modelo del aparato, ya validada.
 */
export function AnswerCard({
  answer,
  accent,
}: {
  answer: OpenAnswer;
  accent: string | null;
}) {
  const { t, locale } = useI18n();
  const c = composeAnswer(answer, t.answer, locale);

  return (
    <article
      className="flex max-w-[92%] flex-col gap-2 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm leading-relaxed"
      data-answer={answer.kind}
    >
      <p className="flex items-start gap-2">
        {c.notInPlan && (
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span>{accent ?? c.lead}</span>
      </p>
      {c.items.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {c.itemsTitle}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {c.items.map((item, i) => (
              <li key={`${i}-${item.text}`} className="flex items-center gap-2">
                {item.marked ? (
                  <CircleDashed
                    aria-hidden
                    className="size-4 shrink-0 text-foreground"
                  />
                ) : (
                  <Check aria-hidden className="size-4 shrink-0 text-tl-green" />
                )}
                <span>
                  {item.text}
                  {item.marked && (
                    <span className="ml-1.5 text-muted-foreground">
                      · {t.texture.notAccepted}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.next && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {c.next.title}
          </p>
          <p className="mt-0.5">{c.next.text}</p>
        </div>
      )}
    </article>
  );
}
