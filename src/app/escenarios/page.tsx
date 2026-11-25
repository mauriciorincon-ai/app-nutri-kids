"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { useProfileNotes } from "@/components/use-profile-notes";
import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import {
  buildScenario,
  SCENARIO_IDS,
  type ScenarioData,
  type ScenarioId,
} from "@/lib/diet/scenarios";
import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};
/** El escenario que pide el enlace (`?e=emergency`, desde Bienestar): se lee tras hidratar. */
const linkedScenario = (): ScenarioId | null => {
  const e = new URLSearchParams(window.location.search).get("e");
  return SCENARIO_IDS.find((s) => s === e) ?? null;
};

/**
 * Días especiales (S9 · ADR-014): cumpleaños, restaurante, emergencia y «le ofrecen algo que
 * no puede». Todo sale del plan guardado en este teléfono (por eso se abre sin señal) y
 * jamás da una indicación médica. `lib/diet/scenarios` decide; aquí solo se redacta.
 */
export default function ScenariosPage() {
  const { diet } = useDiet();
  const { t, l } = useI18n();
  const notes = useProfileNotes();
  const linked = useSyncExternalStore(noSubscribe, linkedScenario, () => null);
  const [picked, setId] = useState<ScenarioId | null | undefined>(undefined);
  const id = picked === undefined ? linked : picked;

  const labels: Record<ScenarioId, string> = {
    birthday: t.scenarios.birthday,
    restaurant: t.scenarios.restaurant,
    emergency: t.scenarios.emergency,
    offered: t.scenarios.offered,
  };
  const intros: Record<ScenarioId, string> = {
    birthday: t.scenarios.birthdayIntro,
    restaurant: t.scenarios.restaurantIntro,
    emergency: t.scenarios.emergencyIntro,
    offered: t.scenarios.offeredIntro,
  };

  const data = id ? buildScenario(id, diet, new Date(), notes.notes) : null;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.scenarios.title}</h1>
      <p className="-mt-2 text-muted-foreground">{t.scenarios.intro}</p>

      <div
        role="group"
        aria-label={t.scenarios.pick}
        className="grid grid-cols-2 gap-2"
      >
        {SCENARIO_IDS.map((s) => (
          <Button
            key={s}
            type="button"
            variant="outline"
            aria-pressed={id === s}
            data-testid={`scenario-${s}`}
            className={cn(
              "min-h-14 whitespace-normal",
              id === s && "border-2 border-foreground bg-muted font-semibold",
            )}
            onClick={() => setId(s)}
          >
            {id === s && <span aria-hidden>✓ </span>}
            {labels[s]}
          </Button>
        ))}
      </div>

      {data && id && (
        <section
          className="flex flex-col gap-4"
          aria-labelledby="scenario-title"
          data-testid="scenario"
        >
          <div>
            <h2 id="scenario-title" className="text-2xl">
              {labels[id]}
            </h2>
            <p className="text-muted-foreground">{intros[id]}</p>
          </div>
          <ScenarioBody data={data} l={l} />
          <p className="text-sm text-muted-foreground">{t.scenarios.offline}</p>
          <p
            className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground"
            data-testid="scenario-not-medical"
          >
            {t.scenarios.notMedical}
          </p>
        </section>
      )}

      <Link
        href="/chat"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        {t.scenarios.chat}
        <ChevronRight aria-hidden className="size-4" />
      </Link>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.nav.today}
      </Link>
    </div>
  );
}

type LocalizeFn = ReturnType<typeof useI18n>["l"];

function Block({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
      data-testid={testId}
    >
      <h3 className="text-lg">{title}</h3>
      {children}
    </section>
  );
}

function ScenarioBody({ data, l }: { data: ScenarioData; l: LocalizeFn }) {
  const { t } = useI18n();
  const alias = l(data.alias);
  const avoid = data.avoid.map((a) => l(a.name)).join(", ");
  const safe = data.safe
    .slice(0, 4)
    .map((s) => l(s.name))
    .join(", ");

  const avoidBlock = (
    <Block title={t.scenarios.avoidTitle} testId="scenario-avoid">
      {data.avoid.length === 0 ? (
        <p>{t.scenarios.avoidNone}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.avoid.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden>✕</span>
              <span>
                <strong>{l(a.name)}</strong>
                {a.kind === "restricted" && (
                  <span className="text-muted-foreground">
                    {" · "}
                    {t.scenarios.restricted}
                  </span>
                )}
                {a.kind === "noted" && (
                  <span className="text-muted-foreground">
                    {" · "}
                    {t.scenarios.notedAvoid}
                  </span>
                )}
                {a.why && (
                  <span className="text-muted-foreground"> — {l(a.why)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );

  const bringBlock = (
    <Block title={t.scenarios.bringTitle} testId="scenario-safe">
      {data.safe.length === 0 ? (
        <p>{t.scenarios.bringNone}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t.scenarios.bringHint}
          </p>
          <ul className="flex flex-col gap-1">
            {data.safe.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden>✓</span>
                <span>
                  {l(s.name)}
                  {s.keepsWithoutFridge && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {t.scenarios.fridgeMark}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Block>
  );

  const limitsBlock = data.limits.length > 0 && (
    <Block title={t.scenarios.limitsTitle}>
      <ul className="flex flex-col gap-1">
        {data.limits.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden>!</span>
            <span>
              {l(x.name)}
              <span className="text-muted-foreground"> — {l(x.limit)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Block>
  );

  const additivesBlock = data.additives.length > 0 && (
    <Block title={t.scenarios.additivesTitle}>
      <ul className="flex flex-col gap-1">
        {data.additives.map((a) => (
          <li key={a.code}>
            {a.code} · {l(a.name)}
          </li>
        ))}
      </ul>
    </Block>
  );

  const sayText = (tpl: string) =>
    fmt(tpl, { alias, avoid: avoid || "—", safe: safe || "—" });

  const doubt = (
    <p className="text-sm text-muted-foreground">{t.scenarios.doubt}</p>
  );

  if (data.id === "birthday")
    return (
      <>
        {bringBlock}
        {avoidBlock}
        {limitsBlock}
        {additivesBlock}
        <Block title={t.scenarios.sayTitle}>
          <p>
            {data.avoid.length === 0
              ? t.scenarios.sayNoAvoid
              : sayText(t.scenarios.sayBirthday)}
          </p>
        </Block>
        {doubt}
      </>
    );

  if (data.id === "restaurant")
    return (
      <>
        {avoidBlock}
        {limitsBlock}
        {additivesBlock}
        <Block title={t.scenarios.askTitle}>
          <p>{t.scenarios.askRestaurant}</p>
          {safe && <p>{sayText(t.scenarios.askRestaurantSafe)}</p>}
          {data.avoid.length > 0 && <p>{sayText(t.scenarios.sayRestaurant)}</p>}
        </Block>
        {data.focusMeal && (
          <Block title={t.scenarios.mealsTitle}>
            <p className="text-sm text-muted-foreground">
              {t.scenarios.mealFocusNext}
            </p>
            <p>
              <strong>{l(data.focusMeal.name)}</strong> · {data.focusMeal.start}
              –{data.focusMeal.end} — {l(data.focusMeal.content)}
            </p>
          </Block>
        )}
        {doubt}
      </>
    );

  if (data.id === "offered")
    return (
      <>
        <Block title={t.scenarios.sayTitle} testId="scenario-say">
          <p>{sayText(t.scenarios.sayOffered)}</p>
          {safe && <p>{sayText(t.scenarios.sayOfferedAlt)}</p>}
        </Block>
        {avoidBlock}
        <Link
          href="/familia/presion"
          prefetch={false}
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
          data-testid="scenario-note-it"
        >
          {t.scenarios.noteIt}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
        {doubt}
      </>
    );

  // emergency
  const c = data.card;
  const none = <p className="text-muted-foreground">{t.scenarios.cardNone}</p>;
  return (
    <>
      <Block title={t.scenarios.callTitle} testId="scenario-call">
        <ul className="flex flex-col gap-1">
          <li>{t.scenarios.callEmergency}</li>
          <li>
            {fmt(t.scenarios.callProfessional, { name: l(data.professional) })}
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">{t.scenarios.callNote}</p>
      </Block>
      {c && (
        <Block title={t.scenarios.cardTitle} testId="scenario-card">
          <dl className="flex flex-col gap-2">
            <div>
              <dt className="text-sm font-semibold">
                {t.scenarios.cardCondition}
              </dt>
              <dd>{c.condition ? l(c.condition) : none}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">
                {t.scenarios.cardAllergies}
              </dt>
              <dd>
                {c.allergies.length > 0
                  ? c.allergies.map((a) => l(a)).join(", ")
                  : none}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">
                {t.scenarios.cardIntolerances}
              </dt>
              <dd>
                {c.intolerances.length > 0
                  ? c.intolerances.map((a) => l(a)).join(", ")
                  : none}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">
                {t.scenarios.cardMedications}
              </dt>
              <dd>
                {c.medications.length > 0
                  ? c.medications
                      .map(
                        (m) =>
                          l(m.name) +
                          (m.dose ? ` · ${l(m.dose)}` : "") +
                          (m.when ? ` · ${l(m.when)}` : ""),
                      )
                      .join("; ")
                  : none}
              </dd>
            </div>
            {c.noted.length > 0 && (
              <div>
                <dt className="text-sm font-semibold">
                  {t.scenarios.cardNoted}
                </dt>
                <dd>{c.noted.map((n) => l(n)).join("; ")}</dd>
              </div>
            )}
          </dl>
        </Block>
      )}
      {avoidBlock}
      <Block title={t.scenarios.notifyTitle}>
        <p>{t.scenarios.notifyBody}</p>
        <Link
          href="/#avisos"
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
        >
          {t.notices.send}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </Block>
    </>
  );
}
