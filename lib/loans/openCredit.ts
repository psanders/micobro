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
 *   - A cycle that has ALREADY ENDED with interest not fully covered
 *     CAPITALIZES the shortfall: the unpaid interest is added to the
 *     balance, compounding it. This is open credit's only penalty — no mora
 *     ever applies (see the proposal's non-goals).
 *   - The CURRENT in-progress cycle (started but not yet ended as of
 *     `today`) is never capitalized — it only capitalizes once it closes,
 *     on a later call made with a later `today`.
 *   - The loan closes (`isClosed`) the moment a payment brings the balance
 *     to zero or below; no further cycles are replayed past that point.
 *
 * Cycle windows are compared by CALENDAR DAY, not by instant. A cycle's end
 * is the day its interest falls due, and the client has all of that day to
 * pay: the cycle only counts as ended once that day is behind `today`, and
 * a payment recorded ON the due date pays that cycle rather than the next
 * one. Comparing raw timestamps instead would capitalize a cycle at 00:00
 * of its own due date — a client paying on time every cycle would still
 * watch their balance compound, and the loan would never surface on the
 * day's route. This matches how a term loan treats due dates everywhere
 * else (`dueDate < startOfToday` in `loanViews.ts` / `composeRouteDay.ts`).
 *
 * Grace days (`openCreditGraceDays`): a cycle doesn't end on its due date
 * but `graceDays` calendar days later. Until then its interest is still
 * collectible as on time, a payment made in those days counts toward it,
 * and nothing is capitalized. The next cycle's window starts after the
 * grace ends, so every payment belongs to exactly one cycle.
 *
 * Presentation split (display only — totals are unaffected): the balance
 * is always reported as `principalBalanceCents` (capital lent minus capital
 * paid down; it can only go down) plus `capitalizedInterestCents` ("intereses
 * sumados": capitalized shortfalls not yet paid off). Money beyond a cycle's
 * interest pays the intereses sumados first, then capital — so a customer
 * catching up on a missed cycle sees that interest cleared, rather than
 * being told they paid "capital" on a balance that looked like it grew.
 *
 * Nothing here is stored: balance and cycle history are derived fresh on
 * every call by replaying `payments` against the cycle timeline — the same
 * derive-don't-store philosophy as a term loan's schedule (see
 * `buildLoanDetailView` in `lib/loans/loanViews.ts`). No stored balance
 * column, no per-payment interest/capital split recorded anywhere; Pass 2's
 * detail/collect screens are expected to call `openCreditState` directly
 * (it's cheap and pure — safe to call on every render).
 */
import { addFrequencyInterval } from "./frequency";

/**
 * Grace days for a crédito abierto loan with no stored value (`null`).
 * Loans created before grace existed get this (and the form pre-fills it); new loans store 0 when the
 * lender leaves the switch off. Separate from Tradicional's mora grace
 * (`DEFAULT_GRACE_DAYS`, 7), which the same column carries for term loans.
 */
export const OPEN_CREDIT_DEFAULT_GRACE_DAYS = 5;

export function openCreditGraceDays(loan: Loan): number {
  return loan.graceDays ?? OPEN_CREDIT_DEFAULT_GRACE_DAYS;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
  /** Cycle window start. */
  start: Date;
  /** The date interest for this cycle is due — payments made on this day still count toward it. */
  end: Date;
  /** Last day of the grace period (`end` when the loan has no grace) — the cycle ends after it. */
  graceEnd: Date;
  /** Interest due for this cycle, computed on the balance as of the cycle's start. */
  interestDueCents: number;
  /** Everything recorded toward this cycle (payments with `paidAt` in `[start, end)`). */
  paidCents: number;
  /** The portion of `paidCents` beyond `interestDueCents` that paid down the balance. */
  capitalPaidCents: number;
  /** Of `capitalPaidCents`, what cleared intereses sumados (paid before capital). */
  capitalizedPaidCents: number;
  /** Of `capitalPaidCents`, what paid down the capital lent. */
  principalPaidCents: number;
  /** Unpaid interest this cycle added to the balance once it ended ("se sumó al saldo"). */
  capitalizedCents: number;
  status: OpenCreditCycleStatus;
}

export interface OpenCreditState {
  /** Outstanding balance after replaying every completed cycle (and the current one). */
  balanceCents: number;
  /** Capital lent minus capital paid down — never above the principal. */
  principalBalanceCents: number;
  /** Capitalized interest not yet paid off ("intereses sumados"). principal + this = balance. */
  capitalizedInterestCents: number;
  /**
   * Interest the next payment will cost — "Interés del próximo pago" in the UI.
   * This is the current cycle's interest minus whatever it has already
   * received, so a partial payment leaves only the remainder; once the
   * cycle's interest is fully covered it becomes the FOLLOWING cycle's
   * interest, charged on the balance the payment left behind (which is what
   * makes a capital paydown lower the interest right away instead of after
   * the cycle rolls over). Zero once closed.
   */
  interestDueCents: number;
  /** The date `interestDueCents` is due — the end of whichever cycle it belongs to. */
  nextDueDate: Date;
  /** Last day `interestDueCents` can be paid before it is added to the balance. */
  nextGraceEndDate: Date;
  /**
   * What to pay to be fully current right now ("Para ponerse al día"): the
   * current cycle's unpaid interest plus all intereses sumados. Zero once
   * closed; equals `interestDueCents` when nothing was ever added.
   */
  catchUpCents: number;
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
  const graceDays = openCreditGraceDays(loan);
  const todayDay = startOfDay(today).getTime();
  let balance = loan.principalCents;
  let capitalized = 0;
  const cycles: OpenCreditCycle[] = [];

  for (let index = 1; ; index++) {
    const start = addFrequencyInterval(loan.startDate, loan.frequency, index - 1);
    const end = addFrequencyInterval(loan.startDate, loan.frequency, index);
    const graceEnd = addDays(startOfDay(end), graceDays);
    const startDay = startOfDay(start).getTime();
    // Payments after the previous cycle's grace belong to this one.
    const windowStartDay = index === 1 ? startDay : addDays(startOfDay(start), graceDays).getTime();
    const graceEndDay = graceEnd.getTime();
    // Cycle hasn't started yet — nothing more to replay.
    if (startDay > todayDay) break;

    // Over only once the last grace day itself has passed (the due date
    // when there is no grace) — see the day-boundary note at the top.
    const isCompleted = graceEndDay < todayDay;

    const paidThisCycle = payments
      .filter((p) => {
        const day = startOfDay(p.paidAt).getTime();
        // A cycle owns the days after the previous cycle's grace through the
        // end of its own grace, inclusive. Cycle 1 also owns the disbursement
        // day itself, so a same-day payment lands somewhere.
        return (index === 1 ? day >= windowStartDay : day > windowStartDay) && day <= graceEndDay;
      })
      .reduce((sum, p) => sum + p.amountCents, 0);

    const interestDue = Math.round(balance * rate);
    const interestPaid = Math.min(paidThisCycle, interestDue);
    // Interest is paid first; only the remainder (if any) pays down capital.
    const capitalPaid = Math.max(0, paidThisCycle - interestDue);
    balance = Math.max(0, balance - capitalPaid);
    const capitalizedPaid = Math.min(capitalized, capitalPaid);
    capitalized -= capitalizedPaid;
    const principalPaid = capitalPaid - capitalizedPaid;
    let capitalizedThisCycle = 0;

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
      if (interestShortfall > 0) {
        balance += interestShortfall;
        capitalized += interestShortfall;
        capitalizedThisCycle = interestShortfall;
      }
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
      graceEnd,
      interestDueCents: interestDue,
      paidCents: paidThisCycle,
      capitalPaidCents: capitalPaid,
      capitalizedPaidCents: capitalizedPaid,
      principalPaidCents: principalPaid,
      capitalizedCents: capitalizedThisCycle,
      status
    });

    if (balance <= 0) break; // closed — no further cycles to replay
    if (!isCompleted) break; // this was the current in-progress cycle; stop here
  }

  const isClosed = balance <= 0;
  const lastCycle = cycles[cycles.length - 1] ?? null;

  let interestDueCents: number;
  let nextDueDate: Date;
  // What's still unpaid on the current cycle — 0 once covered, even though
  // interestDueCents then rolls forward to the following cycle.
  let currentCycleOutstanding = 0;
  if (isClosed) {
    interestDueCents = 0;
    nextDueDate = lastCycle
      ? lastCycle.end
      : addFrequencyInterval(loan.startDate, loan.frequency, 1);
  } else if (lastCycle) {
    // The loop only ever stops on an incomplete cycle (besides closing), so
    // the last cycle recorded is always the current in-progress one. What's
    // owed next is whatever interest that cycle hasn't received yet — and
    // once it has been covered in full, the next cycle's interest on the
    // post-payment balance, so a capital paydown shows up as a lower
    // interest immediately rather than only after the cycle rolls over.
    const outstanding = lastCycle.interestDueCents - lastCycle.paidCents;
    if (outstanding > 0) {
      interestDueCents = outstanding;
      currentCycleOutstanding = outstanding;
      nextDueDate = lastCycle.end;
    } else {
      interestDueCents = Math.round(balance * rate);
      nextDueDate = addFrequencyInterval(loan.startDate, loan.frequency, lastCycle.index + 1);
    }
  } else {
    // `today` precedes the loan's first cycle — report cycle 1's
    // not-yet-started interest without adding a cycle to the history.
    interestDueCents = Math.round(balance * rate);
    nextDueDate = addFrequencyInterval(loan.startDate, loan.frequency, 1);
  }

  // An overpayment clamps the balance at zero; keep the split consistent.
  capitalized = Math.min(capitalized, balance);
  return {
    balanceCents: balance,
    nextGraceEndDate: addDays(startOfDay(nextDueDate), graceDays),
    catchUpCents: isClosed ? 0 : capitalized + currentCycleOutstanding,
    principalBalanceCents: balance - capitalized,
    capitalizedInterestCents: capitalized,
    interestDueCents,
    nextDueDate,
    isClosed,
    cycles
  };
}

/** One crédito abierto payment broken down for its receipt. */
export interface OpenCreditReceiptBreakdown {
  /** "Interés · ciclo N" / "Intereses sumados" / "Abono a capital" — zero parts omitted. */
  lines: { label: string; amountCents: number }[];
  /** "Después de este pago": the split balance and the next interest, as of this payment. */
  balanceAfter: { label: string; amountCents: number }[];
}

/**
 * How one payment was applied, derived by replaying the loan just before
 * and just after it at the moment it was made — the same engine every
 * screen uses, so the receipt printed at the cobro and one rebuilt later
 * from history always agree. `formatDueDate` labels the next interest's
 * due date (kept out of here so this module stays free of UI formatting).
 */
export function openCreditReceiptBreakdown(
  loan: Loan,
  payments: Payment[],
  paymentId: string,
  formatDueDate: (date: Date) => string
): OpenCreditReceiptBreakdown | null {
  const target = payments.find((p) => p.id === paymentId && p.loanId === loan.id);
  if (!target) return null;
  const loanPayments = payments.filter((p) => p.loanId === loan.id);
  // Payments made at the exact same instant are one cobro.
  const atOrBefore = loanPayments.filter((p) => p.paidAt.getTime() <= target.paidAt.getTime());
  const before = loanPayments.filter((p) => p.paidAt.getTime() < target.paidAt.getTime());
  const amountCents = atOrBefore
    .filter((p) => p.paidAt.getTime() === target.paidAt.getTime())
    .reduce((sum, p) => sum + p.amountCents, 0);

  const prior = openCreditState(loan, before, target.paidAt);
  const after = openCreditState(loan, atOrBefore, target.paidAt);
  const capitalizedPart = prior.capitalizedInterestCents - after.capitalizedInterestCents;
  const principalPart = prior.principalBalanceCents - after.principalBalanceCents;
  const interestPart = Math.max(0, amountCents - capitalizedPart - principalPart);
  const cycleIndex = after.cycles[after.cycles.length - 1]?.index ?? 1;

  const lines = [
    { label: `Interés · ciclo ${cycleIndex}`, amountCents: interestPart },
    { label: "Intereses sumados", amountCents: capitalizedPart },
    { label: "Abono a capital", amountCents: principalPart }
  ].filter((line) => line.amountCents > 0);

  const balanceAfter = after.isClosed
    ? [{ label: "Capital pendiente", amountCents: 0 }]
    : [
        { label: "Capital pendiente", amountCents: after.principalBalanceCents },
        { label: "Intereses sumados", amountCents: after.capitalizedInterestCents },
        {
          // Short enough that the amount fits on a 32-column thermal line.
          label: `Próx. interés ${formatDueDate(after.nextDueDate)}`,
          amountCents: after.interestDueCents
        }
      ];

  return { lines, balanceAfter };
}
