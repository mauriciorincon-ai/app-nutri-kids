# ADR-013 — Roles with permissions, signed per person, with a change log

**Status:** accepted · **Date:** 2026-11-16 · **Sprint:** S009 · **Revises:** ADR-011 (the family gains a signed roster and the invitation gains a fingerprint) and ADR-012 (the service worker only shows a family notice signed by someone allowed to send one) · **Owner decisions:** G-Plan S9 «1a 2a» plus the owner's nuance on red lines (recorded in ADR-014).

## Context

Since S7 everyone holding the family phrase can write everything: a mark, a note, the whole plan. The VISION's roadmap item «Roles with permissions» asks for four roles: parent (everything), caregiver (logs the day, notes, notices), school (ticks the meals of its time slots and sends notices) and nutritionist (reads and leaves notes). It also asks for a log of who changed what. The S7 server only holds ciphertext and an opaque token, so it cannot enforce roles: every phone has to enforce them on what it receives. Hard rule 6 still holds: names, roles and keys must never reach the server in clear.

## Owner decisions (G-Plan, verbatim intent)

1. **1a — per-person signature and a roster signed by a parent.** Each phone discards what does not belong to that role.
2. **2a — when two plans merge, red wins on its own** (ADR-014). Only a parent may later change a red line, seeing both origins and confirming once, without alarm; the change goes to the log.

## Decision

1. **One key per phone.** WebCrypto ECDSA P-256, generated on the phone with `extractable: false` and kept in IndexedDB (`nutrikids-family` / `keys`, row `signer`). The public key (65-byte raw point, base64url) travels only inside the encrypted records. Everything signed goes through `canon` (JSON with sorted keys) and a domain prefix `nutrikids/family/v1/sig\n`. Each payload names its record (`n`), so a signature for one record never validates another. «Delete data» deletes the key as well.
2. **The roster is a hash-chained, signed op log** (`src/lib/family/roster.ts`, record `roster`). Op 0 is the genesis, signed by its founder, who must be a parent. Every later op (`set`, `remove`, `invite`) names the hash of the previous one and is signed by a parent of the roster as it stood before that op. Folding rejects the whole chain if one link fails: shape, order, previous hash, signature, signer not a parent. It also rejects an op that changes an existing member's key, puts `meals` on a role other than school, removes someone who is not a member, or leaves the family without a parent. The cap is 120 ops.
3. **The invitation carries the roster's fingerprint.** It is the family code (10) plus the **pin**, 12 Crockford characters (60 bits) of the genesis hash, plus an optional 4-character invite tag. A joining phone accepts only a roster whose genesis matches the pin, so the server (or anyone with the phrase) cannot hand it a substitute roster. A parent can create an invitation for a role (an `invite` op); whoever joins with it appears «waiting» with that role preselected.
4. **Choosing between chains** (`chooseChain`):
   - If the remote chain extends the local one, take the remote.
   - If it is an older prefix (a replay), keep the local one.
   - On a fork (two parents changed at once), the earlier op wins (ties go to the smaller hash), and this phone re-signs its own losing ops on top.
   - A remote chain with another pin is rejected, and the screen says so.
5. **Each entry carries its writer's signature.** The S7 merge mixes entries from several phones inside one record, so a signature on the whole record would be the uploader's, not the writer's. Each mark, day note, profile note and texture entry therefore carries `s` over `{n, k, t, by, v}`. The plan and each notice are signed whole; the device record is signed with its own key.
6. **What each role may write** (`may`, the one table that both the screen and the sync use):

   | Role         | May write                                                           |
   | ------------ | ------------------------------------------------------------------- |
   | parent       | everything                                                          |
   | caregiver    | marks, day notes, notices                                           |
   | school       | notices; marks and day notes only on `meal:<id>` within its `meals` |
   | nutritionist | day notes, profile notes                                            |

7. **Pull order and checks.** The phone sorts what it pulls in this order: roster, devices, logs, everything else. An entry is dropped before merging when it has no valid signature, its writer is outside the roster, or the role may not write it. Drops are counted, and the settings show «N changes arrived without permission and were not accepted», without alarm. The screen hides or disables what the role cannot do (Hoy, Perfil, `/cargar`, «Notify the family») and says so in one line.
8. **Self-healing.** Someone with the phrase could overwrite a record on the server. When that happens, its rightful writer uploads the good one again:
   - a parent re-uploads the plan;
   - each phone re-uploads its own device record, its own log, and a notice it wrote;
   - the roster is re-uploaded when the remote one is rejected.

   Day and profile records already heal through the S7 digest comparison.

9. **Joining needs a parent's confirmation, compared by eye.** A new phone uploads its device record, self-signed with its new key. It appears «waiting», able to read but not to write. Its screen shows its key fingerprint (`ABCD-EFGH`, 40 bits), and the parent's screen shows the fingerprint it received. The parent confirms only if the two match, so nobody can slip their own key into another waiting phone's record. A parent can also remove a waiting phone (which changes the phrase).
10. **The log** (`src/lib/family/log.ts`, record `log:<id>`):
    - Each phone keeps **its own** log, hash-chained and signed with its key. It holds up to 200 events, each a kind plus a reference of at most 100 characters, never the content.
    - Others keep the copy they have seen. Nobody can write in another phone's log, because they lack its key.
    - A phone that rewrites its own past is flagged: same index with a different hash shows «rewritten», and the copy already seen is kept. An older prefix changes nothing.
    - The settings show the last 60 events with name and role.
11. **Notices on a locked phone.** The page writes to the push pointer the public keys of the members allowed to send notices (`senders`). The service worker verifies the notice's signature with the same `canon` and domain before showing its name and text. An unverified notice shows only the generic «There is a new notice». The bridge test `push-sw.test.ts` enforces this contract (rule 19).
12. **Migration from S7.**
    - A family state without a roster has `migrate: true`. The first phone that runs S9 signs a genesis with itself as the only parent.
    - Every phone it already knew becomes a caregiver automatically as soon as that phone's signed key arrives. A parent can then change the role.
    - A phone still on S7 (no key) is listed but cannot write.
    - New families start with `migrate: false`, and the founder signs the genesis when creating the family.
13. **Rotation keeps the family.** Changing the phrase (also when removing someone) keeps the roster, the pin, the cached signatures, the log and the legacy list. Only a parent may rotate once a roster exists. Removing a member is a signed `remove` op followed by a rotation.

## What remains possible (accepted residual risk)

- **Availability, not forgery.** The server only knows the family token, so anyone holding the phrase can still call `rotate` or `destroy` on the server, or overwrite records with garbage. They cannot forge a writer, a role or a log. Phones reject what does not verify, and the rightful writers re-upload. A removed or hostile member can therefore disrupt the family until a parent changes the phrase, but cannot change the plan, a mark or the roster. A server-side role check would need the server to know roles or keys, which hard rule 6 forbids.
- **Content of one's own role.** A member may write anything their role allows (a caregiver may mark a meal that was not eaten). The log keeps who did it.
- **A lost parent phone.** If the only parent loses their phone, nobody can change roles any more. The remedy is to create a new family. The screen recommends having two parents.

## Alternatives considered

- **Role check on the server.** It would need the server to know who is who, and hard rule 6 forbids that.
- **A shared «parent password».** A secret shared by several people cannot say who wrote what, and it would leak with the first copy.
- **Signing whole records.** The uploader is not always the writer (S7 merge), so this does not fit.
- **A third-party signing library.** WebCrypto ECDSA ships in every target browser and in Node. No dependency was added.

## Tests

- `tests/unit/family-roles.test.ts` covers:
  - each role against each write;
  - signatures and key fingerprints;
  - self-promotion, a forged signer, altered, repeated, key-swapping and orphaning roster ops;
  - extend, replay, fork and pin cases;
  - rewritten, truncated and forged logs;
  - four phones against the store double: a modified caregiver client changing the plan, unsigned and impersonated marks, the school outside its slots, the nutritionist marking;
  - roster, log and device overwrites healing;
  - the server sentinel (no names, roles or meal ids on the wire);
  - S7 migration and a wrong pin.
- `tests/unit/family-controller.test.tsx` covers invite, confirm, change, remove and what each role is refused.
- `tests/unit/push-sw.test.ts` covers notices that are unsigned, signed by someone else, or signed by someone outside the roster.
- `tests/e2e/familia.spec.ts` covers joining with the invitation, the fingerprint compared on both screens, confirming as caregiver, `/cargar` locked, and a modified caregiver client whose plan the parent's phone discards. Every new state is checked with axe in both themes.
