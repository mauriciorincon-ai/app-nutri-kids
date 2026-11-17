# ADR-014 — Plan B, special scenarios and merging two plans (code first, never less strict)

**Status:** accepted · **Date:** 2026-11-16 · **Sprint:** S009 · **Revises:** ADR-013 (the change log gains the `plan-line` kind) · **Owner decisions:** G-Plan S9 «2a» plus the owner's nuance on red lines (below).

## Context

Three VISION roadmap items remain after the roles: a **plan B** for when something goes wrong at mealtime, **special scenarios** (birthday, restaurant, emergency, someone offers something) and **merging two diets** from two professionals. All three touch hard rules: 1 (nothing of a real family in the repo), 2 (no calories, no blame), 3 (no medical advice), 5 (code first, no paid or third-party AI) and 6 (health data never leaves the phone in clear). They are built as pure code over the plan already loaded on the phone.

## Decision

### Plan B (`src/lib/diet/plan-b.ts`, `options.ts`)

1. Three situations: **out** («we ran out of X»), **no fridge** and **running late**. Each is a pure function of the loaded plan, the clock and the adult's own marks. The chat answers the same three through the same code (`nofridge` and `late` intents, matched before `replacement` because «no hay nevera» contains «no hay»), and Today shows them as a card.
2. **Only what the plan says.** Options come from the plan's equivalences or the same green group. A name the plan does not bring, a food with no options, no marks and no menu each return a `not-in-plan` reason and the screen says so («your plan doesn't say; ask your professional»). Nothing is invented.
3. **`isSafeOption` is stricter than «matches a red»**: an option is also blocked when its tokens are a contiguous phrase inside the name of a red or currently-restricted item («Gaseosas» against «Gaseosas y jugos de caja»). When in doubt, it is not proposed. This was a real gap found by a test («never proposes a red even if marked»).
4. **«Keeps without a fridge»** is a flag the plan may carry (`keepsWithoutFridge` on an equivalence option or a green item) **or** an adult mark stored as a profile note of kind `fridge` (text = the option's Spanish name, compared lowercase and trimmed). Adult marks go through the existing signed `profile-note` write, so only parent and nutritionist can leave them (ADR-013).

### Special scenarios (`src/lib/diet/scenarios.ts`, `/escenarios`)

5. `buildScenario(id, diet, now, notes)` only gathers what the plan already says: what the child cannot have (reds, active restrictions, «also avoid»), what has a measure, what is safe to bring (marked-for-fridge first, at most 8, never a blocked item), additives to avoid, meals and the slot running or next. The screen words it with `t.scenarios` templates, in both languages.
6. **The emergency card** shows only the profile the plan carries (condition, allergies, intolerances, medications) and what caregivers noted, and the professional is `meta.source`. **No phone numbers or contacts are invented**: «emergency services where you are» and «keep your professional's number in your contacts». Notifying the family links to the existing signed notices (ADR-011/013).
7. **No medical advice, checked.** `looksLikeMedicalAdvice` (guardrails) is a cheap safety net, with positive controls, and a test proves that no es/en string of `t.scenarios` or `t.planB` trips it. The real guarantee is that the engine only repeats what the plan says. The chat's medical rejection is unchanged.
8. The route is in the service worker shell, so it opens offline; it is in the Lighthouse and offline e2e lists.

### Merging two plans (`src/lib/diet/reconcile.ts`, `second-plan.ts`, `/unir`)

9. **The second plan lives apart** (`nutrikids.second-plan.v1`, local only, never shared). `/cargar` can mark the next load as «the second plan» (a flag), and `/unir` shows both side by side with counts. Merging or discarding deletes it; «Delete data» deletes it too.
10. **Red wins on its own (G-Plan 2a).** Any item that is restricted, red or «also avoid» in either plan is restricted/red in the merged plan and marked with its origin. Allergies and intolerances are the union. A restriction window is the widest of the two. Matching is by id or by normalized name. The invariant is tested for both argument orders and for every choice of conflict resolution: the merged plan is never less strict than either source in red.
11. **Clashes a person decides** (colour of a food, a limit, a portion, a dose, a schedule, a texture, a meal's content, hydration, free text): a parent chooses once per clash; until then the default is plan A and the screen says «pending». Lines present in only one plan are carried and marked with that origin.
12. **The owner's nuance: a parent may change anything, always, including a red line of the merged plan.** They see both origins, confirm once (no alarm, no blame) and the change goes to the log as `plan-line` with the line key. Mechanically, `merged.lines[key]` keeps `from`, the rule and an `alt` (the other side's placement or patch); `switchLine` toggles to the other origin (rule `parent`), validates with the schema and records `merged.last = {key, t}`. `storeDiet(..., "diet-line-changed", at)` stamps the plan with the same `t`, and the sync logs `plan-line` when `merged.last.t === plan.t`. Only the **parent** role has this power (`may({k:"plan"})`); a caregiver's modified client that uploads another merged plan is discarded by the parent's phone, as any plan not signed by a parent (ADR-013).
13. **The merged plan is one `DietPlan`** (schema v2 plus optional `merged`), signed and shared like any plan: the server still sees only ciphertext, and names, roles and lines travel only inside what is encrypted.

## Consequences

- Plan B, scenarios and merge introduce no dependency, no network and no model.
- **Known limits, declared:** (a) a third plan merges against the _merged_ plan as plan A; earlier origins are not carried beyond the `merged.from` pair. (b) Matching by normalized name can miss a synonym («queso» vs «queso fresco»); the miss leaves both lines, so nothing is lost, but a human may need to merge them. (c) Fridge marks by name depend on the option's Spanish text, so renaming it in a later plan drops the mark. (d) The second plan is not shared: only the merged result is.
- `src/lib/diet/reconcile.ts` is the largest file in `lib/diet`; its tests (30, `tests/unit/reconcile.test.ts`) are the contract.
