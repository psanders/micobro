# Proposal: loan-interest-math

## Why

Closes #6. `loan.interestRateBps` has been captured at loan creation since
day one but never used: `lib/loans/loanViews.ts` computes the cuota as a
flat `floor(principalCents / termCount)` and the balance as
`principal - paid` — no amortization, no interest, no total-cost-of-loan
number anywhere in the app. A lender who types "20%" into Nuevo Préstamo
sees that rate reflected nowhere in what the client actually owes. This is
separate from mora/late fees (`lib/loans/mora.ts`), which already exist and
already derive from the (until now interest-blind) cuota.

## What Changes

- **Flat add-on interest model**, ported from mikro's
  `mods/common/src/utils/calculateLoan.ts` (`calculateLoanOptions`'s
  per-option core — not its options-generator loop): interest accrues once
  over the whole term (`principal × rate`, `rate = interestRateBps /
10000`), folded into an equal cuota across every installment and rounded
  up to a collection-friendly increment (`CUOTA_ROUNDING_CENTS`, 50 pesos,
  mirroring mikro's `DEFAULT_PAYMENT_ROUNDING_INCREMENT`). New pure module
  `lib/loans/loanMath.ts` exports `totalInterestCents`, `totalRepayCents`,
  `cuotaCents`, and `loanCostSummary` — no DB, fully unit-testable, same
  porting pattern as `lib/payments/paymentSplit.ts` and `lib/loans/mora.ts`.
- **`lib/loans/loanViews.ts`** now builds the Plan de pagos schedule and
  "Total a pagar hoy" breakdown from the interest-inclusive cuota, and the
  loan balance is `totalRepayCents - paidCents` (principal + interest,
  minus what's been collected) instead of bare `principal - paid`. The
  last installment absorbs the rounding remainder, clamped at zero — a
  small loan with a coarse rounding increment can otherwise "finish"
  before its nominal last installment.
- **Consumers reconciled**: `lib/loans/mora.ts`'s `oldestOverdueInstallment`
  (mora accrues against the correct cuota), `lib/payments/getCollectContext.ts`
  and the mock's `getCollectContext`/`get()` (both derived their own
  `Math.floor(principal / term)` copy of the old formula), and
  `lib/loans/getLoanDetail.ts` (`LoanDetail.balanceCents`, previously bare
  `principal - paid`) all now go through `lib/loans/loanMath.ts` instead of
  re-deriving cuota/balance locally.
- **Total-cost-of-loan surfaced in the UI**: `LoanDetailView` gained
  `principalCents` / `totalInterestCents` / `totalRepayCents`; Préstamo
  Detalle's balance summary card shows a "Total a pagar" (+ "Interés" when
  nonzero) caption under the balance. Nuevo Préstamo now shows a live
  "Cuota estimada / Interés total / Total a pagar" preview as the lender
  types principal, rate, and term — using existing screen conventions
  (no new design system components; a captain design pass can restyle
  later).
- **Mock exemplar recomputed**: José Núñez's loan (`loan-3`, RD$28,800 @
  12% / 12 semanas) now carries a RD$2,700 cuota (was a flat RD$2,400);
  the three already-paid cuota fixtures were bumped to match so "cuotas
  1–3 paid, cuota 4 overdue" still holds. Total-a-pagar-hoy for the
  overdue cuota + RD$750 mora is now RD$3,450 (was RD$3,150). The canonical
  `loan-detail` and `collect-payment` specs' worked examples are updated
  to match via this change's delta specs.

## Capabilities

### Modified Capabilities

- `loan-detail`: "Total a pagar hoy" worked example numbers now reflect the
  interest-inclusive cuota; new "Total cost of loan" requirement for the
  balance summary card's total-a-pagar caption.
- `collect-payment`: worked example numbers (cuota, readout, breakdown,
  receipt) updated to the interest-inclusive cuota.

## Impact

- `lib/loans/loanMath.ts` — new pure module (`CUOTA_ROUNDING_CENTS`,
  `totalInterestCents`, `totalRepayCents`, `cuotaCents`, `loanCostSummary`).
- `lib/loans/loanViews.ts`, `lib/loans/mora.ts`,
  `lib/payments/getCollectContext.ts`, `lib/loans/getLoanDetail.ts`,
  `lib/repo/mock/index.ts` — cuota/balance math routed through
  `loanMath.ts`.
- `lib/repo/types.ts` — `LoanDetailView` gains `principalCents`,
  `totalInterestCents`, `totalRepayCents`.
- `lib/repo/mock/fixtures.ts` — José Núñez's (`loan-3`) three paid-cuota
  fixtures bumped from 240000 to 270000 cents.
- `components/screens/LoanDetailScreen.tsx` — "Total a pagar" caption on
  the balance summary card.
- `components/screens/NewLoanFormScreen.tsx` — live cost preview.
- Tests: new `__tests__/loanMath.test.ts`; updated
  `__tests__/loanViews.test.ts`, `__tests__/mora.test.ts`,
  `__tests__/paymentHistory.test.ts`, `__tests__/getLoanDetailView.test.ts`,
  `__tests__/getLoanDetail.test.ts`, `__tests__/collectFlow.test.ts`,
  `__tests__/visitFlow.test.ts` for the new golden numbers.
- Storybook (`CollectionKit.stories.tsx`, `ClientRow.stories.tsx`,
  `ProfileToolsKit.stories.tsx`) still shows the old RD$2,400/RD$3,150
  static copy — those are hand-authored display props, not computed, so
  nothing breaks, but they're now cosmetically stale. Left for the
  captain's design pass rather than touched here.
