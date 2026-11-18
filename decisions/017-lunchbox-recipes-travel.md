# ADR-017 — Lunchbox, recipe book and travel mode: code first, on the device, nothing invented

**Status:** accepted · **Date:** 2026-11-18 · **Sprint:** S011 · **Owner decisions:** G-Plan S11 «1a» (starter recipe book and «with what I have» now; photo → recipe is S12). The rest are builder defaults, listed below.

## Context

Three roadmap features of the VISION were missing: a lunchbox that holds up without a fridge, a recipe book that respects the plan, and a travel mode. All three touch hard rules 1, 2, 5 and 6: they handle the child's health data, must never invent a food or give medical advice, and must not need a paid or third-party AI. All three are built as pure code over the loaded plan.

## Decision

1. **Lunchbox engine (`src/lib/lunchbox/`).** Candidates come from the foods the plan accepts, filtered by the traffic light for the date (green or yellow), by «keeps without a fridge» (plan mark or S9 mark) and by texture. A red food, an allergy, an intolerance or a non-accepted texture never gets in; negative tests cover each. If the plan only has free text for lunch, the engine uses the food groups and says so.
2. **Lunch map in the day record.** `day:<date>` gets a `lunch` map, so encryption, signing, caps and merge are the S10 plumbing. Parent and caregiver write it; only a parent writes the label name; school reads only if its member has meals, otherwise it sees the «your access does not include meals» note. Fixed along the way: `hasDay` in `family/sync.ts` ignored a day that only carried the lunch map, so it was never uploaded (found by the end-to-end family tests against the server double).
3. **Weekly shopping list** is derived, never stored.
4. **Label and QR carry text, never a link.** The label is plain text (allergies, intolerances, what goes today; the name only if a parent wrote it) in ES and EN. The QR encodes that text in UTF-8 bytes, level M, at most 360 bytes; a test rejects `http`, `://` and any host. Library: `qrcode-generator` 2.0.4 (published 2025-08-07, MIT, no dependencies), the only new dependency. Printing uses `window.print()` and `@media print` (`[data-print-sheet]` / `[data-no-print]`); no PDF library.
5. **Recipe book (`src/lib/recipes/`).** ≥ 30 recipes written in ES and EN (not translated), ingredients by catalog id, time and cost in three levels, no brands, no nutrient figures. **Matching to the plan is by name**: an exact match wins, otherwise the worst partial match; what the plan does not have is «not in your plan» (unknown, never green). A swap only comes from `diet.equivalences` whose `whenMissing` is the plan item. Red hides the recipe and names the ingredient; yellow marks it; allergy or intolerance hides it; a non-accepted texture marks it (it depends on how it is cooked). The demo got a chicken and rice equivalence so the swap path is exercised. A test runs every recipe against the test plan.
6. **«With what I have».** The pantry is local and marks recipes «make it now» or «with a safe swap».
7. **Own recipes are local-only (not synced).** Syncing a `recipe:` named kind would touch sync, records, trust, roster and log, and is a family-sharing decision with its own risk. They are reviewed against the plan like the starter ones. Revisit with the owner if sharing them matters.
8. **Travel mode (`src/lib/travel/`).** A checklist from the plan (foods that keep, supplements, medications), a day plan from the plan's meal slots (no invented hours), and a medical document in ES and EN built from the emergency sheet plus what the carers noted. It is generated on the phone with no request and carries a «contains health data» notice. The name appears only if a parent wrote it.
9. **Weight and loading.** Texts live in one module per screen (`src/i18n/day-to-day/*`), each screen imports only its own. Recipe steps load lazily when a card opens. The QR is drawn only when it scrolls into view (`WhenInView`). Measured script weight: `/` 415.7, `/lonchera` 435.5, `/recetas` 436.5, `/viaje` 427.8 KB (budget 440 KB; the margin on `/recetas` is 3.5 KB).
10. **Chunking lesson.** A `next/dynamic` whose target imports shared UI and i18n modules makes Turbopack re-split the shared chunks and inflates every route (+13 KB). Dynamic imports are only used for light, self-contained targets (the QR, the steps).

## Consequences

- Nothing leaves the phone in the QR or the document; the lunch map travels only encrypted and signed, and the server double never sees its type, names or content.
- Adding a recipe means adding to `book.ts` and `steps.ts` (a test checks that their ids match) in both languages.
- Name-based matching is conservative: a plan that names a food differently shows «not in your plan» rather than a wrong green.
