"use client";

import { useMemo } from "react";
import Link from "next/link";

import { useDiet } from "@/components/diet-provider";
import { useToday } from "@/components/day-checklist/use-today";
import { RoleLimit } from "@/components/family/role-limit";
import { useCan } from "@/components/family/use-family";
import { useProfileNotes } from "@/components/use-profile-notes";
import { useI18n } from "@/i18n";
import { cameraCookText } from "@/i18n/camera-cook";
import { commonText } from "@/i18n/day-to-day/common";
import { pantryWrite } from "@/lib/camera/access";
import { cookFromPantry } from "@/lib/camera/cook";
import { getPantry } from "@/lib/day-to-day/store";
import { useLocalStore } from "@/lib/local-store";
import { INGREDIENTS, type IngredientId } from "@/lib/recipes/catalog";

import { CookResults } from "./cook-results";

const EMPTY: IngredientId[] = [];

/**
 * «Qué cocinar con lo que tienes» (S12 · ADR-018): lo que quien cuida confirmó en la cámara ya está
 * en la despensa de este teléfono; aquí el código lo coteja con el recetario y, si nada sale, con
 * las plantillas de cocina. Es su propia pantalla a propósito: trae el recetario, y así `/camara`
 * no lo carga para abrir.
 */
export function CameraCook() {
  const { locale } = useI18n();
  const c = cameraCookText[locale];
  const common = commonText[locale];
  const { diet } = useDiet();
  const today = useToday();
  const notes = useProfileNotes();
  const can = useCan();
  const ids = useLocalStore(getPantry, EMPTY);
  const pantry = useMemo(
    () => ids.filter((id): id is IngredientId => id in INGREDIENTS),
    [ids],
  );
  const allowed = can(pantryWrite());
  const cooked = useMemo(
    () =>
      today && allowed && pantry.length > 0
        ? cookFromPantry(new Set(pantry), {
            diet,
            now: today,
            notes: notes.notes,
            accepted: notes.acceptedTextures,
          })
        : null,
    [diet, today, notes, pantry, allowed],
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-3xl">{c.resultsTitle}</h1>
      <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        {common.notMedical}
      </p>
      {allowed && pantry.length > 0 && (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
          {c.check}
        </p>
      )}
      {!allowed ? (
        <>
          <p className="rounded-xl border bg-card px-4 py-3 text-sm">
            {c.roleBlocked}
          </p>
          <RoleLimit />
        </>
      ) : pantry.length === 0 ? (
        <p className="text-sm" data-testid="camera-cook-empty">
          {c.pantryEmpty}
        </p>
      ) : (
        cooked && <CookResults cooked={cooked} pantry={pantry} />
      )}
      <Link
        href="/camara"
        prefetch={false}
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
      >
        {c.backToCamera}
      </Link>
    </div>
  );
}
