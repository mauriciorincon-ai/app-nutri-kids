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

The owner chose on 2026-11-25, over `docs/diseno/marca/aprende.html`, with this sentence, verbatim:

> «Me gustaria uan mezcla entre B y C, todo lo del C me gusta pero el B me gustan lo que complementa especialemnte el calendario de lo que aprende»

Reading (builder, reported in the closing report): direction **C** («la mochila y el hilo») in full is the base. From **B** come the parts that complement it, above all the **four-week calendar** on «Lo que aprende», drawn in C's colours, and a legend for the three levels under the day card. So:

- the day level is a backpack that fills (light, with something more, full), in plum, never the foods' red;
- this week is a thread of seven beads, with the four-week calendar below it;
- patterns are grouped by when, where and what matched, each with a count ring;
- what it learns is a list with its evidence, and «Borrar lo aprendido» has a lock.

`design-system.md` § «Lo que aprende y el día en Hoy» holds the rules.

## Part 2 — the day's context, the risk and the twin

All builder defaults (technical). Nothing here loosens a hard rule.

### 7. The day's context: a new map, `ctx`

- The day record gets one more map, `ctx`: `social` (an event), `away` (out of the house), `new` (someone new caring). Each is a stamped boolean in the same last-writer-wins register as the rest of the wellbeing maps (`src/lib/wellbeing/values.ts`, `CTX_KEYS`; `src/lib/family/records.ts`, `daySchema.ctx`).
- **Who writes it:** `parent`, `caregiver` and `school` (`roster.ts`, `may`). Not the nutritionist. A `ctx` op signed by another role is rejected by `WELLBEING_RULES.ctx` in `trust.ts` (valid value: `true` or a tombstone).
- It travels encrypted and signed like the rest of the day. The key is a closed list: any other key is dropped on read.
- **Contract (rule 19):** two places hardcoded the list of day maps, so a new map never synced. `sync.ts` (`hasDay`) and the test double of the server now iterate `WELLBEING_MAPS`. A contract test in `family-roles.test.ts` covers the map against the double, with every role.
- A day with only context is not «noted»: `wellbeingIsEmpty` ignores `ctx` (and lunch), so context alone never makes a day count as adherence or as history.

### 8. «Someone new» is also computed

`src/lib/insights/newcomer.ts` (`NEWCOMER_DAYS = 14`) plus `joinedAt` in `roster.ts`: the time of the first `set` op of a member in the roster chain. A member counts as new today when they joined ≤ 14 days ago **and** marked or noted something today (`by`). Founders have no `set` op: they are `null` and never count. No cryptography is touched. Without a family, only the manual toggle exists, and the screen says so.

### 9. The day's risk (no push)

`src/lib/insights/risk.ts`. Factors: **short sleep** (last night under the minimum of the age band, `readHabit` against the AASM table; no age band or no sleep noted → the factor does not add and the card says so), **social**, **away**, **new**.

- Points = factors present, plus the twin's adjustments (only for the parent, rule 2a), never below 0.
- 0 → light, 1 → with something more, ≥ 2 → full. The levels are the backpacks of the owner's direction, in plum (`--mood-anxious`), never the foods' red. The word «riesgo» does not appear in the copy.
- It shows **why** in words per factor and **what to prepare**, each item a link to something that already exists: birthday scenario, «when someone asks», plan B (out of food, late), lunchbox, «what yes and what no» (`PREPARE_HREF`).
- It is computed when «Hoy» opens. No notification, no timer.

### 10. The twin

`src/lib/insights/twin.ts`: the app's own explainable statistics, on the phone, no model.

| Constant                              | Value | Meaning                                                                                                  |
| ------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| `TWIN_MIN_DAYS`                       | 14    | With fewer noted days since the last erase it says «aún aprendiendo (N de 14 días)» and adjusts nothing. |
| `TWIN_MIN_WITH`                       | 3     | A factor is compared only if present on ≥ 3 noted days.                                                  |
| `TWIN_LIFT_UP`                        | 1.5   | Laplace-smoothed rate of «something different» with the factor ÷ without it: ≥ 1.5 adds one point.       |
| `TWIN_LIFT_DOWN`                      | 0.67  | …and ≤ 0.67 takes one away (never below «light»).                                                        |
| `TWIN_ACCEPT_HITS`                    | 3     | What it accepts (green group of the plan, texture, presentation): ≥ 3 times…                             |
| `TWIN_ACCEPT_SHARE`                   | 0.6   | …and ≥ 60 % of the times an opinion was noted. Shown as a count («5 de 6»).                              |
| `TWIN_MAX_ACCEPTS` / `TWIN_MAX_TRIES` | 4 / 3 | Caps of the list; «to try» only suggests foods **of the plan**, same group, not yet tried.               |
| `TWIN_WINDOW`                         | 90    | Looks at most three months back.                                                                         |

A «hard day» is a noted day with at least one deviation (section 1). It never says «predicts»: it says «va aprendiendo de lo que anotan».

**Erase.** `nutrikids.twin.v1` holds only `since` (`twin-store.ts`). «Borrar lo aprendido» sets `since` to today and the twin counts days **strictly after** it, so it goes back to zero without touching the log. It is local, never synced, and `clearAllData` clears it. Only a parent sees the button, in two steps.

### 11. Who sees what (G-Plan 2a)

- **The risk card in «Hoy»:** every role, with the base factors. The twin's adjustment and its lines are shown only when `seesAll` (`pressure/pattern.ts`: no family, or `parent`).
- **`/aprende`** (adherence, calendar, radar, twin): `seesAll` only. Any other role sees the role-limit notice. The nutritionist sees the day card read-only.
- The link «Lo que aprende» in «Para la familia» appears only for whoever can open it.

### 12. Weight and layout shift

The card renders in its baseline state (nothing noted, no age band) during prerender, as the rows of «Hoy» already do, so hydration does not move it: Lighthouse CLS on `/` went from 0.376 (card appearing after hydration) to 0.000. Local Lighthouse CI, median of 3: `/` 420.2 KB of script, `/aprende` 433.8 KB, both under 440 KB (ADR-020). `/aprende` has about 6 KB of margin: anything added to it must be loaded lazily.

### 13. Logs and Sentry

Nothing noted or learned is logged. The only events are `kind` and counts, as before.
