# ADR-011 — The family shares the plan, encrypted end to end on the phone

**Status:** accepted · **Date:** 2026-11-15 · **Sprint:** S007 · **Revises:** ADR-001 (local storage), ADR-007 (day log stays local) · **Owner decisions:** G-Plan S7 «1 a 2 a» (the core's DECISION look for shared state).

## Context

Until S6 everything lived on one phone (ADR-001). The VISION asks for the plan to be shared by everyone who cares for the child. Hard rule 6 allows it only if what travels is encrypted end to end: no server or third party may read it. The repo is public, the data is a minor's health data, and the runtime may use no paid or third-party AI.

## Owner decisions (G-Plan, verbatim intent)

1. **Where it is stored:** Upstash Redis Free, provisioned by the owner from Vercel Storage and connected to every environment, reached through its REST API behind one minimal app route.
2. **What is shared:** the plan; the day (marks, times, notes and who noted them); the profile with its notes, allergies and medications. Language, theme and each phone's own settings stay local.

## Decision

1. **Code and phrase.** The app generates both with `crypto.getRandomValues`, in Crockford base32 (no I, L, O, U): a **family code** of 10 characters (50 bits) that only identifies the family, and a **phrase** of 20 characters (100 bits, 5 groups of 4) that unlocks it. The phrase is never stored nor sent; it is shown when the family is created and when it changes.
2. **Keys, WebCrypto only.** `PBKDF2-SHA-256(phrase, per-family 16-byte salt, 600 000 iterations)` → seed → HKDF (three `info` labels) → an **AES-GCM-256 key**, an **HMAC-SHA-256 key** that names records, and a **256-bit write token**. All CryptoKeys are non-extractable. The token authorises writes and reads but cannot decrypt (HKDF separates it from the key).
3. **What the server holds.** Per family: the salt, `SHA-256(token)` (compared with `crypto.timingSafeEqual`; a missing family is compared against a dummy hash), an epoch, a write counter, and records `{id, kind, ver, iv, ct}`. `id` = first 16 bytes of `HMAC(name)` (the server sees no date, no device and no type of record); `kind` is only `plan` or `item` (for the size cap). Each record is sealed with a **fresh random 12-byte IV**, AES-GCM with `aad = family|epoch|id` (a server cannot move a record to another slot), and the plaintext is padded to 256-byte buckets. The device name, last-seen time and consent date travel encrypted, one record per phone.
4. **Protocol.** One route, `POST /api/family/<op>` (`health` also answers GET): `create`, `join` (returns the salt), `pull` (pages of ≤ 2 MB since a sequence number), `push` (compare-and-set on the version each phone saw: an old version gets **409** with the current one), `rotate`, `destroy`. The code travels in the body, never in a URL. Every op that reads or writes on Upstash is **one Lua script** (`EVAL`), so the epoch and version check and the write are atomic. Errors are fixed codes; the route logs nothing (no body, header or code). The server runtime does initialise Sentry (`src/instrumentation.ts`), but its scrubber drops request headers, body, cookies and query before anything is sent, so only the error kind and a scrubbed path can leave.
5. **Merge, deterministic.** Each mark, day note and profile note is a last-writer-wins register `{t, by, v}` with tombstones (`v: null`), so removing something is a change that does not come back; ties go to the higher device id, then the larger value — the merge is commutative, associative and idempotent (tested). The plan travels whole and merges by version: if two phones changed it since they last synced, the newer one stays and the app says so.
6. **Removing a phone = a new phrase.** Any phone still inside asks the server to `rotate`: new salt, new token hash, epoch + 1, and **every stored record is deleted**; that phone then re-uploads everything (except the removed phone's record) under the new key. The removed phone gets 403 and cannot open anything new. A lost phrase is handled the same way: any phone inside makes a new one. There is no recovery without the phrase, by design.
7. **Leaving and deleting.** «Leave the family» forgets the keys on this phone and keeps its local copy. «Delete what is shared» destroys the family on the server; each phone keeps its copy. «Delete data» also leaves the family.
8. **Store selection.** `FAMILY_STORE=memory` (CI and e2e) wins over everything and never reads the real store's variables; it refuses to run when `VERCEL` is set. Otherwise the Upstash variables the Vercel integration injects (`KV_REST_API_*` or `UPSTASH_REDIS_REST_*`). With neither, the route answers 503 and the app says sharing is not available. `health` reports `real`, `memory` or `none`, never a variable.
9. **Abuse caps.** Ciphertext ≤ 256 KB for the plan and ≤ 64 KB for any other record; ≤ 1 000 records per family (507 beyond); ≤ 50 records and ≤ 1 MB per request; 5 new families per IP per day and 500 in total per day; 120 requests per IP per minute. IPs are never stored, only a short hash inside the counters. A family with no activity for 400 days expires.

10. **What the server can still learn (accepted).** `join` answers with the salt for any code, so anyone can test whether a code exists (50-bit code, 120 requests/IP/min, 5 creates/IP/day: guessing is not practical, and a hit yields only the salt, never a record). Sizes (padded to 256-byte steps), record counts, timing and the family epoch are visible to the store. The protocol carries no version number: a future change ships with the app and the 409/epoch path; there is no per-record metadata beyond the HMAC id.
11. **Storage-abuse bound.** One family costs at most 256 KB + 999 × 64 KB of ciphertext in the worst case; the caps in point 9 and the 400-day TTL bound what an attacker can park. Cost assumption: a handful of families sits far inside the Upstash Free tier; if it is exceeded the route answers `unavailable` and every phone keeps working from its local copy.

## Alternatives considered

- **A sync SaaS or a database with its own SDK:** a new dependency and a third party with server-side code; rejected for a REST call with `fetch`.
- **Storing the phrase or an exportable key on the phone:** rejected; the key is a non-extractable CryptoKey and the phrase is shown, never kept.
- **Rotating by re-encrypting everything in one request:** would exceed request limits; the two-step rotation (server wipes, the rotating phone re-uploads) is retried from the local copy if it is interrupted.

## Consequences

- The day log and the profile notes gain a timestamp and an author per mark and note (day log v3).
- `tests/unit/no-cloud-ai.test.ts` allows exactly this route and exactly two files that open the network (`src/lib/family/client.ts`, `src/lib/family/server/upstash.ts`); a sentinel test checks every request body and header for plaintext.
- Clocks of different phones decide «newest»; a phone with a wrong clock can win a tie it should not. Accepted: the merge stays deterministic and nothing is lost silently.
