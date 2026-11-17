"use client";

import { useState } from "react";
import { KeyRound, LogOut, Trash2 } from "lucide-react";

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
import { InviteCard, LogList, MyRole, People, Waiting } from "./roles";
import { StatusBadge } from "./status-badge";
import { useFamily } from "./use-family";

/** Lo que se ve y se hace cuando este teléfono ya está en una familia. */
export function FamilyPanel({
  onNotice,
  onWarning,
}: {
  onNotice: (message: string | null) => void;
  onWarning: (message: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const view = useFamily();
  const [newPhrase, setNewPhrase] = useState<{
    phrase: string;
    keysSaved: boolean;
  } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState(view.ownName);

  if (view.phase === "off") return null;

  const rotate = async () => {
    setProblem(null);
    const r = await getFamily().rotate();
    if (r.ok) setNewPhrase({ phrase: r.phrase, keysSaved: r.keysSaved });
    else setProblem(errorText(t, r.reason));
  };

  const remove = async (id: string) => {
    setProblem(null);
    const r = await getFamily().removeMember(id);
    if (r.ok) setNewPhrase({ phrase: r.phrase, keysSaved: r.keysSaved });
    else setProblem(errorText(t, r.reason));
  };
  const parent = view.role === "parent";

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
          rejoin={{ code: view.invite ?? view.code, name: view.ownName }}
          onJoined={(keysSaved) => {
            onNotice(null);
            onWarning(keysSaved ? null : t.family.keysNotSaved);
          }}
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
      {view.oversize > 0 && (
        <p className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow">
          ⚠ {fmt(t.family.oversize, { n: view.oversize })}
        </p>
      )}
      {view.rejected > 0 && (
        <p
          role="status"
          className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow"
          data-testid="family-rejected"
        >
          ⚠ {fmt(t.family.rejected, { n: view.rejected })}
        </p>
      )}
      {view.rosterIssue && (
        <p
          role="status"
          className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow"
          data-testid="family-roster-issue"
        >
          ⚠{" "}
          {view.rosterIssue === "pin"
            ? t.family.rosterPin
            : t.family.rosterInvalid}
        </p>
      )}
      {view.rosterFull && view.role === "parent" && (
        <p
          role="status"
          className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow"
          data-testid="family-roster-full"
        >
          ⚠ {t.family.errRosterFull}
        </p>
      )}
      {view.rewritten.length > 0 && (
        <p className="rounded-xl bg-tl-yellow-surface px-4 py-3 text-sm text-tl-yellow">
          ⚠ {fmt(t.family.rewritten, { names: view.rewritten.join(", ") })}
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
            {view.invite ?? view.code}
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

      <MyRole view={view} />
      <People view={view} onRemove={remove} />
      <Waiting view={view} onRemove={remove} />
      {parent &&
        view.members.filter((m) => m.role === "parent").length === 1 && (
          <p
            className="text-sm text-muted-foreground"
            data-testid="family-one-parent"
          >
            ℹ {t.family.oneParent}
          </p>
        )}
      {parent && <InviteCard />}

      {newPhrase && (
        <SecretsCard
          title={t.family.newPhraseTitle}
          body={t.family.newPhraseBody}
          phrase={newPhrase.phrase}
          keysSaved={newPhrase.keysSaved}
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

      <LogList view={view} />

      <section className="flex flex-col gap-2">
        <h3 className="text-lg">{t.family.rotateTitle}</h3>
        {!parent && view.members.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.family.onlyParents}
          </p>
        ) : (
          <>
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
          </>
        )}
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
        {(parent || view.members.length === 0) && (
          <>
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
          </>
        )}
      </section>

      {problem && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          ⚠ {problem}
        </p>
      )}
    </div>
  );
}
