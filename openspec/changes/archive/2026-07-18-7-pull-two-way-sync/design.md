# Design: 7-pull-two-way-sync

> Options-and-tradeoffs analysis for the pull/two-way half of GitHub issue
> #7. Every section below ends with a **Recommendation**. None of it is
> authorized to build — see `proposal.md`'s status banner and `tasks.md`
> phase 0.

## Context

**Current state (push-only).** `lib/sync/push.ts` drains
`pending_mutations` — a queue of local writes recorded by every
validated-function write path — up to the lender's Google Sheet:

- `ENTITY_RANGES` (`lib/sync/push.ts:18-20`) currently maps only
  `customer: "Clientes!A:F"`. Loan/payment/visit mutations are enqueued
  (every write path does that, regardless of entity) but the push loop
  does `if (!range) continue` (`push.ts:56-57`) — those rows sit in the
  queue forever. _(Extending `ENTITY_RANGES` to loan/payment/visit is the
  push half of issue #7, shipped in a separate PR — not addressed here.)_
- Every mutation write is a Sheets `values.append`
  (`lib/sync/sheetsClient.ts:29-45`, `appendRow`) — new row at the bottom,
  always. There is no update-by-id call. `push.ts:59-63` explicitly skips
  `operation !== "create"` mutations with a comment explaining why:
  appending an "update" would duplicate the row rather than correct it.
- `sheetsClient.ts` already exports a second function, `readRange`
  (`sheetsClient.ts:48-60`), a thin `values.get` wrapper — but it is
  **unused** anywhere in the app (confirmed by grep; the only reference is
  its own re-export in `lib/sync/index.ts:11`). This is the one piece of
  the pull mechanism that already exists in some form; §2 below covers
  what's still missing around it.
- `pushPendingMutations` records `lastPushedAt` in `syncMeta`
  (`push.ts:80-83`) and is exposed as `SyncRepo.pushNow()`
  (`lib/repo/real/syncRepo.ts:42`), surfaced today only by a manual
  "Sincronizar ahora" button on `SyncSettingsScreen`
  (`components/screens/SyncSettingsScreen.tsx:48-50`) and by Cuadre
  General's "Cerrar día y sincronizar" action (per
  `openspec/changes/profile-tools-screens/design.md`).
- `SyncStatus` (`lib/repo/types.ts:200-205`) is `{ connected, sheetId,
lastPushedAt, pendingCount }` — no field yet for pull state, conflicts,
  or failures beyond the raw pending count.

**Schema shape relevant to pull** (`lib/db/schema.ts`):

- Every entity is keyed by a client-generated `id: text().primaryKey()`
  (uuid) — `customers`, `loans`, `payments`, `visits`,
  `pending_mutations`. That `id` is what a pulled row must be matched
  against for upsert-by-id to work.
- `customers.updatedAt` and `loans.updatedAt` exist (both
  `integer("updated_at", { mode: "timestamp" }).notNull()`), but
  **`payments` and `visits` have no `updatedAt` column at all** — only
  `createdAt`. This is load-bearing for §4: any last-write-wins strategy
  keyed on `updatedAt` has no signal to compare for those two entities as
  the schema stands today, because those two are actually
  append-only by product design (a payment or a visit is a fact that
  happened; the app has no "edit a payment" or "edit a visit" flow — only
  create). Conflict resolution in practice only has teeth for
  `customers` and `loans`, the two mutable entities.
- `pending_mutations` rows carry `entity`, `entityId`, `operation`,
  `payload` (JSON snapshot at write time), `status`, `retryCount`. This is
  the thing a naive pull must not clobber: if a customer's `phone` was
  edited locally five minutes ago and that mutation is still `status:
"pending"` (not yet pushed — the lender's phone was offline), a pull
  that blindly overwrites local `customers` rows with sheet data would
  silently lose that edit.

**Relevant specs.** `openspec/specs/google-connect/spec.md` covers only
the connect/disconnect _screen flow_ (onboarding step, re-entry from
Settings) — it has no requirements about sync behavior once connected,
push or pull. There is no existing spec for push behavior either (it
shipped ahead of the OpenSpec workflow being applied to `lib/sync/`), so
this is the first design pass to treat sync _behavior_ as spec-worthy.

## Goals / Non-Goals

**Goals:**

- Recommend one trigger model, one read/mapping mechanism, one
  merge/upsert strategy, and one conflict-resolution policy — each
  justified against this app's actual constraints (offline-first,
  single-user-per-sheet, non-technical users editing the sheet directly).
- Make the interaction between pull and the _unpushed_ local queue
  (`pending_mutations`) explicit and safe by construction, not by
  convention.
- Size the work honestly: identify what's genuinely new build (an
  implementation change, phased) versus what's a one-line reuse of
  something that already exists (`readRange`).

**Non-Goals:**

- Not designing loan/payment/visit push coverage — separate PR, per issue
  #7's own split.
- Not designing real-time/background sync (push notifications, sheet
  change triggers) — out of scope for an offline-first app whose users
  may not open it for days; see §1.
- Not solving multi-device-per-lender sync. The product model is one
  phone per lender; the Sheet's "other writer" is always a human editing
  cells directly, never a second app instance. This simplifies conflict
  resolution considerably (no need to reconcile two apps' causal
  histories, only "app state" vs. "sheet cell as last saved").
- Not building field-level operational-transform / CRDT merge. Given the
  one-phone-per-lender model and the small, mostly-independent field sets
  per entity, that machinery is disproportionate to the problem.

## 1. Trigger

When does pull run?

| Option                    | Description                                                                                     | Tradeoffs                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **App-open**              | Pull automatically whenever the app is foregrounded and connected                               | Freshest data with zero user action, but this app is used for hours at a stretch on one collection route with the phone likely in airplane-adjacent connectivity (rural DR) — most "app opens" during a route would just fail silently or spin, and firing a network call on every foreground is wasteful when nothing changed |
| **Periodic (background)** | e.g. every N minutes while app is open                                                          | Needs a timer/interval and battery/data considerations on low-end Android devices this app targets; still doesn't help offline stretches; adds a background-fetch permission story neither `push.ts` nor anything else in `lib/sync/` currently needs                                                                          |
| **Manual "Sincronizar"**  | Pull rides the same explicit action as today's "Sincronizar ahora" / "Cerrar día y sincronizar" | Matches the existing mental model exactly — the lender already has one button that means "talk to the cloud now"; zero new UI surface; but _only_ happens when the user remembers to tap it                                                                                                                                    |
| **After successful push** | Pull runs automatically right after `pushPendingMutations` completes with `failed === 0`        | Piggybacks on an event that already means "we have connectivity right now" — no extra permission or timer; keeps push and pull as one atomic-feeling "sync" operation from the user's point of view; failed push (no connectivity) correctly skips pull too, since there's nothing to talk to                                  |

**Recommendation: manual "Sincronizar" as the only user-visible trigger,
with pull automatically chained after a successful push inside that same
action** (not a separate trigger). Concretely: `SyncRepo.pushNow()`
becomes (or is joined by) a `syncNow()` that does push-then-pull as one
unit, still fired only by the existing "Sincronizar ahora" /
"Cerrar día y sincronizar" buttons. This fits the offline-first reality —
connectivity is opportunistic, not assumed — and avoids inventing a
background-sync permission story for an app whose users open it precisely
because they're standing in front of a customer, not because they want to
poll a spreadsheet.

**Owner decision (2026-07-17): app-open auto-pull IS included in phase 1** as
a low-risk _additional_ trigger (not a replacement for the manual path),
overriding this section's original "defer it to later" stance. To neutralize
the wasteful-calls concern raised in the table above, app-open pull is guarded
three ways: **connectivity-gated** (attempt only when the device reports a
network); **debounced** (skip if a successful sync completed within the last
~15 minutes, so reopening the app repeatedly along a route doesn't re-fire);
and **non-blocking / silent-on-failure** (runs in the background with no
spinner and fails quietly when offline — a foreground in a dead-zone route is a
no-op, not a spin). App-open calls the same `syncNow()` (push-then-pull) as the
manual button, behind that connectivity+debounce guard.

## 2. Read mechanism

Pull needs: `values.get` per entity range, mapped to typed local records
by `id`.

- **What already exists**: `readRange(spreadsheetId, range):
Promise<string[][]>` (`sheetsClient.ts:48-60`) is exactly a `values.get`
  wrapper, following the same `authorizedFetch` pattern as `appendRow`.
  It is unused today but requires no signature change to serve as pull's
  read primitive.
- **What's missing in `sheetsClient.ts`**:
  - Nothing structural — `readRange` is sufficient as the low-level call.
    Sheets API v4 also offers `values.batchGet` (multiple ranges in one
    HTTP round trip); worth adding as a `readRanges(spreadsheetId,
ranges[])` once more than one entity is pulled, purely as a latency
    optimization (four sequential `readRange` calls for
    customer/loan/payment/visit is otherwise fine to start with — this is
    a phase-2 nicety, not a blocker).
  - A row-to-record mapper per entity, the mirror image of
    `customerRowValues` (`push.ts:22-31`) but inverted — e.g.
    `rowToCustomer(row: string[]): CustomerRecord` reading
    `[id, name, phone, address, createdAt, updatedAt]` back into typed
    fields, with the same column order `ENTITY_RANGES` already encodes so
    the two stay in lockstep (a single source of truth for "column N is
    field X" — today that mapping is implicit and duplicated in
    `customerRowValues`; formalizing it as one shared column-spec used by
    both `customerRowValues` and its inverse avoids the two drifting).
  - Type coercion at the boundary: every Sheets cell comes back as a
    string (`readRange`'s return type is already `string[][]`, correctly
    reflecting this) — timestamps, cents amounts, etc. need explicit
    parsing with a defined failure mode for a cell a lender typed
    free-form garbage into (skip the row, surface it as a sync issue —
    see §6 — don't crash the pull).
- **Where it lives**: a new `lib/sync/pull.ts`, sibling to `push.ts`,
  mirroring its shape (`ENTITY_RANGES` reused from — or moved to a shared
  module imported by — both `push.ts` and `pull.ts`, since the range
  strings must stay identical for push and pull to agree on where a given
  entity's rows live).

**Recommendation**: reuse `readRange` as-is; add per-entity row↔record
mappers colocated with (and sharing the column-order constant with) the
existing `*RowValues` functions; add `readRanges` (batchGet) only once
pull covers more than one entity and latency is measured to matter.

## 3. Merge / upsert

Given remote rows (id, columns) and local SQLite (id, columns, plus
`pending_mutations`), how do they reconcile?

- **Present both sides, values differ** → this is the conflict case,
  handled in §4.
- **Present remotely, absent locally** (a row the lender typed straight
  into the Sheet, bypassing the app entirely — plausible for `customers`
  especially) → upsert as a local insert. Straightforward: the app has no
  prior state to protect, so remote simply wins by insertion. This is
  arguably the single most valuable outcome pull unlocks for this user
  base — the sheet is often the _first_ system of record for a
  spreadsheet-native lender adopting the app mid-book.
- **Present locally, absent remotely** — the genuinely hard case, and it
  is ambiguous by construction because **the sheet is append-only from
  the push side today**: a row missing from the sheet could mean (a) it
  was never pushed yet (still sitting in `pending_mutations`, or even
  failed/retrying), (b) the lender deleted the row directly in the sheet
  (an intentional correction — "I created this customer by mistake"), or
  (c) the range read came back truncated/errored and this is a read
  artifact, not a real absence. The app has **no delete operation** in
  its own domain today (no `deleteCustomer`, no soft-delete column in
  `lib/db/schema.ts`) — so "detect deletion and remove locally" has no
  symmetric local concept to map onto yet. Given that, treating a
  locally-present/remotely-absent row as a _deletion signal_ is unsafe
  without first distinguishing (a)/(b)/(c), and doing that reliably from
  an id diff alone is not possible with today's schema.
- **Deletion detection more generally**: real per-row deletion detection
  needs one of (i) a soft-delete/tombstone column pulled and honored on
  both sides, (ii) a full snapshot diff with a trust boundary (e.g. "row
  absent AND locally older than N successful pulls ago" as a heuristic),
  or (iii) punting entirely — never inferring deletion from absence,
  requiring an explicit in-app "archive/remove" action later if the
  product wants that. Given there's no delete concept anywhere in the
  domain yet, this design does not invent one as a side effect of pull.

**Recommendation**: upsert-by-id for rows present remotely (insert if
locally absent, reconcile per §4 if both present with differing values).
**Do not infer deletion from remote absence in phase 1** — a row present
locally but missing from a pulled range is left untouched and, if it also
has no local mutation history, flagged informationally (not silently
dropped, not silently re-pushed) so the lender isn't surprised either way.
Real deletion support is called out as a separate, later capability once
the domain has a delete/archive concept to hang it on — see `tasks.md`.

## 4. Conflict resolution

The core question: both a local row and a remote row exist for the same
`id` with differing field values. Which wins?

| Strategy                               | How it works                                                                            | Tradeoffs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Last-write-wins by `updatedAt`**     | Compare local `updatedAt` to the remote row's `updatedAt` column; higher timestamp wins | Clean in theory, but two real problems here: (1) `payments`/`visits` have **no `updatedAt` column** (§ Context) — LWW has nothing to compare for those; (2) a lender editing a cell directly in Google Sheets does not update any "updatedAt" cell — Sheets doesn't stamp that automatically, and asking a non-technical user to manually bump a timestamp column when they fix a typo is unrealistic. LWW is only trustworthy for the _local_ side's timestamp; the _remote_ side's "clock" is fictional unless the app writes it there itself, which the lender's manual edit won't do |
| **Remote-wins (sheet authoritative)**  | Any field that differs, the pulled value overwrites local, unconditionally              | Matches the actual mental model this app's users have: the sheet is _their_ backup/ledger, editing it is a deliberate correction ("I know the app is wrong, I fixed it in the sheet"). Simple to implement and explain. Risk: clobbers a local edit made _after_ the last push but _before_ this pull, if that local edit hasn't reached the sheet yet — this is exactly the `pending_mutations` race called out in Context, and needs a guard (see recommendation)                                                                                                                      |
| **Local-wins**                         | Local SQLite value always wins on conflict; pull only fills in truly-new remote rows    | Defeats the actual purpose of this design — sheet edits (the stated reason issue #7 asks for two-way sync) would never take effect. Rejected outright                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Field-level merge**                  | Per-field comparison/resolution instead of whole-row                                    | More correct in the abstract (a lender might fix `phone` in the sheet while the app independently updated `address` in the same window) but meaningfully more complex to implement and reason about, and this app's write patterns rarely touch more than one or two fields of a row per operation anyway — the added precision isn't worth the complexity for a v1                                                                                                                                                                                                                      |
| **Conflict queue (manual resolution)** | Detected conflicts aren't auto-resolved; surfaced to the lender to pick a winner        | Most correct and most respectful of the user's intent in ambiguous cases, but adds a whole new UI surface (a "resolve conflicts" screen) for a target user (an independent DR lender, often the sole user of the app, often not deeply technical) who is unlikely to understand what a "conflict" even means in an app they think of as "just tracking my loans." Overkill as the _primary_ mechanism                                                                                                                                                                                    |

**Interaction with `pending_mutations` (the hazard this design must not
ignore)**: a local write not yet pushed — e.g. the lender just corrected
a customer's phone offline, the mutation sits `status: "pending"` — must
never be silently overwritten by a pull that only knows about the sheet's
_old_ value for that field, because the local edit is strictly newer
information than what's in the sheet right now. Any strategy chosen must
check, per row (or per field, if field-level merge is ever adopted): "is
there a `pending_mutations` row for this `entityId` that hasn't pushed
yet?" If yes, that row's local value is protected from this pull pass —
it stays local-authoritative until it successfully pushes, at which point
the _next_ pull will correctly see the sheet reflecting it (or, if the
lender meanwhile also edited the same field in the sheet independently, a
genuine conflict that a future pull would then need to resolve against
the _pushed_ value, not the pre-push one).

**Recommendation: remote-wins-with-guard.** Pulled sheet values overwrite
local values on a per-row basis, _except_ any row (practically:
`customer`/`loan`, the only entities with mutable fields at all — see
Context) that currently has one or more `pending_mutations` rows with
`status IN ("pending", "failed")` for that `entityId`; those rows are
skipped by this pull pass entirely and re-evaluated after they
successfully push. This is chosen because:

- It matches this app's actual trust model — the Sheet is the lender's
  own backup that they deliberately edit to correct the app, not a
  competing system with its own independent authority the app must
  arbitrate against. "Remote wins" is really "the human's direct edit
  wins over the app's stale cache," which is the correct framing for a
  single-user, human-edits-the-source-of-truth workflow.
- It needs no new "editable timestamp" convention for lenders to
  understand or maintain, sidestepping the LWW problem above entirely.
- The guard against unpushed local mutations is the one piece of
  correctness that's non-negotiable regardless of which macro-strategy is
  chosen, so it's built in from the start rather than bolted on.
- A full conflict queue is not rejected forever — it's the right escape
  hatch for the _one_ case remote-wins-with-guard can't resolve safely on
  its own: a field with both an unpushed local mutation _and_ a
  differing remote value discovered at push time (i.e., the mutation
  fails to push cleanly because the target cell moved under it, which
  `values.update` with an id/row lookup — see §5 — should make
  detectable). That narrow case is deferred to a later phase rather than
  gating phase 1 on building a full manual-resolution UI for an edge case
  that will be rare in a one-device-per-lender product.

## 5. `update` support

Pull is entangled with `values.update`-by-id because round-tripping edits
requires both directions to agree on identity:

- Today, `push.ts:59-63` explicitly refuses to push `operation: "update"`
  mutations because `appendRow` can only add rows, never correct one in
  place — doing so would duplicate data instead of fixing it. That's the
  reason local edits to a customer's phone, for example, currently never
  reach the sheet at all (the mutation queues forever, per issue #7's own
  point 1).
- Pull's remote-wins-with-guard (§4) depends on knowing _which sheet
  row_ corresponds to a given local `id` in order to both read its
  current value and, eventually, write corrections back. That requires:
  1. `sheetsClient.ts` gains an update-by-id write path. Sheets API v4
     has no native "update the row where column A = X" — it addresses
     cells by A1 range (`Sheet!A5`), not by key. So an update-by-id call
     is really two steps: locate the row number for a given `id` (via a
     `values.get` on the id column, or by maintaining a local
     `id → row number` index built during pull — the latter is cheaper
     since pull already reads every row), then `values.update` on that
     specific row's range.
  2. Once that exists, `push.ts` can drop the "skip update mutations"
     branch and push `update` operations for real — this closes the loop
     issue #7 point 2 asks about ("decide what update support looks like
     for all entities"), for the entities pull can also verify against.
  3. Pull and this new push-update path must not race: if push is
     mid-flight writing row 5 while pull is reading it, the row-number
     index either needs to be re-derived per sync pass (simplest — accept
     it's a snapshot valid only for the current sync cycle) or the two
     phases are strictly sequential within one `syncNow()` call (push
     completes fully, _then_ pull runs, per §1's recommended trigger) —
     which the recommended trigger model already gives for free, since
     pull only ever runs chained after a completed push, never
     concurrently with one.

**Recommendation**: build the id→row-number index as a byproduct of the
pull read pass (§2) and reuse it for the update-by-id write path, rather
than a separate lookup call per update. Land `values.update` in
`sheetsClient.ts` and wire it into `push.ts` for `operation: "update"` as
part of the same phased effort as pull itself (see `tasks.md`) — the two
were always going to ship together in practice, since neither is useful
in isolation for entities with an edit flow (`customers`, `loans`).

## 6. Failure / partial-sync & visibility

What does the lender see, and how do stuck/failed mutations surface?

- **Today**: `SyncStatus.pendingCount` (`lib/repo/types.ts:204`) is the
  only signal, rendered as "Pendientes por respaldar: N" on
  `SyncSettingsScreen.tsx:44`. A mutation that has hit `MAX_RETRIES`
  (`push.ts:15`, 5) and is marked `status: "failed"`
  (`push.ts:72-76`) is _indistinguishable_ from one still legitimately
  queued and pending — both count toward the same `pendingCount` number
  today. This is exactly the gap issue #7 point 4 calls out ("surface
  stuck/failed mutations somewhere visible").
- **What pull adds to the picture**: rows skipped because of the
  §4 guard (protected by an unpushed local mutation), rows the mapper
  couldn't parse (§2's "lender typed garbage into a cell" case), and —
  once deletion detection exists later — ambiguous absence cases (§3) are
  all new categories of "not wrong, but not fully resolved" state that
  `pendingCount` alone can't express.

**Recommendation**:

- Extend `SyncStatus` with a `lastPulledAt: Date | null` (mirroring
  `lastPushedAt`) and a `failedCount: number` split out from
  `pendingCount` (so "12 pendientes" and "2 fallidos" are visibly
  different states, not conflated) — a small, additive change to
  `lib/repo/types.ts` and the `getStatus()` implementations
  (`lib/repo/real/syncRepo.ts`, `lib/repo/mock/syncRepo.mock.ts`).
  Un-parseable pulled rows and guard-skipped rows are logged
  (`lib/logger.ts`) and counted into a new `syncIssues`-style summary
  rather than invented as their own UI concept in phase 1 — enough to
  answer "is something stuck?" without building a full conflict-detail
  screen up front.
- Surface `failedCount` on `SyncSettingsScreen.tsx` next to the existing
  "Pendientes por respaldar" line, and consider (not required for phase
  1. a badge on the Cuadre or Perfil entry points per issue #7's
     suggestion, consistent with how `pendingCount` already surfaces on
     `HomeScreen.tsx:128`, `ProfileScreen.tsx:99`, and
     `CuadreScreen.tsx:87` today.
- No push notification / background alerting — consistent with §1's
  offline-first, manual-trigger recommendation; visibility is
  "next time you open the relevant screen," not proactive.

## 7. Standalone change? Phased sketch

**Yes — this warrants its own OpenSpec change**, separate from whatever
lands loan/payment/visit push coverage (already in flight in a separate
PR per the task). Pull is a materially larger and riskier piece of work
(new read path, new conflict semantics, a new write primitive for
updates, new local schema for tracking guard state) than extending
`ENTITY_RANGES`, and issue #7 itself frames it as a distinct decision
("does it need its own OpenSpec change" — yes).

Sketch of phases for the eventual implementation change (not authorized
by this design doc — see `tasks.md` phase 0):

- **Phase A — read + upsert, `customers` only.** `readRange`-based row
  mapper, upsert-by-id, no conflict handling beyond "remote wins,
  full stop" (customers is the entity with the most real-world sheet-edit
  pressure — phone/address typos — and the smallest field set, making it
  the safest place to prove the mechanism). Manual trigger only.
- **Phase B — `values.update` + push-update, `customers` only.** Closes
  the loop for the one entity from phase A: local edits now actually
  reach the sheet instead of queuing forever.
- **Phase C — the `pending_mutations` guard (§4) + `SyncStatus`
  visibility additions (§6).** This is the correctness-critical phase —
  no guard means phase A/B can silently clobber offline edits — so it
  should land before pull is enabled by default for any user, not as a
  polish pass after.
- **Phase D — extend to `loans`** (the other mutable entity with
  `updatedAt`). Same mechanism as customers, applied to the second
  entity.
- **Phase E (later, separate decision)** — deletion detection and/or a
  conflict-queue escape hatch for the narrow case §4 defers. Explicitly
  not scheduled as part of this change; revisit once phases A–D are live
  and real usage shows whether it's needed.

`payments` and `visits` are deliberately **not** in this pull sketch at
all beyond what §3's "insert if remotely-present, locally-absent" already
covers passively — they have no edit flow and no `updatedAt`, so there is
no conflict to resolve for them; a lender adding a payment row by hand in
the sheet is just a new fact to insert, not a correction to reconcile.
