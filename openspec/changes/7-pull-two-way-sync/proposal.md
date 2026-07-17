# Proposal: 7-pull-two-way-sync

> **Status: design only, pending owner sign-off.** Nothing in this change is
> authorized to build yet. `tasks.md` phase 0 is a decision gate — no
> implementation task starts until the recommendations below are approved or
> revised by the owner. See GitHub issue #7.

## Why

Sync today is push-only. `lib/sync/push.ts` replays queued local writes
(`pending_mutations`) up to the lender's Google Sheet via `appendRow` — data
flows one direction, device to Sheet. But the Sheet is human-editable, and
lenders use that: a lender fixes a typo'd phone number, corrects a payment
amount entered wrong, or annotates a row directly in the spreadsheet because
that's faster than the app in the moment. None of that ever comes back down.
The app's local SQLite silently diverges from the sheet the lender thinks of
as the shared record, with no way to reconcile and no visibility that a
divergence exists.

Issue #7 splits into two independent halves: extending push to cover
loan/payment/visit entities (handled in a separate PR — not touched here),
and designing pull/two-way sync — unbuilt, and the harder half, because it
introduces conflicts that push-only never had to face. This proposal is the
design for that second half.

## What Changes

This is a design document, not an implementation. It proposes:

- **A pull mechanism** — `values.get` reads over each entity's Sheet range,
  mapped back to typed rows by the `id` column, upserted into local SQLite.
- **A conflict-resolution policy** for rows that changed on both sides
  between syncs, including the specific hazard of a pull clobbering a local
  write that hasn't been pushed yet.
- **The `sheetsClient.ts` and `push.ts` additions** pull depends on,
  including how it entangles with the still-missing `values.update`-by-id
  support (push today can only append, never correct a row in place).
- **User-visible sync status** for partial/failed/stuck state, building on
  the existing `SyncStatus.pendingCount`.

Recommended, pending sign-off: pull triggered on manual "Sincronizar" plus
opportunistically after a successful push; remote-wins-with-guard conflict
resolution (Sheet is authoritative for a field the lender edited there,
_except_ a field with an unpushed local mutation still queued, which always
wins over a stale pull) as the primary strategy, with a conflict-queue as a
deferred fallback for the cases that policy can't resolve safely (deletions).
Full options analysis with tradeoffs is in `design.md`.

## Capabilities

### New Capabilities

- `pull-two-way-sync`: pulling remote Sheet rows down into local SQLite,
  reconciling with local state (including in-flight `pending_mutations`),
  and resolving conflicts. **Not implemented by this change** — this change
  only introduces the capability's spec once the design is approved
  (tracked as a follow-up delta once phase 0 sign-off happens; see
  `tasks.md`). No delta spec is added to `specs/` in this change because
  there is no approved behavior yet to describe as SHALL/scenario
  requirements — see the note on `openspec validate` below.

### Modified Capabilities

None. `google-connect` (`openspec/specs/google-connect/spec.md`) covers the
connect/disconnect flow only and is unaffected; sync _behavior_ once
connected has no existing spec to modify (push itself was never specced).

## Impact

Design-only — no source files change in this PR. If/when the recommended
approach is approved, the eventual implementation change would touch:

- `lib/sync/sheetsClient.ts` — add a typed `readRange`-based row reader
  (already has a `readRange` primitive, currently unused — see `design.md`
  §2) and a `values.update`-by-id write function.
- `lib/sync/push.ts` — the "skip update mutations" comment (line ~59) goes
  away once `values.update` exists; pull needs to run in a way that doesn't
  race the push loop over the same `pending_mutations` rows.
- `lib/db/schema.ts` — likely a `lastPulledAt` / per-row `syncedAt` marker;
  `payments` and `visits` currently have no `updatedAt` column at all, which
  matters for any last-write-wins strategy (see `design.md` §4).
- `lib/repo/types.ts` / `SyncRepo` — a `pullNow()` seam alongside the
  existing `pushNow()`, and `SyncStatus` gains whatever failure/conflict
  fields the recommendation needs.
- `components/screens/SyncSettingsScreen.tsx` (and possibly Cuadre/Perfil,
  per issue #7's "surface stuck/failed mutations" ask) — visibility for
  pull results and unresolved conflicts.

## Note on `openspec validate`

`openspec validate 7-pull-two-way-sync` reports no deltas found for this
change, which is expected and fine for a design-only proposal: there is no
`specs/` delta directory here because no capability behavior is being
authorized yet. The capability delta spec gets written as part of the
follow-up implementation change once the owner picks a direction in
`tasks.md` phase 0.
