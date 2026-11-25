# ADR-021 — What it learns: adherence, the deviation radar, the day's risk and the twin

**Status:** accepted · **Date:** 2026-11-25 · **Sprint:** S015 · **Owner decisions (G-Plan S15 «1a 2a»):**

- **(1a)** Adherence is shown in words and counts, never as a percentage: «5 de 7 días dentro del plan · lo más difícil: la merienda». The previous week is also in words.
- **(2a)** The day's risk and what to prepare are seen by whoever cares for the child that day. Adherence, the radar and the twin are seen only by a parent («madre o padre»).

**Planner decisions:**

- The twin is the app's own explainable statistics, on the phone, with no AI model.
- The twin needs 14 noted days before it says anything.
- The risk is seen when «Hoy» opens. There is no push.
- An adult notes the day's context; «someone new» is also computed from the family.

The rest are builder defaults, listed below. The ADR has two parts:

- **Part 1:** adherence and the radar (F1), and the owner's choice of look.
- **Part 2:** the day's context, the risk and the twin (F2).

## Context

VISION.md:84-87 asks for four things: plan adherence, a deviation radar, a day-risk prediction and a «digital twin». The brief frames all of them as a heuristic, not a diagnosis (`brief.md:77`). The research found no direct evidence for a twin in child adherence (`investigacion/2026-07-06-cientifica.md:127`), so the app says «it learns from what you note» and never «it predicts».

They touch the hard rules:

- **Rule 2:** no blame, no percentages read as a grade.
- **Rule 3:** non-medical framing: a pattern never names a cause or an allergy.
- **Rule 6:** everything is computed on the phone; nothing noted or learned goes to logs or Sentry.

## Part 1 — adherence and the radar

### 1. What counts as a deviation (builder default)

All of it is pure code in `src/lib/insights/days.ts` (`judgeDay`).

- Only a **noted day** is judged: a day with at least one mark or note of the plan, or a «someone offered something» entry. A day with nothing noted is «sin anotar». It is never a miss and it never subtracts. A day with only wellbeing (sleep, mood…) is not judged either.
- On a noted day, a deviation is:
  - a meal or supplement of that day's checklist (`buildDayChecklist`) left unmarked;
  - a meal note with the chip «no lo quiso» (`rejected`);
  - an offer answered «accepted» (S14 pressure log).
- Water does not count: it is a quantity, not a moment.
- Today only the meals whose window has ended are judged. Today's supplements are still on time.

### 2. Adherence

`src/lib/insights/adherence.ts`:

- **Today:** how many of today's moments are checked («van 3 de 4»).
- **This week:** the seven days ending today, in order, each one «dentro del plan», «algo distinto» or «sin anotar». The count is «N de M días anotados dentro del plan», with the unnoted days said apart.
- **Last week:** the same, in words.
- **The hardest part:** over the last 28 days (today excluded), the meal or supplement missed or rejected most often, from the second time on (`HARDEST_MIN = 2`). It shows the plan's own name and «N de M días anotados».
- No field is a ratio. A test checks that nothing returned is a decimal.

### 3. The radar

`src/lib/insights/radar.ts`. The window is the 28 days before today; today is still going.

**Thresholds (builder default):**

| Constant          | Value | Meaning                                                                                                         |
| ----------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| `RADAR_MIN_DAYS`  | 7     | With fewer noted days the radar says nothing. It says how many days it needs and how many there are.            |
| `RADAR_MIN_HITS`  | 3     | A pattern needs at least three coincidences.                                                                    |
| `RADAR_MIN_SHARE` | 0.6   | …and at least 60 % of the times it could happen («3 de 4», «7 de 10»). Shown as a count, never as a percentage. |
| `RADAR_MAX`       | 6     | At most six patterns, most repeated first.                                                                      |

**What it looks for:**

1. **A moment:** a meal or supplement left unmarked or rejected.
2. **A weekday:** the day of the week with something different from the plan.
3. **A place:** where, of what was offered, it was accepted (S14 places).
4. **A signal and a food:** a signal noted in «cómo está» (tummy ache, headache, some pain, nausea, a reaction, different stools; or the note chip «le dolió») on days when a food was also noted. It only counts when the signal appears **more** with that food than without it: if the signal appears almost every day, matching every food says nothing.

**How it speaks.** «Coincidió 3 de 4 veces», never «X causes Y». Every signal pattern closes with «Una coincidencia no dice por qué pasa: coméntalo con tu nutricionista». The radar never changes the plan, and the screen says so.

### 4. Texts

`src/i18n/learn.ts`, written in each language, with parity and a banned-phrase test (`tests/unit/insights.test.ts`):

- cause («causa», «provoca», «desencadena», «causes», «triggers»);
- allergy or intolerance;
- telling to stop a food;
- blame, «no cumplió», «failed»;
- alarm or urgency;
- prediction;
- percentages;
- calories, weight, BMI, percentiles;
- any digit outside the `{placeholders}`;
- anything `looksLikeMedicalAdvice` catches.

### 5. Reading the days

`listInsightDays()` (`src/lib/diet/day-log.ts`) reads the day log once and returns marks, notes and wellbeing per day. The engines decide what counts; the reader does not filter.

### 6. The look (owner decision)

_Pending: the owner's sentence, verbatim, on `docs/diseno/marca/aprende.html` (three directions)._
