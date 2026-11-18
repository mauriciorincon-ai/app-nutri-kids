# ADR-016 — A real dark theme: «System» by default, a manual choice that wins, no flash

**Status:** accepted · **Date:** 2026-11-18 · **Sprint:** S011 · **Revises:** the S1 «light-only» scope note in `design-system.md` · **Owner decisions:** none needed (G-Plan S11 «1a» only rules the recipe book).

## Context

Until S10 the app had a `.dark` block with 41 tokens, but nothing ever set the class and nothing answered `prefers-color-scheme`, so a phone in dark mode saw the light theme. Worse, seven e2e specs ran axe «in both themes» with `page.emulateMedia({ colorScheme })`, which changed nothing: the «dark» passes measured the light theme twice, and the S10 closing note listed dark mode as debt inherited from S1. The block itself was also a neutral grey, not the warm kitchen palette of the light theme, and carried no traffic-light (`--tl-*`) tokens at all, so a green or red food would have kept its light surface on a dark page.

## Decision

1. **A preference with three values** in `nutrikids.prefs.v1`: `theme: "system" | "light" | "dark"`, default `system`. A manual choice beats the phone. It is a display preference, like the language, not child data; «Delete my data» keeps it. `loadPrefs()` maps the field and drops any other value to `system` (it drops unknown keys by design, so the field had to be added there, and a test proves that changing the language does not lose the theme, and the other way round).
2. **No flash.** `THEME_SCRIPT` (`src/lib/theme-script.ts`) is inlined at the top of `<body>`, synchronous, and sets the `dark` class on `<html>`, `color-scheme`, and the `theme-color` meta tags before the first paint. `ThemeSync` (client) keeps them current when the setting changes or, in «System», when the phone switches. Both go through the same rules; a unit test runs the inline string against `applyTheme` for six combinations so they cannot drift apart. `applyTheme` touches `<html>` only when something changed (a needless mutation invalidates styles for the whole page; the `lang` lesson from S2).
3. **Browser bar.** `viewport.themeColor` has two entries with `media`. With a manual choice the two meta tags get the same colour, so the phone's own preference stops mattering; with «System» each keeps its own.
4. **A warm dark palette** in `globals.css` (`.dark`): roasted browns (hue 55–60), cream ink, a lighter terracotta accent, plus the `--tl-*` pairs (light text on a dark tinted surface). The traffic light keeps symbol + word + colour (hard rule 4); only the tone changes. Dialogs use a new `--scrim` token (10 % black in light, 55 % in dark) instead of the hard-coded `bg-black/10`.
5. **The verification stops lying.** Every axe pass in the e2e suite goes through `tests/e2e/theme.ts` (`analyze`), which first asserts that the page is in the theme being measured: the `dark` class, `color-scheme` and the luminance of the painted `<body>` background (read through a canvas, which resolves `oklch`). If the dark theme ever stops working, the «dark» passes fail instead of passing the light theme again. `a11y.spec.ts`, which only ran light, now covers its 12 routes in both themes, and the two private copies of `axe()` in `familia` and `avisos` were replaced by the shared one. axe was not turned off or relaxed anywhere.
6. **Where the toggle lives:** Settings → Theme, a group of three buttons with `aria-pressed` and a 44 px target, the same pattern as the language. No new route, no new dependency, no extra weight on the home screen beyond a ~10-line client component.

## Consequences

- Light contrast passes that only «passed» because dark did not exist are now real and had to be paid for (see the S11 closing note for what moved).
- Any new colour must exist in both blocks of `globals.css`; the e2e suite now catches a dark-only failure.
- `--chart-*` and `--sidebar-*` are carried over; no screen uses them today.
