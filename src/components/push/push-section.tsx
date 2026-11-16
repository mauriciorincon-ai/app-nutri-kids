"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";

import { CheckLine } from "@/components/family/parts";
import { Button } from "@/components/ui/button";
import { useI18n, type Dictionary } from "@/i18n";
import { getPush, type PushError } from "@/lib/push/controller";
import type { PushTypes } from "@/lib/push/schedule";

import { usePush } from "./use-push";

const ERROR_KEY: Record<NonNullable<PushError>, keyof Dictionary["push"]> = {
  offline: "errOffline",
  worker: "errWorker",
  update: "errUpdate",
  dismissed: "errDismissed",
  server: "errServer",
  full: "errFull",
  lost: "lost",
};

const TYPE_ROWS: {
  key: keyof PushTypes;
  label: "supplements" | "meals" | "water" | "family";
  hint: "supplementsHint" | "mealsHint" | "waterHint" | "familyHint";
}[] = [
  { key: "supplements", label: "supplements", hint: "supplementsHint" },
  { key: "meals", label: "meals", hint: "mealsHint" },
  { key: "water", label: "water", hint: "waterHint" },
  { key: "family", label: "family", hint: "familyHint" },
];

/** «Avisos en este teléfono» en Ajustes: cada estado dice qué pasa y qué sigue. */
export function PushSection() {
  const { t } = useI18n();
  const view = usePush();
  const [offResult, setOffResult] = useState<"server" | "local" | null>(null);

  const note = (text: string, tone: "info" | "warn" = "info") => (
    <p
      role="status"
      className={
        tone === "warn"
          ? "rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm font-semibold text-tl-yellow"
          : "rounded-xl border bg-card px-4 py-3 text-sm leading-relaxed"
      }
    >
      {text}
    </p>
  );

  const turnOff = async () => {
    const r = await getPush().disable();
    setOffResult(r.server ? "server" : "local");
  };

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="push-title"
      data-testid="push-section"
    >
      <h2 id="push-title" className="text-lg">
        {t.push.title}
      </h2>
      <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
        {t.push.intro}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.push.privacy}
      </p>

      {view.status === "unsupported" && note(t.push.unsupported)}
      {view.status === "unavailable" && note(t.push.unavailable)}
      {view.status === "denied" && note(t.push.denied, "warn")}

      {view.status === "needs-install" && (
        <div
          className="rounded-xl border bg-card px-4 py-3"
          data-testid="push-install"
        >
          <p className="font-semibold">{t.push.installTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t.push.installIntro}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
            <li>{t.push.install1}</li>
            <li>{t.push.install2}</li>
            <li>{t.push.install3}</li>
            <li>{t.push.install4}</li>
          </ol>
        </div>
      )}

      {(view.status === "off" || view.status === "checking") && (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t.push.askNote}
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={view.busy || view.status === "checking"}
            onClick={() => {
              setOffResult(null);
              void getPush().enable();
            }}
          >
            <BellRing aria-hidden className="size-5" />
            {view.busy ? t.push.working : t.push.enable}
          </Button>
        </>
      )}

      {view.error && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          ⚠ {t.push[ERROR_KEY[view.error]]}
        </p>
      )}

      {view.status === "on" && (
        <>
          <p
            role="status"
            className="rounded-xl bg-tl-green-surface px-4 py-3 text-sm font-semibold text-tl-green"
          >
            {t.push.on}
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">
              {t.push.typesTitle}
            </legend>
            {TYPE_ROWS.map(({ key, label, hint }) => (
              <CheckLine
                key={key}
                checked={view.types[key]}
                onChange={(on) => void getPush().setType(key, on)}
              >
                <span className="font-medium">{t.push[label]}</span>
                <span className="block text-muted-foreground">
                  {t.push[hint]}
                </span>
                {key === "family" && view.types.family && !view.inFamily && (
                  <span className="block text-muted-foreground">
                    ℹ {t.push.familyNeeds}
                  </span>
                )}
              </CheckLine>
            ))}
          </fieldset>
          <CheckLine
            checked={view.hide}
            onChange={(on) => void getPush().setHide(on)}
          >
            <span className="font-medium">{t.push.hideTitle}</span>
            <span className="block text-muted-foreground">
              {t.push.hideHint}
            </span>
          </CheckLine>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={view.busy}
            onClick={() => void turnOff()}
          >
            {t.push.off}
          </Button>
        </>
      )}

      {view.status !== "on" && offResult && (
        <p
          role="status"
          className="rounded-xl bg-tl-green-surface px-4 py-3 text-sm font-semibold text-tl-green"
        >
          ✓ {offResult === "server" ? t.push.offDone : t.push.offDoneLocal}
        </p>
      )}
    </section>
  );
}
