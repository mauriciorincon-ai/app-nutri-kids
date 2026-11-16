"use client";

import { useState } from "react";
import { KeyRound, LogOut, Trash2, UserMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import { DEVICE_NAME_MAX } from "@/lib/device";
import { getFamily } from "@/lib/family/controller";

import { JoinForm } from "./forms";
import {
  Confirm,
  errorText,
  Field,
  fieldClass,
  SecretsCard,
  when,
} from "./parts";
import { StatusBadge } from "./status-badge";
import { useFamily } from "./use-family";

/** Lo que se ve y se hace cuando este teléfono ya está en una familia. */
export function FamilyPanel({
  onNotice,
}: {
  onNotice: (message: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const view = useFamily();
  const [newPhrase, setNewPhrase] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState(view.ownName);

  if (view.phase === "off") return null;

  const rotate = async () => {
    setProblem(null);
    const r = await getFamily().rotate();
    if (r.ok) setNewPhrase(r.phrase);
    else setProblem(errorText(t, r.reason));
  };

  const rename = async () => {
    setProblem(null);
    const r = await getFamily().rename(name);
    if (r.ok) onNotice(t.family.renamed);
    else setProblem(errorText(t, r.reason));
  };

  return (
    <div className="flex flex-col gap-4" data-testid="family-panel">
      <StatusBadge phase={view.phase} />

      {view.phase === "locked" && view.code && (
        <JoinForm
          rejoin={{ code: view.code, name: view.ownName }}
          onJoined={() => onNotice(null)}
        />
      )}

      {view.planNotice && (
        <div role="status" className="rounded-xl bg-accent px-4 py-3 text-sm">
          <p className="leading-relaxed text-accent-foreground">
            {view.planNotice === "theirs"
              ? t.family.planNoticeTheirs
              : t.family.planNoticeMine}
          </p>
          <Button
            variant="outline"
            size="lg"
            className="mt-2 min-h-11"
            onClick={() => void getFamily().dismissNotice()}
          >
            {t.family.planNoticeOk}
          </Button>
        </div>
      )}
      {view.planTooBig && (
        <p className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow">
          ⚠ {t.family.planTooBig}
        </p>
      )}
      {view.unreadable > 0 && (
        <p className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow">
          ⚠ {fmt(t.family.unreadable, { n: view.unreadable })}
        </p>
      )}

      <div className="rounded-xl border bg-card px-4 py-3 text-sm">
        <p>
          {fmt(t.family.codeShown, { code: "" })}
          <span className="font-mono text-base" data-testid="family-code-shown">
            {view.code}
          </span>
        </p>
        <p className="mt-1 text-muted-foreground">
          {view.lastSync > 0
            ? fmt(t.family.lastSync, { when: when(view.lastSync, locale) })
            : t.family.neverSynced}
        </p>
        {view.pending > 0 && (
          <p className="mt-1 font-semibold" data-testid="family-pending">
            ⏳ {fmt(t.family.pending, { n: view.pending })}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg">{t.family.phonesTitle}</h3>
        <ul className="flex flex-col gap-2" data-testid="family-phones">
          {view.phones.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
            >
              <p className="font-semibold">
                {p.name || "—"}
                {p.self && (
                  <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                    {t.family.youTag}
                  </span>
                )}
              </p>
              {!p.self && (
                <p className="-mt-1 text-sm text-muted-foreground">
                  {fmt(t.family.seenAt, { when: when(p.seen, locale) })}
                </p>
              )}
              {!p.self && (
                <Confirm
                  testId={`family-remove-${p.id}`}
                  icon={<UserMinus aria-hidden className="size-5" />}
                  triggerLabel={fmt(t.family.removeButton, { name: p.name })}
                  title={fmt(t.family.removeTitle, { name: p.name })}
                  body={fmt(t.family.removeBody, { name: p.name })}
                  yes={t.family.removeYes}
                  onYes={rotate}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {newPhrase && (
        <SecretsCard
          title={t.family.newPhraseTitle}
          body={t.family.newPhraseBody}
          phrase={newPhrase}
          onDone={() => setNewPhrase(null)}
        />
      )}

      <section className="flex flex-col gap-2">
        <Field label={t.family.nameLabel} hint={t.family.nameHint}>
          {(id, hintId) => (
            <input
              id={id}
              aria-describedby={hintId}
              className={fieldClass}
              value={name}
              maxLength={DEVICE_NAME_MAX}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Button
          variant="outline"
          size="lg"
          className="min-h-11 bg-transparent"
          disabled={name.trim() === "" || name.trim() === view.ownName}
          onClick={rename}
        >
          {t.family.renameSave}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg">{t.family.rotateTitle}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.family.rotateBody}
        </p>
        <Confirm
          testId="family-rotate"
          icon={<KeyRound aria-hidden className="size-5" />}
          triggerLabel={t.family.rotateButton}
          title={t.family.rotateConfirmTitle}
          body={t.family.rotateConfirmBody}
          yes={t.family.rotateYes}
          onYes={rotate}
        />
      </section>

      <section className="flex flex-col gap-2">
        <Confirm
          testId="family-leave"
          icon={<LogOut aria-hidden className="size-5" />}
          triggerLabel={t.family.leaveButton}
          title={t.family.leaveConfirmTitle}
          body={t.family.leaveConfirmBody}
          yes={t.family.leaveYes}
          onYes={async () => {
            await getFamily().leave();
            onNotice(t.family.left);
          }}
        />
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t.family.destroyBody}
        </p>
        <Confirm
          testId="family-destroy"
          icon={<Trash2 aria-hidden className="size-5" />}
          triggerLabel={t.family.destroyButton}
          title={t.family.destroyConfirmTitle}
          body={t.family.destroyConfirmBody}
          yes={t.family.destroyYes}
          onYes={async () => {
            const r = await getFamily().destroy();
            if (r.ok) onNotice(t.family.destroyed);
            else setProblem(errorText(t, r.reason));
          }}
        />
      </section>

      {problem && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          ⚠ {problem}
        </p>
      )}
    </div>
  );
}
