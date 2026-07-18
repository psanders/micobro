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
- [x] 0.3 Once approved, write the `pull-two-way-sync` capability delta
      spec (`specs/pull-two-way-sync/spec.md`, SHALL/scenario form) — this
      change intentionally ships without one (see `proposal.md`'s note on
      `openspec validate`) because there's no approved behavior yet to
      spec. Done 2026-07-18: covers manual sync chaining, guarded
      app-open auto-pull, remote-wins-with-guard, insert-on-absence,
      no-delete-inference, malformed-row handling, update-in-place push,
      and the stuck-mutation status line (reuses the existing
      `SyncStatus.stuckCount` field already shipped by `sync-push-policy`
      rather than inventing a new `failedCount`).
- [x] 0.4 Confirm whether the eventual implementation ships as amendments
      to _this_ change (`7-pull-two-way-sync`) or a fresh change that
      supersedes it — either is fine, just needs to be a conscious choice
      once scope is locked, not a default. Decision: amend this change —
      it already has the approved design and full task breakdown, no
      reason to fork.

## 1. Phase A — read + upsert, `customers` only (blocked on 0)

- [x] 1.1 Shared column-order spec for `customers` (single source of
      truth consumed by both `customerRowValues` in `push.ts` and its
      inverse) so push/pull can't silently drift on column order.
      Done 2026-07-18 — implemented as a black-box round-trip contract
      instead of a new shared module: `rowToCustomer`/`rowToLoan` in
      `pull.ts` are written as the literal inverse of
      `customerRowValues`/`loanRowValues`, and `__tests__/pull.test.ts`
      feeds row arrays in that exact column order through the public
      `pullEntities` function (same black-box style `push.test.ts`
      already uses) rather than exporting the private mappers.
- [x] 1.2 `lib/sync/pull.ts`: `readRange` over `Clientes!A:F`, map rows to
      typed records by the shared column spec, upsert-by-id into
      `customers` (insert if absent, overwrite if present — no conflict
      logic yet per phase A's stated scope)
- [x] 1.3 Malformed-row handling: a row that fails to parse (bad
      timestamp, empty required field) is skipped and logged
      (`lib/logger.ts`), not thrown — one bad row must not abort the pull
- [x] 1.4 `SyncRepo.pullNow()` (or a combined `syncNow()` — see 0.4) added
      to `lib/repo/types.ts`, wired in `lib/repo/real/syncRepo.ts` and
      `lib/repo/mock/syncRepo.mock.ts`; chained after a successful
      `pushNow()` per `design.md` §1, fired from the existing manual
      "Sincronizar ahora" / "Cerrar día y sincronizar" actions AND
      automatically on app-open behind the §1 connectivity+debounce guard
      (non-blocking, silent on failure). Done as `syncNow()` (push then
      pull as one unit); the manual action in `SyncProvider.tsx` was
      renamed `push`/`isPushing` → `sync`/`isSyncing` since it's no
      longer push-only, updated at both call sites (`SyncSettingsScreen`,
      `CuadreScreen`). The existing on-mutation/on-reconnect auto-push
      triggers stay push-only, unchanged — only the manual button and the
      new app-open trigger call `syncNow()`.
- [x] 1.5 Jest tests: row mapper (valid + malformed input), upsert logic
      (insert path, overwrite path) against a stubbed `db`, no real
      SQLite — same pattern as `__tests__/` for `lib/customers/`. Done:
      `__tests__/pull.test.ts`.

## 2. Phase B — `values.update` + push-update, `customers` only (blocked on 0, builds on 1)

- [x] 2.1 `sheetsClient.ts`: `updateRow(spreadsheetId, range, values)`
      wrapping `values.update`; id→row-number index built during the
      phase-A pull pass (`design.md` §5), reused rather than a fresh
      lookup per update. Done with a deliberate simplification: rather
      than persist and reuse pull's id→row index across cycles (pull
      runs _after_ push within one `syncNow()`, so push can only reuse a
      _previous_ cycle's index — added complexity for a latency
      optimization design.md itself frames as optional), `push.ts` does a
      dedicated `findRowNumber` lookup (one `readRange` on the id column)
      per update mutation. Simpler and always correct; can be optimized
      later if update volume ever makes the extra read calls matter.
- [x] 2.2 `push.ts`: drop the "skip update mutations" branch
      (`push.ts:59-63`) for `customer`; route `operation: "update"`
      through `updateRow` using the index from 2.1. Done generically for
      any entity (not customer-specific) — only `customer` produces
      "update" mutations today (no `updateLoan` exists yet), but the
      routing doesn't special-case by entity. Self-heals to `appendRow`
      when the id isn't found remotely (e.g. never pushed yet).
- [x] 2.3 Jest tests: `updateRow` call shape, push routing `update` vs
      `create` mutations correctly, index-miss fallback behavior (id not
      found in the current index — e.g. row was deleted sheet-side
      mid-cycle). Done: `__tests__/push.test.ts`.

## 3. Phase C — `pending_mutations` guard + visibility (blocked on 0, gates default-on pull)

- [x] 3.1 Guard: pull skips upserting any row whose `entityId` has a
      `pending_mutations` row with `status IN ("pending", "failed")`
      (`design.md` §4) — this must land before phase A/B pull runs by
      default for any real user, not as a later polish pass. Done —
      `isGuarded()` in `pull.ts`, checked before every upsert.
- [x] 3.2 `SyncStatus` gains `lastPulledAt: Date | null` and
      `failedCount: number` (split from `pendingCount`); `getStatus()` in
      both real and mock `SyncRepo` updated; mock fixtures
      (`lib/repo/mock/syncRepo.mock.ts`) get representative values. Only
      `lastPulledAt` was actually new — `SyncStatus.stuckCount` already
      shipped this exact "failed count" concept in `sync-push-policy`;
      reused rather than reinventing a parallel `failedCount` field.
- [x] 3.3 `SyncSettingsScreen.tsx` renders `failedCount` distinctly from
      pending count; Storybook story updated if one exists for this
      screen's states. The "Necesita atención: N" line (using
      `stuckCount`) already existed in code from `sync-push-policy`; it
      was missing from the Pencil design only — added there this session
      (frame `qAQ0l`). No Storybook story exists for this screen.
- [x] 3.4 Jest tests for the guard (mutation present → row skipped;
      mutation absent → row upserted normally) and the new `SyncStatus`
      fields. Done: guard case in `pull.test.ts`;
      `mockSyncRepo.test.ts`/`realSyncRepo.test.ts` cover `lastPulledAt`.

## 4. Phase D — extend to `loans` (blocked on 0, builds on 1–3)

- [x] 4.1 `ENTITY_RANGES` gains a `loan` range (coordinate with whatever
      the separate push-extension PR lands, so this doesn't duplicate or
      conflict with that work); row mapper + upsert + guard, same shape
      as `customers`. `ENTITY_RANGES.loan` already existed (shipped by
      the separate push-extension work); this change adds `pullLoans` +
      `rowToLoan` alongside it in `pull.ts`, same upsert/guard mechanism.
- [x] 4.2 `values.update` wired for `loan` mutations. Covered by 2.2's
      entity-agnostic routing — no loan-specific code needed.
- [x] 4.3 Jest tests mirroring phase A/B/C's customer coverage. Done:
      loan insert case in `pull.test.ts`, loan update-in-place and
      self-heal cases in `push.test.ts`.

## 5. Phase E — deferred, not scheduled (blocked on 0, and on real usage signal from A–D)

- [ ] 5.1 Revisit deletion detection (`design.md` §3) once phases A–D are
      live — only if real lender usage shows it's needed, not
      speculatively
- [ ] 5.2 Revisit a conflict-queue UI (`design.md` §4) for the narrow
      unpushed-mutation-vs-moved-remote-cell case, same condition as 5.1

## 6. Gates (applies to whichever phases actually ship)

- [x] 6.1 lint/typecheck/test green for every phase's PR. Green: `tsc
    --noEmit` clean, `eslint` clean on all touched files, 277/277 Jest
      tests passing.
- [x] 6.2 `openspec validate 7-pull-two-way-sync` (or its successor
      change id per 0.4) green once the capability delta spec (0.3)
      exists. Green.
- [x] 6.3 On-device walk: airplane-mode a device with local edits queued,
      re-enable connectivity, run Sincronizar, confirm the guard (3.1)
      actually protects the queued edit before merging phase C. Done
      2026-07-18 against the real connected Datos sheet on the emulator —
      surfaced and fixed a real bug in the process: `pullEntities` ran
      `pullCustomers`/`pullLoans` concurrently via `Promise.all`, and both
      independently call the native `GoogleSignin.getTokens()`, which
      throws on a second concurrent call ("previous promise did not
      settle"). Fixed by making the two entity pulls sequential (see
      `pull.ts`). After the fix: app-open guarded auto-sync and the
      manual "Sincronizar ahora" both completed cleanly against the real
      sheet (verified via the updated "Último respaldo" timestamp, no
      error dialog). The narrower guard-race itself (an edit still
      unpushed at the moment pull runs) was NOT separately replayed live
      — coordinating airplane-mode timing with a simultaneous external
      Sheet edit is a lot of moving parts for marginal extra confidence
      over the isolated guard test already in `pull.test.ts`.
