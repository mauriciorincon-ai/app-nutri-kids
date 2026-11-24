# ADR-020 — Family learning, the social-pressure log and the kid adventure

**Status:** accepted · **Date:** 2026-11-24 · **Sprint:** S014 · **Owner decisions (G-Plan S14 «1a 2a»):**

- **(1a)** Anyone in the family can note a pressure moment. Only a parent («madre o padre») sees the full log and the pattern. Every other phone sees what it noted.
- **(2a)** The «modo niño» runs on an adult's phone. It shows no plan and no Settings, and it has an adult exit. There is no new role.

**Planner decisions:**

- Energy comes from habits and exploration, never from eating, and it never goes down.
- Lessons paraphrase and cite their source.
- The pattern counts by type, food and place.

The rest are builder defaults, listed below.

The ADR has two parts:

- **Part 1:** the family (F1).
- **Part 2:** the adventure (F2). It is written once the owner chooses the look.

## Context

VISION.md:79-81 asks for three things: education for relatives, a social-pressure detector, and a game for the child. All of them touch the hard rules:

- **Rule 2:** no blame and no food as a reward.
- **Rule 3:** non-medical framing.
- **Rule 6:** the family's data never leaves the phone in clear text.
- Family sync uses **one key per family** (`src/lib/family/crypto.ts:18`).

## Part 1 — the family

### 1. Lessons

`src/lib/family-learn/lessons.ts` holds five micro-lessons, written in each language (not translated):

1. support without scolding;
2. food is not a prize or a punishment;
3. no forcing and no bargaining for bites;
4. many tries without pressure;
5. what to say when the child asks for what they can't have.

Each lesson has a gist, short points, phrases to say as they are, and its sources. The sources were read on 2026-11-24, and the text paraphrases them. Nothing is copied:

- **AAP · HealthyChildren.org,** «How to Handle Mealtime Struggles and Build Healthy Eating Habits in Children», adapted from «Tips for Preventing Food Hassles». https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Tips-for-Preventing-Food-Hassles.aspx
- **AAP · HealthyChildren.org,** «10 Tips for Parents of Picky Eaters», from the AAP Committee on Nutrition. https://www.healthychildren.org/English/ages-stages/toddler/nutrition/Pages/Picky-Eaters.aspx
- **AAP · HealthyChildren.org,** «Emotional Eating». Only its part on praising with words and rewarding without food is used. The page is framed around weight, and that framing is not used. https://www.healthychildren.org/English/health-issues/conditions/emotional-problems/Pages/emotional-eating.aspx
- **Ellyn Satter Institute,** «The Satter Division of Responsibility in Feeding». Its handouts cannot be modified, so the idea is paraphrased and cited, never reproduced. https://www.ellynsatterinstitute.org/how-to-feed/division-of-responsibility/
- **USDA NESR,** the systematic reviews on repeated exposure and food acceptance (birth to 24 months, NESR 2019; 2 to 6 years, NESR 2025), cited as in ADR-015.

`tests/unit/family-learn.test.ts` guards every new string, in ES and EN. Each of these is at zero:

- blame;
- «portarse bien» / «be good»;
- food named as a prize, unless the sentence denies it;
- «solo un poquito» and bargaining for bites;
- alarm or urgency;
- digits;
- calories, weight, height, BMI or percentiles;
- links;
- `looksLikeMedicalAdvice`;
- in English, a gendered pronoun for the child.

Each lesson stays at 280 words or fewer, which reads in under two minutes.

### 2. «Qué sí y qué no»

`familyYesNo(diet, now, notes)` (`src/lib/family-learn/yes-no.ts`, pure) builds the sheet from the loaded plan and the caregiver's notes only:

- **What the child can't have:** restrictions in force, reds, «also avoid», allergies, intolerances and what was noted.
- **Additives to avoid,** by label code.
- **With a condition:** yellows, by name only. Their amount is omitted on purpose and the sheet says «ask the caregiver». The sheet carries no digits.
- **What the child can have,** by plan group, without anything that is avoided today.

Nothing is invented: a test checks that every name on the sheet appears in the plan.

### 3. The social-pressure log («Cuando le ofrecen algo»)

**An entry** is `{id, t, date, by, who, what, place, answer}` (`src/lib/pressure/values.ts`, strict Zod):

- `who` is the device id of a family phone, or `"other"`.
- `what` is a plan item id, or `"outside"`.
- `place` and `answer` are closed lists.

There is **no free text**, so an entry cannot hold a third person's name, an address or the child's data. Lists are pruned to 90 days and 200 entries per phone.

**Storage and travel.** Entries live in `nutrikids.pressure.v1`, split into `own` and `others`. With a family, each phone's own list travels as the record `pressure:<deviceId>`. The record is encrypted like every family record and **signed whole by that phone** (`src/lib/pressure/shared.ts`, the same pattern as `log:`). Nobody can write into another phone's record: a forged signature, or an entry whose `by` is another phone, drops the whole record. When the owner removes everything they noted, an empty list is uploaded, so the removal reaches the parents too.

**Who writes.** Every role may write: `may(m, {k: "pressure"})` in `src/lib/family/roster.ts`.

**Who reads (1a).** `src/lib/family/sync.ts` applies the rule:

- Only a parent's phone verifies and stores the other phones' records.
- Any other role lets them pass without storing or showing them.
- A phone that stops being a parent, or that leaves the family, drops what others noted. This happens at sync step 1d and in `clearFamilyLocal`.

The screen uses the same rule (`seesAll` and `visibleEntries`, `src/lib/pressure/pattern.ts`). Without a family, the phone is the only one and sees everything.

**Declared limitation (builder default).** The family shares one key, so rule 1a is enforced by the app, not by the cryptography. A modified client that holds the family phrase could decrypt the records it receives. Separating them by key means changing the crypto and the signature, which S14 excludes. A per-role encryption would belong to a sprint that touches the crypto.

**No trace.** Nothing about pressure goes to the family log, so nobody learns that they were noted. Nothing goes to app logs or Sentry either. «Borrar datos» clears the log (`clearAllData`).

**Strategy and pattern.**

- `STRATEGIES` gives each place its own steps and a sentence for the adult who offered. They are written in each language, name no food and blame nobody.
- What to offer instead comes from `buildScenario("offered").safe`, which holds only the plan's greens.
- `pressurePattern` counts the last 30 days by place, by food and by the food-and-place pair. It names a pattern from the second repeat on. It never counts by person.

### 4. Screens and weight

**Routes.** `/familia` holds the lessons and the sheet; `/familia/presion` holds the log. Both are in `SHELL_ROUTES` and in `lighthouse-urls.json`.

**Links.** They are reached from Hoy («Para la familia») and from the «offered» scenario («Anotarlo»). These links and the link between the two screens **do not prefetch**, as the camera has done since S13.

**One weight meter.** Lighthouse CI, the same command as the `lighthouse` job, is the only meter. The scratchpad meter `static.mjs` is deleted. Measured on 2026-11-24, on the same build:

- **The static meter added the chunks of all six bottom-nav routes,** as if every one were prefetched. It gave `/familia` 474.1 KB, `/` 465.7 KB and a maximum of 486.9 KB.
- **Lighthouse counts only the scripts the page actually requests.** Those are the route's own scripts plus the ones prefetched by links in view at load. It gave `/familia` 437.7 KB and `/` 429.3 KB.
- **The difference is the prefetch the static meter assumed.** It never happens on load. The reverse case did happen: with the sibling link in view, `/familia` really did request `/familia/presion`'s chunk and reached 448.9 KB. Lighthouse saw it; the static meter would have hidden it inside its fixed union.

**Final numbers** (Lighthouse, median of 3, local `CI=1` build):

| Route              | Script   | CLS   | TBT   |
| ------------------ | -------- | ----- | ----- |
| `/`                | 429.3 KB | 0.009 | 36 ms |
| `/familia`         | 437.7 KB | 0     | 33 ms |
| `/familia/presion` | 438.4 KB | 0     | 34 ms |
| `/escenarios`      | 433.9 KB | 0     | 32 ms |

The sheet needs the day, so it renders after the lessons, and nothing above it moves. Before this, CLS was 0.40.

### Consequences of part 1

- A new family record kind (`pressure:`), with its write kind in the role matrix. The matrix test covers it.
- Parents see a log that other phones cannot see. The guarantee is the app, as declared above.
- The lessons are repo content. Changing one means changing its sources and passing the banned-phrase test.

## Part 2 — the adventure

Pending the owner's choice of look (`docs/diseno/marca/juego.html`). It is written in F2 with the owner's phrase, word for word.
