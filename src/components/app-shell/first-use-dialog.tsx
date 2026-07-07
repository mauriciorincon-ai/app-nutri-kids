"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { loadPrefs, savePrefs } from "@/lib/diet/storage";
import { notifyLocalStore, useLocalStore } from "@/lib/local-store";

/** Primer uso: presenta el encuadre no-médico UNA vez (flag en prefs del dispositivo). */
export function FirstUseDialog() {
  const { t } = useI18n();
  // Fallback true en servidor: el diálogo solo aparece tras leer el dispositivo.
  const seen = useLocalStore(() => loadPrefs().disclaimerSeen, true);

  const accept = () => {
    savePrefs({ ...loadPrefs(), disclaimerSeen: true });
    notifyLocalStore();
  };

  return (
    <Dialog open={!seen} onOpenChange={(next) => !next && accept()}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            {t.disclaimer.firstUseTitle}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-foreground/80">
            {t.disclaimer.firstUseBody}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={accept} size="lg" className="w-full">
            {t.disclaimer.firstUseAccept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
