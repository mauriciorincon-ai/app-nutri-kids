"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { ItemCard } from "@/components/traffic-light/item-card";
import { StatusChip } from "@/components/traffic-light/status-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmt, useI18n } from "@/i18n";
import {
  resolveItemStatus,
  searchItems,
  type ItemStatus,
} from "@/lib/diet/logic";
import { formatShortDate } from "@/lib/format";
import { useToday } from "@/components/day-checklist/use-today";

/**
 * La dieta — semáforo navegable (outcome principal). Responde "¿esto se puede?"
 * en <10s: búsqueda arriba + pestañas Verde/Amarillo/Rojo.
 * LCP: h1 + buscador + pestañas nacen estáticos.
 */
export default function DietPage() {
  const { diet } = useDiet();
  const { t, l, locale } = useI18n();
  const today = useToday();
  const [query, setQuery] = useState("");

  const date = today ?? new Date(`${diet.restrictions.validFrom}T12:00:00`);
  const results =
    query.trim().length >= 2 ? searchItems(diet, query, locale, date) : null;

  const statusOf = (id: string): ItemStatus | null =>
    resolveItemStatus(diet, id, date);

  const restrictedStatuses = diet.restrictions.foods
    .map((f) => statusOf(f.id))
    .filter((s): s is ItemStatus => s !== null);

  const redStatuses = [
    ...diet.trafficLight.red.items,
    ...diet.trafficLight.red.alsoAvoid,
  ]
    .map((i) => statusOf(i.id))
    .filter((s): s is ItemStatus => s !== null);

  const yellowStatuses = diet.trafficLight.yellow.items
    .map((i) => statusOf(i.id))
    .filter((s): s is ItemStatus => s !== null);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{t.diet.title}</h1>

      <label className="relative block">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.diet.searchPlaceholder}
          aria-label={t.diet.searchPlaceholder}
          className="h-12 w-full rounded-xl border bg-card pl-9 pr-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </label>

      {results !== null ? (
        <section className="flex flex-col gap-2" aria-live="polite">
          {results.length > 0 ? (
            results.map((s) => <ItemCard key={s.id} status={s} />)
          ) : (
            <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-muted-foreground">
              {fmt(t.diet.searchNoResults, { query: query.trim() })}
            </p>
          )}
        </section>
      ) : (
        <Tabs defaultValue="green">
          <TabsList className="w-full">
            <TabsTrigger value="green" className="flex-1">
              <StatusChip color="green" label={t.diet.tabGreen} />
            </TabsTrigger>
            <TabsTrigger value="yellow" className="flex-1">
              <StatusChip color="yellow" label={t.diet.tabYellow} />
            </TabsTrigger>
            <TabsTrigger value="red" className="flex-1">
              <StatusChip color="red" label={t.diet.tabRed} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="green" className="mt-4 flex flex-col gap-5">
            {diet.trafficLight.green.groups.map((group) => (
              <section key={group.id} className="flex flex-col gap-2">
                <h2 className="text-lg">{l(group.name)}</h2>
                <p className="-mt-1 text-sm text-muted-foreground">
                  {fmt(t.diet.groupPortion, { portion: l(group.portion) })}
                </p>
                {group.items.map((item) => {
                  const s = statusOf(item.id);
                  return s && <ItemCard key={item.id} status={s} />;
                })}
              </section>
            ))}
          </TabsContent>

          <TabsContent value="yellow" className="mt-4 flex flex-col gap-2">
            {diet.trafficLight.yellow.note && (
              <p className="mb-1 text-sm text-muted-foreground">
                {l(diet.trafficLight.yellow.note)}
              </p>
            )}
            {yellowStatuses.map((s) => (
              <ItemCard key={s.id} status={s} />
            ))}
          </TabsContent>

          <TabsContent value="red" className="mt-4 flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <h2 className="text-lg">{t.diet.restrictedSection}</h2>
              <p className="-mt-1 text-sm text-muted-foreground">
                {t.diet.restrictedIntro}
              </p>
              {restrictedStatuses.map((s) => (
                <ItemCard key={s.id} status={s} />
              ))}
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-lg">{t.diet.alsoAvoid}</h2>
              {redStatuses.map((s) => (
                <ItemCard key={s.id} status={s} />
              ))}
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-lg">{t.diet.additivesSection}</h2>
              <p className="-mt-1 text-sm text-muted-foreground">
                {t.diet.additivesIntro}
              </p>
              <ul className="flex flex-col gap-2">
                {diet.trafficLight.red.additives.map((a) => (
                  <li
                    key={a.code}
                    className="rounded-xl border bg-card px-4 py-3"
                  >
                    <p className="flex items-baseline gap-2 font-semibold">
                      <code className="rounded bg-tl-red-surface px-1.5 py-0.5 font-mono text-sm text-tl-red">
                        {a.code}
                      </code>
                      {l(a.name)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {fmt(t.diet.additiveFoundIn, { where: l(a.foundIn) })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </TabsContent>
        </Tabs>
      )}

      {restrictedStatuses.some(
        (s) => s.kind === "restricted" && s.restrictionActive,
      ) && (
        <p className="text-center text-sm text-muted-foreground">
          {fmt(t.status.restrictedUntil, {
            date: formatShortDate(diet.restrictions.validUntil, locale),
          })}{" "}
          · {l(diet.restrictions.note)}
        </p>
      )}
    </div>
  );
}
