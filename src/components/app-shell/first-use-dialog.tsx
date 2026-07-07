"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { loadPrefs, savePrefs } from "@/lib/diet/storage";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";

/**
 * Primer uso: presenta el encuadre no-médico UNA vez (flag en prefs).
 *
 * NO usa portal (Radix Dialog): el portal solo monta tras hidratar y su texto
 * se volvía el LCP real de TODAS las rutas (~5s móvil, medido en CI). Este
 * overlay viaja en el HTML del servidor — el usuario nuevo lo ve en el primer
 * paint. Para quien ya aceptó, un script inline en el layout lo oculta ANTES
 * del primer paint (html[data-first-use-seen]) — sin flash.
 */
export function FirstUseDialog() {
  const { t } = useI18n();
  // Fallback false en servidor: el overlay SÍ se prerenderiza (LCP estático).
  const seen = useLocalStore(() => loadPrefs().disclaimerSeen, false);

  const accept = () => {
    savePrefs({ ...loadPrefs(), disclaimerSeen: true });
    notifyLocalStore();
  };

  if (seen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-use-title"
      aria-describedby="first-use-body"
      className="first-use-overlay fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
    >
      <section className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg">
        <h2
          id="first-use-title"
          className="font-heading text-2xl font-semibold"
        >
          {t.disclaimer.firstUseTitle}
        </h2>
        <p
          id="first-use-body"
          className="mt-2 text-base leading-relaxed text-foreground/80"
        >
          {t.disclaimer.firstUseBody}
        </p>
        <Button onClick={accept} size="lg" className="mt-5 w-full" autoFocus>
          {t.disclaimer.firstUseAccept}
        </Button>
      </section>
    </div>
  );
}
