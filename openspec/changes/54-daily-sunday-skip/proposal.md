# Proposal: daily-sunday-skip

## Why

Closes #54. Some lenders don't collect on Sundays (religious observance,
operational). For **daily** loans, the repayment schedule should be able to
skip Sundays so no cuota ever falls due on a Sunday.

Per the lender's decision, this is a **per-loan** toggle chosen at creation
(not a lender-global flag) — mirroring the existing per-loan `moraEnabled` /
`graceDays` pattern — so existing loans are never retroactively reshaped and
the logic stays local to the loan.

## Exploration / impact

- Only **daily** loans are affected. `installmentDueDate(loan, n)`
  (`lib/loans/loanViews.ts`) computes cuota `n` as `startDate + n days`; with
  skip-Sundays on, cuota `n` becomes the `n`-th **non-Sunday** day after
  `startDate` (a Sunday due date shifts to Monday), so a 30-cuota daily loan
  spans ~35 calendar days.
- `installmentDueDate` feeds the schedule, route, loan-detail, collect
  context, customer detail, and mora — all read through the same seam, so the
  skip lives in one place.
- **Mora counts business days** (per decision): when a loan skips Sundays,
  `mora.ts`'s overdue-day count excludes Sundays, so a loan is never "more
  late" merely because a Sunday passed.
- Weekly/quincenal/mensual are unchanged.

## What Changes

- **Schema + migration**: nullable `skip_sundays` integer(boolean) column on
  `loans` (null = off), mirroring `mora_enabled`.
- **`lib/loans/loan.schema.ts`**: `createLoanSchema` gains
  `skipSundays: z.boolean().optional()`; `Loan` gains
  `skipSundays: boolean | null`.
- **`lib/loans/createLoan.ts` + mock repo**: persist
  `skipSundays: params.skipSundays ?? null`.
- **`lib/loans/loanViews.ts`**: `installmentDueDate` skips Sundays for daily
  loans with the flag on (new helper for the day-walk); everything downstream
  inherits it.
- **`lib/loans/mora.ts`**: overdue-day count excludes Sundays for a
  skip-Sundays loan.
- **`components/screens/NewLoanFormScreen.tsx`**: a "Saltar domingos" `Toggle`
  (reusing the Change 1 component), shown only when frecuencia is **Diario**.
- **Sync round-trip**: `push.ts` / `pull.ts` / `provisionSheet.ts` gain the
  `skip_sundays` column, like `mora_enabled`.

## Non-goals

- No lender-global/profile flag; no retroactive change to existing loans.
- No change to weekly/quincenal/mensual schedules.
