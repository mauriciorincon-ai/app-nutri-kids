"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { getFamily } from "@/lib/family/controller";

import { FamilyPanel } from "./family-panel";
import { CreateForm, JoinForm } from "./forms";
import { SecretsCard } from "./parts";
import { useFamily } from "./use-family";

type Step = "home" | "create" | "join" | "secrets";
type Health = "checking" | "ready" | "unavailable" | "offline";

/** «Compartir con la familia» en Ajustes: cada estado tiene su pantalla. */
export function FamilySection() {
  const { t } = useI18n();
  const view = useFamily();
  const [step, setStep] = useState<Step>("home");
  const [secrets, setSecrets] = useState<{
    code: string;
    phrase: string;
  } | null>(null);
  const [health, setHealth] = useState<Health>("checking");
  const [notice, setNotice] = useState<string | null>(null);

  const inFamily = view.phase !== "off";

  useEffect(() => {
    if (inFamily) return;
    let live = true;
    void getFamily()
      .health()
      .then((h) => live && setHealth(h));
    return () => {
      live = false;
    };
  }, [inFamily]);

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="family-title"
      data-testid="family-section"
    >
      <h2 id="family-title" className="text-lg">
        {t.family.title}
      </h2>

      {step === "secrets" && secrets ? (
        <SecretsCard
          title={t.family.secretsTitle}
          body={t.family.secretsBody}
          code={secrets.code}
          phrase={secrets.phrase}
          onDone={() => {
            setSecrets(null);
            setStep("home");
          }}
        />
      ) : inFamily ? (
        <FamilyPanel onNotice={setNotice} />
      ) : step === "create" ? (
        <CreateForm
          onCreated={(s) => {
            setSecrets(s);
            setStep("secrets");
          }}
          onCancel={() => setStep("home")}
        />
      ) : step === "join" ? (
        <JoinForm
          onJoined={() => setStep("home")}
          onCancel={() => setStep("home")}
        />
      ) : (
        <>
          <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
            {t.family.intro}
          </p>
          <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-sm leading-relaxed">
            <p>
              <span className="font-semibold">{t.family.travelsTitle}. </span>
              {t.family.travels}
            </p>
            <p>
              <span className="font-semibold">{t.family.staysTitle}. </span>
              {t.family.stays}
            </p>
            <p>{t.family.privacy}</p>
          </div>
          {health === "checking" && (
            <p role="status" className="text-sm text-muted-foreground">
              {t.family.checking}
            </p>
          )}
          {health === "unavailable" && (
            <p
              role="status"
              className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow"
              data-testid="family-unavailable"
            >
              ⚠ {t.family.unavailable}
            </p>
          )}
          {health === "offline" && (
            <p
              role="status"
              className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow"
              data-testid="family-offline"
            >
              ⚠ {t.family.offlineHome}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              className="min-h-11 w-full"
              disabled={health !== "ready"}
              onClick={() => {
                setNotice(null);
                setStep("create");
              }}
              data-testid="family-create"
            >
              <UsersRound aria-hidden className="size-5" />
              {t.family.createButton}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="min-h-11 w-full bg-transparent"
              disabled={health !== "ready"}
              onClick={() => {
                setNotice(null);
                setStep("join");
              }}
              data-testid="family-join"
            >
              {t.family.joinButton}
            </Button>
          </div>
        </>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-tl-green-surface px-4 py-3 text-sm font-semibold text-tl-green"
          data-testid="family-notice"
        >
          ✓ {notice}
        </p>
      )}
    </section>
  );
}
