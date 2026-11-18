"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Utensils } from "lucide-react";

import { useWt } from "@/components/wellbeing/use-wellbeing";
import type { ComponentProps } from "react";

// El formulario pesa más que el resto de Hoy: se descarga solo al abrirlo.
const FoodLog = dynamic(() => import("@/components/wellbeing/food-log"), {
  ssr: false,
});

/** El botón que abre la bitácora de aceptación de una comida (o de un alimento). */
export function FoodLogSlot(
  props: ComponentProps<typeof FoodLog> & { label?: string },
) {
  const w = useWt();
  const [open, setOpen] = useState(false);
  const { label, ...rest } = props;
  return (
    <>
      <div className="pl-9">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Utensils aria-hidden className="size-4" />
          {label ?? w.foodTitle}
        </button>
      </div>
      {open && <FoodLog {...rest} />}
    </>
  );
}
