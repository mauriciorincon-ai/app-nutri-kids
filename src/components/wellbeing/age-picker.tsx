"use client";

import { useCan } from "@/components/family/use-family";
import { ChoiceRow } from "@/components/wellbeing/choice-row";
import { useWt, wellbeingChanged } from "@/components/wellbeing/use-wellbeing";
import { getAgeBand, setAgeBand } from "@/lib/diet/profile-notes";
import { useLocalStore } from "@/lib/local-store";
import { AGE_BANDS } from "@/lib/wellbeing/values";

/**
 * La franja de edad (decisión 1a del G-Plan): una madre o un padre la elige; se guarda solo
 * la franja, jamás la fecha de nacimiento. Escribir es solo del padre (`age` en `may()`).
 */
export function AgePicker() {
  const w = useWt();
  const can = useCan();
  const age = useLocalStore(getAgeBand, null);
  const allowed = can({ k: "age" });
  return (
    <div
      className="rounded-xl border bg-card px-4 py-3"
      data-testid="age-picker"
    >
      <h3 className="font-heading text-base font-semibold">{w.ageTitle}</h3>
      <p className="mt-1 mb-2 text-sm text-muted-foreground">{w.ageBody}</p>
      <ChoiceRow
        label={w.ageTitle}
        optional={false}
        disabled={!allowed}
        value={age?.band ?? null}
        onChange={(band) => {
          if (!band) return;
          setAgeBand(band, Date.now());
          wellbeingChanged();
        }}
        options={AGE_BANDS.map((id) => ({ id, text: w.ageBands[id] }))}
      />
      {!allowed && (
        <p className="mt-2 text-sm text-muted-foreground">{w.ageOnlyParent}</p>
      )}
    </div>
  );
}
