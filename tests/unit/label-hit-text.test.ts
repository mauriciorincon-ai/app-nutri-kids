import { describe, expect, it } from "vitest";

import { hitText } from "@/components/label/label-result";
import { labelText } from "@/i18n/label";
import type { LabelHit } from "@/lib/label/check";

/** Cómo se dice cada motivo (S13): lo que está en los ingredientes «lleva»; lo de «puede contener», «puede llevar». */
const name = { es: "Mariscos", en: "Shellfish" };
const allergy = (where: "ingredients" | "traces"): LabelHit => ({
  kind: "allergy",
  where,
  name,
});

describe("hitText", () => {
  it.each(["es", "en"] as const)(
    "en %s: ingredientes dicen «lleva», trazas «puede llevar»",
    (l) => {
      const t = labelText[l];
      const say = (h: LabelHit) => hitText(h, t, (x) => x[l]);
      const inIng = say(allergy("ingredients"));
      const inTr = say(allergy("traces"));
      expect(inIng.startsWith(t.has)).toBe(true);
      expect(inTr.startsWith(t.mayHave)).toBe(true);
      expect(inTr).not.toBe(inIng);
      expect(inTr).toContain(name[l]);
      // Nada de «lleva» y «puede contener» en el mismo motivo: se contradecían.
      expect(inTr.startsWith(t.has + " ")).toBe(false);
    },
  );

  it("un parecido dice qué se leyó y a qué se parece", () => {
    const t = labelText.es;
    const text = hitText(
      { kind: "similar", where: "ingredients", name, seen: "camar6n" },
      t,
      (x) => x.es,
    );
    expect(text).toContain("camar6n");
    expect(text).toContain("Mariscos");
  });
});
