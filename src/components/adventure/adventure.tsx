"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { useToday } from "@/components/day-checklist/use-today";
import { fmt, useI18n } from "@/i18n";
import { adventureText } from "@/i18n/adventure";
import {
  doneOnDay,
  energyOf,
  SOURCES,
  stageOf,
  STAGE_MAX,
  untilNext,
  type Source,
} from "@/lib/adventure/energy";
import { scanDays } from "@/lib/adventure/scan";
import { kidModeOn, setKidMode } from "@/lib/adventure/kidmode";
import {
  earnAll,
  readAdventure,
  setWorld,
  subscribeAdventure,
  WORLDS,
  type Adventure as AdventureState,
  type World,
} from "@/lib/adventure/store";
import { dateKey } from "@/lib/diet/logic";
import { cn } from "@/lib/utils";

import { AdultExit } from "./adult-exit";
import { Glyph, type GlyphName } from "./glyph";
import { Scene } from "./scenes";

const EMPTY: AdventureState = { world: "brote", sparks: [] };
const server = () => EMPTY;
const serverKid = () => false;

const TILE_GLYPH: Record<Source, GlyphName> = {
  sleep: "moon",
  activity: "ball",
  water: "drop",
  sun: "sun",
  kitchen: "spoon",
  try: "new",
};
/** El símbolo de la energía de cada mundo: la gota, la chispa y la estrella. */
const ENERGY_GLYPH: Record<World, GlyphName> = {
  brote: "drop",
  lumo: "new",
  nubo: "new",
};

/** Cómo se ve cada mundo: solo composición y color (lo que eligió el dueño en `juego.html`). */
const LOOK: Record<
  World,
  { scene: string; grid: string; tile: string; done: string; energy: string }
> = {
  brote: {
    scene: "bg-gradient-to-b from-[var(--adv-sage-soft)] to-background",
    grid: "grid-cols-3",
    tile: "min-h-[76px] rounded-2xl",
    done: "border-[var(--adv-sage)] bg-[var(--adv-sage-soft)]",
    energy: "left-3 top-2.5 text-[var(--adv-sage)]",
  },
  lumo: {
    scene: "border-2 border-dashed border-border bg-[var(--adv-paper)]",
    grid: "grid-cols-3",
    tile: "mx-auto aspect-square w-24 rounded-full text-xs",
    done: "border-primary bg-[var(--adv-amber-soft)]",
    energy: "left-3 top-2.5 text-primary",
  },
  nubo: {
    scene: "bg-gradient-to-br from-[var(--adv-sky)] to-[var(--adv-sky-2)]",
    grid: "grid-cols-2",
    tile: "min-h-16 flex-row justify-start gap-2 rounded-full px-4 text-xs",
    done: "border-[var(--adv-sky-2)] bg-accent",
    energy: "bottom-3 right-3.5 text-[var(--adv-star)]",
  },
};

/**
 * La aventura del modo niño (S14 · ADR-020, parte 2 · G-Plan 2a). Pantalla completa, sin plan, sin
 * barra y sin Ajustes. El niño elige su mundo (el dueño decidió: «El niño elige su mundo»): son
 * tres dibujos de UNA sola energía, que solo sube y que sale de hábitos y de explorar, jamás de
 * comer. Los hábitos de la fila se anotan en el día de la familia; aquí solo se ven, salvo la
 * cocina, que el niño toca.
 */
export function Adventure() {
  const { locale } = useI18n();
  const t = adventureText[locale];
  const router = useRouter();
  const today = useToday();
  const day = today ? dateKey(today) : null;
  const adv = useSyncExternalStore(subscribeAdventure, readAdventure, server);
  const kid = useSyncExternalStore(subscribeAdventure, kidModeOn, serverKid);

  // Lo que los días ya anotados le dan a la energía (solo lee el día; solo añade al libro).
  useEffect(() => {
    if (!day) return;
    earnAll(scanDays());
  }, [day]);

  const world = adv.world;
  const w = t.worlds[world];
  const look = LOOK[world];
  const energy = energyOf(adv.sparks);
  const stage = stageOf(energy);
  const done = day ? doneOnDay(adv.sparks, day) : new Set<Source>();
  const unit = energy === 1 ? w.unitOne : w.unitMany;
  const left = untilNext(energy);

  const tapKitchen = () => {
    if (day) earnAll([{ day, sources: ["kitchen"] }]);
  };
  const leave = () => {
    setKidMode(false);
    router.replace("/");
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground"
      data-testid="adventure"
      data-world={world}
      data-kid-mode={kid ? "on" : "off"}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-2 px-3.5 pb-4 pt-3">
        <div className="flex min-h-11 items-center justify-between">
          {kid ? (
            <span />
          ) : (
            <Link
              href="/"
              prefetch={false}
              className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-2 hover:underline"
            >
              {t.adultBack}
            </Link>
          )}
          {kid && <AdultExit onLeave={leave} />}
        </div>

        <h1 className="text-2xl">{w.hi}</h1>
        <p className="-mt-1 text-sm text-muted-foreground">{w.sub}</p>

        <div
          className={cn(
            "relative my-1 min-h-64 flex-1 overflow-hidden rounded-[20px]",
            look.scene,
          )}
        >
          <Scene world={world} stage={stage} label={w.scene} />
          <div
            className={cn(
              "absolute flex items-center gap-2 font-bold",
              look.energy,
            )}
            data-testid="adventure-energy"
            data-energy={energy}
            role="status"
          >
            <Glyph name={ENERGY_GLYPH[world]} className="size-6" />
            <span className="font-heading text-2xl tabular-nums">{energy}</span>
            <span>{unit}</span>
          </div>
        </div>

        <section aria-labelledby="adv-habits">
          <h2 id="adv-habits" className="sr-only">
            {t.habitsTitle}
          </h2>
          <ul className={cn("grid gap-2", look.grid)}>
            {SOURCES.map((s) => {
              const isDone = done.has(s);
              const body = (
                <>
                  <Glyph name={TILE_GLYPH[s]} className="size-7 shrink-0" />
                  <span className="flex flex-col items-center leading-tight">
                    {w.tiles[s]}
                    {isDone && (
                      <small className="text-[11px] font-normal text-muted-foreground">
                        {t.done}
                      </small>
                    )}
                  </span>
                  {isDone && (
                    <span
                      aria-hidden
                      className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                    >
                      <Glyph name="check" className="size-3.5" />
                    </span>
                  )}
                </>
              );
              const cls = cn(
                "relative flex w-full flex-col items-center justify-center gap-0.5 border-2 bg-card px-1 py-1.5 text-center text-[13px] font-bold",
                look.tile,
                isDone && look.done,
              );
              return (
                <li key={s} data-testid={`tile-${s}`} data-done={isDone}>
                  {s === "kitchen" && !isDone ? (
                    <button
                      type="button"
                      onClick={tapKitchen}
                      className={cn(cls, "min-h-16")}
                      aria-describedby="adv-kitchen-hint"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <p id="adv-kitchen-hint" className="sr-only">
            {t.kitchenHint}
          </p>
        </section>

        <p className="text-center text-sm text-muted-foreground">
          {stage >= STAGE_MAX
            ? w.full
            : left === 1
              ? w.nextOne
              : fmt(w.next, { n: left })}
        </p>

        <section aria-labelledby="adv-pick" className="flex flex-col gap-1.5">
          <h2 id="adv-pick" className="text-base">
            {t.pickTitle}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {WORLDS.map((id) => {
              const on = id === world;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  data-testid={`world-${id}`}
                  onClick={() => setWorld(id)}
                  className={cn(
                    "relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-card px-1 text-sm font-bold",
                    on && "border-primary bg-accent",
                  )}
                >
                  <Glyph name={ENERGY_GLYPH[id]} className="size-6" />
                  {t.worlds[id].short}
                  {on && (
                    <>
                      <span
                        aria-hidden
                        className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Glyph name="check" className="size-3" />
                      </span>
                      <span className="sr-only">{t.pickCurrent}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {!kid && (
          <section
            aria-labelledby="adv-adult"
            className="mt-2 flex flex-col gap-2 rounded-2xl border bg-card px-4 py-4"
            data-testid="adventure-adult"
          >
            <h2 id="adv-adult" className="text-xl">
              {t.adultTitle}
            </h2>
            <p>{t.adultLead}</p>
            <p className="text-sm text-muted-foreground">{t.adultRule}</p>
            <button
              type="button"
              data-testid="kid-mode-on"
              onClick={() => setKidMode(true)}
              className="mt-1 min-h-14 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
            >
              {t.adultOn}
            </button>
            <p className="text-sm text-muted-foreground">{t.adultOnNote}</p>
          </section>
        )}

        <p className="pt-1 text-center text-xs text-muted-foreground">
          {t.notMedical}
        </p>
      </div>
    </div>
  );
}
