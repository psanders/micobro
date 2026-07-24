# Ship checkpoint — 54-daily-sunday-skip

Started: 2026-07-24
Current stage: Committed + PR #67 (2026-07-24), rebased onto main after #66 merged. Remaining: OpenSpec archive + Pencil parity.

**Scope:** Change 2 of the Loans-screen epic (#54). Per-loan "Saltar domingos"
toggle on daily loans: no cuota falls due on a Sunday (Sunday → Monday), and
mora counts business days for such loans. Per-loan (mirrors `moraEnabled`), off
by default; weekly/quincenal/mensual unaffected; existing loans never reshaped.
Stacked on Change 1 (`feat/loan-creation-fidelity`) because it adds a toggle to
the same Nuevo Préstamo form and reuses the Change 1 `Toggle` component.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: no · E2E: no (Maestro, machine-level)

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Branch `feat/daily-sunday-skip` off `feat/loan-creation-fidelity` (stacked). Issue #54 read; exploration in proposal. |
| 1 | Design (Pencil) | in-progress | Reuses Change 1 `Toggle`; conditional on frecuencia=Diario. Pencil parity (add toggle to `Mac4Z`) deferred like Change 1. |
| 2 | Spec reconcile | done | Delta ADDS "Sunday-skip for daily loans" to loan-configuration. `openspec validate --strict` passes. |
| 3 | Build | done | Sonnet: migration `0008_friendly_zaladane.sql` (ADD skip_sundays); `addNonSundayDays` in loanViews; `daysLateExcludingSundays` in mora; conditional "Saltar domingos" Toggle; sync A:N→A:O round-trip. Uncommitted. |
| 4 | Test | done | Verified by Opus: tsc clean, lint clean (project), jest 47 suites / 269 tests (+15). Manual emulator pending (needs app restart for the migration — needs user). |
| 5 | Sync | pending | Gate. (Archive ordering as with Change 1.) |
| 6 | Archive | pending | Gate. |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first.

- 2026-07-24 — User decisions: (1) **per-loan** toggle at creation (not lender-
  global, not retroactive); (2) mora counts **business days** (excludes Sundays)
  for skip-Sundays loans.
- 2026-07-24 — Stacked on Change 1: Change 2 edits the same Nuevo Préstamo form
  and reuses its `Toggle`, so branching off main would conflict.
- 2026-07-24 — Frame from #54; per-loan pattern mirrors 56-per-loan-mora.
