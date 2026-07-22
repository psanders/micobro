/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Flat add-on interest: the loan accrues one interest amount over its
 * whole term (not per period, not declining balance) — `principal × rate`,
 * folded into an equal cuota across every installment and rounded up to a
 * collection-friendly increment. Ported from mikro's
 * `@mikro/common/utils/calculateLoan.ts` (`calculateLoanOptions`'s
 * per-option core: `totalInterest`/`totalRepay`/`paymentPerPeriod`) — not
 * imported as a package for the same reason `lib/payments/paymentSplit.ts`
 * and `lib/loans/mora.ts` aren't: that package assumes a Node runtime
 * unsafe under Hermes/Expo. Same porting pattern; this module only needs
 * the single-option core, not mikro's options-generator loop.
 */

/**
 * Rounding increment for collection-friendly cuota amounts (50 pesos),
 * mirroring mikro's `DEFAULT_PAYMENT_ROUNDING_INCREMENT`.
 */
export const CUOTA_ROUNDING_CENTS = 5000;

function roundUpToIncrement(valueCents: number, incrementCents: number): number {
  return Math.ceil(valueCents / incrementCents) * incrementCents;
}

/** rate = interestRateBps / 10000 (e.g. 2000 bps → 0.20 = 20% flat over the whole loan). */
export function totalInterestCents(principalCents: number, interestRateBps: number): number {
  return Math.round((principalCents * interestRateBps) / 10000);
}

/** Principal + flat interest — the full amount the loan will collect. */
export function totalRepayCents(principalCents: number, interestRateBps: number): number {
  return principalCents + totalInterestCents(principalCents, interestRateBps);
}

/**
 * Equal cuota across the term, rounded up to `CUOTA_ROUNDING_CENTS`. The
 * schedule's last installment absorbs the rounding remainder (see
 * `loanViews.ts` / `mora.ts`), so this is the amount for every
 * installment except (usually) the last one.
 */
export function cuotaCents(
  principalCents: number,
  interestRateBps: number,
  termCount: number
): number {
  const repay = totalRepayCents(principalCents, interestRateBps);
  return roundUpToIncrement(repay / termCount, CUOTA_ROUNDING_CENTS);
}

/**
 * The final installment, which absorbs the remainder left by rounding every
 * earlier cuota up to `CUOTA_ROUNDING_CENTS`, so the schedule sums back to
 * `totalRepayCents` (see `loanViews.ts`). Never below zero — a small loan with
 * a coarse increment can "finish" before its nominal last installment. Equals
 * `cuotaCents` exactly when the rounded cuotas already divide the repay amount.
 */
export function lastCuotaCents(
  principalCents: number,
  interestRateBps: number,
  termCount: number
): number {
  const cuota = cuotaCents(principalCents, interestRateBps, termCount);
  const repay = totalRepayCents(principalCents, interestRateBps);
  return Math.max(0, repay - cuota * (termCount - 1));
}

export interface LoanCostSummary {
  principalCents: number;
  totalInterestCents: number;
  totalRepayCents: number;
  cuotaCents: number;
  /** Final installment; differs from `cuotaCents` when rounding leaves a remainder. */
  lastCuotaCents: number;
}

/** Total-cost-of-loan summary — what "Total a pagar" surfaces in the UI. */
export function loanCostSummary(loan: {
  principalCents: number;
  interestRateBps: number;
  termCount: number;
}): LoanCostSummary {
  return {
    principalCents: loan.principalCents,
    totalInterestCents: totalInterestCents(loan.principalCents, loan.interestRateBps),
    totalRepayCents: totalRepayCents(loan.principalCents, loan.interestRateBps),
    cuotaCents: cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount),
    lastCuotaCents: lastCuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount)
  };
}
