import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { fmt } from "@/i18n";
import { dietPlanSchema } from "@/lib/diet/schema";
import { buildReminder } from "@/lib/diet/logic";

/**
 * Microcopy sin culpa (regla dura 1 y 2 de la app) + "la CI verifica el
 * comportamiento, no la experiencia" (kit v1.6.1, regla 2): todo copy que
 * afirma una métrica se confronta con la definición de la métrica.
 */

function allStrings(dict: object): string[] {
  return Object.values(dict).flatMap((section) =>
    Object.values(section as Record<string, string>),
  );
}

const STRINGS = [...allStrings(es), ...allStrings(en)];

describe("microcopy: términos prohibidos por regla dura (salud sin culpa)", () => {
  // Sin calorías, peso, IMC, percentiles — ni en ES ni en EN.
  const FORBIDDEN = [
    /calor[íi]a/i,
    /\bpeso\b/i,
    /\bIMC\b/,
    /\bBMI\b/,
    /percentil/i,
    /\bkcal\b/i,
    /\bweight\b/i,
  ];

  it.each(FORBIDDEN)("ningún string del diccionario contiene %s", (rx) => {
    const offenders = STRINGS.filter((s) => rx.test(s));
    expect(offenders, `viola ${rx}`).toEqual([]);
  });
});

describe("microcopy: el recordatorio y el registro NO reprochan (tono no coercitivo)", () => {
  // El registro nunca juzga una comida no marcada: informa, no recrimina.
  const COERCIVE = [
    /olvidaste/i,
    /no marcaste/i,
    /atrasad/i,
    /deber[íi]as/i,
    /fallaste/i,
    /incumpl/i,
    /castig/i,
    /you forgot/i,
    /you failed/i,
    /you should have/i,
  ];

  const reminderAndRecord = [
    ...Object.values(es.reminder),
    ...Object.values(es.history),
    ...Object.values(en.reminder),
    ...Object.values(en.history),
  ];

  it.each(COERCIVE)("ningún copy de recordatorio/historial usa %s", (rx) => {
    expect(reminderAndRecord.filter((s) => rx.test(s))).toEqual([]);
  });
});

describe("microcopy: frase-vs-métrica del recordatorio (agua)", () => {
  const diet = dietPlanSchema.parse(
    JSON.parse(readFileSync(resolve("data/demo-diet.json"), "utf8")),
  );
  const monday = new Date("2026-07-06T07:30:00");

  it("el número de la frase de agua es el de VASOS MARCADOS, no el objetivo", () => {
    // Métrica: done = vasos marcados; target = objetivo del plan.
    const reminder = buildReminder(diet, monday, ["water:1", "water:3"]);
    expect(reminder.water).toEqual({ target: 4, done: 2 });

    // La frase que ve la mamá usa EXACTAMENTE esos números (2 de 4), sin inflar.
    const phrase = fmt(es.reminder.water, {
      done: reminder.water.done,
      target: reminder.water.target,
    });
    expect(phrase).toBe("Agua: 2 de 4 vasos");
    // Cero vasos ⇒ "0 de 4" (nunca esconde ni redondea a favor).
    const empty = buildReminder(diet, monday, []);
    expect(
      fmt(es.reminder.water, {
        done: empty.water.done,
        target: empty.water.target,
      }),
    ).toBe("Agua: 0 de 4 vasos");
  });
});
