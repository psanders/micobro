/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure builder for the Mi cartera report: every figure is a sum over the
 * active loans that still owe something, computed with the same loan math
 * the detail screens use (`loanViews.ts` for term loans, `openCredit.ts`
 * for crédito abierto) so the report never disagrees with a loan's own
 * screen. Contract: openspec/changes/cartera-figures-fix/design.md.
 *
 * - Each loan's balance is split into capital and interest that add up to
 *   it exactly: a term loan's interest is its flat share of the balance
 *   (balance × total interest / total repay, rounded to the peso); a
 *   crédito abierto's is its intereses sumados. Interest not yet charged
 *   (the next open-credit cycle) is not counted.
 * - Past due is term cuotas due before today (the loan screen's ATRASO
 *   rule; grace days only delay mora), net of what was paid toward cuotas,
 *   or a crédito abierto's intereses sumados. A loan is late iff that is
 *   above zero.
 * - Cobrado este mes is every payment dated this month, whatever its
 *   loan's state now. Mora is not projected; the month outlook is the
 *   best case if every installment due by month end is paid.
 */
import { totalInterestCents, totalRepayCents } from "../loans/loanMath";
import { buildLoanDetailView, principalPaidCents } from "../loans/loanViews";
import { effectiveLoanType } from "../loans/loan.schema";
import { openCreditState } from "../loans/openCredit";
import { roundToPeso } from "../utils/money";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { OwnerPosition } from "./position.schema";

export interface ComposePositionInput {
  loans: Loan[];
  payments: Payment[];
  today?: Date;
}

interface LoanFigures {
  capitalCents: number;
  receivableCents: number;
  /** Interest inside `receivableCents`; capital + interest = receivable. */
  interestCents: number;
  /** Past due (no grace), net of payments; the loan is late iff > 0. */
  pastDueCents: number;
  /** Still due by month end, net of payments (never negative). */
  dueByMonthEndCents: number;
  isOpenCredit: boolean;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function figuresFor(
  loan: Loan,
  loanPayments: Payment[],
  today: Date,
  monthEnd: Date
): LoanFigures | null {
  if (effectiveLoanType(loan) === "open_credit") {
    const state = openCreditState(loan, loanPayments, today);
    if (state.isClosed || state.balanceCents <= 0) return null;
    return {
      capitalCents: state.principalBalanceCents,
      receivableCents: state.balanceCents,
      // The next cycle's `interestDueCents` isn't in the balance yet.
      interestCents: state.capitalizedInterestCents,
      // Open credit only capitalizes after its own grace.
      pastDueCents: state.capitalizedInterestCents,
      dueByMonthEndCents:
        state.nextDueDate.getTime() <= monthEnd.getTime() ? state.catchUpCents : 0,
      isOpenCredit: true
    };
  }

  const view = buildLoanDetailView({
    loan,
    customerName: "",
    business: null,
    payments: loanPayments,
    today
  });
  if (view.balanceCents <= 0) return null;

  // Flat add-on interest: every peso repaid carries the same interest share.
  const repay = totalRepayCents(loan.principalCents, loan.interestRateBps);
  const interest = totalInterestCents(loan.principalCents, loan.interestRateBps);
  const interestCents = repay > 0 ? roundToPeso((view.balanceCents * interest) / repay) : 0;

  // Same cutoff as the schedule's `overdue` status: due before today.
  const startOfToday = startOfDay(today).getTime();
  let dueThroughMonthEnd = 0;
  let dueBeforeTodayCents = 0;
  for (const item of view.schedule) {
    if (item.dueDate.getTime() <= monthEnd.getTime()) dueThroughMonthEnd += item.amountCents;
    if (item.dueDate.getTime() < startOfToday) dueBeforeTodayCents += item.amountCents;
  }
  return {
    capitalCents: view.balanceCents - interestCents,
    receivableCents: view.balanceCents,
    interestCents,
    // Mora rows never pay cuotas.
    pastDueCents: Math.max(0, dueBeforeTodayCents - principalPaidCents(loanPayments)),
    dueByMonthEndCents: Math.max(0, dueThroughMonthEnd - view.paidCents),
    isOpenCredit: false
  };
}

export function composePosition({
  loans,
  payments,
  today = new Date()
}: ComposePositionInput): OwnerPosition {
  const monthStart = startOfMonth(today).getTime();
  const monthEnd = endOfMonth(today);

  const paymentsByLoan = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = paymentsByLoan.get(payment.loanId);
    if (list) list.push(payment);
    else paymentsByLoan.set(payment.loanId, [payment]);
  }

  const position: OwnerPosition = {
    capitalCents: 0,
    receivableCents: 0,
    interestCents: 0,
    overdue: { cents: 0, loanCount: 0, percent: 0 },
    byType: {
      term: { loanCount: 0, outstandingCents: 0 },
      openCredit: { loanCount: 0, outstandingCents: 0 }
    },
    month: { collectedCents: 0, remainingCents: 0, expectedCents: 0, progress: 0 }
  };

  for (const loan of loans) {
    if (loan.status !== "active") continue;
    const loanPayments = paymentsByLoan.get(loan.id) ?? [];
    const figures = figuresFor(loan, loanPayments, today, monthEnd);
    if (!figures) continue;

    position.capitalCents += figures.capitalCents;
    position.receivableCents += figures.receivableCents;
    position.interestCents += figures.interestCents;
    position.month.remainingCents += figures.dueByMonthEndCents;

    const bucket = figures.isOpenCredit ? position.byType.openCredit : position.byType.term;
    bucket.loanCount += 1;
    bucket.outstandingCents += figures.receivableCents;

    if (figures.pastDueCents > 0) {
      position.overdue.cents += figures.pastDueCents;
      position.overdue.loanCount += 1;
    }
  }

  // Every payment this month counts, mora included, whatever its loan's
  // state now (settled, archived, or not in `loans` at all).
  for (const payment of payments) {
    const paidAt = payment.paidAt.getTime();
    if (paidAt >= monthStart && paidAt <= monthEnd.getTime()) {
      position.month.collectedCents += payment.amountCents;
    }
  }

  position.overdue.percent =
    position.receivableCents > 0
      ? Math.round((position.overdue.cents / position.receivableCents) * 100)
      : 0;
  position.month.expectedCents = position.month.collectedCents + position.month.remainingCents;
  position.month.progress =
    position.month.expectedCents > 0
      ? position.month.collectedCents / position.month.expectedCents
      : 0;

  return position;
}
