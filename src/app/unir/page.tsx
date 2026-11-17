"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, Layers, Lock, TriangleAlert } from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { RoleLimit } from "@/components/family/role-limit";
import { useCan } from "@/components/family/use-family";
import {
  OriginBadge,
  useOriginName,
  useOriginText,
} from "@/components/merge/origin-badge";
import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import {
  lineLabel,
  reconcile,
  relaxesRed,
  switchLine,
  switchableLines,
  type Choices,
} from "@/lib/diet/reconcile";
import {
  dietCounts,
  type DietPlan,
  type LocalizedText,
} from "@/lib/diet/schema";
import {
  clearSecondPlan,
  loadSecondPlan,
  setLoadingSecond,
} from "@/lib/diet/second-plan";
import { storeDiet } from "@/lib/diet/storage";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import { cn } from "@/lib/utils";

/**
 * Varias dietas (S9 · ADR-014): el segundo plan junto al primero, los choques uno por uno y
 * el plan unido con el origen de cada línea. Solo una madre o un padre une o cambia
 * (la firma de la familia lo hace cumplir; aquí además se esconde lo que no toca).
 */

function Counts({ plan }: { plan: DietPlan }) {
  const { t } = useI18n();
  const c = dietCounts(plan);
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-sm" data-tabular>
      <li>{fmt(t.load.countGroups, { n: c.greenGroups })}</li>
      <li>{fmt(t.load.countRestricted, { n: c.restrictedFoods })}</li>
      <li>{fmt(t.load.countAdditives, { n: c.additives })}</li>
      <li>{fmt(t.load.countSupplements, { n: c.supplements })}</li>
      <li>{fmt(t.load.countMeals, { n: c.meals })}</li>
    </ul>
  );
}

function Panel({ title, plan }: { title: string; plan: DietPlan }) {
  const { l } = useI18n();
  return (
    <div
      className="rounded-xl border bg-card px-3 py-3"
      data-testid="plan-side"
    >
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="mt-0.5 font-heading text-base font-semibold leading-snug">
        {l(plan.meta.title)}
      </p>
      <p className="text-xs leading-snug text-muted-foreground">
        {l(plan.meta.source)}
      </p>
      <Counts plan={plan} />
    </div>
  );
}

function MergePanel({ a, b }: { a: DietPlan; b: DietPlan }) {
  const { t, l } = useI18n();
  const { refresh } = useDiet();
  const [choices, setChoices] = useState<Choices>({});
  const [status, setStatus] = useState<
    "idle" | "merged" | "error" | "discarded"
  >("idle");
  const r = useMemo(() => reconcile(a, b, choices), [a, b, choices]);
  const lines = r.plan.merged!.lines;
  const redLines = Object.entries(lines).filter(
    ([, line]) => line.rule === "red",
  );
  const origin = useOriginName();

  const merge = () => {
    if (r.pending.length > 0 || !r.valid) return;
    const stored = storeDiet(r.plan, "diet-merged");
    if (!stored.ok) return setStatus("error");
    clearSecondPlan();
    refresh();
    notifyLocalStore();
    setStatus("merged");
  };
  const discard = () => {
    clearSecondPlan();
    notifyLocalStore();
    setStatus("discarded");
  };

  if (status === "merged")
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-xl bg-tl-green-surface px-4 py-3 text-sm font-semibold text-tl-green"
      >
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t.merge.merged}
      </p>
    );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2" aria-labelledby="side-title">
        <h2 id="side-title" className="text-lg">
          {t.merge.sideTitle}
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Panel title={t.merge.planAActive} plan={a} />
          <Panel title={t.merge.planBSecond} plan={b} />
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="red-title">
        <h2 id="red-title" className="text-lg">
          {t.merge.redTitle}
        </h2>
        <p className="-mt-1 text-sm text-muted-foreground">{t.merge.redBody}</p>
        {redLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.merge.redNone}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="merge-red">
            {redLines.map(([key, line]) => (
              <li
                key={key}
                className="flex items-start gap-2 rounded-xl bg-tl-red-surface px-4 py-3 text-sm font-semibold text-tl-red"
              >
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                {key === "restrictions"
                  ? t.merge.redWindow
                  : fmt(t.merge.redLine, {
                      food: l(lineLabel(r.plan, key) ?? { es: key, en: key }),
                      origin: origin(
                        r.plan.merged!,
                        line.from === "b" ? "b" : "a",
                      ),
                    })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="pick-title">
        <h2 id="pick-title" className="text-lg">
          {t.merge.pickTitle}
        </h2>
        <p className="-mt-1 text-sm text-muted-foreground">
          {t.merge.pickBody}
        </p>
        {r.conflicts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.merge.pickNone}</p>
        )}
        <ul className="flex flex-col gap-3" data-testid="merge-conflicts">
          {r.conflicts.map((c) => {
            const chosen = choices[c.key];
            return (
              <li
                key={c.key}
                className="rounded-xl border bg-card px-3 py-3"
                data-testid={`conflict-${c.key}`}
              >
                <p className="font-semibold">
                  {l(c.label)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {t.merge[`kinds_${c.kind}`]}
                  </span>
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  {(["a", "b"] as const).map((side) => {
                    const on = chosen === side;
                    return (
                      <Button
                        key={side}
                        type="button"
                        variant="outline"
                        aria-pressed={on}
                        data-testid={`pick-${c.key}-${side}`}
                        className={cn(
                          "h-auto min-h-11 flex-col items-start gap-0.5 whitespace-normal py-2 text-left",
                          on && "border-2 border-foreground bg-muted",
                        )}
                        onClick={() =>
                          setChoices((prev) => ({ ...prev, [c.key]: side }))
                        }
                      >
                        <span className="text-xs font-semibold text-muted-foreground">
                          {on && <span aria-hidden>✓ </span>}
                          {side === "a" ? t.merge.planA : t.merge.planB}
                          {on && ` · ${t.merge.pickChosen}`}
                        </span>
                        <span className="font-normal">
                          {l(side === "a" ? c.a : c.b)}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p
        className="text-sm font-semibold"
        role="status"
        data-testid="merge-status"
      >
        {r.pending.length > 0
          ? fmt(t.merge.pendingCount, { n: r.pending.length })
          : t.merge.allChosen}
      </p>
      {!r.valid && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm font-semibold text-tl-yellow"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.merge.invalid}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          <TriangleAlert aria-hidden className="mr-1.5 inline size-4" />
          {t.merge.storeError}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t.merge.merging}</p>
      <Button
        size="lg"
        className="min-h-11"
        disabled={r.pending.length > 0 || !r.valid}
        onClick={merge}
        data-testid="merge-do"
      >
        <Layers aria-hidden className="size-5" />
        {t.merge.mergeBtn}
      </Button>
      <Button
        variant="ghost"
        className="min-h-11 text-muted-foreground"
        onClick={discard}
        data-testid="merge-discard"
      >
        {t.merge.discardBtn}
      </Button>
    </div>
  );
}

function MergedView({ diet }: { diet: DietPlan }) {
  const { t, l } = useI18n();
  const { refresh } = useDiet();
  const canPlan = useCan()({ k: "plan" });
  const originText = useOriginText();
  const origin = useOriginName();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "changed" | "failed">("idle");
  const merged = diet.merged!;
  const switchable = new Set(switchableLines(diet));
  // Las líneas con algo que contar: lo prohibido que ganó, lo que se eligió y lo que un padre cambió.
  const rows = Object.entries(merged.lines).filter(
    ([, line]) =>
      line.rule === "red" || line.rule === "picked" || line.rule === "parent",
  );

  const change = (key: string) => {
    const at = new Date().getTime();
    const next = switchLine(diet, key, at);
    if (!next || !storeDiet(next, "diet-line-changed", at).ok) {
      setStatus("failed");
      return;
    }
    setConfirming(null);
    setStatus("changed");
    refresh();
    notifyLocalStore();
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="mine-title">
      <h2 id="mine-title" className="text-lg">
        {t.merge.mineTitle}
      </h2>
      <p className="-mt-1 text-sm text-muted-foreground">
        {fmt(t.merge.mineFrom, {
          a: l(merged.from[0].title),
          b: l(merged.from[1].title),
        })}
      </p>
      <h3 className="font-heading text-base font-semibold">
        {t.merge.linesTitle}
      </h3>
      <p className="-mt-2 text-sm text-muted-foreground">{t.merge.linesBody}</p>
      {!canPlan && <RoleLimit />}
      {status === "changed" && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-semibold text-tl-green"
        >
          <CircleCheck aria-hidden className="size-4" />
          {t.merge.changed}
        </p>
      )}
      {status === "failed" && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          {t.merge.changeFailed}
        </p>
      )}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.merge.linesNone}</p>
      )}
      <ul className="flex flex-col gap-3" data-testid="merged-lines">
        {rows.map(([key, line]) => {
          const label = lineLabel(diet, key);
          const isConfirming = confirming === key;
          return (
            <li
              key={key}
              className="rounded-xl border bg-card px-3 py-3"
              data-testid={`line-${key}`}
            >
              <p className="font-semibold">{label ? l(label) : key}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {originText(merged, line)}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {(["a", "b"] as const).map((side) => {
                  const said = line[side] as LocalizedText | undefined;
                  return said ? (
                    <li key={side}>
                      {fmt(t.merge.says, {
                        origin: origin(merged, side),
                        text: l(said),
                      })}
                    </li>
                  ) : null;
                })}
              </ul>
              {canPlan && switchable.has(key) && !isConfirming && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 min-h-11"
                  data-testid={`change-${key}`}
                  onClick={() =>
                    relaxesRed(diet, key) ? setConfirming(key) : change(key)
                  }
                >
                  {t.merge.change}
                </Button>
              )}
              {isConfirming && (
                <div
                  className="mt-2 flex flex-col gap-2 rounded-lg bg-muted px-3 py-3"
                  role="group"
                  aria-label={t.merge.changeConfirmTitle}
                  data-testid="change-confirm"
                >
                  <p className="font-semibold">{t.merge.changeConfirmTitle}</p>
                  <p className="text-sm leading-relaxed">
                    {t.merge.changeConfirmBody}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="min-h-11"
                      data-testid={`change-ok-${key}`}
                      onClick={() => change(key)}
                    >
                      {t.merge.changeConfirm}
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => setConfirming(null)}
                    >
                      {t.merge.changeCancel}
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-2">
                <OriginBadge merged={merged} lineKey={key} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function MergePage() {
  const { diet, source, ready } = useDiet();
  const { t } = useI18n();
  const canPlan = useCan()({ k: "plan" });
  const second = useLocalStore(loadSecondPlan, null);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.merge.title}</h1>
      <p className="-mt-3 text-muted-foreground">{t.merge.intro}</p>

      {diet.merged && <MergedView diet={diet} />}

      {!canPlan ? (
        diet.merged ? null : (
          <RoleLimit />
        )
      ) : second && ready && source === "real" ? (
        <MergePanel a={diet} b={second} />
      ) : second ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm">
          {t.merge.needReal}
        </p>
      ) : (
        <section className="rounded-xl border border-dashed bg-card px-4 py-5 text-center">
          <p className="font-heading text-lg font-semibold">
            {t.merge.noSecondTitle}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t.merge.noSecondBody}
          </p>
          <Button
            asChild
            size="lg"
            className="mt-4 min-h-11 w-full"
            onClick={() => setLoadingSecond(true)}
          >
            <Link href="/cargar">{t.merge.goLoad}</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
