"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera as CameraIcon,
  Check,
  Download,
  ImageUp,
  ScanBarcode,
} from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { useToday } from "@/components/day-checklist/use-today";
import { RoleLimit } from "@/components/family/role-limit";
import { useCan } from "@/components/family/use-family";
import { LabelResult } from "@/components/label/label-result";
import { Button } from "@/components/ui/button";
import { useProfileNotes } from "@/components/use-profile-notes";
import { fmt, useI18n } from "@/i18n";
import { commonText } from "@/i18n/day-to-day/common";
import { labelText } from "@/i18n/label";
import { superText } from "@/i18n/super";
import { pantryWrite } from "@/lib/camera/access";
import { aptProducts, categoryChain } from "@/lib/catalog/apt";
import { checkProduct } from "@/lib/catalog/product";
import type { Product } from "@/lib/catalog/schema";
import { dateKey } from "@/lib/diet/logic";
import { formatShortDate } from "@/lib/format";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";
import {
  ScanClient,
  canScan,
  downloadScan,
  nativeScanner,
} from "@/lib/scan/client";
import { ODBL_URL, scanDownloadBytes } from "@/lib/scan/files";
import { checkCode, type CodeProblem } from "@/lib/scan/gtin";
import { scanCached } from "@/lib/scan/scan-store";
import {
  addBought,
  getBought,
  removeBought,
  type Bought,
} from "@/lib/shopping/store";

import { BoughtList } from "./bought-list";

type Phase = "checking" | "cant" | "idle" | "loading" | "ready" | "failed";
/** Lo que se buscó: el código y, si el catálogo lo tiene, el producto (o `null` si vino roto). */
type Looked = { code: string; found: boolean; product: Product | null };

const mb = (bytes: number) => Math.max(1, Math.round(bytes / 1e6));
const NO_BOUGHT: Bought[] = [];

/**
 * El modo súper (S13 · ADR-019): el catálogo de Colombia (Open Food Facts, ODbL) se baja UNA vez tras
 * el toque; el código de barras (foto o escrito) se busca en este teléfono y el producto pasa por el
 * mismo cotejo que la foto de una etiqueta. Lo que no está en el catálogo manda a la foto de la
 * etiqueta. Nada de lo escaneado se guarda ni se envía.
 */
export function SuperMode() {
  const { locale } = useI18n();
  const s = superText[locale];
  const t = labelText[locale];
  const common = commonText[locale];
  const { diet } = useDiet();
  const today = useToday();
  const notes = useProfileNotes();
  const can = useCan();
  const canWrite = can(pantryWrite());
  const bought = useLocalStore(getBought, NO_BOUGHT);

  const [phase, setPhase] = useState<Phase>("checking");
  const [native, setNative] = useState(false);
  const [cached, setCached] = useState(false);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"none" | "read" | "no-code">("none");
  const [problem, setProblem] = useState<CodeProblem | null>(null);
  const [looked, setLooked] = useState<Looked | null>(null);
  const [apt, setApt] = useState<Product[] | null>(null);
  const [typed, setTyped] = useState("");
  const [ready, setReady] = useState<ScanClient | null>(null);
  const client = useRef<ScanClient | null>(null);
  const takeRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const total = useMemo(
    () => (phase === "checking" ? 0 : scanDownloadBytes(native)),
    [phase, native],
  );

  useEffect(() => {
    let alive = true;
    const able = canScan();
    void (async () => {
      const nat = able ? await nativeScanner() : false;
      const yes = able ? await scanCached(nat) : false;
      if (!alive) return;
      setNative(nat);
      setCached(yes);
      setPhase(able ? "idle" : "cant");
    })();
    return () => {
      alive = false;
      void client.current?.stop();
      client.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    setPhase("loading");
    setDone(0);
    try {
      if (!cached) await downloadScan((loaded) => setDone(loaded), native);
      await client.current?.stop();
      client.current = await ScanClient.start(native);
      setReady(client.current);
      setCached(true);
      setPhase("ready");
    } catch {
      client.current = null;
      setReady(null);
      setPhase("failed");
    }
  }, [cached, native]);

  const find = useCallback(async (raw: string) => {
    const c = checkCode(raw);
    setApt(null);
    setLooked(null);
    setFailed("none");
    if (!c.ok) {
      setProblem(c.problem);
      return;
    }
    setProblem(null);
    if (!client.current) return;
    try {
      const { product, found } = await client.current.lookup(c.code);
      setLooked({ code: c.code, found, product });
    } catch {
      setFailed("read");
    }
  }, []);

  const scan = useCallback(
    async (input: HTMLInputElement) => {
      const file = input.files?.[0];
      input.value = "";
      if (!file || !client.current) return;
      setBusy(true);
      setFailed("none");
      setProblem(null);
      setLooked(null);
      try {
        const code = await client.current.decode(file);
        if (code) await find(code);
        else setFailed("no-code");
      } catch {
        setFailed("read");
      } finally {
        setBusy(false);
      }
    },
    [find],
  );

  const product = looked?.product ?? null;
  const result = useMemo(
    () =>
      product && today ? checkProduct(product, diet, today, notes.notes) : null,
    [product, today, diet, notes.notes],
  );

  // Marcas aptas: de la categoría más específica hacia arriba, hasta encontrar alguna.
  useEffect(() => {
    if (!product || !today || !ready) return;
    let alive = true;
    void (async () => {
      let found: Product[] = [];
      try {
        for (const cat of categoryChain(product)) {
          found = aptProducts(await ready.sameCategory(cat), diet, today, {
            exclude: product.code,
            notes: notes.notes,
          });
          if (found.length > 0) break;
        }
      } catch {
        found = [];
      }
      if (alive) setApt(found);
    })();
    return () => {
      alive = false;
    };
  }, [product, today, ready, diet, notes.notes]);

  // El código que ya se anotó en esta visita: el botón dice «Anotado» solo para ese producto.
  const [addedCode, setAddedCode] = useState<string | null>(null);
  const justAdded = !!product && addedCode === product.code;
  const add = () => {
    if (!product || !today) return;
    addBought(
      { code: product.code, name: product.name, brand: product.brand },
      dateKey(today),
    );
    notifyLocalStore();
    setAddedCode(product.code);
  };

  const meta = ready?.meta ?? null;
  // El texto del catálogo en lugar de «lo que se leyó» de la foto.
  const catalogT = {
    ...t,
    readTitle: s.catalogText,
    readNote: s.catalogNote,
    readEmpty: s.noIngredients,
    check: s.catalogCheck,
    leadOk: s.catalogLeadOk,
    partial: s.catalogPartial,
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{s.title}</h1>
      <p className="-mt-2 text-muted-foreground">{s.lead}</p>
      <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        {common.notMedical}
      </p>

      {phase === "cant" && (
        <section
          className="flex flex-col gap-2 rounded-2xl border p-4"
          aria-labelledby="super-cant"
          data-testid="super-cant"
        >
          <h2 id="super-cant" className="text-xl">
            {s.cantTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{s.cantBody}</p>
          <Link
            href="/dieta"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            {s.searchLink}
          </Link>
        </section>
      )}

      {(phase === "idle" || phase === "loading" || phase === "failed") && (
        <section
          className="flex flex-col gap-3 rounded-2xl border p-4"
          aria-labelledby="super-catalog"
          data-testid="super-catalog"
        >
          <h2 id="super-catalog" className="text-xl">
            {s.catalogTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {cached ? s.catalogCached : fmt(s.catalogLead, { mb: mb(total) })}
          </p>
          {phase === "failed" && (
            <div role="alert" className="flex flex-col gap-1">
              <p className="font-semibold">{s.failedTitle}</p>
              <p className="text-sm text-muted-foreground">{s.failedBody}</p>
              <Link
                href="/dieta"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
              >
                {s.searchLink}
              </Link>
            </div>
          )}
          {phase === "loading" ? (
            <p role="status" className="text-sm font-medium">
              {cached || done === 0
                ? s.preparing
                : fmt(s.downloading, {
                    done: Math.min(mb(total), Math.round(done / 1e6)),
                    mb: mb(total),
                  })}
            </p>
          ) : (
            <Button
              className="min-h-11 self-start"
              onClick={() => void start()}
            >
              <Download aria-hidden />
              {phase === "failed" ? s.retry : cached ? s.prepare : s.download}
            </Button>
          )}
        </section>
      )}

      {phase === "ready" && (
        <section
          className="flex flex-col gap-3"
          aria-labelledby="super-scan"
          data-testid="super-ready"
        >
          <h2 id="super-scan" className="text-xl">
            {s.ready}
          </h2>
          <p className="-mt-1 text-sm text-muted-foreground">{s.tip}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              disabled={busy}
              onClick={() => takeRef.current?.click()}
            >
              {looked ? (
                <ScanBarcode aria-hidden />
              ) : (
                <CameraIcon aria-hidden />
              )}
              {looked ? s.another : s.takePhoto}
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => pickRef.current?.click()}
            >
              <ImageUp aria-hidden />
              {s.pickPhoto}
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
            data-testid="super-take"
            onChange={(e) => void scan(e.currentTarget)}
          />
          <input
            ref={pickRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="super-pick"
            onChange={(e) => void scan(e.currentTarget)}
          />

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void find(typed);
            }}
          >
            <label htmlFor="super-code" className="text-sm font-semibold">
              {s.typeTitle}
            </label>
            <div className="flex gap-2">
              <input
                id="super-code"
                inputMode="numeric"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-label={s.typeLabel}
                placeholder={s.typeLabel}
                className="min-h-11 min-w-0 flex-1 rounded-xl border bg-background px-3"
                data-testid="super-code"
              />
              <Button
                type="submit"
                variant="outline"
                className="min-h-11"
                disabled={busy || !typed.trim()}
                data-testid="super-code-go"
              >
                {s.typeButton}
              </Button>
            </div>
          </form>

          {busy && (
            <p role="status" className="text-sm font-medium">
              {s.reading}
            </p>
          )}
          {failed === "read" && (
            <p role="alert" className="text-sm">
              {s.readFailed}
            </p>
          )}
          {failed === "no-code" && (
            <p role="alert" className="text-sm" data-testid="super-no-code">
              {s.noCode}
            </p>
          )}
          {problem && (
            <p role="alert" className="text-sm" data-testid="super-bad-code">
              {problem === "checksum" ? s.codeChecksum : s.codeLength}
            </p>
          )}

          {looked && !looked.found && (
            <section
              className="flex flex-col gap-2 rounded-2xl border p-4"
              aria-live="polite"
              data-testid="super-notfound"
            >
              <h3 className="text-lg font-semibold">{s.notFoundTitle}</h3>
              <p className="text-sm text-muted-foreground">{s.notFoundBody}</p>
              <p className="text-sm text-muted-foreground">
                {fmt(s.scannedCode, { code: looked.code })}
              </p>
              <Link
                href="/camara/etiqueta"
                className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
                data-testid="super-to-label"
              >
                {s.labelLink}
              </Link>
            </section>
          )}

          {looked?.found && (
            <div className="flex flex-col gap-3" data-testid="super-product">
              {product ? (
                <div className="rounded-xl bg-muted px-4 py-3">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[product.brand, fmt(s.scannedCode, { code: product.code })]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ) : (
                <p className="text-sm">{s.notFoundBody}</p>
              )}
              {result && (
                <>
                  <LabelResult
                    result={result}
                    text={product?.ing ?? ""}
                    t={catalogT}
                    testId="super-result"
                    lead={{ unreadable: s.leadUnreadable }}
                    chipUnreadable={s.chipNoList}
                  />
                  {result.verdict === "unreadable" && (
                    <Link
                      href="/camara/etiqueta"
                      className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
                      data-testid="super-to-label"
                    >
                      {s.labelLink}
                    </Link>
                  )}
                  {canWrite ? (
                    justAdded ? (
                      <p
                        role="status"
                        className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-tl-green"
                        data-testid="super-add"
                      >
                        <Check aria-hidden className="size-4 shrink-0" />
                        {s.added}
                      </p>
                    ) : (
                      <Button
                        variant="outline"
                        className="min-h-11 self-start"
                        onClick={add}
                        data-testid="super-add"
                      >
                        {s.add}
                      </Button>
                    )
                  ) : (
                    <>
                      <p className="rounded-xl border bg-card px-4 py-3 text-sm">
                        {s.roleBlocked}
                      </p>
                      <RoleLimit />
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {product && result && result.verdict !== "ok" && (
            <section
              className="flex flex-col gap-2"
              aria-labelledby="super-apt"
              data-testid="super-apt"
            >
              <h3 id="super-apt" className="text-lg font-semibold">
                {s.aptTitle}
              </h3>
              {apt === null ? (
                <p className="text-sm text-muted-foreground">{s.aptPending}</p>
              ) : apt.length === 0 ? (
                <p className="text-sm">{s.aptNone}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{s.aptLead}</p>
                  <ul className="flex flex-col gap-2">
                    {apt.map((p) => (
                      <li
                        key={p.code}
                        className="rounded-xl border px-3 py-2"
                        data-testid="super-apt-item"
                      >
                        <p className="font-medium">{p.name}</p>
                        {p.brand && (
                          <p className="text-sm text-muted-foreground">
                            {p.brand}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </section>
      )}

      <BoughtList
        items={bought}
        client={phase === "ready" ? ready : null}
        diet={diet}
        now={today}
        notes={notes.notes}
        t={t}
        s={s}
        canWrite={canWrite}
        onRemove={(code) => {
          removeBought(code);
          notifyLocalStore();
        }}
      />

      <p className="text-sm text-muted-foreground" data-testid="super-odbl">
        {s.attribution}{" "}
        <a
          href={ODBL_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
        >
          {s.licenseLink}
        </a>
        {meta && (
          <span className="block">
            {fmt(s.catalogInfo, {
              date: formatShortDate(meta.generated, locale),
              count: meta.count,
            })}
          </span>
        )}
      </p>

      <Link
        href="/camara"
        prefetch={false}
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
      >
        {s.back}
      </Link>
    </div>
  );
}
