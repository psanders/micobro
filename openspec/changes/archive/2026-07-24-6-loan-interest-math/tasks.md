# Tasks: loan-interest-math

## 1. Math core

- [x] 1.1 `lib/loans/loanMath.ts` — pure `totalInterestCents`,
      `totalRepayCents`, `cuotaCents` (rounded up to `CUOTA_ROUNDING_CENTS`,
      50 pesos), `loanCostSummary`; ported from mikro's
      `calculateLoan.ts`/`loanCalculatorConstants.ts` core (no options-loop)
- [x] 1.2 Jest: worked examples (principal 1,000,000 @ 2000 bps / 12,
      rounding-remainder case, the mock exemplar, the small-loan
      rounding-dominates case)

## 2. Wire consumers off the flat no-interest formula

- [x] 2.1 `lib/loans/loanViews.ts` — `buildLoanDetailView` schedule/balance
      and `buildPaymentHistoryView`'s full-cuota threshold use
      `loanMath.cuotaCents`/`totalRepayCents`; last installment absorbs the
      rounding remainder, clamped at zero
- [x] 2.2 `lib/loans/mora.ts` — `oldestOverdueInstallment` uses the same
      interest-inclusive cuota so mora accrues against the right amount
- [x] 2.3 `lib/payments/getCollectContext.ts` + mock's
      `getCollectContext`/`get()` — drop their own flat `Math.floor`
      copy of the formula, use `loanMath.cuotaCents`/`totalRepayCents`
- [x] 2.4 `lib/loans/getLoanDetail.ts` (`LoanDetail.balanceCents`) — same

## 3. Surface total-cost-of-loan

- [x] 3.1 `LoanDetailView` gains `principalCents`/`totalInterestCents`/
      `totalRepayCents` (`lib/repo/types.ts`, populated in
      `buildLoanDetailView`)
- [x] 3.2 `LoanDetailScreen.tsx` — "Total a pagar" (+ "Interés" when
      nonzero) caption under the balance summary
- [x] 3.3 `NewLoanFormScreen.tsx` — live "Cuota estimada / Interés total /
      Total a pagar" preview as principal/rate/term are typed

## 4. Reconcile the mock exemplar + tests

- [x] 4.1 `lib/repo/mock/fixtures.ts` — bump José Núñez's (`loan-3`) three
      paid-cuota payments to the new RD$2,700 cuota so "cuotas 1–3 paid,
      cuota 4 overdue" still holds
- [x] 4.2 Update `__tests__/loanViews.test.ts`, `__tests__/mora.test.ts`,
      `__tests__/paymentHistory.test.ts`, `__tests__/getLoanDetailView.test.ts`,
      `__tests__/getLoanDetail.test.ts`, `__tests__/collectFlow.test.ts`,
      `__tests__/visitFlow.test.ts` for the new golden numbers
- [x] 4.3 lint/typecheck/test/format:check green

## 5. Spec reconcile

- [x] 5.1 `specs/loan-detail/spec.md` delta — ADDED "Total cost of loan",
      MODIFIED "Total a pagar hoy" worked example
- [x] 5.2 `specs/collect-payment/spec.md` delta — MODIFIED worked examples
      (cuota/readout/breakdown/receipt amounts)
- [x] 5.3 `openspec validate 6-loan-interest-math --strict`
