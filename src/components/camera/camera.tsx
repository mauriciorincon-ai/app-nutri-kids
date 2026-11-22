"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera as CameraIcon,
  Check,
  Download,
  ImageUp,
  X,
} from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { useToday } from "@/components/day-checklist/use-today";
import { RoleLimit } from "@/components/family/role-limit";
import { useCan } from "@/components/family/use-family";
import { Button } from "@/components/ui/button";
import { useProfileNotes } from "@/components/use-profile-notes";
import { fmt, useI18n } from "@/i18n";
import { cameraText } from "@/i18n/camera";
import { commonText } from "@/i18n/day-to-day/common";
import { pantryWrite, plateWrite } from "@/lib/camera/access";
import { plateMeal, readPlate } from "@/lib/camera/plate";
import {
  VisionClient,
  canTry,
  pixelsFromFile,
  type Progress,
} from "@/lib/camera/client";
import { matchSeen, type SeenResult } from "@/lib/camera/match";
import model from "@/lib/camera/model.json";
import { modelBytes, modelCached } from "@/lib/camera/model-store";
import {
  PASS,
  shortAgent,
  summarize,
  trialText,
  verdict,
  type Mark,
  type TrialMeta,
  type TrialPhoto,
} from "@/lib/camera/trial";
import { getPantry, togglePantry } from "@/lib/day-to-day/store";
import { notifyLocalStore } from "@/lib/local-store";
import { INGREDIENTS, type IngredientId } from "@/lib/recipes/catalog";
import { cn } from "@/lib/utils";

import { ManualPick } from "./manual-pick";
import { PlateReading } from "./plate-reading";

type Phase = "checking" | "cant" | "idle" | "loading" | "ready" | "failed";

type Shot = TrialPhoto & { result: SeenResult };

/** Lo que se está leyendo ahora: una foto o lo elegido a mano. Es lo mismo para la despensa y el plato. */
type Reading = { source: "photo" | "manual"; seen: SeenResult };

const mb = (bytes: number) => Math.round(bytes / 1e6);

/**
 * La cámara (S12 · ADR-018). El modelo SOLO ve: devuelve nombres, y el código los coteja con el
 * catálogo y el plan. La foto entra por el selector de archivos del sistema (sin permiso de cámara
 * de la página), se reduce, se transfiere al worker y se suelta: nada la guarda ni la envía. La
 * única red es la descarga del modelo, y solo tras el toque de quien cuida.
 */
export function Camera() {
  const { locale, l } = useI18n();
  const c = cameraText[locale];
  const common = commonText[locale];
  const { diet } = useDiet();
  const today = useToday();
  const notes = useProfileNotes();
  const can = useCan();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("checking");
  const [cached, setCached] = useState(false);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [meta, setMeta] = useState<TrialMeta | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeFailed, setAnalyzeFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [confirmed, setConfirmed] = useState<ReadonlySet<IngredientId>>(
    new Set(),
  );
  const [mealId, setMealId] = useState<string | undefined>(undefined);
  const client = useRef<VisionClient | null>(null);
  const takeRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const able = canTry();
    void (able ? modelCached() : Promise.resolve(false)).then((yes) => {
      if (!alive) return;
      setCached(yes);
      setPhase(able ? "idle" : "cant");
    });
    return () => {
      alive = false;
      client.current?.terminate();
      client.current = null;
    };
  }, []);

  const onProgress = useCallback((p: Progress) => {
    if (!p.file || !(p.total > 0)) return;
    setProgress((prev) => ({ ...prev, [p.file]: p }));
  }, []);

  // El último progreso, leído al terminar la carga sin volver a crear `start`.
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const start = useCallback(async () => {
    setPhase("loading");
    setProgress({});
    const t0 = performance.now();
    const fresh = () => {
      client.current?.terminate();
      const vc = new VisionClient();
      client.current = vc;
      return vc;
    };
    try {
      const first = fresh();
      const probe = await first.probe();
      if (!probe.wasm && !probe.webgpu) {
        first.terminate();
        client.current = null;
        setPhase("cant");
        return;
      }
      let ready: Awaited<ReturnType<VisionClient["load"]>>;
      if (probe.webgpu) {
        try {
          ready = await first.load("webgpu", onProgress);
        } catch {
          // Sin WebGPU utilizable: el mismo archivo corre en WASM (lo ya bajado sigue en caché).
          ready = await fresh().load("wasm", onProgress);
        }
      } else ready = await first.load("wasm", onProgress);
      const loadMs = Math.round(performance.now() - t0);
      const fromCache = cached;
      const downloaded = Object.values(progressRef.current).reduce(
        (s, p) => s + p.total,
        0,
      );
      setMeta({
        engine: ready.engine,
        modelBytes:
          fromCache || downloaded === 0 ? await modelBytes() : downloaded,
        runtimeBytes: fromCache ? 0 : ready.runtimeBytes,
        fromCache,
        loadMs,
        agent: shortAgent(navigator.userAgent),
      });
      setCached(true);
      setPhase("ready");
    } catch {
      client.current?.terminate();
      client.current = null;
      setPhase("failed");
    }
  }, [cached, onProgress]);

  const show = useCallback((r: Reading) => {
    setReading(r);
    setConfirmed(new Set());
  }, []);

  const analyze = useCallback(
    async (input: HTMLInputElement) => {
      const file = input.files?.[0];
      // El selector se vacía de inmediato: la foto no queda colgada del formulario.
      input.value = "";
      if (!file || !client.current || !today) return;
      setAnalyzing(true);
      setAnalyzeFailed(false);
      try {
        const pixels = await pixelsFromFile(file);
        const { text, ms } = await client.current.analyze(pixels);
        const result = matchSeen(text, diet, today);
        show({ source: "photo", seen: result });
        const labels = [...result.known.map((k) => k.label), ...result.unknown];
        setShots((prev) => [
          ...prev,
          { ms, result, seen: labels.map((label) => ({ label, mark: null })) },
        ]);
      } catch {
        setAnalyzeFailed(true);
      } finally {
        setAnalyzing(false);
      }
    },
    [diet, today, show],
  );

  const toggleConfirmed = (id: IngredientId) =>
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // Solo lo confirmado se escribe en la despensa; las recetas se ven en su propia pantalla, que
  // trae el recetario (así esta no lo carga).
  const save = () => {
    if (confirmed.size === 0) return;
    const have = new Set(getPantry());
    let wrote = false;
    for (const id of confirmed)
      if (!have.has(id)) {
        togglePantry(id);
        wrote = true;
      }
    if (wrote) notifyLocalStore();
    router.push("/camara/cocina");
  };

  const mark = (shot: number, label: string, value: Mark) =>
    setShots((prev) =>
      prev.map((s, i) =>
        i !== shot
          ? s
          : {
              ...s,
              seen: s.seen.map((x) =>
                x.label === label
                  ? { ...x, mark: x.mark === value ? null : value }
                  : x,
              ),
            },
      ),
    );

  const summary = useMemo(
    () => (meta ? summarize(shots, meta) : null),
    [meta, shots],
  );
  const v = summary ? verdict(summary) : null;

  const copy = async () => {
    if (!meta) return;
    const text = trialText(shots, meta, {
      title: c.copyTitle,
      engine: c.engineLabel,
      size: c.sizeLabel,
      load: c.loadLabel,
      perPhoto: c.perPhotoLabel,
      max: c.maxLabel,
      hits: c.hitsLabel,
      invented: c.inventedLabel,
      fromCache: c.fromCache,
      device: c.deviceLabel,
      photo: c.photoLabel,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const doneMB = mb(
    Object.values(progress).reduce(
      (s, p) => s + Math.min(p.loaded, p.total),
      0,
    ),
  );
  const canPantry = can(pantryWrite());
  const meal = plateMeal(diet, today ?? new Date(0), mealId);
  const canPlate = meal ? can(plateWrite(meal.id)) : true;
  const plate = useMemo(
    () =>
      reading && today
        ? readPlate(diet, reading.seen, today, notes.notes, mealId)
        : null,
    [reading, today, diet, notes.notes, mealId],
  );
  const last = shots.length - 1;
  const current = shots[last];
  const markOf = (label: string) =>
    current?.seen.find((s) => s.label === label)?.mark ?? null;

  const markButtons = (label: string) => (
    <span className="flex shrink-0 gap-1.5">
      {(
        [
          ["yes", Check, c.markYes],
          ["no", X, c.markNo],
        ] as const
      ).map(([value, Icon, aria]) => {
        const on = markOf(label) === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            aria-label={fmt(aria, { label })}
            onClick={() => mark(last, label, value)}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full border",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent",
            )}
          >
            <Icon aria-hidden className="size-5" />
          </button>
        );
      })}
    </span>
  );

  const criteria = summary && v && (
    <ul className="flex flex-col gap-1 text-sm" aria-label={c.criteriaTitle}>
      {(
        [
          [v.size, fmt(c.criteriaSize, { max: PASS.maxMB })],
          [v.speed, fmt(c.criteriaSpeed, { max: PASS.maxSeconds })],
          [v.hits, fmt(c.criteriaHits, { min: PASS.minHits, of: PASS.of })],
          [v.invented, fmt(c.criteriaInvented, { max: PASS.maxInvented })],
        ] as const
      ).map(([ok, text]) => (
        <li key={text} className="flex items-center gap-2">
          {ok ? (
            <Check aria-hidden className="size-4 text-tl-green" />
          ) : (
            <span aria-hidden className="inline-block size-4 text-center">
              ·
            </span>
          )}
          <span>
            {text} — <strong>{ok ? c.criteriaMet : c.criteriaPending}</strong>
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{c.title}</h1>
      <p className="-mt-2 text-muted-foreground">{c.lead}</p>
      <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        {common.notMedical}
      </p>

      {phase === "cant" && (
        <section
          className="flex flex-col gap-2 rounded-2xl border p-4"
          aria-labelledby="cam-cant"
          data-testid="camera-cant"
        >
          <h2 id="cam-cant" className="text-xl">
            {c.cantTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{c.cantBody}</p>
          <Link
            href="/recetas"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            {c.manualLink}
          </Link>
        </section>
      )}

      {(phase === "idle" || phase === "loading" || phase === "failed") && (
        <section
          className="flex flex-col gap-3 rounded-2xl border p-4"
          aria-labelledby="cam-model"
          data-testid="camera-model"
        >
          <h2 id="cam-model" className="text-xl">
            {c.modelTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {cached
              ? c.prepareLead
              : fmt(c.modelLead, { mb: model.downloadMB })}
          </p>
          {phase === "failed" && (
            <div role="alert" className="flex flex-col gap-1">
              <p className="font-semibold">{c.failedTitle}</p>
              <p className="text-sm text-muted-foreground">{c.failedBody}</p>
              <Link
                href="/recetas"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
              >
                {c.manualLink}
              </Link>
            </div>
          )}
          {phase === "loading" ? (
            <p role="status" className="text-sm font-medium">
              {cached || doneMB === 0
                ? c.preparing
                : fmt(c.downloading, { done: doneMB, mb: model.downloadMB })}
            </p>
          ) : (
            <Button
              className="min-h-11 self-start"
              onClick={() => void start()}
            >
              <Download aria-hidden />
              {phase === "failed" ? c.retry : cached ? c.prepare : c.download}
            </Button>
          )}
        </section>
      )}

      {phase === "ready" && (
        <section
          className="flex flex-col gap-3"
          aria-labelledby="cam-photo"
          data-testid="camera-ready"
        >
          <h2 id="cam-photo" className="text-xl">
            {c.ready}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              disabled={analyzing}
              onClick={() => takeRef.current?.click()}
            >
              <CameraIcon aria-hidden />
              {c.takePhoto}
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={analyzing}
              onClick={() => pickRef.current?.click()}
            >
              <ImageUp aria-hidden />
              {c.pickPhoto}
            </Button>
          </div>
          <input
            ref={takeRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="camera-take"
            onChange={(e) => void analyze(e.currentTarget)}
          />
          <input
            ref={pickRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="camera-pick"
            onChange={(e) => void analyze(e.currentTarget)}
          />
          {analyzing && (
            <p role="status" className="text-sm font-medium">
              {c.analyzing}
            </p>
          )}
          {analyzeFailed && (
            <p role="alert" className="text-sm">
              {c.analyzeFailed}
            </p>
          )}
        </section>
      )}

      {reading && !analyzing && (
        <>
          <section
            className="flex flex-col gap-3 rounded-2xl border p-4"
            aria-labelledby="cam-seen"
            data-testid="camera-seen"
          >
            <h2 id="cam-seen" className="text-xl">
              {c.seenTitle}
            </h2>
            <p className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
              {c.check}
            </p>
            {reading.seen.known.length === 0 &&
              reading.seen.unknown.length === 0 && (
                <p className="text-sm text-muted-foreground">{c.seenNone}</p>
              )}
            {reading.seen.known.length > 0 && (
              <>
                {canPantry && (
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{c.confirmTitle}</h3>
                    <p className="text-sm text-muted-foreground">
                      {c.confirmLead}
                    </p>
                  </div>
                )}
                <ul className="flex flex-col divide-y">
                  {reading.seen.known.map((k) => (
                    <li key={k.label} className="flex items-center gap-3 py-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-semibold">{k.label}</span>
                        {k.ingredient && (
                          <span className="text-sm text-muted-foreground">
                            {c.inCatalog}: {l(INGREDIENTS[k.ingredient])}
                          </span>
                        )}
                      </div>
                      {canPantry && k.ingredient && (
                        <ConfirmChip
                          on={confirmed.has(k.ingredient)}
                          label={l(INGREDIENTS[k.ingredient])}
                          aria={fmt(c.haveIt, {
                            label: l(INGREDIENTS[k.ingredient]),
                          })}
                          onToggle={() => toggleConfirmed(k.ingredient!)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {reading.seen.unknown.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{c.notKnownTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {c.notKnownHint}
                </p>
                <ul className="flex flex-col divide-y">
                  {reading.seen.unknown.map((label) => (
                    <li key={label} className="py-2">
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canPantry && reading.seen.known.some((k) => k.ingredient) && (
              <div className="flex flex-col gap-1">
                <Button
                  className="min-h-11 self-start"
                  disabled={confirmed.size === 0}
                  onClick={save}
                  data-testid="camera-save"
                >
                  {fmt(c.confirmButton, { n: confirmed.size })}
                </Button>
                {confirmed.size === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {c.confirmPick}
                  </p>
                )}
              </div>
            )}
          </section>

          {plate && canPlate && (
            <PlateReading
              plate={plate}
              meals={diet.dailyMenu}
              mealId={mealId}
              onMeal={setMealId}
            />
          )}
          {(!canPantry || !canPlate) && (
            <p className="rounded-xl border bg-card px-4 py-3 text-sm">
              {c.roleBlocked}
            </p>
          )}
          {(!canPantry || !canPlate) && <RoleLimit />}
        </>
      )}

      <ManualPick
        diet={diet}
        today={today}
        open={phase === "cant" || phase === "failed"}
        onUse={(seen) => show({ source: "manual", seen })}
      />

      {meta && summary && (
        <details className="rounded-2xl border p-4" data-testid="camera-trial">
          <summary className="min-h-11 cursor-pointer text-xl font-semibold">
            {c.trialTitle}
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{c.trialLead}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{c.engineLabel}</dt>
              <dd>{meta.engine === "webgpu" ? "WebGPU" : "WASM"}</dd>
              <dt className="text-muted-foreground">{c.sizeLabel}</dt>
              <dd>
                {summary.totalMB} MB{meta.fromCache ? ` (${c.fromCache})` : ""}
              </dd>
              <dt className="text-muted-foreground">{c.loadLabel}</dt>
              <dd>{(meta.loadMs / 1000).toFixed(1)} s</dd>
              <dt className="text-muted-foreground">{c.perPhotoLabel}</dt>
              <dd>
                {(summary.medianMs / 1000).toFixed(1)} s ({c.maxLabel}{" "}
                {(summary.maxMs / 1000).toFixed(1)} s)
              </dd>
              <dt className="text-muted-foreground">{c.hitsLabel}</dt>
              <dd>
                {summary.hits} ·{" "}
                {fmt(c.photosCount, { n: summary.photos, of: PASS.of })}
              </dd>
              <dt className="text-muted-foreground">{c.inventedLabel}</dt>
              <dd>{summary.invented}</dd>
            </dl>
            {current && current.seen.length > 0 && (
              <ul
                className="flex flex-col divide-y"
                aria-label={`${c.photoLabel} ${shots.length}`}
              >
                {current.seen.map((x) => (
                  <li key={x.label} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">{x.label}</span>
                    {markButtons(x.label)}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="font-semibold">{c.criteriaTitle}</h3>
            {criteria}
            <Button
              variant="outline"
              className="min-h-11 self-start"
              onClick={() => void copy()}
            >
              {copied ? <Check aria-hidden /> : null}
              {copied ? c.copied : c.copy}
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}

function ConfirmChip({
  on,
  label,
  aria,
  onToggle,
}: {
  on: boolean;
  label: string;
  aria: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={aria}
      onClick={onToggle}
      data-testid="camera-confirm"
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:bg-accent",
      )}
    >
      {on && <Check aria-hidden className="size-4" />}
      {label}
    </button>
  );
}
