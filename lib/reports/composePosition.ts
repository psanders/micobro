/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure builder for the Mi cartera report: every figure is a sum over the
 * active loans that still owe something, computed with the same loan math
 * the detail screens use (`loanViews.ts` for term loans, `openCredit.ts`
 * for crédito abierto) so the report never disagrees with a loan's own
 * screen. Contract: openspec/changes/cartera-cobrado-split (month breakdown) and openspec/specs/owner-position/spec.md.
 *
 * - Each loan's balance is split into capital and interest that add up to
 *   it exactly: a term loan's interest is its flat share of the balance
 *   (balance × total interest / total repay, rounded to the peso); a
 *   crédito abierto's is its intereses sumados. Interest not yet charged
 *   (the next open-credit cycle) is not counted.
 * - Past due is term cuotas due before today (the loan screen's ATRASO
 *   rule; grace days only delay mora), net of what was paid toward cuotas,
 *   or a crédito abierto's intereses sumados, or a Tradicional Plus loan's
 *   owed penalties (see `plusFigures`). A loan is late iff that is above
 *   zero.
 * - Cobrado este mes is every payment dated this month, whatever its
 *   loan's state now. Mora is not projected; the month outlook is the
 *   best case if every installment due by month end is paid.
 */
import { cuotaCents, lastCuotaCents, totalInterestCents, totalRepayCents } from "../loans/loanMath";
import { tradicionalPlusDueDates, tradicionalPlusState } from "../loans/tradicionalPlus";
import { buildLoanDetailView, principalPaidCents } from "../loans/loanViews";
import { effectiveLoanType } from "../loans/loan.schema";
import { openCreditPaymentSplit, openCreditState } from "../loans/openCredit";
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
  const plus =
    effectiveLoanType(loan) === "term_plus"
      ? plusFigures(loan, loanPayments, today, monthEnd)
      : null;
  return {
    capitalCents: view.balanceCents - interestCents,
    receivableCents: view.balanceCents,
    interestCents,
    // Mora rows never pay cuotas.
    pastDueCents:
      plus?.pastDueCents ?? Math.max(0, dueBeforeTodayCents - principalPaidCents(loanPayments)),
    dueByMonthEndCents:
      plus?.dueByMonthEndCents ?? Math.max(0, dueThroughMonthEnd - view.paidCents),
    isOpenCredit: false
  };
}

/**
 * Tradicional Plus: what's late is the owed penalties (paying them moves the
 * missed cuotas forward rather than collecting them), or, with none owed yet,
 * the cuota past its date within grace — like Tradicional's ATRASO. The month
 * outlook assumes the owed penalties get paid: those, plus every unpaid cuota
 * that still falls by month end once the plan has moved for them.
 */
function plusFigures(
  loan: Loan,
  loanPayments: Payment[],
  today: Date,
  monthEnd: Date
): Pick<LoanFigures, "pastDueCents" | "dueByMonthEndCents"> {
  const state = tradicionalPlusState(loan, loanPayments, today);
  const pastDueCents =
    state.owedPenalties > 0 ? state.owedCents : state.isOverdue ? state.nextCuotaCents : 0;

  const owedPaid: Payment[] = Array.from({ length: state.owedPenalties }, (_, i) => ({
    id: `owed-penalty-${i}`,
    loanId: loan.id,
    amountCents: state.penaltyCents,
    paidAt: today,
    method: null,
    notes: null,
    tipo: "penalidad",
    createdAt: today
  }));
  const dueDates = tradicionalPlusDueDates(loan, [...loanPayments, ...owedPaid]);
  let cuotasByMonthEnd = 0;
  for (let number = state.installmentsPaid + 1; number <= loan.termCount; number++) {
    if (dueDates[number - 1]!.getTime() > monthEnd.getTime()) break;
    cuotasByMonthEnd +=
      number === loan.termCount
        ? lastCuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount)
        : cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  }
  return { pastDueCents, dueByMonthEndCents: state.owedCents + cuotasByMonthEnd };
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
    month: {
      collectedCents: 0,
      capitalCollectedCents: 0,
      interestCollectedCents: 0,
      moraCollectedCents: 0,
      remainingCents: 0,
      expectedCents: 0,
      progress: 0
    }
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
  const thisMonth = payments.filter((payment) => {
    const paidAt = payment.paidAt.getTime();
    return paidAt >= monthStart && paidAt <= monthEnd.getTime();
  });
  for (const payment of thisMonth) position.month.collectedCents += payment.amountCents;
  splitCollected(position.month, thisMonth, loans, paymentsByLoan);

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

/**
 * Splits this month's payments into capital, interest and mora that add up
 * to `collectedCents`. Mora and penalidad rows are mora; a term cuota takes
 * its loan's flat interest share (per loan, rounded to the peso); a crédito
 * abierto cobro is split like its receipt; a cuota whose loan is gone is
 * capital.
 */
function splitCollected(
  month: OwnerPosition["month"],
  thisMonth: Payment[],
  loans: Loan[],
  paymentsByLoan: Map<string, Payment[]>
): void {
  const loanById = new Map(loans.map((loan) => [loan.id, loan]));
  const termCuotasByLoan = new Map<string, number>();
  const splitCobros = new Set<string>();

  for (const payment of thisMonth) {
    if (payment.tipo === "mora" || payment.tipo === "penalidad") {
      month.moraCollectedCents += payment.amountCents;
      continue;
    }
    const loan = loanById.get(payment.loanId);
    if (!loan) {
      month.capitalCollectedCents += payment.amountCents;
      continue;
    }
    if (effectiveLoanType(loan) === "open_credit") {
      const cobro = `${loan.id}@${payment.paidAt.getTime()}`;
      if (splitCobros.has(cobro)) continue;
      splitCobros.add(cobro);
      const split = openCreditPaymentSplit(loan, paymentsByLoan.get(loan.id) ?? [], payment.id);
      if (!split) continue;
      const interest = split.interestCents + split.capitalizedCents;
      month.interestCollectedCents += interest;
      month.capitalCollectedCents += split.amountCents - interest;
      continue;
    }
    termCuotasByLoan.set(loan.id, (termCuotasByLoan.get(loan.id) ?? 0) + payment.amountCents);
  }

  for (const [loanId, cuotasCents] of termCuotasByLoan) {
    const loan = loanById.get(loanId)!;
    const repay = totalRepayCents(loan.principalCents, loan.interestRateBps);
    const interest = totalInterestCents(loan.principalCents, loan.interestRateBps);
    const interestCents = repay > 0 ? roundToPeso((cuotasCents * interest) / repay) : 0;
    month.interestCollectedCents += interestCents;
    month.capitalCollectedCents += cuotasCents - interestCents;
  }
}
