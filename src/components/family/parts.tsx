"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n, type Dictionary, type Locale } from "@/i18n";
import { DEVICE_NAME_MAX } from "@/lib/device";
import type { ActionResult } from "@/lib/family/controller";
import { cn } from "@/lib/utils";

export const fieldClass =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Failure = Extract<ActionResult, { ok: false }>["reason"];

const ERROR_KEY: Record<Failure, keyof Dictionary["family"]> = {
  "wrong-code": "errWrongCode",
  "wrong-phrase": "errWrongPhrase",
  offline: "errOffline",
  unavailable: "errUnavailable",
  busy: "errBusy",
  full: "errFull",
  denied: "errError",
  error: "errError",
  "no-family": "errError",
  "no-name": "errNoName",
};

export function errorText(t: Dictionary, reason: Failure): string {
  return t.family[ERROR_KEY[reason]];
}

/** Fecha y hora cortas en el idioma de la app; «—» si el dato no es una fecha. */
export function when(ms: number, locale: Locale): string {
  const d = new Date(ms);
  if (ms <= 0 || Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "es" ? "es-CO" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children(id, hintId)}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function NameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Field label={t.family.nameLabel} hint={t.family.nameHint}>
      {(id, hintId) => (
        <input
          id={id}
          aria-describedby={hintId}
          className={fieldClass}
          value={value}
          maxLength={DEVICE_NAME_MAX}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function CheckLine({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 size-6 rounded-md"
      />
      <span className="flex-1 leading-snug">{children}</span>
    </label>
  );
}

/** Código y/o frase para anotar: se muestran en grande y se leen tal cual. */
export function SecretsCard({
  title,
  body,
  code,
  phrase,
  keysSaved,
  onDone,
}: {
  title: string;
  body: string;
  code?: string;
  phrase: string;
  /** false: la clave no se pudo guardar en este teléfono. */
  keysSaved?: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4"
      data-testid="family-secrets"
    >
      <h3 className="text-lg">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {keysSaved === false && (
        <p role="alert" className="text-sm font-semibold text-tl-yellow">
          ⚠ {t.family.keysNotSaved}
        </p>
      )}
      {code && (
        <div>
          <p className="text-sm font-semibold">{t.family.codeLabel}</p>
          <p
            className="font-mono text-2xl tracking-wider"
            data-testid="family-code"
          >
            {code}
          </p>
        </div>
      )}
      <div>
        <p className="text-sm font-semibold">{t.family.phraseLabel}</p>
        <p
          className="font-mono text-2xl tracking-wider break-words"
          data-testid="family-phrase"
        >
          {phrase}
        </p>
      </div>
      <CheckLine checked={saved} onChange={setSaved}>
        {t.family.savedCheck}
      </CheckLine>
      <Button size="lg" className="min-h-11" disabled={!saved} onClick={onDone}>
        {t.family.secretsDone}
      </Button>
    </div>
  );
}

/** Botón que abre una confirmación; la acción corre solo con el «sí». */
export function Confirm({
  triggerLabel,
  icon,
  title,
  body,
  yes,
  onYes,
  testId,
}: {
  triggerLabel: string;
  icon?: ReactNode;
  title: string;
  body: string;
  yes: string;
  onYes: () => void | Promise<void>;
  testId: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onYes();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={cn("min-h-11 w-full bg-transparent")}
          data-testid={testId}
        >
          {icon}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            size="lg"
            className="min-h-11"
            disabled={busy}
            onClick={run}
            data-testid={`${testId}-yes`}
          >
            {yes}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="min-h-11"
            onClick={() => setOpen(false)}
          >
            {t.family.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
