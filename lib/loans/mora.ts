/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Past-due (mora) fee accrual: one cuota's worth, daily-prorated over 30
 * calendar days, gated by a grace period, capped, and floored. Ported from
 * mikro's `@mikro/common/utils/lateFee.ts` `computeAccruedMora` — not
 * imported as a package, since that package bundles native Node deps
 * (sharp, pdfkit) unsafe under Hermes/Expo. Same porting pattern as
 * `lib/payments/paymentSplit.ts`. Formula and defaults (10%/30 días, no
 * grace, cap at 1 cuota, no floor) match mikro's `defaultLoansConfig`.
 */
import { MORA_NOTE, installmentDueDate, principalPaidCents } from "./loanViews";
import { cuotaCents as computeCuotaCents, totalRepayCents } from "./loanMath";
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MoraPolicy {
  /** Monthly rate applied to the overdue cuota (e.g. 0.1 = 10%/30 días). */
  rate: number;
  /** No mora if days late is at or below this. */
  graceDays: number;
  /** Cap accrued mora at this multiple of one cuota. */
  capInCuotas: number;
  /** Minimum mora in cents when mora is otherwise positive (0 = no floor). */
  minCents: number;
}

export const DEFAULT_MORA_POLICY: MoraPolicy = {
  rate: 0.1,
  graceDays: 0,
  capInCuotas: 1,
  minCents: 0
};

export interface AccruedMora {
  moraCents: number;
  moraDays: number;
}

/** rate × (daysLate / 30) × cuota, capped at capInCuotas × cuota, floored at minCents. */
export function computeAccruedMora(
  daysLate: number,
  cuotaCents: number,
  policy: MoraPolicy = DEFAULT_MORA_POLICY
): AccruedMora {
  if (daysLate <= 0 || cuotaCents <= 0 || policy.rate <= 0) {
    return { moraCents: 0, moraDays: 0 };
  }
  if (daysLate <= policy.graceDays) {
    return { moraCents: 0, moraDays: daysLate };
  }

  const rawMora = policy.rate * (daysLate / 30) * cuotaCents;
  const cap = policy.capInCuotas * cuotaCents;
  const capped = cap > 0 ? Math.min(rawMora, cap) : rawMora;

  let moraCents = Math.round(capped);
  if (policy.minCents > 0 && moraCents > 0 && moraCents < policy.minCents) {
    moraCents = policy.minCents;
  }

  return { moraCents, moraDays: daysLate };
}

/**
 * The oldest unpaid installment, if its due date has already passed.
 * Mirrors the "first unpaid cuota" walk in `buildLoanDetailView`'s
 * schedule (interest-inclusive cuota via `./loanMath`), kept separate
 * since mora needs it before the view is built.
 */
export function oldestOverdueInstallment(
  loan: Loan,
  payments: Payment[],
  today: Date = new Date()
): { dueDate: Date; amountCents: number } | null {
  const cuota = computeCuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  const repayCents = totalRepayCents(loan.principalCents, loan.interestRateBps);
  const paidCents = principalPaidCents(payments);
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  let cumulative = 0;
  for (let number = 1; number <= loan.termCount; number++) {
    const amountCents =
      number === loan.termCount ? Math.max(0, repayCents - cuota * (loan.termCount - 1)) : cuota;
    cumulative += amountCents;
    if (paidCents >= cumulative) continue;

    const dueDate = installmentDueDate(loan, number);
    return dueDate < startOfToday ? { dueDate, amountCents } : null;
  }
  return null;
}

/**
 * Accrued mora for a loan, net of any mora already collected (payments
 * flagged `MORA_NOTE`) on or after the oldest overdue due date — mirrors
 * mikro's collected-LATE_FEE netting in `computeAccruedMora`.
 */
export function computeLoanMora(
  loan: Loan,
  payments: Payment[],
  today: Date = new Date(),
  policy: MoraPolicy = DEFAULT_MORA_POLICY
): AccruedMora {
  const overdue = oldestOverdueInstallment(loan, payments, today);
  if (!overdue) return { moraCents: 0, moraDays: 0 };

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const daysLate = Math.floor((startOfToday.getTime() - overdue.dueDate.getTime()) / DAY_MS);

  const gross = computeAccruedMora(daysLate, overdue.amountCents, policy);
  if (gross.moraCents === 0) return gross;

  const collectedCents = payments
    .filter((p) => p.notes === MORA_NOTE && p.paidAt.getTime() >= overdue.dueDate.getTime())
    .reduce((sum, p) => sum + p.amountCents, 0);

  return { moraCents: Math.max(0, gross.moraCents - collectedCents), moraDays: gross.moraDays };
}
