"use client";

import { useEffect, useRef, useState } from "react";

import { fmt, useI18n } from "@/i18n";
import { adventureText } from "@/i18n/adventure";
import {
  canExit,
  HOLD_MS,
  makeChallenge,
  wordsOf,
  type Challenge,
} from "@/lib/adventure/adult-exit";

import { Glyph } from "./glyph";

/**
 * La salida del adulto (S14 · ADR-020 · G-Plan 2a): mantener pulsado dos segundos y, después,
 * una suma escrita en palabras con el teclado numérico. Un toque suelto no hace nada. Sin las
 * dos cosas, `onLeave` no se llama jamás (prueba en `tests/unit/adventure.test.ts`).
 */
export function AdultExit({ onLeave }: { onLeave: () => void }) {
  const { locale } = useI18n();
  const t = adventureText[locale];
  const [phase, setPhase] = useState<"idle" | "holding" | "asking">("idle");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPhase((p) => (p === "holding" ? "idle" : p));
  };
  const start = () => {
    if (phase === "asking" || timer.current) return;
    setPhase("holding");
    timer.current = setTimeout(() => {
      timer.current = null;
      held.current = true;
      setChallenge(makeChallenge());
      setAnswer("");
      setWrong(false);
      setPhase("asking");
    }, HOLD_MS);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const close = () => {
    held.current = false;
    setPhase("idle");
    setChallenge(null);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      challenge &&
      canExit({
        heldMs: held.current ? HOLD_MS : 0,
        challenge,
        input: answer,
      })
    ) {
      onLeave();
      return;
    }
    setWrong(true);
  };

  return (
    <>
      <button
        type="button"
        data-testid="adult-exit"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) start();
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") stop();
        }}
        className="flex min-h-11 select-none touch-none items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-semibold text-muted-foreground"
      >
        <Glyph name="lock" className="size-4" />
        <span className="flex flex-col items-start leading-tight">
          {t.exit}
          <span className="text-xs font-normal" role="status">
            {phase === "holding" ? t.exitHolding : t.exitHold}
          </span>
        </span>
      </button>

      {phase === "asking" && challenge && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim p-4 sm:items-center"
          data-testid="adult-exit-dialog"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            className="w-full max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-lg"
          >
            <form onSubmit={submit} className="flex flex-col gap-3">
              <h2 id="exit-title" className="text-xl">
                {t.exitTitle}
              </h2>
              <p>
                {fmt(t.exitSum, {
                  a: wordsOf(challenge.a, locale),
                  b: wordsOf(challenge.b, locale),
                })}
              </p>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {t.exitField}
                <input
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value.replace(/\D/g, "").slice(0, 3));
                    setWrong(false);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoFocus
                  data-testid="adult-exit-input"
                  className="min-h-12 rounded-xl border bg-background px-3 text-lg"
                />
              </label>
              {wrong && (
                <p role="status" className="text-sm font-semibold">
                  {t.exitWrong}
                </p>
              )}
              <button
                type="submit"
                data-testid="adult-exit-confirm"
                className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
              >
                {t.exitConfirm}
              </button>
              <button
                type="button"
                onClick={close}
                className="min-h-12 rounded-xl border px-4 font-semibold"
              >
                {t.exitStay}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
