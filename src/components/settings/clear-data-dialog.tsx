"use client";

import { CheckLine } from "@/components/family/parts";
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

/**
 * La confirmación de «Borrar mis datos». Vive aparte y Ajustes la carga al pulsar el botón
 * (`next/dynamic`): el primitivo del diálogo pesa ~14 KB y /ajustes está a décimas del tope de
 * script (S10); así solo lo paga quien borra.
 */
export default function ClearDataDialog({
  open,
  onOpenChange,
  inFamily,
  alsoShared,
  onAlsoShared,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inFamily: boolean;
  alsoShared: boolean;
  onAlsoShared: (value: boolean) => void;
  error: string | null;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {t.settings.clearConfirmTitle}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {t.settings.clearConfirmBody}
          </DialogDescription>
        </DialogHeader>
        {inFamily && (
          <CheckLine checked={alsoShared} onChange={onAlsoShared}>
            {t.settings.clearAlsoShared}
          </CheckLine>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-tl-red">
            ⚠ {error}
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="destructive" size="lg" onClick={onConfirm}>
            {t.settings.clearConfirmYes}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            {t.settings.clearConfirmNo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
