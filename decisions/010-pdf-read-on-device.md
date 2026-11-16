# ADR-010 — The professional's PDF is read on the device, then reviewed section by section

**Status:** accepted · **Date:** 2026-11-15 · **Sprint:** S006 · **Extends:** ADR-001 (local storage), ADR-003 (service worker), ADR-009 (schema v2) · **Owner decisions:** G-Plan S6 «1 a 2 a».

## Context

Until S5, a real plan could only be loaded as JSON, which someone had to build by hand from the professional's PDF. The official PDF (HTML printed by headless Chromium) carries a text layer: it can be read with code, with no OCR. Its _shape_ (two merged documents, header types, sections, columns, separators) is described without a single real datum in the planner's `ordenes/forma-del-pdf.md`. The repo is public and the PDF holds a minor's health data, identity, body measurements, lab results and the professional's contact.

## Decision

1. **Extraction happens on the phone, with no network.**
   - pdf.js (`pdfjs-dist`, pinned, legacy build) and its worker are copied from `node_modules` into `public/pdfjs/` at build time (`scripts/build-sw.mjs`). The app serves them itself and the service worker precaches them. There is no CDN and no new origin; the repo defines no CSP, and none is needed for same-origin files.
   - They load only when a PDF is chosen: `import()` by URL, outside the Next bundle, so the initial script of `/cargar` does not grow.
   - `getDocument` runs with `isEvalSupported: false`, no system fonts, and no range, stream or auto-fetch.
2. **A deterministic, pure reader.** `src/lib/diet/pdf-reader.ts` turns the extracted text into a draft:
   - Text items become lines and column segments by x (`pdf-text.ts`). Tables are rebuilt by column, never by physical line. A row that crosses a page continues without a repeated header.
   - Sections are found by **shape** (position, columns, icons, a line ending in «:», header and footer bands, a code like `E 123`) and by **single generic words only**, one word per condition (owner decision «1 a», 2026-11-15). No template phrase or title is written in the reader: `ANCHOR_WORDS` (the only anchors), `VALUE_WORDS` (units, spans, grammar, textures) and `DISCARD_WORDS` (what is never read) are exported constants, and `tests/unit/pdf-reader-anchors.test.ts` walks the reader's source and fails if a regex carries an undeclared word or two literal words in a row. The fixture is invented end to end (titles, goals, times, litres and names); the planner checks it privately against the real PDF, aiming for zero equal lines apart from the weekday names.
   - What is read: restriction validity, red-listed foods, additives (each grid cell is two segments, code and name at another x; a two-line name is centred on its code, one line above and one below) and «found in», also-avoid (each name is a line of its own ending in «:»), green groups and portions, yellow (parentheses with a limit), equivalences (notes under the red list, where «Nota <word>: the <X> includes …» swaps <X>; the «<X> as a swap [adjective]:» labels of the right-hand column, wrapping over several lines; and «<noun> of the <x>:», which carries a sentence «<verb> the <x> for <y> — <comment>» whose only option is <y>; inside an option « o » does not split, only commas and the «o»/«y» before the last option do; known limit of that rule: a last option with an inner «y»/«o» («pan y queso» alone) is split in two, and the review shows it). «el», «la» and «incluye» are declared as value words: they are the shape §2.5 (a) of the planeadora's shape document names, read only inside a note already anchored on «nota», never to locate a section, supplements (the bottle size, e.g. `4 fl oz 120 ml`, is dropped from the name; the brand stays) and their notes, menu and times (12 h → 24 h; a lone time means start + 30 min), hydration, activity (the «objetivo» sentence that carries the minutes, not the first one) and sleep.
   - Table cells are centred vertically: when one side of a row has more lines than the other, the extra lines sit above and below. Lines are assigned to the row (an additive code, a meal's icon-to-time block) closest in `y`, never by reading order; that is how each meal keeps only its own content.
   - Before any table is read, the type-B header and footer bands (60 pt from each edge) are dropped, and a footer-shaped line near the bottom of any other page too; control characters are removed before lines are joined, except U+0000.
   - U+0000 is a lost `fi`/`fl` ligature, delivered by pdf.js as a narrow text item of its own glued to its neighbours. pdf.js does not expose the glyph name, so the method is a neighbour-letter rule: `fl` before «u» (with or without accent), `fi` otherwise (about 4 in 5 in the template). It is never turned into a space nor deleted, and it never opens a space between its neighbours even if pdf.js rounds its width (`restoreLigatures`, `src/lib/diet/pdf-text.ts`). Known limit: an `fl` before another letter («flan», «flora») comes out as `fi`; the review shows it and the person caring fixes it by hand.
   - **Every datum records the page it came from** (`pages["<section>.<id>"]`), and the field is stored in the plan.
3. **What is discarded, never kept** (hard rule 2, decision 2 a). pdf.js hands the reader every page's text in memory; the reader drops the following before searching anything, and none of it is stored, logged or sent:
   - **Dropped pages:** lab results (Sections 01/02), the identity-and-measurements table (`Dato | Información`), dividers, and cover/closing pages, except the cover date.
   - **Dropped lines:** any line holding an e-mail, a phone number, `ID:`, weight, height, BMI, percentiles, age, or `kg`/`cm`. They go before any section is searched.
   - **The child's name** is taken from the type-B header only to erase it from everything read.
   - **The profile** (condition, allergies) lives in prose and is **not inferred**.
   - **Tips that name a family member** («<person>: if they have <x>, swap for <a>») are not read; the caregiver adds that swap by hand.
   - **The invented fixture** carries weight, height, BMI, percentile, name, ID and contact as bait. A test requires that none of them appear in the reading.
4. **The PDF is not stored** (decision 2 a). The bytes live only inside `readPdfFile` and the pdf.js document is destroyed when reading ends (also on error). Only the reviewed, structured plan (with pages) is kept. Nothing about the PDF goes to logs or Sentry.
5. **Nothing is saved without the caregiver's review** (decision 1 a).
   - «Revisa tu plan» shows each section with what was read and its page. The caregiver marks it «está bien», corrects it (rename, remove, add), or marks «mi plan no lo trae». Whatever was not recognized is filled in by hand on the same screen.
   - A PDF with a different shape is never rejected: it shows what it recognized.
   - The draft lives under its own key until the plan is saved, so an unfinished review can be resumed. «Borrar datos» deletes it.
   - The result is built by `plan-assemble.ts` and goes through the v2 schema.
6. **Language.** The plan's words are written into both `es` and `en` exactly as the professional wrote them. Translating them would mean inventing. The app's own texts (labels, notes, disclaimer) are written in both languages.
7. **Schema v2, additive changes only** (no version bump, a v2 JSON without them still loads):
   - optional `pages`;
   - `restrictions.foods`, `yellow.items` and `supplements` may be empty (a plan may not bring them), and the engine already handles empty lists.
   - Green groups, the menu and hydration stay required. Hydration is never invented: without it, the review asks for it.

## Consequences

- The caregiver loads the PDF they were given and confirms what the app read, with no JSON.
- The template's red categories written in prose (no deterministic pattern) are added by hand in the review.
- A scanned PDF with no text layer is reported as unreadable (OCR is out of scope).
- The real PDF may differ from the invented one. The planner runs the reader against it privately at close, and any missing field (listed without content) becomes the next sprint's first task.

## Owner decision on anchors (S6, 2026-11-15)

The S6 close left open whether generic multi-word anchors honoured «no literal template title is copied to the public repo». The owner chose «1 a»: the reader anchors only on single generic words and finds the rest by shape, and the fixture's text is invented. Both are now enforced by tests (above).
