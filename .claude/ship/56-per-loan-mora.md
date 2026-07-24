# Ship checkpoint — 56-per-loan-mora

Started: 2026-07-24
Current stage: DONE — shipped in PR #62 (2026-07-24)

**Scope:** Make mora (late fee) per-loan configurable — a loan can opt out of
mora entirely (`moraEnabled`) and set its own rate (`moraRateBps`) instead of
the fixed 10% default — mirroring the existing nullable `graceDays` pattern.
Touches schema + migration, `mora.ts`'s `loanMoraPolicy`, the Nuevo Préstamo
form, and the Sheets sync round-trip.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: no · E2E: no (Maestro `.maestro/`, machine-level)

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Change `56-per-loan-mora` authored (proposal/tasks/delta spec). Branch `feat/per-loan-mora` off origin/main. |
| 1 | Design (Pencil) | done | Added mora opt-in switch + conditional "Tasa de mora (%)" field to the Collectors "06b Nuevo Préstamo" screen (`Mac4Z`) in pencil.pen. User approved 2026-07-24. |
| 2 | Spec reconcile | done | Delta MODIFIES loan-detail "Total a pagar hoy" for per-loan enable + custom rate. `openspec validate --strict` passes. |
| 3 | Build | done | Sonnet subagent implemented all tasks. Migration `0007_flimsy_genesis.sql`. Opus reviewed mora.ts/form/sync diffs — correct & idiomatic. |
| 4 | Test | done | Real tree: 47 suites / 254 tests pass, `tsc --noEmit` clean, eslint clean. (Stray `.claude/worktrees/` copy pollutes raw runs — excluded.) |
| 5 | Sync | done | `openspec archive` promoted the loan-detail delta into main specs (1 requirement modified). User approved. |
| 6 | Archive | done | Change archived as `2026-07-24-56-per-loan-mora`. User approved. Committing + PR next. |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-24 — Manual test on `mikro-test` Android emulator (fresh `expo run:android` dev build, mock repos): app runs, exemplars keep mora (backward compat verified), mora toggle + conditional rate field render. User feedback: "Período de gracia" must be nested UNDER the mora toggle (grace is meaningless when mora is off) → moving grace field into the `moraEnabled &&` conditional. Delegated to Sonnet agent; hot-reloads via Metro.
- 2026-07-24 — Mora is opt-in at creation (form toggle defaults OFF → new loans send `moraEnabled: false`), but data-layer `null` stays enabled@10% for backward compat (no fixture/test churn, no retroactive change to existing loans). Per user steer "don't just default to 10%".
- 2026-07-24 — Design done on the CORRECT cluster: Collectors mobile "06b Nuevo Préstamo" (`Mac4Z`), not the Operations `cp/` cards. Misplaced Operations variant deleted.
- 2026-07-24 — Schema input is `moraRate` (percent) → stored `moraRateBps` (bps), mirroring `interestRate`/`interestRateBps`. Columns nullable, `null` = default (mirrors `graceDays`).
- 2026-07-24 — Only `mora.ts` central change needed; the 4 `computeLoanMora` call sites already pass `loanMoraPolicy(loan)`.
- 2026-07-24 — Committed in-progress `pencil.pen` onto `fix/bluetooth-permissions-ux` (as `c2df97d`), then branched `feat/per-loan-mora` off `origin/main`.
- 2026-07-24 — Checkpoint created; framing the change from issue #56.
