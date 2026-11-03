/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Tradicional Plus: a term loan whose cycles are each covered by either its
 * cuota or a fixed penalty. A penalty never touches the balance; it moves
 * every remaining cuota one cycle later, with no limit. A cycle left unpaid
 * past its due date plus the grace period becomes one owed penalty. Some or
 * all owed penalties can be paid on their own; a cuota is accepted only with
 * every owed penalty paid first (in the same cobro or before it) and only on
 * or after its due date. No mora.
 *
 * Nothing about the moves is stored: they're counted from the `payments`
 * rows with `tipo: "penalidad"`, so a deleted row can't leave the schedule
 * out of step with the payments (see `lib/payments/paymentNotes.ts`). Kept free of `loanViews.ts` imports
 * (which imports this module) — the schedule only needs
 * `addFrequencyInterval`, since Tradicional Plus is quincenal-only and never
 * skips Sundays.
 */
import { addFrequencyInterval } from "./frequency";
import { cuotaCents, lastCuotaCents } from "./loanMath";
import { DEFAULT_GRACE_DAYS } from "./loan.schema";
import { isPenaltyPayment, isPrincipalPayment } from "../payments/paymentNotes";
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { ReceiptLine, TradicionalPlusView } from "../repo/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Chronological order; within one cobro (equal `paidAt`), penalty rows come
 * before cuota rows, so a cobro's result never depends on row order.
 */
export function chronologicalPayments(payments: Payment[]): Payment[] {
  return [...payments].sort(
    (a, b) =>
      a.paidAt.getTime() - b.paidAt.getTime() ||
      (isPenaltyPayment(b) ? 1 : 0) - (isPenaltyPayment(a) ? 1 : 0)
  );
}

/** Penalties paid so far — each one moved the schedule one cycle. */
export function penaltiesPaid(payments: Payment[]): number {
  return payments.filter(isPenaltyPayment).length;
}

/** Cycle `cycle`'s due date (1-based), counted from the loan's start. */
function cycleDueDate(loan: Loan, cycle: number): Date {
  return addFrequencyInterval(new Date(loan.startDate), loan.frequency, cycle);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The interest-inclusive amount of cuota `number` (the last absorbs rounding). */
function installmentAmount(loan: Loan, number: number): number {
  return number === loan.termCount
    ? lastCuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount)
    : cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
}

/**
 * Each cuota's due date as of now. A paid cuota keeps the date it had when it
 * was paid — its number plus the penalties paid before it — and every unpaid
 * one sits at its number plus every penalty paid so far.
 */
export function tradicionalPlusDueDates(loan: Loan, payments: Payment[]): Date[] {
  const chronological = chronologicalPayments(payments);
  const movesWhenPaid: number[] = [];
  let moves = 0;
  let principal = 0;
  let cumulative = 0;
  let number = 1;
  for (const payment of chronological) {
    if (isPenaltyPayment(payment)) {
      moves += 1;
      continue;
    }
    if (!isPrincipalPayment(payment)) continue;
    principal += payment.amountCents;
    while (number <= loan.termCount && principal >= cumulative + installmentAmount(loan, number)) {
      cumulative += installmentAmount(loan, number);
      movesWhenPaid[number] = moves;
      number += 1;
    }
  }
  const dates: Date[] = [];
  for (let n = 1; n <= loan.termCount; n++) {
    dates.push(cycleDueDate(loan, n + (movesWhenPaid[n] ?? moves)));
  }
  return dates;
}

export interface TradicionalPlusState {
  penaltyCents: number;
  graceDays: number;
  /** Penalties paid so far — how many times the schedule has moved. */
  timesMoved: number;
  /** Cuotas paid in full. */
  installmentsPaid: number;
  /** The next cuota to pay (1-based), or null once every cuota is paid. */
  nextCuotaNumber: number | null;
  nextCuotaCents: number;
  /** Due date of the next uncovered cycle, or null once paid off. */
  nextDueDate: Date | null;
  /** Last cuota's due date after every move so far. */
  endDate: Date | null;
  /** Cycles past due date + grace with nothing paid. */
  owedPenalties: number;
  owedCents: number;
  /** Days since the next uncovered cycle's due date (0 when not overdue). */
  daysLate: number;
  /** From the day after the next uncovered cycle's due date — like Tradicional's ATRASO. */
  isOverdue: boolean;
  paidOff: boolean;
  /** The next cuota's due date is today or past. */
  isDue: boolean;
  /** A cuota alone: no penalties owed and the cuota is due. */
  canCollectCuota: boolean;
  /** Owed penalties, or the next cycle is due (today or within grace). */
  canCollectPenalty: boolean;
  /** Most penalties one cobro can take: every owed one, else one. */
  maxPenaltyCount: number;
}

/** Where a Tradicional Plus loan stands on `today`, derived from its payments alone. */
export function tradicionalPlusState(
  loan: Loan,
  payments: Payment[],
  today: Date = new Date()
): TradicionalPlusState {
  const penaltyCents = loan.penaltyCents ?? 0;
  const graceDays = loan.graceDays ?? DEFAULT_GRACE_DAYS;
  const startOfToday = startOfDay(today);
  const timesMoved = penaltiesPaid(payments);
  const dueDates = tradicionalPlusDueDates(loan, payments);

  const principal = payments.filter(isPrincipalPayment).reduce((sum, p) => sum + p.amountCents, 0);
  let installmentsPaid = 0;
  let cumulative = 0;
  while (installmentsPaid < loan.termCount) {
    const next = cumulative + installmentAmount(loan, installmentsPaid + 1);
    if (principal < next) break;
    cumulative = next;
    installmentsPaid += 1;
  }

  const paidOff = installmentsPaid >= loan.termCount;
  const nextCuotaNumber = paidOff ? null : installmentsPaid + 1;
  const nextDueDate = nextCuotaNumber ? dueDates[nextCuotaNumber - 1]! : null;

  // Every cycle from the next uncovered one on, while its grace has run out.
  let owedPenalties = 0;
  if (nextCuotaNumber) {
    const firstCycle = nextCuotaNumber + timesMoved;
    for (let cycle = firstCycle; ; cycle++) {
      const graceEnd = new Date(cycleDueDate(loan, cycle).getTime() + graceDays * DAY_MS);
      if (startOfDay(graceEnd) >= startOfToday) break;
      owedPenalties += 1;
    }
  }

  const isOverdue = nextDueDate !== null && startOfDay(nextDueDate) < startOfToday;
  const daysLate = isOverdue
    ? Math.round((startOfToday.getTime() - startOfDay(nextDueDate!).getTime()) / DAY_MS)
    : 0;
  const isDue = nextDueDate !== null && startOfDay(nextDueDate) <= startOfToday;

  return {
    penaltyCents,
    graceDays,
    timesMoved,
    installmentsPaid,
    nextCuotaNumber,
    nextCuotaCents: nextCuotaNumber ? installmentAmount(loan, nextCuotaNumber) : 0,
    nextDueDate,
    endDate: dueDates.length > 0 ? dueDates[dueDates.length - 1]! : null,
    owedPenalties,
    owedCents: owedPenalties * penaltyCents,
    daysLate,
    isOverdue,
    paidOff,
    isDue,
    canCollectCuota: !paidOff && owedPenalties === 0 && isDue,
    canCollectPenalty: !paidOff && penaltyCents > 0 && (owedPenalties > 0 || isDue),
    maxPenaltyCount: owedPenalties > 0 ? owedPenalties : 1
  };
}

/** The screen-facing slice of `TradicionalPlusState`. */
export function tradicionalPlusView(state: TradicionalPlusState): TradicionalPlusView {
  return {
    penaltyCents: state.penaltyCents,
    graceDays: state.graceDays,
    timesMoved: state.timesMoved,
    owedPenalties: state.owedPenalties,
    owedCents: state.owedCents,
    nextCuotaCents: state.nextCuotaCents,
    nextCuotaNumber: state.nextCuotaNumber,
    nextDueDate: state.nextDueDate,
    canCollectCuota: state.canCollectCuota,
    canCollectPenalty: state.canCollectPenalty,
    maxPenaltyCount: state.maxPenaltyCount
  };
}

/** "Penalidad" for one, "Penalidades (2)" for several — shared by receipts and history. */
export function penaltyLabel(count: number): string {
  return count === 1 ? "Penalidad" : `Penalidades (${count})`;
}

export interface TradicionalPlusReceipt {
  /** One "Penalidad · Cuota N pasa al <fecha>" line, or null when the cobro paid no penalty. */
  penaltyLine: ReceiptLine | null;
  /** The loan's end date right after this cobro. */
  endDate: Date | null;
}

/**
 * The penalty line and end date for the cobro that wrote `cobroPayments`
 * (rows sharing one `paidAt`), as the loan stood right after it — so a
 * reprint months later still reads the date the cobro moved the cuota to.
 * The line reads the schedule after the cobro's penalties but before its
 * cuota, so "Penalidades + cuota" prints the cuota it then paid.
 */
export function tradicionalPlusReceipt(
  loan: Loan,
  loanPayments: Payment[],
  cobroPayments: Payment[],
  formatDate: (date: Date) => string
): TradicionalPlusReceipt {
  const paidAt = cobroPayments[0]?.paidAt ?? new Date();
  const asOfCobro = loanPayments.filter((p) => p.paidAt.getTime() <= paidAt.getTime());
  const state = tradicionalPlusState(loan, asOfCobro, paidAt);
  const penalties = cobroPayments.filter(isPenaltyPayment);
  if (penalties.length === 0) return { penaltyLine: null, endDate: state.endDate };

  const cobroIds = new Set(cobroPayments.map((p) => p.id));
  const afterPenalties = tradicionalPlusState(
    loan,
    asOfCobro.filter((p) => !cobroIds.has(p.id) || isPenaltyPayment(p)),
    paidAt
  );
  const moved =
    afterPenalties.nextCuotaNumber && afterPenalties.nextDueDate
      ? ` · Cuota ${afterPenalties.nextCuotaNumber} pasa al ${formatDate(afterPenalties.nextDueDate)}`
      : "";
  return {
    penaltyLine: {
      label: `${penaltyLabel(penalties.length)}${moved}`,
      amountCents: penalties.reduce((sum, p) => sum + p.amountCents, 0)
    },
    endDate: state.endDate
  };
}
