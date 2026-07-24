/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: loan-detail "Open-credit loan detail" + collect-payment "Collect an
 * open-credit payment" — the cycle-replay engine (lib/loans/openCredit.ts).
 * Worked example throughout: RD$10,000 capital @ 5% per cycle (500 bps),
 * semanal (weekly).
 */
import { openCreditState } from "../lib/loans/openCredit";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// A fixed "today" so every test is deterministic regardless of when it runs.
const TODAY = new Date("2026-07-16T00:00:00");

function baseLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-oc-1",
    customerId: "customer-1",
    principalCents: 1000000, // RD$10,000
    interestRateBps: 500, // 5% per cycle
    termCount: 0, // unused for open credit
    frequency: "weekly",
    startDate: new Date(TODAY.getTime() - 4 * WEEK_MS), // 4 weeks before today
    status: "active",
    notes: null,
    graceDays: null,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: "open_credit",
    createdAt: TODAY,
    updatedAt: TODAY,
    ...overrides
  };
}

function payment(amountCents: number, paidAt: Date, overrides: Partial<Payment> = {}): Payment {
  return {
    id: `p-${paidAt.getTime()}-${amountCents}`,
    loanId: "loan-oc-1",
    amountCents,
    paidAt,
    method: "cash",
    notes: null,
    createdAt: paidAt,
    ...overrides
  };
}

describe("openCreditState — first interest timing", () => {
  it("is due one cycle after disbursement, with cycle 1 pending before the loan has any payments", () => {
    // A loan disbursed today: cycle 1 hasn't ended yet, so it's the current
    // in-progress cycle — interest is accruing but not yet due.
    const loan = baseLoan({ startDate: TODAY });

    const state = openCreditState(loan, [], TODAY);

    expect(state.balanceCents).toBe(1000000);
    expect(state.interestDueCents).toBe(50000); // RD$500 = 5% of RD$10,000
    expect(state.nextDueDate.getTime()).toBe(TODAY.getTime() + WEEK_MS);
    expect(state.isClosed).toBe(false);
    expect(state.cycles).toHaveLength(1);
    expect(state.cycles[0]).toMatchObject({ index: 1, status: "pending", interestDueCents: 50000 });
  });

  it("reports cycle 1 as the current cycle exactly at its start date", () => {
    const loan = baseLoan({ startDate: TODAY });
    const state = openCreditState(loan, [], TODAY);
    expect(state.cycles[0]!.start.getTime()).toBe(TODAY.getTime());
    expect(state.cycles[0]!.end.getTime()).toBe(TODAY.getTime() + WEEK_MS);
  });
});

describe("openCreditState — interest-only cycles hold the balance", () => {
  it("keeps the balance at RD$10,000 after a completed interest-only cycle, with next interest RD$500", () => {
    // startDate 1 week before today: cycle 1 is completed (ends today),
    // paid exactly the RD$500 interest due.
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - WEEK_MS) });
    const payments = [payment(50000, new Date(TODAY.getTime() - WEEK_MS + DAY_MS))];

    const state = openCreditState(loan, payments, TODAY);

    expect(state.balanceCents).toBe(1000000);
    expect(state.interestDueCents).toBe(50000);
    expect(state.isClosed).toBe(false);
    expect(state.cycles).toHaveLength(2); // cycle 1 (completed) + cycle 2 (current)
    expect(state.cycles[0]).toMatchObject({
      index: 1,
      status: "interest_only",
      interestDueCents: 50000,
      paidCents: 50000,
      capitalPaidCents: 0
    });
    expect(state.cycles[1]).toMatchObject({ index: 2, status: "pending", interestDueCents: 50000 });
  });

  it("holds the balance across two interest-only cycles (loan-detail spec scenario)", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - 2 * WEEK_MS) });
    const payments = [
      payment(50000, new Date(TODAY.getTime() - 2 * WEEK_MS + DAY_MS)),
      payment(50000, new Date(TODAY.getTime() - WEEK_MS + DAY_MS))
    ];

    const state = openCreditState(loan, payments, TODAY);

    expect(state.balanceCents).toBe(1000000);
    expect(state.interestDueCents).toBe(50000);
    const completed = state.cycles.filter((c) => c.status !== "pending");
    expect(completed).toHaveLength(2);
    expect(completed.every((c) => c.status === "interest_only")).toBe(true);
  });
});

describe("openCreditState — interest + capital lowers the balance and next interest", () => {
  it("RD$500 interest + RD$2,000 capital drops the balance to RD$8,000 and next interest to RD$400", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - WEEK_MS) });
    const payments = [payment(250000, new Date(TODAY.getTime() - WEEK_MS + DAY_MS))]; // 500 + 2000

    const state = openCreditState(loan, payments, TODAY);

    expect(state.balanceCents).toBe(800000); // RD$8,000
    expect(state.interestDueCents).toBe(40000); // RD$400 = 5% of RD$8,000
    expect(state.isClosed).toBe(false);
    expect(state.cycles[0]).toMatchObject({
      index: 1,
      status: "interest_plus_capital",
      interestDueCents: 50000,
      paidCents: 250000,
      capitalPaidCents: 200000
    });
  });
});

describe("openCreditState — a skipped cycle capitalizes its interest", () => {
  it("adds the unpaid RD$500 interest to the balance (RD$10,500) with no mora", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - WEEK_MS) });

    const state = openCreditState(loan, [], TODAY);

    expect(state.balanceCents).toBe(1050000); // RD$10,500
    expect(state.interestDueCents).toBe(52500); // RD$525 = 5% of RD$10,500
    expect(state.isClosed).toBe(false);
    expect(state.cycles[0]).toMatchObject({
      index: 1,
      status: "skipped",
      interestDueCents: 50000,
      paidCents: 0,
      capitalPaidCents: 0
    });
  });

  it("capitalizes a partially-paid cycle the same as a full skip", () => {
    // Paid RD$200 of the RD$500 due — still short, still capitalizes.
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - WEEK_MS) });
    const payments = [payment(20000, new Date(TODAY.getTime() - WEEK_MS + DAY_MS))];

    const state = openCreditState(loan, payments, TODAY);

    expect(state.cycles[0]).toMatchObject({
      status: "skipped",
      paidCents: 20000,
      capitalPaidCents: 0
    });
    expect(state.balanceCents).toBe(1030000); // 1,000,000 + (50,000 - 20,000)
  });

  it("never capitalizes the current in-progress cycle even if underpaid so far", () => {
    // startDate today: cycle 1 is current, not completed — no capitalization
    // regardless of how little (or nothing) has been paid toward it yet.
    const loan = baseLoan({ startDate: TODAY });

    const state = openCreditState(loan, [], TODAY);

    expect(state.balanceCents).toBe(1000000); // unchanged
    expect(state.cycles[0]).toMatchObject({ status: "pending" });
  });
});

describe("openCreditState — closes on zero balance", () => {
  it("sets isClosed true when interest + full remaining capital is paid off", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - WEEK_MS) });
    // 500 interest + 10,000 capital = the full balance.
    const payments = [payment(1050000, new Date(TODAY.getTime() - WEEK_MS + DAY_MS))];

    const state = openCreditState(loan, payments, TODAY);

    expect(state.balanceCents).toBe(0);
    expect(state.isClosed).toBe(true);
    expect(state.interestDueCents).toBe(0);
    expect(state.cycles[0]).toMatchObject({ status: "paid", capitalPaidCents: 1000000 });
    // No further cycles are replayed once the loan closes.
    expect(state.cycles).toHaveLength(1);
  });

  it("stops replaying cycles once closed, even if more time has passed", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - 3 * WEEK_MS) });
    const payments = [payment(1050000, new Date(TODAY.getTime() - 3 * WEEK_MS + DAY_MS))];

    const state = openCreditState(loan, payments, TODAY);

    expect(state.isClosed).toBe(true);
    expect(state.cycles).toHaveLength(1);
  });

  it("closes on an overpayment (balance driven below zero, not just to it)", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - WEEK_MS) });
    const payments = [payment(1100000, new Date(TODAY.getTime() - WEEK_MS + DAY_MS))]; // overpay by 500

    const state = openCreditState(loan, payments, TODAY);

    expect(state.balanceCents).toBe(0); // floored, never negative
    expect(state.isClosed).toBe(true);
  });
});

describe("openCreditState — compounding across multiple skipped cycles", () => {
  it("capitalizes interest cycle over cycle when nothing is ever paid", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - 2 * WEEK_MS) });

    const state = openCreditState(loan, [], TODAY);

    // Cycle 1: 10,000 * 5% = 500 unpaid -> balance 10,500.
    // Cycle 2: 10,500 * 5% = 525 unpaid -> balance 11,025.
    // Cycle 3 (current, as of `today`): 11,025 * 5% = 551.25 -> 55,125 due,
    // not yet capitalized (it's still in progress).
    expect(state.cycles).toHaveLength(3);
    expect(state.cycles[0]).toMatchObject({ status: "skipped", interestDueCents: 50000 });
    expect(state.cycles[1]).toMatchObject({ status: "skipped", interestDueCents: 52500 });
    expect(state.cycles[2]).toMatchObject({ status: "pending", interestDueCents: 55125 });
    expect(state.balanceCents).toBe(1102500);
    expect(state.interestDueCents).toBe(55125);
    expect(state.isClosed).toBe(false);
  });
});

describe("openCreditState — payments outside the loan's cycle windows", () => {
  it("only counts a payment toward the cycle whose window it falls in", () => {
    const loan = baseLoan({ startDate: new Date(TODAY.getTime() - 2 * WEEK_MS) });
    // Cycle 1 is skipped (no payment) and capitalizes 500, bringing the
    // balance to 10,500 — so cycle 2's interest due is 525 (5% of 10,500).
    // Only cycle 2 gets paid, exactly that amount.
    const payments = [payment(52500, new Date(TODAY.getTime() - WEEK_MS + DAY_MS))];

    const state = openCreditState(loan, payments, TODAY);

    expect(state.cycles[0]).toMatchObject({
      status: "skipped",
      paidCents: 0,
      interestDueCents: 50000
    });
    expect(state.cycles[1]).toMatchObject({
      status: "interest_only",
      paidCents: 52500,
      interestDueCents: 52500
    });
  });
});
