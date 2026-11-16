# ADR-009 — The child's profile lives on the device; diet schema v2

**Status:** accepted · **Date:** 2026-11-15 · **Sprint:** S005 · **Extends:** ADR-001 (local storage), ADR-007 (local log minimisation) · **Owner decisions:** G-Plan S5 «1 a 2 a».

## Context

The VISION's MVP asks for the child's profile (condition, allergies, intolerances, medications), the professional's goals (activity, sleep) and replacements that respect the textures the child accepts. Schema v1 had none of these, and `equivalences[].use` was a list of plain texts. The S6 (reading the PDF) needs somewhere to put what it reads.

## Decision

1. **Schema v2** (`src/lib/diet/schema.ts`, `schemaVersion: 2`) adds, all optional:
   - `profile` = `{ condition?, allergies?[], intolerances?[], medications?[{ name, dose?, when? }] }`;
   - `goals` = `{ activity?, sleep? }`, plain `{es, en}` text as the plan words it (never body figures: hard rule 2);
   - `equivalences[].use` becomes `[{ name, texture? }]`, with `texture` from a **closed list** (`liquid · puree · mashed · soft · chopped · crunchy`); the labels live in i18n.
2. **Migration on read, never a loss.** `parseDietJson` accepts v1 and v2 and always returns v2. A v1 is validated as v1, migrated by the pure `migrateV1toV2` (`src/lib/diet/migrate.ts`), and validated again as v2. Only then does `loadActiveDiet` rewrite the stored plan. Until that point the original stays untouched. Migration copies every field and turns each option into `{ name }`. It invents nothing: there is no texture, profile or goals unless the plan says so. Tested field by field against an invented v1 fixture shaped like a real plan (`tests/unit/migrate.test.ts`).
3. **What the caregiver knows lives apart from the plan** (decision 1 a). `nutrikids.profile-notes.v1` (`src/lib/diet/profile-notes.ts`, Zod-validated) holds the accepted textures and dated notes (`condition · allergy · intolerance · medication · other`, ≤ 140 chars).
   - Loading a new plan does not touch it. «Borrar datos» deletes it.
   - The UI always shows the origin of each piece: «según tu plan» or «anotado por quien cuida» (an icon + text badge; the not-accepted texture chip uses a dashed border + text + symbol, never color alone: see `design-system.md`).
   - The on-device chat also reads the notes (allergy, intolerance, medication) and says them as «anotado por quien cuida», never as the plan's.
4. **Textures order, never hide** (decision 2 a). Options with an accepted texture come first. Options with no texture in the plan come next. Options with a texture the child does not accept today come last, marked «textura que hoy no acepta». A list is never emptied by the filter. With no textures marked, the plan's order stands. One pure helper is shared by the food detail, the verdict card and the chat.
5. **It never leaves the phone in the clear** (hard rule 6). _Revised in S7 (ADR-011): if the family chooses to share, the profile and its notes travel only as AES-GCM ciphertext sealed on the phone; otherwise nothing leaves._
   - The profile and the notes live in `localStorage`; the only copy that can leave is the end-to-end encrypted one of ADR-011, and only after the family chooses to share.
   - Logs carry counts only (`dietCounts` adds `allergies · intolerances · medications` as numbers).
   - Sentry gets a `beforeSend` scrubber (`src/lib/privacy/sentry-scrub.ts`). It drops `extra`, `user`, request bodies and console/input breadcrumbs, and redacts any message that contains a profile or note term.
   - There is no export path in `src/`. A test keeps it that way until a future export decides, by ADR, what it carries, and the profile is not part of it.

## Consequences

- A real plan stored by S1–S4 keeps working with no action from the family; the planner regenerates the real diet as v2 to add profile, goals and textures.
- The S6 PDF reader has typed places for what it extracts.
- Any new export, share or sync (S7) must pass this ADR: the profile travels end-to-end encrypted or not at all.
