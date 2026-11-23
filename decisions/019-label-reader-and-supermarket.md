# ADR-019 — Labels and the supermarket: the reader only reads, code decides

**Status:** accepted · **Date:** 2026-11-22 · **Sprint:** S013 · **Owner decisions (G-Plan S13 «1a»):** the catalog is Open Food Facts, Colombia only, downloaded once to the phone with its ODbL licence and attribution; scanning and «brands that fit» are resolved on the phone; a product not in the catalog goes to the label photo. Planner decisions: traces of an allergy in the plan → «not a fit»; an unreadable text → «couldn't read it», never «fits»; the reader and the catalog download on tap and are deleted in Settings. The rest are builder defaults, listed below.

This ADR has two parts: **Part 1, the label reader** (F1), and **Part 2, the supermarket** (F2, appended when it lands).

## Context

VISION.md:70 and :72 ask for checking a label by photo and a supermarket mode. Hard rules 5 and 6 apply in full, as they did for the camera (ADR-018): no paid or third-party API in the runtime, and nothing photographed or scanned leaves the phone. Browsers do not give web pages a text recognizer, so this is step two of rule 5: an open, local engine that runs inside the page.

## Part 1 — the label reader

1. **The reader only reads.** It returns TEXT and a mean confidence. Everything else is decided by code over the loaded plan (`src/lib/label/check.ts`, pure, no storage or network), and the same check serves the photo and a catalog product.
   - **Additives:** the plan's red additives are matched by code in any form: `E102`, `E-102`, `E 102`, `INS 102`, `SIN 102`, with a letter or roman suffix (`E150d`, `INS 160a(ii)`), and an `O` the reader took for a `0`. They are also matched by their name in the plan (es/en), and by a short public alias (`src/lib/label/additive-aliases.ts`, e.g. «tartrazina», «yellow 5»).
     - An alias counts only if its code is in the plan, or if its class («artificial dye», «artificial sweetener») names a red food of the plan.
     - An alias never invents a red.
   - **Reds, restrictions and yellows** are matched by their names in the plan.
   - **Allergies and intolerances** come from the plan and from what the carer noted. Both are expanded with their families (`allergen-families.ts`).
   - **Traces:** whatever follows «puede contener», «trazas», «may contain», «made in a facility…» counts as TRACES.
2. **Verdict, in this order of precedence:**
   - **Not a fit**, when the label has any of these:
     - a red additive;
     - an allergy, in the ingredients or in the traces;
     - a red food, a restriction in force or an intolerance, in the ingredients.
   - **Check it**, when the label has any of these:
     - a yellow;
     - an ended restriction (its reintroduction is guided by the professional);
     - an intolerance or a plan food only in the traces.
   - **Couldn't read it:** the text did not read well.
   - **Nothing clashes that I saw:** ONLY when the text read well.

   «Read well» means all of these (`QUALITY` in `normalize.ts`):
   - mean confidence ≥ 70;
   - ≥ 4 words of 3+ letters;
   - ≥ 60 % Latin letters;
   - ≥ 2 words that labels use («ingredientes», «azúcar», «sal», …).

   A «not a fit» or «check it» over a poorly read text is shown, and adds «the rest didn't read well: it may have more».

   Every result says «check it with an adult» and shows what was read. There are no nutrient figures.

3. **Engine:** tesseract.js 7.0.0 (Apache-2.0, published 2025-12-15), with the LSTM cores of tesseract.js-core 7.0.0. The languages are `@tesseract.js-data/spa` and `eng` 1.0.0 (MIT, 2023-09-04, `4.0.0_best_int`). All three are pinned exact.
   - `scripts/build-sw.mjs` copies the script, the worker, the three cores (relaxed-SIMD, SIMD, plain) and both languages into `public/ocr/`. That folder is gitignored and lint-ignored.
   - `src/lib/label/ocr.json` records each file's bytes, and a test checks them against the copy.
   - A phone downloads the code, ONE core (the one its browser can run, detected like tesseract.js does) and both languages: 9.1 MB with relaxed-SIMD. The size is shown before the tap.
4. **No CDN, no `blob:` worker, one cache.**
   - By default tesseract.js would fetch its worker, core and languages from jsdelivr and run the worker from a `blob:` URL (the S12 lesson: that hung). Here `workerPath`, `corePath` and `langPath` point to `/ocr/`, with `workerBlobURL: false`.
   - `cacheMethod: "none"` stops tesseract keeping its own IndexedDB copy of the languages. The only copy is the service worker's `nutrikids-ocr-<hash of versions>` cache: cache-first for `/ocr/**/*.js|.gz`, deleted only when the versions change (`OWN_CACHE`). It is measured and deleted from the app (`ocr-store.ts`). A contract test covers the service worker ↔ page pair (rule 19).
5. **No route imports the reader.**
   - The page injects `<script src="/ocr/tesseract.min.js">` (a literal URL the bundler does not follow) only after the tap.
   - The CI gate `scripts/check-model-isolation.mjs` now also fails on tesseract markers (`createScheduler`, `TesseractCore`, `tesseract.js-core`, `PSM_AUTO_OSD`).
   - It was shown failing with `scripts/demo-rojo.sh`: adding `import "tesseract.js"` to the label screen made it fail, naming `createScheduler` in 3 chunks. Restored, it was green again: 267 chunks, 0 traces.
6. **The worker's network is closed by the browser.** `next.config.ts` sends `Content-Security-Policy: connect-src 'self' blob: data:` on `/ocr/worker.min.js` (`OCR_WORKER_CSP`, asserted by a test). The worker can only reach the app's own files.
7. **The photo never leaves the phone and is never saved.**
   - It enters through the system file picker (`<input type="file" accept="image/*" capture="environment">`), so there is no camera permission and rule 24 does not apply.
   - It is scaled in memory to 1600 px on its longest side, in grey, and handed to the worker. The input is cleared, the bitmap closed, nothing stored.
   - Errors leave as a code (`OcrErrorCode`), never with the text read.
   - Opening the screen fetches nothing; the download happens only on tap.
8. **The script budget (440 KB on every route) holds.** The new route made Turbopack merge `allergen-families` two different ways, so every route downloaded it twice (+12.6..13.6 KB). Thirteen `turbopackChunking` settings were measured; the best still left +7 KB.
   - The fix pins the module to the shell: `src/components/app-shell/shell-pins.ts`, referenced by `DietProvider` with a real assignment so it is not tree-shaken.
   - It also keeps the label check off the recipe book and the options module.
   - Result: every route is 1.3–3.1 KB below `main`, at most 436.7 KB (Lighthouse, local).
   - Pinning `ui/checkbox` the same way makes it worse (+12 KB). Do not do it.

## Consequences

- **Measured on the Mac** (Chromium, through the real `/camara/etiqueta` flow):
  - The test set is 10 labels written for this test: no real brands, composed in HTML, then rotated, blurred, noised and two of them darkened. They are kept only in the scratchpad.
  - At 2000 px: 9 of 10 right. One hard label gave «couldn't read it», which is safe.
  - At 1600 px: 10 of 10, in two series (rendered at 2400 px and at 1600 px).
  - There were 0 false «nothing clashes», 0 requests while reading, and 0 requests outside the app.
  - Each photo took 0.1–0.4 s, and the reader was ready 0.8 s after the download.
  - Hence `OCR_EDGE = 1600`: fewer pixels and less memory, with no hit lost.
- Synthetic labels are not photos taken in a shop aisle. The phone test goes to the H-2 general rehearsal (owner decision). That is why «couldn't read it» outranks «fits», and why the read text is always on screen.
- Without Worker or WebAssembly, the screen says so and offers to search the plan.
