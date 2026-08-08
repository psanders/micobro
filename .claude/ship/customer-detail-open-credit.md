# Ship checkpoint — 107-customer-detail-open-credit

Started: 2026-08-07
Current stage: 6 — Archive (done)

**Change renamed** `107-customer-detail-open-credit` → `customer-detail-open-credit`:
the OpenSpec CLI's `status`/`archive` reject change names that don't start
with a letter (`validate` accepts them, which is why it wasn't caught at
stage 0). Archived as `2026-08-08-customer-detail-open-credit`.

**Scope:** Closes #107. Cliente Detalle was never updated when crédito abierto
shipped (change 55), so open-credit loans render "Cuota 0 de 0", a dead
progress bar, and "Pago cuota N" activity rows. This change gives the loan
card an open-credit variant driven by capital repaid, relabels activity rows
"Pago ciclo N", and stops open-credit loans from being run through mora.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (`.storybook/`) · E2E: Maestro (`.maestro/`, machine-level CLI — no Playwright)

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Change created from issue #107; `openspec validate --strict` passes. |
| 1 | Design (Pencil) | done | `05c Cliente Detalle — Crédito Abierto` = node `Ewzzx`, row `ZvdX2` index 11. Approved by owner. **Unsaved in Pencil (in-memory only).** |
| 2 | Spec reconcile | done | Delta spec's open-credit sub-line corrected from "Interés <frecuencia>" to "<tasa>% <frecuencia>" to match the approved design + `06c` vocabulary. `openspec validate --strict` passes. |
| 3 | Build | done | Sonnet subagent. 8 files changed, 2 added (`LoanSummaryCard.tsx`, `LoanSummaryCardKit.stories.tsx`). |
| 4 | Test | done | 80 suites / 489 tests pass; typecheck clean; eslint clean on all changed files. |
| 5 | Sync | done | Deltas merged into `openspec/specs/customer-detail/spec.md`; spec + change validate strict. |
| 6 | Archive | done | `2026-08-08-customer-detail-open-credit`. |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Pencil placement (decided)

- Cliente Detalle is `p9vQX` "05 Cliente Detalle", inside wrapper `ZfUov`, in
  section `lYF48` **"Visit & Collection Flow"** — *not* Navigation & Search.
- That same row already holds the change-55 open-credit variants: `IGK1Q`
  "06c Crédito Abierto Detalle" and `gH1rr` "07c Cobrar Crédito Abierto",
  chained after arrow `I803X`. Repo convention is a `c`-suffixed sibling.
- New screen goes into that open-credit sub-chain **before** `IGK1Q`, matching
  the navigation order (cliente → préstamo → cobrar → recibo).

## Emulator verification (2026-08-07)

Ran on `mikro-test` (emulator-5554) in real mode against live SQLite rows.
Both open-credit cards rendered correctly — `Capital pagado 50%` /
`Interés 01/10 · RD$501.90` and `Capital pagado 27%` / `Interés 01/10 ·
RD$729`, activity rows `Pago ciclo 1/2`. Every figure was cross-checked
against an independent hand replay of the cycle model and matched exactly,
including cycle 1 of loan A being skipped and capitalizing RD$1,000 into
the balance (which is why its cycle-2 interest is RD$1,100, not RD$1,000).

**Caution for next time:** `expo run:android` replaced the app database —
the previously installed EAS-signed build (0.2.3) and a locally-signed
debug build have different keys, so installing wipes app data. Back up
`/data/data/com.micobro.app/files/SQLite/micobro.db` (+ `-wal`) via
`adb exec-out run-as` before rebuilding.

## Known follow-ups (not blockers)

- **Month-end date drift (pre-existing, filed separately).**
  `addFrequencyInterval` (`lib/loans/loanViews.ts:60-64`) uses a bare
  `setMonth` with no month-end clamp, so a monthly loan starting 31 Jul has
  its 2nd cycle end on **Oct 1** instead of Sep 30, and one starting 30 Jan
  skips February entirely (1st cycle ends **Mar 2**). Affects open-credit
  cycle windows *and* term-loan cuota due dates via `installmentDueDate`.
  Surfaced by the #107 math check; out of scope for this change.

- `cycleIndexForPayment` (`lib/loans/loanViews.ts`) duplicates the cycle
  day-window rule from `openCredit.ts:150` verbatim rather than sharing it —
  `openCredit.ts` was declared out of scope for this change. Exporting a
  single `cycleOwnsDay` helper would remove the drift risk.
- Repo-wide `npm run lint` is NOT clean: 18 pre-existing errors, all inside
  the nested worktree `.claude/worktrees/agent-a44c3238833f865ea`
  (branch `docs/4-feedback-auth-decision`, PR #19, still OPEN — do not
  delete). `eslint.config.mjs`'s ignore list isn't `**/`-anchored, so it
  doesn't reach into nested worktrees; jest picks those tests up too.

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-07 — Stages 3–4 executed by a Sonnet subagent; captain verified
  independently (tests, typecheck, scoped lint, diff review) rather than
  accepting the agent's report.

- 2026-08-07 — Owner picked "Pago ciclo N" for activity rows; rejected a
  per-payment interés/capital split (OpenCreditCycle splits per cycle, not per
  payment — would need a new helper). Recorded as a non-goal.
- 2026-08-07 — Owner picked "Capital pagado %" for the card meta + progress
  bar, clamped to 0–100% because capitalized interest can push the balance
  above the original principal.
- 2026-08-07 — Confirmed change 55 updated `loan-detail`, `collect-payment`,
  `loan-configuration` specs but never `customer-detail`; the gap exists at
  the spec level, not just in code.
- 2026-08-07 — Checkpoint created; change `107-customer-detail-open-credit`
  proposed and validated.
