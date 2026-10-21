/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure builder for the Mi posición report: every figure is a sum over the
 * active loans that still owe something, computed with the same loan math
 * the detail screens use (`loanViews.ts` for term loans, `openCredit.ts`
 * for crédito abierto) so the report never disagrees with a loan's own
 * screen. Mora is not projected; the month outlook is the best case if
 * every installment due by month end is paid.
 */
import { buildLoanDetailView } from "../loans/loanViews";
import { effectiveLoanType } from "../loans/loan.schema";
import { openCreditState } from "../loans/openCredit";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { OwnerPosition } from "./position.schema";

export interface ComposePositionInput {
  loans: Loan[];
  payments: Payment[];
  today?: Date;
}

interface LoanFigures {
  lentCents: number;
  receivableCents: number;
  isLate: boolean;
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
      lentCents: state.principalBalanceCents,
      receivableCents: state.balanceCents,
      isLate: state.capitalizedInterestCents > 0,
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

  let dueThroughMonthEnd = 0;
  for (const item of view.schedule) {
    if (item.dueDate.getTime() <= monthEnd.getTime()) dueThroughMonthEnd += item.amountCents;
  }
  return {
    lentCents: loan.principalCents,
    receivableCents: view.balanceCents,
    isLate: view.schedule.some((item) => item.status === "overdue"),
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
    lentCents: 0,
    receivableCents: 0,
    collectedTotalCents: 0,
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

    position.lentCents += figures.lentCents;
    position.receivableCents += figures.receivableCents;
    position.month.remainingCents += figures.dueByMonthEndCents;

    const bucket = figures.isOpenCredit ? position.byType.openCredit : position.byType.term;
    bucket.loanCount += 1;
    bucket.outstandingCents += figures.receivableCents;

    if (figures.isLate) {
      position.overdue.cents += figures.receivableCents;
      position.overdue.loanCount += 1;
    }

    for (const payment of loanPayments) {
      position.collectedTotalCents += payment.amountCents;
      if (
        payment.paidAt.getTime() >= monthStart &&
        payment.paidAt.getTime() <= monthEnd.getTime()
      ) {
        position.month.collectedCents += payment.amountCents;
      }
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
