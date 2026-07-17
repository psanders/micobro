# Tasks: 7-pull-two-way-sync

This is a design change. Phase 0 is the only task authorized to be
"done" by this PR. **Nothing below phase 0 may start until phase 0's
decision gate is checked off by the owner** — none of it is pre-approved
by writing it down here.

## 0. Decision gate (owner sign-off required — nothing past this point is authorized)

- [x] 0.1 Owner reviewed `design.md` §1–7 (2026-07-17): **approved
      remote-wins-with-guard** conflict resolution, no deletion inference in
      phase 1, and `customers` → `loans` → deferred payments/visits ordering;
      **amended the trigger** to add guarded app-open auto-pull alongside the
      manual+chained path (see §1)
- [x] 0.2 `proposal.md`/`design.md` updated to match the owner's decision
      (app-open trigger folded into §1, proposal status banner) before any
      phase A work begins
- [ ] 0.3 Once approved, write the `pull-two-way-sync` capability delta
      spec (`specs/pull-two-way-sync/spec.md`, SHALL/scenario form) — this
      change intentionally ships without one (see `proposal.md`'s note on
      `openspec validate`) because there's no approved behavior yet to
      spec
- [ ] 0.4 Confirm whether the eventual implementation ships as amendments
      to _this_ change (`7-pull-two-way-sync`) or a fresh change that
      supersedes it — either is fine, just needs to be a conscious choice
      once scope is locked, not a default

## 1. Phase A — read + upsert, `customers` only (blocked on 0)

- [ ] 1.1 Shared column-order spec for `customers` (single source of
      truth consumed by both `customerRowValues` in `push.ts` and its
      inverse) so push/pull can't silently drift on column order
- [ ] 1.2 `lib/sync/pull.ts`: `readRange` over `Clientes!A:F`, map rows to
      typed records by the shared column spec, upsert-by-id into
      `customers` (insert if absent, overwrite if present — no conflict
      logic yet per phase A's stated scope)
- [ ] 1.3 Malformed-row handling: a row that fails to parse (bad
      timestamp, empty required field) is skipped and logged
      (`lib/logger.ts`), not thrown — one bad row must not abort the pull
- [ ] 1.4 `SyncRepo.pullNow()` (or a combined `syncNow()` — see 0.4) added
      to `lib/repo/types.ts`, wired in `lib/repo/real/syncRepo.ts` and
      `lib/repo/mock/syncRepo.mock.ts`; chained after a successful
      `pushNow()` per `design.md` §1, fired from the existing manual
      "Sincronizar ahora" / "Cerrar día y sincronizar" actions AND
      automatically on app-open behind the §1 connectivity+debounce guard
      (non-blocking, silent on failure)
- [ ] 1.5 Jest tests: row mapper (valid + malformed input), upsert logic
      (insert path, overwrite path) against a stubbed `db`, no real
      SQLite — same pattern as `__tests__/` for `lib/customers/`

## 2. Phase B — `values.update` + push-update, `customers` only (blocked on 0, builds on 1)

- [ ] 2.1 `sheetsClient.ts`: `updateRow(spreadsheetId, range, values)`
      wrapping `values.update`; id→row-number index built during the
      phase-A pull pass (`design.md` §5), reused rather than a fresh
      lookup per update
- [ ] 2.2 `push.ts`: drop the "skip update mutations" branch
      (`push.ts:59-63`) for `customer`; route `operation: "update"`
      through `updateRow` using the index from 2.1
- [ ] 2.3 Jest tests: `updateRow` call shape, push routing `update` vs
      `create` mutations correctly, index-miss fallback behavior (id not
      found in the current index — e.g. row was deleted sheet-side
      mid-cycle)

## 3. Phase C — `pending_mutations` guard + visibility (blocked on 0, gates default-on pull)

- [ ] 3.1 Guard: pull skips upserting any row whose `entityId` has a
      `pending_mutations` row with `status IN ("pending", "failed")`
      (`design.md` §4) — this must land before phase A/B pull runs by
      default for any real user, not as a later polish pass
- [ ] 3.2 `SyncStatus` gains `lastPulledAt: Date | null` and
      `failedCount: number` (split from `pendingCount`); `getStatus()` in
      both real and mock `SyncRepo` updated; mock fixtures
      (`lib/repo/mock/syncRepo.mock.ts`) get representative values
- [ ] 3.3 `SyncSettingsScreen.tsx` renders `failedCount` distinctly from
      pending count; Storybook story updated if one exists for this
      screen's states
- [ ] 3.4 Jest tests for the guard (mutation present → row skipped;
      mutation absent → row upserted normally) and the new `SyncStatus`
      fields

## 4. Phase D — extend to `loans` (blocked on 0, builds on 1–3)

- [ ] 4.1 `ENTITY_RANGES` gains a `loan` range (coordinate with whatever
      the separate push-extension PR lands, so this doesn't duplicate or
      conflict with that work); row mapper + upsert + guard, same shape
      as `customers`
- [ ] 4.2 `values.update` wired for `loan` mutations
- [ ] 4.3 Jest tests mirroring phase A/B/C's customer coverage

## 5. Phase E — deferred, not scheduled (blocked on 0, and on real usage signal from A–D)

- [ ] 5.1 Revisit deletion detection (`design.md` §3) once phases A–D are
      live — only if real lender usage shows it's needed, not
      speculatively
- [ ] 5.2 Revisit a conflict-queue UI (`design.md` §4) for the narrow
      unpushed-mutation-vs-moved-remote-cell case, same condition as 5.1

## 6. Gates (applies to whichever phases actually ship)

- [ ] 6.1 lint/typecheck/test green for every phase's PR
- [ ] 6.2 `openspec validate 7-pull-two-way-sync` (or its successor
      change id per 0.4) green once the capability delta spec (0.3)
      exists
- [ ] 6.3 On-device walk: airplane-mode a device with local edits queued,
      re-enable connectivity, run Sincronizar, confirm the guard (3.1)
      actually protects the queued edit before merging phase C
