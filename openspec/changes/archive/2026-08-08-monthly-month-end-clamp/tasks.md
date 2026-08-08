## 1. Fix

- [x] 1.1 Rewrite `addFrequencyInterval`'s monthly branch in
      `lib/loans/loanViews.ts` to clamp to the target month's last day
      while preserving the original anchor day-of-month, including for
      negative `count`.
- [x] 1.2 Update the function's JSDoc to state the clamp/anchor-restore
      rule.
- [x] 1.3 Verify every call site (`installmentDueDate`,
      `defaultFirstPaymentDate`, `openCreditState`'s cycle loop and
      `nextDueDate` branches, `NewLoanFormScreen`'s `startDate` derivation)
      passes the loan's original `startDate`/anchor date as the base with
      an increasing `count`, rather than iterating off a previous result —
      required for anchor preservation to hold.

## 2. Tests

- [x] 2.1 Add a boundary matrix to `__tests__/loanViews.test.ts` covering
      28/29/30/31-day month-end shifts, including a leap-year February.
- [x] 2.2 Add the 30 Jan → 28 Feb and 31 Jul → 30 Sep/31 Oct/30 Nov/31 Dec
      regressions.
- [x] 2.3 Add a negative-`count` clamp test.
- [x] 2.4 Add a `NewLoanFormScreen` startDate round-trip test across
      monthly first-payment picks; document the residual case where the
      round-trip cannot hold (chosen day doesn't exist in the preceding
      month) as a known limitation, not a bug to fix here.
- [x] 2.5 Add an `openCreditState` regression in `__tests__/openCredit.test.ts`
      for a month-end monthly loan's cycle windows, asserting no month is
      skipped and cycles tile contiguously.

## 3. Spec

- [x] 3.1 Add the "Monthly schedule month-end clamp" requirement to the
      `loan-configuration` delta spec, with scenarios for the 30 Jan
      (incl. leap year) and 31 Jul cases.
- [x] 3.2 `openspec validate monthly-month-end-clamp --strict` passes.

## 4. Verification

- [x] 4.1 `npx tsc --noEmit` passes.
- [x] 4.2 `npx jest` full suite passes.
- [x] 4.3 `npx eslint` on changed files passes.
