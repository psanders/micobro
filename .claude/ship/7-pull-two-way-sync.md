# Ship checkpoint — 7-pull-two-way-sync

Started: 2026-07-18
Current stage: 5 — Sync (gate)

**Scope:** Implement pull/two-way sync per the already-approved design
(owner sign-off 2026-07-17): remote-wins-with-guard conflict resolution,
manual "Sincronizar" trigger chained after push plus guarded app-open
auto-pull, phased customers → loans, payments/visits deferred (append-only,
no updatedAt). Closes GitHub issue #28 (P0: sync is push-only).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (only SyncSettingsScreen
status text — no new screens/flows) · Storybook: yes (`.storybook/`) · E2E:
yes, but Maestro (`.maestro/*.yaml`), not Playwright.

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | |
| 1 | Design (Pencil) | done | Added "Necesita atención: N" (stuckCount) line to `qAQ0l` (Sincronización con Google) |
| 2 | Spec reconcile | done | Wrote `specs/pull-two-way-sync/spec.md` (8 requirements); `openspec validate` green |
| 3 | Build | done | pull.ts, updateRow/findRowNumber in push.ts, syncNow() in SyncProvider+SyncRepo, autoSyncPolicy.ts, lastPulledAt in SyncStatus. Phase E (deletion detection, conflict queue) deliberately deferred per design.md §7 |
| 4 | Test | done | tsc/eslint/jest all green (68 suites, 278 tests). Live on-device walk against the real connected Datos sheet: found and fixed a real bug (concurrent `GoogleSignin.getTokens()` crash from `Promise.all`-ing the two entity pulls — now sequential). Maestro E2E addition skipped: a scripted flow can't meaningfully cover connectivity toggling + external Sheet edits, and the manual walk already exercised the real native auth path more thoroughly than mock-repo Maestro flow would |
| 5 | Sync | in-progress | Awaiting user confirmation to promote `pull-two-way-sync` delta into `openspec/specs/` |
| 6 | Archive | pending | |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-18 — Stage 4 (Test) done. Live on-device walk surfaced and fixed a
  real concurrency bug (`pull.ts`'s `Promise.all` over two entity pulls both
  hitting native `getTokens()`); fixed to sequential. Verified live: app-open
  guarded auto-sync and manual "Sincronizar ahora" both complete cleanly
  against the real Datos sheet (timestamp updates, no error dialog). Guard
  race itself not separately replayed live — already covered by
  `pull.test.ts`'s isolated guard test; the live-coordination cost (airplane
  mode + simultaneous external Sheet edit) wasn't worth the marginal
  confidence gain.
- 2026-07-18 — Stage 3 (Build) done. `lib/sync/pull.ts` (new): customer/loan
  row mappers (literal inverse of push.ts's, round-trip tested rather than
  extracted into a shared module — see tasks.md 1.1), upsert-by-id,
  `isGuarded()` against `pending_mutations`, no-delete-inference.
  `push.ts`: `updateRow`/`findRowNumber` so "update" mutations correct the
  Sheet row in place (self-heals to append if never pushed) instead of being
  skipped forever. `SyncProvider.tsx`: renamed `push`/`isPushing` →
  `sync`/`isSyncing` (both call sites updated) since the manual action is now
  push-then-pull; added the guarded app-open auto-sync effect
  (`autoSyncPolicy.ts`, ~15 min debounce); existing on-mutation/on-reconnect
  auto-push triggers stay push-only, unchanged. `SyncStatus` gains
  `lastPulledAt`; `stuckCount` (already shipped by `sync-push-policy`) reused
  as the "failedCount" concept design.md called for, not reinvented.
- 2026-07-18 — Stage 2 (Spec reconcile) done. Wrote
  `specs/pull-two-way-sync/spec.md` — 8 requirements covering manual sync
  chaining, guarded app-open auto-pull, remote-wins-with-guard,
  insert-on-absence, no-delete-inference, malformed-row skipping,
  update-in-place push, and the stuck-mutation status line. Hit and fixed an
  `openspec validate` parser quirk: the CLI only reads up to the first
  literal newline as a requirement's text, so hard-wrapped SHALL sentences
  that put "SHALL" past that point fail the "must contain SHALL" check —
  fixed by keeping each requirement statement on one line. Tasks 0.3/0.4
  checked off in `tasks.md` (decision: amend this change, not fork).
- 2026-07-18 — Stage 1 (Design) done. Added "Necesita atención: N" text node
  to the existing `qAQ0l` Sincronización con Google frame (this text already
  existed in code from `sync-push-policy` but was missing from Pencil).
  User confirmed good to proceed.
- 2026-07-18 — Checkpoint created; framing the change. Design (design.md) and
  tasks.md already fully written and owner-approved (2026-07-17); this ship
  run starts at task 0.3 (write delta spec) since 0.1/0.2 are done. Deferring
  phase E (deletion detection, conflict queue) per design.md §7 — not
  scheduled, needs real usage signal first.
