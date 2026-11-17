"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";

import { AnswerCard } from "@/components/chat/answer-card";
import { useDiet } from "@/components/diet-provider";
import { useProfileNotes } from "@/components/use-profile-notes";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import type { OpenAnswer } from "@/lib/diet/answer";
import { allItemIds, resolveItemStatus } from "@/lib/diet/logic";
import { planB, planBOut, type PlanB, type Situation } from "@/lib/diet/plan-b";
import { cn } from "@/lib/utils";

/** El plan B como una respuesta del chat: así Hoy y el chat dicen lo mismo, con las mismas palabras. */
function asAnswer(p: PlanB): OpenAnswer {
  if (p.situation === "out" && p.kind === "options")
    return { kind: "replacement", food: p.food, options: p.options };
  if (p.situation === "out" && p.kind === "not-in-plan")
    return {
      kind: "not-in-plan",
      reason: p.reason === "no-options" ? "no-options" : "unknown-food",
      food: p.food,
    };
  return { kind: "plan-b", plan: p };
}

/**
 * Plan B en Hoy (S9 · ADR-014): «se acabó…», «no hay nevera» y «llegamos tarde» proponen SOLO
 * lo que el plan cargado ya dice; si no lo dice, lo dice. Sin lógica propia: decide
 * `lib/diet/plan-b`, redacta `composeAnswer`.
 */
export function PlanBCard() {
  const { diet } = useDiet();
  const { t, l, locale } = useI18n();
  const notes = useProfileNotes();
  const [open, setOpen] = useState<Situation | null>(null);
  const [answer, setAnswer] = useState<OpenAnswer | null>(null);

  const marks = notes.notes
    .filter((n) => n.kind === "fridge")
    .map((n) => n.text.trim().toLocaleLowerCase("es"));

  const choose = (s: Situation) => {
    setOpen(s);
    setAnswer(
      s === "out"
        ? null
        : asAnswer(
            planB(s, diet, new Date(), {
              marks,
              accepted: notes.acceptedTextures,
            }),
          ),
    );
  };

  const foods = allItemIds(diet)
    .map((id) => resolveItemStatus(diet, id, new Date()))
    .filter((s) => s !== null)
    .map((s) => ({ id: s.id, name: l(s.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const buttons: { s: Situation; label: string }[] = [
    { s: "out", label: t.planB.out },
    { s: "no-fridge", label: t.planB.fridge },
    { s: "late", label: t.planB.late },
  ];

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4"
      aria-labelledby="planb-title"
      data-testid="plan-b"
    >
      <h2
        id="planb-title"
        className="flex items-center gap-1.5 text-lg text-muted-foreground"
      >
        <LifeBuoy aria-hidden className="size-4" />
        {t.planB.title}
      </h2>
      <p className="-mt-1 text-sm text-muted-foreground">{t.planB.intro}</p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t.planB.title}
      >
        {buttons.map(({ s, label }) => (
          <Button
            key={s}
            type="button"
            variant="outline"
            aria-pressed={open === s}
            data-testid={`planb-${s}`}
            className={cn(
              "min-h-11",
              open === s && "border-2 border-foreground bg-muted font-semibold",
            )}
            onClick={() => choose(s)}
          >
            {open === s && <span aria-hidden>✓ </span>}
            {label}
          </Button>
        ))}
      </div>

      {open === "out" && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t.planB.pickFood}
          <select
            className="min-h-11 rounded-lg border bg-card px-3 font-normal"
            data-testid="planb-food"
            defaultValue=""
            onChange={(e) =>
              setAnswer(
                e.target.value
                  ? asAnswer(
                      planBOut(
                        diet,
                        e.target.value,
                        new Date(),
                        notes.acceptedTextures,
                      ),
                    )
                  : null,
              )
            }
          >
            <option value="">{t.planB.pickPlaceholder}</option>
            {foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {answer && (
        <div aria-live="polite" data-testid="planb-answer">
          <AnswerCard answer={answer} accent={null} />
        </div>
      )}
    </section>
  );
}
