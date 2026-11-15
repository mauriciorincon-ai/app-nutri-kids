"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, PenLine, Trash2 } from "lucide-react";

import { useToday } from "@/components/day-checklist/use-today";
import { useDiet } from "@/components/diet-provider";
import { Button } from "@/components/ui/button";
import { useProfileNotes } from "@/components/use-profile-notes";
import { fmt, useI18n } from "@/i18n";
import { isRestrictionActive } from "@/lib/diet/logic";
import {
  NOTE_KINDS,
  PROFILE_NOTE_MAX,
  addProfileNote,
  removeProfileNote,
  toggleTexture,
  type NoteKind,
} from "@/lib/diet/profile-notes";
import { TEXTURES } from "@/lib/diet/schema";
import { TEXTURE_SYMBOL } from "@/lib/diet/texture";
import { formatShortDate, formatTime } from "@/lib/format";
import { notifyLocalStore } from "@/lib/local-store";
import { cn } from "@/lib/utils";

/**
 * Perfil: lo que el profesional dijo en el plan («según tu plan») y lo que quien
 * cuida completa en el teléfono («anotado por ti»), cada dato con su origen
 * (ADR-009). Lo anotado vive aparte del plan y jamás sale del aparato. Lo que el
 * plan no trae se dice («tu plan no lo dice»), nunca se inventa.
 */
function Origin({ kind }: { kind: "plan" | "you" }) {
  const { t } = useI18n();
  const Icon = kind === "plan" ? FileText : PenLine;
  return (
    <span
      data-origin={kind}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        kind === "plan"
          ? "border-primary/40 text-primary"
          : "border-foreground/40 text-foreground",
      )}
    >
      <Icon aria-hidden className="size-3" />
      {kind === "plan" ? t.profile.originPlan : t.profile.originYou}
    </span>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-base font-semibold">{title}</h3>
        <Origin kind="plan" />
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/85">
        {children}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { diet } = useDiet();
  const { t, l, locale } = useI18n();
  const today = useToday();
  const notes = useProfileNotes();
  const [kind, setKind] = useState<NoteKind>("other");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  const notSaid = (
    <span className="text-muted-foreground">{t.profile.notSaid}</span>
  );
  const nf = new Intl.NumberFormat(locale);
  const profile = diet.profile;
  const glasses = diet.hydration.glassesPerDay ?? 4;
  const restrictionActive = today ? isRestrictionActive(diet, today) : false;

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = addProfileNote(kind, text, new Date());
    if (!saved) return;
    notifyLocalStore();
    setText("");
    setStatus(t.profile.noteAdded);
  };
  const onRemove = (id: string) => {
    removeProfileNote(id);
    notifyLocalStore();
    setStatus(t.profile.noteRemoved);
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      <h1 className="text-3xl">{t.profile.title}</h1>
      <p className="-mt-3 text-muted-foreground">{t.profile.intro}</p>

      <section className="flex flex-col gap-3" aria-labelledby="goals-title">
        <h2 id="goals-title" className="text-lg">
          {t.profile.goalsTitle}
        </h2>
        <Block title={t.profile.groupsTitle}>
          <ul className="flex flex-col gap-1">
            {diet.trafficLight.green.groups.map((g) => (
              <li key={g.id}>
                <span className="font-semibold">{l(g.name)}</span> ·{" "}
                {l(g.portion)}
              </li>
            ))}
          </ul>
        </Block>
        <Block title={t.profile.scheduleTitle}>
          <ul className="flex flex-col gap-1">
            {diet.dailyMenu.map((m) => (
              <li key={m.id}>
                <span className="font-semibold">{l(m.name)}</span> ·{" "}
                {formatTime(m.start, locale)}–{formatTime(m.end, locale)}
              </li>
            ))}
          </ul>
        </Block>
        <Block title={t.profile.hydrationTitle}>
          {fmt(t.profile.hydrationValue, {
            min: nf.format(diet.hydration.targetLitersMin),
            max: nf.format(diet.hydration.targetLitersMax),
            glasses,
          })}{" "}
          {l(diet.hydration.habit)}
        </Block>
        <Block title={t.profile.activityTitle}>
          {diet.goals?.activity ? l(diet.goals.activity) : notSaid}
        </Block>
        <Block title={t.profile.sleepTitle}>
          {diet.goals?.sleep ? l(diet.goals.sleep) : notSaid}
        </Block>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="limits-title">
        <h2 id="limits-title" className="text-lg">
          {t.profile.limitsTitle}
        </h2>
        <Block title={t.diet.restrictedSection}>
          <p>
            {restrictionActive
              ? fmt(t.profile.restrictionsActive, {
                  date: formatShortDate(diet.restrictions.validUntil, locale),
                  foods: diet.restrictions.foods
                    .map((f) => l(f.name))
                    .join(", "),
                })
              : t.profile.restrictionsEnded}
          </p>
        </Block>
        <Block title={t.supplements.title}>
          <p>
            {fmt(t.profile.supplementsCount, { n: diet.supplements.length })}
          </p>
          <Link
            href="/suplementos"
            className="mt-1 inline-flex min-h-11 items-center font-medium text-primary hover:underline"
          >
            {t.profile.supplementsLink}
          </Link>
        </Block>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="child-title">
        <h2 id="child-title" className="text-lg">
          {t.profile.childTitle}
        </h2>
        <Block title={t.profile.conditionTitle}>
          {profile?.condition ? l(profile.condition) : notSaid}
        </Block>
        <Block title={t.profile.allergiesTitle}>
          {profile?.allergies?.length
            ? profile.allergies.map((a) => l(a.name)).join(", ")
            : notSaid}
        </Block>
        <Block title={t.profile.intolerancesTitle}>
          {profile?.intolerances?.length
            ? profile.intolerances.map((a) => l(a.name)).join(", ")
            : notSaid}
        </Block>
        <Block title={t.profile.medicationsTitle}>
          {profile?.medications?.length ? (
            <ul className="flex flex-col gap-1">
              {profile.medications.map((m) => (
                <li key={m.id}>
                  <span className="font-semibold">{l(m.name)}</span>
                  {m.dose && <> · {l(m.dose)}</>}
                  {m.when && <> · {l(m.when)}</>}
                </li>
              ))}
            </ul>
          ) : (
            notSaid
          )}
        </Block>
        <p className="text-sm text-muted-foreground">
          {t.profile.medicalReminder}
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="mine-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mine-title" className="text-lg">
            {t.profile.mineTitle}
          </h2>
          <Origin kind="you" />
        </div>
        <p className="-mt-1 text-sm text-muted-foreground">
          {t.profile.mineBody}
        </p>

        <div className="rounded-xl border bg-card px-4 py-3">
          <h3 className="font-heading text-base font-semibold">
            {t.profile.texturesTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.profile.texturesHint}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {TEXTURES.map((tx) => {
              const on = notes.acceptedTextures.includes(tx);
              return (
                <li key={tx}>
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={on}
                    className={cn(
                      "min-h-11 gap-1.5",
                      on && "border-2 border-foreground bg-muted font-semibold",
                    )}
                    onClick={() => {
                      toggleTexture(tx);
                      notifyLocalStore();
                    }}
                  >
                    <span aria-hidden>{on ? "✓" : TEXTURE_SYMBOL[tx]}</span>
                    {t.texture[tx]}
                    {on && (
                      <span className="sr-only"> · {t.texture.accepted}</span>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>

        <ul className="flex flex-col gap-2" data-testid="profile-notes">
          {notes.notes.length === 0 && (
            <li className="text-sm text-muted-foreground">
              {t.profile.noteEmpty}
            </li>
          )}
          {notes.notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {t.profile[`noteKinds_${n.kind}`]}
                </p>
                <p className="leading-relaxed">{n.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmt(t.profile.noteDate, {
                    date: formatShortDate(n.at, locale),
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11 shrink-0"
                aria-label={fmt(t.profile.noteRemove, { text: n.text })}
                onClick={() => onRemove(n.id)}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ul>

        <form onSubmit={onAdd} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t.profile.noteKindLabel}
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as NoteKind)}
              className="min-h-11 rounded-lg border bg-card px-3 font-normal"
            >
              {NOTE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.profile[`noteKinds_${k}`]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {fmt(t.profile.noteLabel, { max: PROFILE_NOTE_MAX })}
            <input
              type="text"
              value={text}
              maxLength={PROFILE_NOTE_MAX}
              onChange={(e) => setText(e.target.value)}
              className="min-h-11 rounded-lg border bg-card px-3 font-normal"
            />
          </label>
          <Button type="submit" size="lg" disabled={text.trim().length === 0}>
            {t.profile.noteAdd}
          </Button>
          <p
            role="status"
            className="min-h-5 text-sm font-semibold text-tl-green"
          >
            {status}
          </p>
        </form>
      </section>
    </div>
  );
}
