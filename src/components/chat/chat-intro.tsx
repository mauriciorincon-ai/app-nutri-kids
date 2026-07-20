"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { loadPrefs, savePrefs } from "@/lib/diet/storage";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";

/**
 * Nota de transparencia IA del chat — se muestra UNA vez (flag en prefs).
 *
 * Mismo patrón que FirstUseDialog: overlay estático que viaja en el HTML del
 * servidor (LCP-seguro), y un script inline pre-paint lo oculta para quien ya
 * lo vio (html[data-chat-intro-seen]) — sin flash, sin portal post-hidratación.
 */
export function ChatIntro() {
  const { t } = useI18n();
  const seen = useLocalStore(() => loadPrefs().chatIntroSeen, false);

  const accept = () => {
    savePrefs({ ...loadPrefs(), chatIntroSeen: true });
    notifyLocalStore();
  };

  if (seen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-intro-title"
      aria-describedby="chat-intro-body"
      className="chat-intro-overlay fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
    >
      <section className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg">
        <h2
          id="chat-intro-title"
          className="font-heading text-2xl font-semibold"
        >
          {t.chat.introTitle}
        </h2>
        <p
          id="chat-intro-body"
          className="mt-2 text-base leading-relaxed text-foreground/80"
        >
          {t.chat.introBody}
        </p>
        <Button onClick={accept} size="lg" className="mt-5 w-full" autoFocus>
          {t.chat.introAccept}
        </Button>
      </section>
    </div>
  );
}
