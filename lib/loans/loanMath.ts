/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Flat add-on interest: the loan accrues one interest amount over its
 * whole term (not per period, not declining balance) — `principal × rate`,
 * folded into an equal cuota across every installment, rounded to the
 * nearest whole peso. Ported from mikro's
 * `@mikro/common/utils/calculateLoan.ts` (`calculateLoanOptions`'s
 * per-option core: `totalInterest`/`totalRepay`/`paymentPerPeriod`) — not
 * imported as a package for the same reason `lib/payments/paymentSplit.ts`
 * and `lib/loans/mora.ts` aren't: that package assumes a Node runtime
 * unsafe under Hermes/Expo. Same porting pattern; this module only needs
 * the single-option core, not mikro's options-generator loop.
 */

/** One peso in cents — cuotas round to the nearest whole peso, never a fractional amount. */
export const PESO_CENTS = 100;

function roundToNearestPeso(valueCents: number): number {
  return Math.round(valueCents / PESO_CENTS) * PESO_CENTS;
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
 * Equal cuota across the term, rounded to the nearest whole peso. This is
 * the amount for every installment except the last, which absorbs
 * whatever few-peso remainder that rounding leaves behind (see
 * `loanViews.ts` / `mora.ts`).
 */
export function cuotaCents(
  principalCents: number,
  interestRateBps: number,
  termCount: number
): number {
  const repay = totalRepayCents(principalCents, interestRateBps);
  return roundToNearestPeso(repay / termCount);
}

/**
 * The final installment, which absorbs the remainder left by rounding
 * every earlier cuota to the nearest whole peso, so the schedule sums back
 * to `totalRepayCents` exactly (see `loanViews.ts`). Never below zero — in
 * principle a short-term loan could "finish" before its nominal last
 * installment if the earlier cuotas round up past the full repay amount.
 * Equals `cuotaCents` exactly when the rounded cuota already divides the
 * repay amount evenly.
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
