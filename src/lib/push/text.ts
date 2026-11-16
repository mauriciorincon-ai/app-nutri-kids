import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { fmt } from "@/i18n";

import type { PushCopy } from "./copy";
import type { ScheduleText } from "./schedule";

/**
 * Los textos que el teléfono deja listos para el trabajador, en el idioma elegido (regla 20):
 * nacen en el diccionario {es, en}, redactados. Aquí solo se arman con la forma que pide
 * `schedule.ts` y `copy.ts`.
 */
export function pushTexts(locale: "es" | "en"): {
  schedule: ScheduleText;
  copy: PushCopy["text"];
} {
  const n = (locale === "es" ? es : en).pushNotify;
  return {
    schedule: {
      supplementTitle: n.supplementTitle,
      waterTitle: n.waterTitle,
      waterBody: (i, total) => fmt(n.waterBody, { n: i, total }),
    },
    copy: {
      generic: { title: n.genericTitle, body: n.genericBody },
      hidden: { title: n.genericTitle, body: n.genericBody },
      allDone: { title: n.allDoneTitle, body: n.allDoneBody },
      many: n.many,
      familyFrom: n.familyFrom,
      familyGeneric: { title: n.familyGenericTitle, body: n.familyGenericBody },
    },
  };
}
