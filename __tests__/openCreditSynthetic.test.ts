/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Synthetic checks of the crédito abierto (compuesto) interest engine
 * (lib/loans/openCredit.ts) against expectations computed independently:
 *
 *  1. Closed-form formulas for the clean cases (every cycle skipped,
 *     interest-only, fixed abonos).
 *  2. A deliberately simple reference model that works on whole-day
 *     offsets instead of Dates, run over seeded random payment histories.
 *  3. Invariants that must hold for any history: capital + intereses
 *     sumados = balance, capital never above the principal and never going
 *     up, and every peso paid accounted for.
 */
import { openCreditState } from "../lib/loans/openCredit";
import { addFrequencyInterval } from "../lib/loans/loanViews";
import { roundToPeso } from "../lib/utils/money";
import type { Loan, LoanFrequency } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const START = new Date("2026-01-05T00:00:00");
const DAY_MS = 24 * 60 * 60 * 1000;

function makeLoan(
  principalCents: number,
  rateBps: number,
  frequency: LoanFrequency,
  graceDays: number | null = 0
): Loan {
  return {
    id: "loan-syn",
    customerId: "c",
    principalCents,
    interestRateBps: rateBps,
    termCount: 0,
    frequency,
    startDate: START,
    status: "active",
    notes: null,
    graceDays,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: "open_credit",
    createdAt: START,
    updatedAt: START
  };
}

/** Midday on the given day, so time-of-day never decides which cycle a payment lands in. */
function atDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function payment(id: string, paidAt: Date, amountCents: number): Payment {
  return {
    id,
    loanId: "loan-syn",
    amountCents,
    paidAt,
    method: "cash",
    notes: null,
    createdAt: paidAt
  };
}

/** Due date of cycle `k` (1-based), from the same calendar stepping the app uses. */
const due = (loan: Loan, k: number) => addFrequencyInterval(loan.startDate, loan.frequency, k);
/** The day after cycle `k` is due — cycle `k` has ended and capitalized by then. */
const dayAfterDue = (loan: Loan, k: number) => atDay(new Date(due(loan, k).getTime() + DAY_MS));

describe("closed-form expectations", () => {
  const rates = [500, 1000, 1500, 2000];
  const frequencies: LoanFrequency[] = ["daily", "weekly", "biweekly", "monthly"];

  it.each(frequencies.flatMap((f) => rates.map((r) => [f, r] as const)))(
    "%s @ %d bps — every cycle skipped compounds as P·(1+r)^n",
    (frequency, rateBps) => {
      const loan = makeLoan(1000000, rateBps, frequency);
      let expected = 1000000;
      for (let n = 1; n <= 12; n++) {
        expected += roundToPeso(expected * (rateBps / 10000));
        const state = openCreditState(loan, [], dayAfterDue(loan, n));
        expect(state.balanceCents).toBe(expected);
        expect(state.principalBalanceCents).toBe(1000000);
        expect(state.capitalizedInterestCents).toBe(expected - 1000000);
        expect(state.interestDueCents).toBe(roundToPeso(expected * (rateBps / 10000)));
      }
    }
  );

  it.each(frequencies)("%s — paying exactly the interest keeps the interest flat at P·r", (f) => {
    const loan = makeLoan(1000000, 1000, f);
    const payments = Array.from({ length: 12 }, (_, i) =>
      payment(`p${i + 1}`, atDay(due(loan, i + 1)), 100000)
    );
    for (let n = 1; n <= 12; n++) {
      const state = openCreditState(loan, payments.slice(0, n), dayAfterDue(loan, n));
      expect(state.balanceCents).toBe(1000000);
      expect(state.capitalizedInterestCents).toBe(0);
      expect(state.interestDueCents).toBe(100000);
      expect(state.cycles.slice(0, n).every((c) => c.status === "interest_only")).toBe(true);
    }
  });

  it("interest + a fixed RD$1,000 abono lowers capital by 1,000 and interest by 10% of that", () => {
    const loan = makeLoan(1000000, 1000, "monthly");
    let capital = 1000000;
    const payments: Payment[] = [];
    for (let n = 1; n <= 9; n++) {
      payments.push(payment(`p${n}`, atDay(due(loan, n)), roundToPeso(capital * 0.1) + 100000));
      capital -= 100000;
      const state = openCreditState(loan, payments, dayAfterDue(loan, n));
      expect(state.principalBalanceCents).toBe(capital);
      expect(state.interestDueCents).toBe(roundToPeso(capital * 0.1));
    }
  });

  it("the L-47621 shape: RD$10,000 @ 10% mensual, no payments → 1,000 · 1,100 · 1,210 · 1,331", () => {
    const loan = makeLoan(1000000, 1000, "monthly");
    const interests = [1, 2, 3, 4].map(
      (n) => openCreditState(loan, [], atDay(due(loan, n))).interestDueCents
    );
    expect(interests).toEqual([100000, 110000, 121000, 133100]);
  });
});

/** Seeded PRNG (mulberry32) — the same "random" histories on every run. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DayPayment {
  day: number;
  amountCents: number;
}

/**
 * Reference model, written from the rules rather than from the engine:
 * cycles are whole-day windows (prevDue, due], cycle 1 also owning day 0;
 * interest = roundToPeso(balance × rate) at the cycle's start; money covers that
 * interest first and any surplus lowers the balance (intereses sumados
 * first); a cycle that has ENDED short capitalizes the shortfall; the
 * current cycle never does; the loan closes at zero.
 */
function referenceModel(
  principal: number,
  rateBps: number,
  dueDays: number[],
  payments: DayPayment[],
  today: number,
  grace = 0
) {
  let balance = principal;
  let sumados = 0;
  let prevGraceEnd = -1;
  for (let k = 0; k < dueDays.length; k++) {
    const startDay = k === 0 ? 0 : dueDays[k - 1]!;
    if (startDay > today) break;
    // A cycle runs until its due date + grace; payments in that span count for it.
    const dueDay = dueDays[k]! + grace;
    const paid = payments
      .filter((p) => (k === 0 ? p.day >= 0 : p.day > prevGraceEnd) && p.day <= dueDay)
      .reduce((s, p) => s + p.amountCents, 0);
    prevGraceEnd = dueDay;
    const interest = roundToPeso(balance * (rateBps / 10000));
    const surplus = Math.max(0, paid - interest);
    balance = Math.max(0, balance - surplus);
    sumados = Math.max(0, sumados - surplus);
    const ended = dueDay < today;
    if (ended && paid < interest) {
      balance += interest - paid;
      sumados += interest - paid;
    }
    if (balance <= 0) return { balance: 0, sumados: 0, closed: true };
    if (!ended) break;
  }
  return { balance, sumados: Math.min(sumados, balance), closed: false };
}

describe("random payment histories vs the reference model", () => {
  const SCENARIOS = 2000;
  const frequencies: LoanFrequency[] = ["daily", "weekly", "biweekly", "monthly"];

  it(`agrees on balance and intereses sumados for ${SCENARIOS} seeded scenarios`, () => {
    const mismatches: string[] = [];
    for (let seed = 1; seed <= SCENARIOS; seed++) {
      const r = rng(seed);
      const frequency = frequencies[Math.floor(r() * frequencies.length)]!;
      const principal = (1 + Math.floor(r() * 50)) * 100000; // RD$1,000 – RD$50,000
      const rateBps = [300, 500, 800, 1000, 1500, 2000][Math.floor(r() * 6)]!;
      const grace = Math.floor(r() * 6); // 0–5 grace days
      const loan = makeLoan(principal, rateBps, frequency, grace);
      const cycles = 3 + Math.floor(r() * 10);
      // Enough due dates to cover "today", which can land a few days past
      // the last cycle with payments (several daily cycles end in that gap).
      const dueDays = Array.from({ length: cycles + 10 }, (_, i) =>
        Math.round((atDay(due(loan, i + 1)).getTime() - atDay(START).getTime()) / DAY_MS)
      );

      // Per cycle: skip, partial interest, exact interest, interest + abono,
      // a big overpayment, or two payments (one on the due date itself).
      const dayPayments: DayPayment[] = [];
      for (let k = 0; k < cycles; k++) {
        const prev = k === 0 ? 0 : dueDays[k - 1]! + 1;
        // Anywhere from the cycle's start to a few days past its due date,
        // so payments land inside and outside the grace period.
        const day = prev + Math.floor(r() * Math.max(1, dueDays[k]! + 5 - prev + 1));
        const roughInterest = Math.round(principal * (rateBps / 10000));
        const kind = r();
        if (kind < 0.2) continue;
        if (kind < 0.35) dayPayments.push({ day, amountCents: Math.round(roughInterest * r()) });
        else if (kind < 0.6) dayPayments.push({ day, amountCents: roughInterest * 2 });
        else if (kind < 0.85)
          dayPayments.push({ day, amountCents: roughInterest + Math.round(principal * 0.1 * r()) });
        else if (kind < 0.92) dayPayments.push({ day, amountCents: principal * 3 });
        else {
          dayPayments.push({ day, amountCents: Math.round(roughInterest / 2) });
          dayPayments.push({ day: dueDays[k]!, amountCents: Math.round(roughInterest / 2) });
        }
      }
      const today = dueDays[cycles - 1]! + 1 + Math.floor(r() * 3);

      const payments = dayPayments.map((p, i) =>
        payment(`p${i}`, new Date(atDay(START).getTime() + p.day * DAY_MS), p.amountCents)
      );
      const todayDate = new Date(atDay(START).getTime() + today * DAY_MS);
      const engine = openCreditState(loan, payments, todayDate);
      const ref = referenceModel(principal, rateBps, dueDays, dayPayments, today, grace);

      if (
        engine.balanceCents !== ref.balance ||
        engine.capitalizedInterestCents !== ref.sumados ||
        engine.isClosed !== ref.closed
      ) {
        mismatches.push(
          `seed ${seed} ${frequency} grace=${grace} P=${principal} r=${rateBps}: engine ${engine.balanceCents}/${engine.capitalizedInterestCents} vs ref ${ref.balance}/${ref.sumados}`
        );
      }

      // Invariants, whatever the history.
      expect(engine.principalBalanceCents + engine.capitalizedInterestCents).toBe(
        engine.balanceCents
      );
      expect(engine.principalBalanceCents).toBeLessThanOrEqual(principal);
      let lastPrincipal = principal;
      for (let n = 1; n <= cycles; n++) {
        const step = openCreditState(
          loan,
          payments,
          new Date(atDay(START).getTime() + (dueDays[n - 1]! + 1) * DAY_MS)
        );
        expect(step.principalBalanceCents).toBeLessThanOrEqual(lastPrincipal);
        lastPrincipal = step.principalBalanceCents;
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("grace days", () => {
  const sat = new Date("2026-12-05T00:00:00"); // a Saturday due date
  const monthlyDueOnSat = (graceDays: number | null) => ({
    ...makeLoan(1000000, 1000, "monthly", graceDays),
    startDate: new Date("2026-11-05T00:00:00")
  });
  const plusDays = (d: Date, n: number) => atDay(new Date(d.getTime() + n * DAY_MS));

  it("a payment on Monday after a Saturday due date is on time with 3 grace days", () => {
    const loan = monthlyDueOnSat(3);
    const state = openCreditState(
      loan,
      [payment("p1", plusDays(sat, 2), 100000)],
      plusDays(sat, 10)
    );

    expect(state.cycles[0]).toMatchObject({ status: "interest_only", capitalizedCents: 0 });
    expect(state.capitalizedInterestCents).toBe(0);
    expect(state.interestDueCents).toBe(100000);
  });

  it("without grace the same Monday payment is late: the interest was already added", () => {
    const loan = monthlyDueOnSat(0);
    const state = openCreditState(
      loan,
      [payment("p1", plusDays(sat, 2), 100000)],
      plusDays(sat, 10)
    );

    // The Monday payment lands in cycle 2 (interest RD$1,100) instead, so
    // the RD$1,000 stays added to the balance.
    expect(state.cycles[0]).toMatchObject({ status: "skipped", capitalizedCents: 100000 });
    expect(state.capitalizedInterestCents).toBe(100000);
    expect(state.balanceCents).toBe(1100000);
  });

  it("nothing is added during grace; it is added the day after the last grace day", () => {
    const loan = monthlyDueOnSat(3);

    expect(openCreditState(loan, [], plusDays(sat, 3)).capitalizedInterestCents).toBe(0);
    expect(openCreditState(loan, [], plusDays(sat, 3)).interestDueCents).toBe(100000);
    expect(openCreditState(loan, [], plusDays(sat, 4)).capitalizedInterestCents).toBe(100000);
    expect(openCreditState(loan, [], plusDays(sat, 4)).interestDueCents).toBe(110000);
  });

  it("reports the last grace day next to the due date", () => {
    const state = openCreditState(monthlyDueOnSat(3), [], plusDays(sat, -3));

    expect(state.nextDueDate.getDate()).toBe(5);
    expect(state.nextGraceEndDate.getDate()).toBe(8);
  });

  it("loans with no stored value (created before grace existed) get 5 days", () => {
    const loan = monthlyDueOnSat(null);

    expect(openCreditState(loan, [], plusDays(sat, 5)).capitalizedInterestCents).toBe(0);
    expect(openCreditState(loan, [], plusDays(sat, 6)).capitalizedInterestCents).toBe(100000);
  });
});

describe("para ponerse al día", () => {
  it("is the current cycle's unpaid interest plus the intereses sumados", () => {
    const loan = makeLoan(1000000, 1000, "monthly");
    const state = openCreditState(loan, [], dayAfterDue(loan, 2));

    expect(state.capitalizedInterestCents).toBe(210000);
    expect(state.interestDueCents).toBe(121000);
    expect(state.catchUpCents).toBe(331000);
  });

  it("paying it leaves the loan current: nothing added, next interest on capital", () => {
    const loan = makeLoan(1000000, 1000, "monthly");
    const catchUp = payment("p1", atDay(due(loan, 3)), 331000);
    const state = openCreditState(loan, [catchUp], atDay(due(loan, 3)));

    expect(state.capitalizedInterestCents).toBe(0);
    expect(state.principalBalanceCents).toBe(1000000);
    expect(state.catchUpCents).toBe(0);
    expect(state.interestDueCents).toBe(100000);
  });

  it("equals just the interest when nothing was ever added", () => {
    const loan = makeLoan(1000000, 1000, "monthly");
    const state = openCreditState(loan, [], atDay(due(loan, 1)));

    expect(state.catchUpCents).toBe(100000);
  });
});
