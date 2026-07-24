# Ship checkpoint — 55-open-credit-loans

Started: 2026-07-24
Current stage: 3 — Build (Sonnet, two passes)

**Scope:** Change 3 of the Loans-screen epic (#55). New loan type **crédito
abierto**: interest-only cycles on an outstanding capital balance, optional
capital paydown, skip capitalizes interest (no mora), close on zero balance,
first interest one cycle after disbursement. Reuses the loans/payments tables +
one `loan_type` column; balance/cycles DERIVED (no stored balance, payments
unchanged). Wires the existing `06c Detalle` / `07c Cobrar` designs. Stacked on
Change 2 (`feat/daily-sunday-skip`) — overlaps loan.schema/form/sync.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (06c/07c exist) · Storybook: no · E2E: no

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Branch `feat/open-credit-loans` off `feat/daily-sunday-skip`. #55 + designs read; model decided with lender. |
| 1 | Design (Pencil) | in-progress | 06c/07c screens exist + in cluster. Add "Crédito Abierto" option to Nuevo Préstamo design (parity, deferred like prior changes — tooling). |
| 2 | Spec reconcile | done | Deltas ADD open-credit create / detail / collect. `openspec validate --strict` passes. |
| 3 | Build | done | Sonnet, 2 passes: (A) model+migration, `openCredit.ts` cycle engine, create flow, sync, tests; (B) detail + collect + form UI. Verified by Opus: tsc clean, eslint clean, engine + view builders + screens reviewed. |
| 4 | Test | done (automated) | tsc clean; eslint clean (only pre-existing `.claude/worktrees` noise); jest **296/296**. Manual emulator (8.2) pending — lender to drive. |
| 5 | Sync | pending | Gate — awaiting approval to promote deltas + commit/PR. |
| 6 | Archive | pending | Gate. |

Status values: `pending` · `in-progress` · `done` · `skipped`.

## Decision log

Newest first.

- 2026-07-24 — Lender decisions: no mora (skip capitalizes only); close on zero
  balance; first interest one cycle after disbursement; derive balance (don't
  store); Google Sheet gains only a `loan_type` column, Pagos tab unchanged.
- 2026-07-24 — One change (not phased) per earlier decision; built in two Sonnet
  passes internally. Reuse loans/payments tables + `loanType` column.
- 2026-07-24 — Stacked on Change 2 (overlaps loan.schema/form/sync).
