/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Crédito abierto (open credit): the pure cycle-replay engine. A term loan
 * has a fixed schedule of N equal cuotas; an open-credit loan instead runs
 * indefinitely on a capital balance that accrues PER-CYCLE interest
 * (`loan.interestRateBps` is the per-cycle rate here, not the whole-loan
 * flat rate it is for a term loan — see `lib/loans/loanMath.ts`). Each
 * cycle:
 *
 *   - Interest due = outstanding balance × per-cycle rate, rounded to the
 *     cent. The first interest is due one cycle after disbursement (cycle 1
 *     ends at `addFrequencyInterval(startDate, frequency, 1)`), mirroring a
 *     term loan's first cuota.
 *   - A payment recorded within the cycle's window covers interest first;
 *     any remainder pays down capital ("Interés + capital"). "Solo interés"
 *     is just a payment that happens to equal the interest due exactly.
 *   - A cycle that has ALREADY ENDED (its end date is on/before `today`)
 *     with interest not fully covered CAPITALIZES the shortfall: the unpaid
 *     interest is added to the balance, compounding it. This is open
 *     credit's only penalty — no mora ever applies (see the proposal's
 *     non-goals).
 *   - The CURRENT in-progress cycle (started but not yet ended as of
 *     `today`) is never capitalized — it only capitalizes once it closes,
 *     on a later call made with a later `today`.
 *   - The loan closes (`isClosed`) the moment a payment brings the balance
 *     to zero or below; no further cycles are replayed past that point.
 *
 * Nothing here is stored: balance and cycle history are derived fresh on
 * every call by replaying `payments` against the cycle timeline — the same
 * derive-don't-store philosophy as a term loan's schedule (see
 * `buildLoanDetailView` in `lib/loans/loanViews.ts`). No stored balance
 * column, no per-payment interest/capital split recorded anywhere; Pass 2's
 * detail/collect screens are expected to call `openCreditState` directly
 * (it's cheap and pure — safe to call on every render).
 */
import { addFrequencyInterval } from "./loanViews";
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";

/**
 * One cycle's outcome once it has been replayed against `today`:
 *  - "pending": the current in-progress cycle, not yet paid (or only
 *    partially paid) — interest is accruing but hasn't been capitalized.
 *  - "interest_only": exactly the interest was paid; balance unchanged.
 *  - "interest_plus_capital": interest plus some capital was paid; balance
 *    dropped, but not all the way to zero.
 *  - "paid": whatever was paid this cycle (interest, or interest + capital,
 *    in-progress or completed) brought the outstanding balance to zero —
 *    the loan closes on this cycle.
 *  - "skipped": the cycle ended with its interest not covered at all, or
 *    only partially — the shortfall was capitalized into the balance. (A
 *    partial-interest completed cycle is treated the same as a full skip:
 *    interest is either fully covered by the cycle's end, or it compounds.)
 */
export type OpenCreditCycleStatus =
  "pending" | "interest_only" | "interest_plus_capital" | "paid" | "skipped";

export interface OpenCreditCycle {
  /** 1-based cycle number — cycle 1 is the first interest period after disbursement. */
  index: number;
  /** Cycle window start (inclusive). */
  start: Date;
  /** Cycle window end (exclusive) — also the date interest for this cycle is due. */
  end: Date;
  /** Interest due for this cycle, computed on the balance as of the cycle's start. */
  interestDueCents: number;
  /** Everything recorded toward this cycle (payments with `paidAt` in `[start, end)`). */
  paidCents: number;
  /** The portion of `paidCents` beyond `interestDueCents` that paid down capital. */
  capitalPaidCents: number;
  status: OpenCreditCycleStatus;
}

export interface OpenCreditState {
  /** Outstanding capital balance after replaying every completed cycle (and the current one). */
  balanceCents: number;
  /** Interest due for the current (in-progress, or not-yet-started) cycle. Zero once closed. */
  interestDueCents: number;
  /** End of the current cycle — when `interestDueCents` is next due. */
  nextDueDate: Date;
  /** True once a payment has brought the balance to zero (or below). */
  isClosed: boolean;
  /**
   * Every cycle replayed so far, oldest first — empty only if `today`
   * precedes the loan's very first cycle (cycle 1 hasn't started yet).
   */
  cycles: OpenCreditCycle[];
}

/**
 * Replays an open-credit loan's cycle timeline against its payments, up to
 * and including the current in-progress cycle as of `today`.
 *
 * `payments` should already be filtered to this loan (same convention as
 * `buildLoanDetailView` in `loanViews.ts`) — every row is treated as an
 * ordinary payment, since open credit never records mora rows.
 */
export function openCreditState(
  loan: Loan,
  payments: Payment[],
  today: Date = new Date()
): OpenCreditState {
  const rate = loan.interestRateBps / 10000;
  let balance = loan.principalCents;
  const cycles: OpenCreditCycle[] = [];

  for (let index = 1; ; index++) {
    const start = addFrequencyInterval(loan.startDate, loan.frequency, index - 1);
    const end = addFrequencyInterval(loan.startDate, loan.frequency, index);
    // Cycle hasn't started yet — nothing more to replay.
    if (start.getTime() > today.getTime()) break;

    const isCompleted = end.getTime() <= today.getTime();

    const paidThisCycle = payments
      .filter((p) => p.paidAt.getTime() >= start.getTime() && p.paidAt.getTime() < end.getTime())
      .reduce((sum, p) => sum + p.amountCents, 0);

    const interestDue = Math.round(balance * rate);
    const interestPaid = Math.min(paidThisCycle, interestDue);
    // Interest is paid first; only the remainder (if any) pays down capital.
    const capitalPaid = Math.max(0, paidThisCycle - interestDue);
    balance = Math.max(0, balance - capitalPaid);

    let status: OpenCreditCycleStatus;
    if (isCompleted) {
      const interestShortfall = interestDue - interestPaid;
      if (paidThisCycle === 0) {
        status = "skipped";
      } else if (interestShortfall > 0) {
        status = "skipped";
      } else {
        status = capitalPaid > 0 ? "interest_plus_capital" : "interest_only";
      }
      // A completed cycle whose interest wasn't fully covered capitalizes
      // the shortfall — compounds into the balance. (capitalPaid is
      // necessarily 0 here: interestPaid can only fall short of
      // interestDue when paidThisCycle <= interestDue.)
      if (interestShortfall > 0) balance += interestShortfall;
    } else {
      // Current in-progress cycle: never capitalized, even if underpaid.
      status =
        paidThisCycle >= interestDue
          ? capitalPaid > 0
            ? "interest_plus_capital"
            : "interest_only"
          : "pending";
    }

    // Whatever the cycle's nominal status, a payment that zeroes the
    // balance closes the loan on this cycle.
    if (balance <= 0) status = "paid";

    cycles.push({
      index,
      start,
      end,
      interestDueCents: interestDue,
      paidCents: paidThisCycle,
      capitalPaidCents: capitalPaid,
      status
    });

    if (balance <= 0) break; // closed — no further cycles to replay
    if (!isCompleted) break; // this was the current in-progress cycle; stop here
  }

  const isClosed = balance <= 0;
  const lastCycle = cycles[cycles.length - 1] ?? null;

  let interestDueCents: number;
  let nextDueDate: Date;
  if (isClosed) {
    interestDueCents = 0;
    nextDueDate = lastCycle
      ? lastCycle.end
      : addFrequencyInterval(loan.startDate, loan.frequency, 1);
  } else if (lastCycle) {
    // The loop only ever stops on an incomplete cycle (besides closing), so
    // the last cycle recorded is always the current in-progress one.
    interestDueCents = lastCycle.interestDueCents;
    nextDueDate = lastCycle.end;
  } else {
    // `today` precedes the loan's first cycle — report cycle 1's
    // not-yet-started interest without adding a cycle to the history.
    interestDueCents = Math.round(balance * rate);
    nextDueDate = addFrequencyInterval(loan.startDate, loan.frequency, 1);
  }

  return { balanceCents: balance, interestDueCents, nextDueDate, isClosed, cycles };
}
