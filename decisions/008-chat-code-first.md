# ADR-008 — Chat code-first: the plan answers on the phone, no cloud AI

**Status:** accepted · **Date:** 2026-11-15 · **Sprint:** S004 · **Supersedes:** ADR-004 (LLM provider adapter); also retires the network parts of ADR-005 (grounding) and ADR-006 (chat privacy).

Kit template: `PLANTILLA-ADR-codigo-primero.md` (core rule 14 · app hard rule 5).

## 1. The feature, in one user sentence
Anyone caring for the child asks the diet in their own words («no tengo pollo, ¿qué le doy?», «no quiso desayunar», «¿qué le doy ahora?», «¿cuánta agua?») and gets the plan's answer, on the street and without data.

## 2. What code solves first (with evidence)
| Deterministic piece | What it solves | Where it stops | Evidence |
|---|---|---|---|
| `matchLookup` (`src/lib/diet/search.ts`, S2) | «¿X se puede?» → traffic-light verdict + replacements | open questions | `tests/unit/search.test.ts` |
| `answerOpen` + intent table (`src/lib/diet/answer.ts`, S4) | the four open questions below, ES/EN, from plan data only | anything the plan does not contain → «tu plan no lo dice» | `tests/unit/answer.test.ts` (51 cases, ES/EN pairs per pattern, negatives) · `tests/e2e/chat.spec.ts` |
| `screenInput` (`src/lib/diet/guardrails.ts`, S2) | medical / off-topic → static redirect | — | `tests/unit/guardrails.test.ts` |

### Pattern table (precedence = order)
| Intent | ES examples | EN examples | Answer (plan data) |
|---|---|---|---|
| `refused` | no quiso · no le gustó · rechazó · no comió | didn't want · didn't like · refused · didn't eat | other options for the food (its equivalences, else its green group) + the next meal; blame-free copy |
| `replacement` | no tengo · no hay · se acabó · en vez de · reemplaz* | don't have · have no · ran out · instead of · replac* | `equivalences[].use` for the food, else other items of its green group; none → «tu plan no trae reemplazos» |
| `hydration` | agua · hidrat* · cuántos vasos | water · hydrat* · how many glass* | `hydration` min/max liters, glasses, habit |
| `meal` | qué le doy · qué preparo · qué toca · ahora | what can I give · what's next · right now | named meal, else `currentMealSlot` at the send-time clock (now / next / tomorrow) |
| — | (no intent, no lookup match) | | `not-in-plan`: «Tu plan no lo dice. Pregúntale a tu profesional.» — never invented |

Matching is token-based (same normalisation + naive singular as the lookup), so «aguacate» is not «agua». Meals match by stem («desayunar» ↔ «Desayuno»); generic words alone («media», «mid») do not.

## 3. Where a model enters and where it does NOT
- **Enters in:** optionally rewording the lead sentence the code already composed, **only** with a model that lives inside the device (Prompt API `LanguageModel`, `availability() === "available"`; a download is never requested). `src/lib/ia/device-accent.ts`.
- **Does NOT enter in:** intent detection, which foods/meals are returned, the option list, «not in plan», guardrails, storage. The list and the «what's next» block are always rendered from data.
- **Input to the model:** the single composed sentence (plan wording only; no day-log, no child alias, no question history).
- **Output:** Zod schema per sentence (`accentSchema`): bounded length, keeps every required plan term, no new numbers, no links, no banned words (calories, weight, BMI, percentiles, guilt, reward, punishment, «must»). Not persisted.

## 4. Deterministic fallback
No device model, error, > 4 s, or output rejected by the schema → the code sentence stays. The badge says «Desde tu plan · sin IA»; only an accepted rewording shows «Desde tu plan · redactado en tu teléfono». The chat is complete without any model.

## 5. Provider, cost and privacy
- **Providers:** none in the cloud. Removed: `ai`, `@ai-sdk/{anthropic,azure,google,groq,openai-compatible,react}`, `src/app/api/chat/route.ts`, `src/lib/ia/{provider,grounding}.ts`, `src/lib/rate-limit.ts`, all `CHAT_*` / `*_API_KEY` env vars.
- **Cost:** US$0 at runtime.
- **Privacy:** asking the chat makes **zero** network requests (e2e `chat.spec.ts` and `registro.spec.ts` record every request after load and expect none). The conversation is still in memory only (ADR-006 rule 1 stands).
- **HITL:** not applicable — no generated content decides anything.

## Consequences
- Two MVP promises (chat and «copiloto familiar») work offline and free; the cloud-AI dependency the hard rule forbids is gone.
- Answers are limited to what the plan structurally holds (equivalences, groups, menu, hydration). Free-form recipes or advice are «not in plan» by design.
- Vercel env vars for the chat must be removed (listed in the S4 implementation log).
