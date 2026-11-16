"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BellRing } from "lucide-react";

import { useFamily } from "@/components/family/use-family";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmt, useI18n } from "@/i18n";
import { dateKey } from "@/lib/diet/logic";
import { getFamily } from "@/lib/family/controller";
import { readNotices, type Notice } from "@/lib/family/notices";
import { NOTICE_TEXT_MAX } from "@/lib/family/records";
import { formatTime } from "@/lib/format";
import { useLocalStore } from "@/lib/local-store";

const NONE: Notice[] = [];
const hhmm = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * «Avisar a la familia» (S8 · ADR-012) y los avisos de hoy, con quién los escribió. Solo
 * existe con familia. El aviso viaja cifrado como todo lo compartido; tocar una notificación
 * abre Hoy justo aquí (`#avisos`).
 */
export function FamilyNotices({ today }: { today: Date | null }) {
  const { t, locale } = useI18n();
  const view = useFamily();
  const day = today ? dateKey(today) : "";
  const notices = useLocalStore(
    () => (day ? readNotices(day).filter((n) => n.date === day) : NONE),
    NONE,
    day,
  );
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    "sent" | "queued" | "empty" | "name" | "error" | null
  >(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const fieldId = useId();
  const inFamily = view.phase !== "off";

  // Tocar el aviso del teléfono abre «/#avisos»: se baja hasta aquí una vez que ya existe.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!inFamily || scrolled.current) return;
    if (window.location.hash !== "#avisos") return;
    scrolled.current = true;
    heading.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, [inFamily]);

  if (!inFamily) return null;

  const send = async () => {
    if (!text.trim()) {
      setResult("empty");
      return;
    }
    setBusy(true);
    setResult(null);
    const r = await getFamily().sendNotice(text);
    setBusy(false);
    if (r.ok) {
      setText("");
      setOpen(false);
      setResult(r.queued ? "queued" : "sent");
    } else {
      setResult(r.reason === "no-name" ? "name" : "error");
    }
  };

  const message =
    result === "sent"
      ? t.notices.sent
      : result === "queued"
        ? t.notices.queued
        : result === "empty"
          ? t.notices.errEmpty
          : result === "name"
            ? t.notices.needName
            : result === "error"
              ? t.notices.errSend
              : null;

  return (
    <section
      id="avisos"
      className="flex scroll-mt-20 flex-col gap-2"
      aria-labelledby="avisos-title"
      data-testid="family-notices"
    >
      <h2
        id="avisos-title"
        ref={heading}
        tabIndex={-1}
        className="flex items-center gap-1.5 text-lg text-muted-foreground outline-none"
      >
        <BellRing aria-hidden className="size-4" />
        {t.notices.title}
      </h2>

      {notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.notices.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notices.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border bg-card px-4 py-3"
              data-testid="notice"
            >
              <p className="text-base leading-snug">{n.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.by === view.ownId
                  ? t.notices.mine
                  : fmt(t.family.by, { name: n.name })}{" "}
                · {fmt(t.notices.at, { time: formatTime(hhmm(n.t), locale) })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p
          role={result === "sent" || result === "queued" ? "status" : "alert"}
          className={
            result === "sent" || result === "queued"
              ? "text-sm font-semibold text-tl-green"
              : "text-sm font-semibold text-tl-red"
          }
        >
          {result === "sent" || result === "queued" ? "" : "⚠ "}
          {message}
        </p>
      )}

      {open ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3">
          <label htmlFor={fieldId} className="text-sm font-semibold">
            {t.notices.label}
          </label>
          <p className="-mt-1 text-xs text-muted-foreground">
            {t.notices.hint}
          </p>
          <Textarea
            id={fieldId}
            value={text}
            maxLength={NOTICE_TEXT_MAX}
            placeholder={t.notices.placeholder}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground" aria-live="off">
            {fmt(t.notices.count, { n: text.length, max: NOTICE_TEXT_MAX })}
          </p>
          <div className="flex gap-2">
            <Button
              className="min-h-11 flex-1"
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? t.notices.sending : t.notices.submit}
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setText("");
                setResult(null);
              }}
            >
              {t.settings.clearConfirmNo}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
        >
          <BellRing aria-hidden className="size-5" />
          {t.notices.send}
        </Button>
      )}
    </section>
  );
}
