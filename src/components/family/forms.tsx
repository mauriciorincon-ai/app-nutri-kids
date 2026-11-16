"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { getFamily } from "@/lib/family/controller";

import { CheckLine, errorText, Field, fieldClass, NameField } from "./parts";

/** Crear: nombre del teléfono + consentimiento. Devuelve código y frase para mostrarlos una vez. */
export function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (secrets: {
    code: string;
    phrase: string;
    keysSaved: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await getFamily().create(name);
    setBusy(false);
    if (r.ok)
      onCreated({ code: r.code, phrase: r.phrase, keysSaved: r.keysSaved });
    else setError(errorText(t, r.reason));
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4"
      data-testid="family-create-form"
    >
      <h3 className="text-lg">{t.family.consentTitle}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.family.consentBody}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.family.consentLost}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.family.consentLeave}
      </p>
      <NameField value={name} onChange={setName} />
      <CheckLine checked={consent} onChange={setConsent}>
        {t.family.consentCheck}
      </CheckLine>
      {error && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          ⚠ {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="min-h-11"
        disabled={busy || !consent || name.trim() === ""}
      >
        {busy ? t.family.creating : t.family.createSubmit}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="min-h-11 bg-transparent"
        onClick={onCancel}
      >
        {t.family.cancel}
      </Button>
    </form>
  );
}

/**
 * Entrar con código y frase. Con `rejoin` (la frase cambió) el código y el nombre ya se
 * conocen: solo se pide la frase nueva.
 */
export function JoinForm({
  rejoin,
  onJoined,
  onCancel,
}: {
  rejoin?: { code: string; name: string };
  onJoined: (keysSaved: boolean) => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState(rejoin?.code ?? "");
  const [phrase, setPhrase] = useState("");
  const [name, setName] = useState(rejoin?.name ?? "");
  const [consent, setConsent] = useState(rejoin !== undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await getFamily().join(code, phrase, name);
    setBusy(false);
    if (r.ok) onJoined(r.keysSaved);
    else setError(errorText(t, r.reason));
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4"
      data-testid="family-join-form"
    >
      <h3 className="text-lg">
        {rejoin ? t.family.lockedTitle : t.family.joinTitle}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {rejoin ? t.family.lockedBody : t.family.joinBody}
      </p>
      <Field label={t.family.joinCode}>
        {(id) => (
          <input
            id={id}
            className={`${fieldClass} font-mono uppercase`}
            value={code}
            readOnly={rejoin !== undefined}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
      </Field>
      <Field label={t.family.joinPhrase}>
        {(id) => (
          <input
            id={id}
            className={`${fieldClass} font-mono uppercase`}
            value={phrase}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setPhrase(e.target.value)}
          />
        )}
      </Field>
      {!rejoin && (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t.family.consentBody}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t.family.consentLost}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t.family.consentLeave}
          </p>
          <NameField value={name} onChange={setName} />
          <CheckLine checked={consent} onChange={setConsent}>
            {t.family.consentCheck}
          </CheckLine>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          ⚠ {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="min-h-11"
        disabled={
          busy ||
          !consent ||
          name.trim() === "" ||
          code.trim() === "" ||
          phrase.trim() === ""
        }
      >
        {busy ? t.family.joining : t.family.joinSubmit}
      </Button>
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 bg-transparent"
          onClick={onCancel}
        >
          {t.family.cancel}
        </Button>
      )}
    </form>
  );
}
