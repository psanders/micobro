# Tasks: loan-first-payment-date

## 1. Investigate root cause

- [x] 1.1 Repro `installmentDueDate` across all four frequencies with
      `startDate = now` — confirms cuota 1 is never due same-day
- [x] 1.2 Trace `NewLoanFormScreen.tsx` — confirms `startDate` is never
      collected or passed, always silently defaults to loan-creation moment

## 2. Schedule helpers

- [x] 2.1 `lib/loans/loanViews.ts` — extract `addFrequencyInterval` (date,
      frequency, count); `installmentDueDate` becomes a thin wrapper
      (unchanged external behavior, verified by existing
      `__tests__/loanViews.test.ts`/`__tests__/mora.test.ts`)
- [x] 2.2 `lib/loans/loanViews.ts` — add `defaultFirstPaymentDate` (frequency,
      from)
- [x] 2.3 Export both from `lib/loans/index.ts`
- [x] 2.4 Jest: `__tests__/loanViews.test.ts` — `addFrequencyInterval` and
      `defaultFirstPaymentDate` cases per frequency, including negative
      count and the monthly/day-based split

## 3. New Loan form

- [x] 3.1 `NewLoanFormScreen.tsx` — "Primer pago" field: cycling preset
      control (no native date-picker dependency, matches
      `VisitOutcomeScreen.tsx`'s pattern), default = `defaultFirstPaymentDate`,
      two further per-frequency presets
- [x] 3.2 Reset the preset to the default when frecuencia changes
- [x] 3.3 On submit, convert the chosen first-payment date back to
      `startDate` via `addFrequencyInterval(date, frequency, -1)` and pass
      it to `loanRepo.create`

## 4. Spec reconcile

- [x] 4.1 New `specs/loan-configuration/spec.md` delta — ADDED "First
      payment date" (no existing spec covered the Nuevo Préstamo form)
- [x] 4.2 `openspec validate 44-loan-first-payment-date --strict`

## 5. Verify

- [x] 5.1 `npx jest`, `npx tsc --noEmit`, `npx eslint` on changed files —
      all green
