# ADR-019 — Labels and the supermarket: the reader only reads, code decides

**Status:** accepted · **Date:** 2026-11-22 · **Sprint:** S013 · **Owner decisions (G-Plan S13 «1a»):** the catalog is Open Food Facts, Colombia only, downloaded once to the phone with its ODbL licence and attribution; scanning and «brands that fit» are resolved on the phone; a product not in the catalog goes to the label photo. Planner decisions: traces of an allergy in the plan → «not a fit»; an unreadable text → «couldn't read it», never «fits»; the reader and the catalog download on tap and are deleted in Settings. The rest are builder defaults, listed below.

This ADR has two parts: **Part 1, the label reader** (F1), and **Part 2, the supermarket** (F2).

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

## Part 2 — the supermarket

1. **The catalog is Open Food Facts, Colombia only, built once on the builder's Mac.**
   - `scripts/build-catalog.mjs --csv` streams the official CSV export (1.5 GB compressed, never saved to disk), keeps the rows whose country is Colombia and writes `data/catalog/off-co.json`. It never runs in CI or at runtime; the app reads the JSON.
   - **Declared deviation.** The plan said the search API (`countries_tags_en=colombia`) instead of the 13.8 GB JSONL dump. Measured: the API answers pages 1–10 and refuses every page from 11 on (401/503 for over an hour, while pages 1–3 and other sorts answer), and any extra filter gets «Page temporarily unavailable». It can give about a thousand products per query shape, not the 10,123 of the country. So the build reads the CSV export, which is the same ODbL data in a tenth of the size. The API mode stays in the script (`--cache`, resumable) for small refreshes.
   - A CSV row is turned into the shape of the API by one pure function (`csvRowToRaw`), so a single cleaner (`cleanProduct`) serves both.
   - **What an entry keeps:** `code`, `name`, `brand`, `cat` (categories, general → specific, at most 8), `ing` (ingredients text), `add` (additive codes), `alg` (allergen tags) and `tr` (trace tags). Nothing else.
   - **What it drops:**
     - non-food (cosmetics, hygiene, pet food);
     - products without a name or without a valid GTIN (8, 12 or 13 digits with the check digit);
     - any sentence with contact or paperwork (phones, addresses, emails, links, sanitary registry, «fabricado por…»);
     - runs of 7 or more digits;
     - an ingredients text that is mostly noise (it is emptied, so the app says «I don't know what it has» instead of guessing).
   - A test runs the cleaner on adversarial text and on the real catalog (no phones, links or emails; food only; only those fields).
   - It carries `license: "ODbL-1.0"` and its source. The attribution is shown before the download, on the screen and in Settings (© Open Food Facts contributors, ODbL, with the link).
   - The catalog never carries anything from a plan or a family.
2. **One worker for the supermarket.** `/scan/scan-worker.js` (a classic worker stamped from `scripts/scan-worker.template.js`) has four operations: `load`, `lookup`, `sameCategory` and `decode`.
   - It indexes the catalog by code and by category after the tap, and it answers from memory.
   - **Decoding** uses the browser's `BarcodeDetector` when it reads `ean_13` (nothing extra is downloaded). Otherwise the worker lazily loads zxing-wasm 3.1.6 (MIT, published 2026-10-19), as an IIFE through `importScripts`, for EAN-13, EAN-8 and UPC-A. UPC-E is left out: Colombian packs do not use it.
   - The code can always be typed. It must pass the GTIN check digit, and a UPC-A also looks up as an EAN-13 with a leading zero.
   - **Its network is closed twice.** The worker's only `fetch(` is the catalog file. `next.config.ts` sends `Content-Security-Policy: connect-src 'self'` on `/scan/scan-worker.js` (`SCAN_WORKER_CSP`, asserted by a test), so the browser blocks anything else even if the worker's own guard failed. Errors leave as a code, never as the code scanned.
3. **Two caches, both ours.** `nutrikids-scan-<hash of zxing version + worker>` and `nutrikids-catalog-<hash of the catalog content>`. The service worker serves them cache-first (`SCAN_PATTERN`, `CATALOG_PATTERN`), keeps them on activate and deletes old ones (`OWN_CACHE`). A contract test covers the service worker ↔ page pair (rule 19). Settings measures and deletes them with the reader's cache.
4. **A product is checked like a label.** `checkProduct` (`src/lib/catalog/product.ts`) turns the entry into the declaration `checkLabel` takes (`codes`, `contains`, `traces`): the OFF allergen tags are mapped to Spanish and English words, and the additive codes are read with their suffix (`E150D` → `E150`).
   - An empty declaration never gives «nothing clashes»: with no ingredients it is «couldn't read it», and the screen offers the label photo.
   - Every product passes a Zod schema first; a malformed one is «I don't know what it has».
5. **Brands that fit.** `aptProducts` (`src/lib/catalog/apt.ts`, pure) takes products of the scanned product's most specific category, and up to two levels above it (never the root). It keeps ONLY `verdict === "ok"`, drops the scanned product, sorts by brand and name, and shows at most 5. A «check it» or «couldn't read it» is never offered as a fit. The verdict is the same code as above, with today's plan.
6. **What I bought.** `src/lib/shopping/store.ts`, in `localStorage` (`nutrikids.bought.v1`), at most 200, with code, name, brand and date. It never stores a verdict: it is recomputed with today's plan, so if the plan changes, a calm warning (symbol + text + colour) says which product no longer fits. Local, not synced (like the pantry), cleared by «Delete data». Writing needs the pantry permission; the other roles see the role limit.
7. **Settings.** «Reader and catalog» shows the space used, the delete button and the ODbL attribution. «Delete data» also deletes the three caches (`src/lib/reader-caches.ts`, import-free).
8. **No route imports the scanner or the catalog.** The page injects nothing: the worker is created after the tap and loads its own files. `scripts/check-model-isolation.mjs` fails on markers of zxing and of the catalog.
   - **Shown failing with `scripts/demo-rojo.sh`, and it caught a defect.** The first markers (`prepareZXingModule`, `ZXING_WASM_SHA256`) were erased by the production minifier, so the gate passed with zxing inside a route. The markers are now texts the library keeps (`Pharmazentralnummer`, `Cannot pass non-string to std::string`).
   - With the fixed markers: importing zxing in `/camara/super` made it fail naming `Pharmazentralnummer` in 3 chunks, and importing the catalog made it fail naming `countries_tags_en=colombia`. Both went back to green: 278 chunks, 0 traces.
9. **The budget lesson (script ≤ 440 KB on every route).** The «Reader and catalog» section first sat in `/ajustes`, a bottom-nav route, so its code joined the chunk set every bottom-nav route loads (+2.6 KB gz everywhere; `/camara` reached 439.5 KB). It is now a `next/dynamic` import with `ssr: false` and a reserved height, and the delete helper that Settings needs lives in a tiny import-free module. Anything heavy placed in a bottom-nav route is paid by all of them.
   - Result (Lighthouse, local): the heaviest route is `/camara` at 437.1 KB; `/camara/super` 432.7 KB; `/ajustes` 430.1 KB.

### Consequences of part 2

- **The catalog, measured** (built 2026-11-23 from the CSV export, which has 10,125 rows for Colombia):
  - **9,027 products** after cleaning (food only, valid GTIN, a real name). The file is 2,004,926 bytes (about 2.0 MB, 0.43 MB gzipped).
  - **Coverage is thin, and the app says so.** 1,708 products (19 %) have an ingredients text, 1,103 declare allergens, 570 declare traces, 1,097 carry additive codes and 2,786 have a category.
  - So for most products the screen says «I don't know what it has» and offers the label photo; it never calls them «nothing clashes». «Brands that fit» come only from the products with ingredients and a category. Those are the honest limits of the open data in Colombia, and the reason the label photo exists.
- **A phone downloads** the worker (4 KB), the catalog (2.0 MB) and, only when its browser has no native `BarcodeDetector` for EAN-13, zxing-wasm (38 KB + 947 KB). The size is shown before the tap, and nothing is requested before it.
- **Not measured here:** a real barcode in a shop aisle, with the phone's own camera app. The phone test goes to the H-2 general rehearsal (owner decision). Typing the code always works.
- **The gate caught its own weak markers** (item 8). A gate is only believed after it fails once.
- **Dependency:** zxing-wasm 3.1.6, exact (MIT, published 2026-10-19: 34 days old). The newer 3.1.7 (2026-11-15) is not used, per the sprint rule.
