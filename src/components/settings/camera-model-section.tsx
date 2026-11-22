"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fmt, useI18n } from "@/i18n";
import { cameraModelText } from "@/i18n/camera-model";
import { deleteModel, modelBytes } from "@/lib/camera/model-store";

/**
 * «Borrar el modelo» (S12 · ADR-018): dice cuánto ocupa el modelo de la cámara en este teléfono y
 * lo borra sin tocar nada más. Solo mira las cachés del modelo; no descarga nada.
 */
export function CameraModelSection() {
  const { locale } = useI18n();
  const c = cameraModelText[locale];
  // null = todavía mirando · 0 = nada guardado
  const [bytes, setBytes] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const look = useCallback(async () => {
    setBytes(await modelBytes());
  }, []);

  useEffect(() => {
    let alive = true;
    void modelBytes().then((n) => alive && setBytes(n));
    return () => {
      alive = false;
    };
  }, []);

  const remove = async () => {
    await deleteModel();
    setDone(true);
    await look();
  };

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="set-model"
      data-testid="settings-model"
    >
      <h2 id="set-model" className="text-lg">
        {c.title}
      </h2>
      {bytes === null ? (
        <p className="text-sm text-muted-foreground">{c.checking}</p>
      ) : bytes > 0 ? (
        <>
          <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
            {fmt(c.body, { mb: Math.max(1, Math.round(bytes / 1e6)) })}
          </p>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => void remove()}
          >
            <Trash2 aria-hidden className="size-5" />
            {c.button}
          </Button>
        </>
      ) : (
        <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
          {c.none}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="rounded-xl bg-tl-green-surface px-4 py-3 text-sm font-semibold text-tl-green"
        >
          {c.done}
        </p>
      )}
    </section>
  );
}
