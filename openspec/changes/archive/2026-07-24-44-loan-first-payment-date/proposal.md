# Proposal: loan-first-payment-date

## Why

Closes #44. The lender's own framing: "when we create a new loan, the first
installment is on the same day. We don't want that. We want to be able to
set a specific day with some healthy defaults." Investigating that claim
against the code: `installmentDueDate(loan, number)`
(`lib/loans/loanViews.ts`) already computes cuota 1's due date as
`loan.startDate` plus one payment interval (tomorrow for diario, +7 days for
semanal, +14 for quincenal, +1 month for mensual) — never same-day as
`startDate`. A repro test across all four frequencies confirms this: no
frequency produces a same-day first cuota.

So the schedule math isn't the bug. The real gap is that
`NewLoanFormScreen.tsx` never surfaces this at all — it collects monto,
tasa, plazo, and frecuencia, but has no field for "when's the first
payment," and always creates the loan with `startDate` defaulted silently
to the creation moment. From the lender's perspective there's no visible
"first payment date" concept to configure — which is what "the first
installment is on the same day" is really describing: not a scheduling
bug, but a missing control. This proposal only adds that control; it does
not change `installmentDueDate`, `mora.ts`, or any existing schedule/mora
behavior.

## What Changes

- **`lib/loans/loanViews.ts`**: extract `addFrequencyInterval(date,
frequency, count)` (day-based for diario/semanal/quincenal, calendar-month
  for mensual; `count` may be negative) — `installmentDueDate` becomes a
  thin wrapper over it, unchanged behavior. Add
  `defaultFirstPaymentDate(frequency, from)` = `addFrequencyInterval(from,
frequency, 1)`, the healthy per-frequency default the lender asked for.
- **`NewLoanFormScreen.tsx`**: new "Primer pago" field, a cycling-preset
  control (same no-native-dependency pattern as
  `VisitOutcomeScreen.tsx`'s `DATE_PRESETS`) defaulting to
  `defaultFirstPaymentDate(frequency)` and letting the lender step through
  two further presets (2 and 3 intervals out) per the selected frecuencia.
  On submit, the chosen first-payment date is converted back to the
  `startDate` sent to `createLoan` via `addFrequencyInterval(date,
frequency, -1)` — the inverse of the +1 interval `installmentDueDate`
  already applies for cuota 1 — so the loan's actual first-cuota due date
  always matches exactly what the lender picked in the form. No schema or
  DB change: `startDate` was already an optional param on
  `createLoanSchema`/`CreateLoanInput`.

## Non-goals

- Issue #43 (configurable grace period, default 7 days) is a distinct
  mora/overdue concern touching `lib/loans/mora.ts`, not schedule/first-
  payment. Left out of this change; a separate proposal if picked up.
- No change to `installmentDueDate`'s semantics or to any existing
  schedule/mora/route behavior — confirmed via the fixture/test suite that
  those already produce healthy (non-same-day) first-cuota dates today.
