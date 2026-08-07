/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Collect an open-credit payment" — which cobrar
 * options are offered for a Crédito Abierto loan. States are produced by the
 * real cycle engine (`openCreditState`) rather than hand-built, so these stay
 * honest about how the two pieces fit together.
 *
 * Worked example: RD$10,000 capital @ 10% per cycle, mensual. Cycle 1 runs
 * Jun 16 -> Jul 16, cycle 2 Jul 16 -> Aug 16.
 */
import { openCreditState } from "../lib/loans/openCredit";
import { resolveOpenCreditPayOptions } from "../lib/payments/openCreditPayOptions";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const TODAY = new Date("2026-07-10T00:00:00");

function baseLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-oc-1",
    customerId: "customer-1",
    principalCents: 1000000, // RD$10,000
    interestRateBps: 1000, // 10% per cycle
    termCount: 0,
    frequency: "monthly",
    startDate: new Date("2026-06-16T00:00:00"),
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

function payment(amountCents: number, paidAt: Date): Payment {
  return {
    id: `p-${paidAt.getTime()}-${amountCents}`,
    loanId: "loan-oc-1",
    amountCents,
    paidAt,
    method: "cash",
    notes: null,
    createdAt: paidAt
  };
}

const resolve = (payments: Payment[], today = TODAY, loan = baseLoan()) =>
  resolveOpenCreditPayOptions(openCreditState(loan, payments, today));

describe("resolveOpenCreditPayOptions — interest not yet covered", () => {
  it("offers both interest options and locks Solo capital", () => {
    const view = resolve([]);
    expect(view.interestCovered).toBe(false);
    expect(view.interestEnabled).toBe(true);
    expect(view.interestCapitalEnabled).toBe(true);
    expect(view.capitalEnabled).toBe(false);
  });

  it("defaults to Solo interés", () => {
    expect(resolve([]).defaultOption).toBe("interest");
  });

  it("reports the cycle's full interest as collectible", () => {
    expect(resolve([]).dueInterestCents).toBe(100000); // RD$1,000
  });

  it("keeps Solo capital locked while the interest is only partly covered", () => {
    // RD$400 of the RD$1,000 due — a "capital" payment here would really pay
    // the RD$600 remainder first, so the option must stay shut.
    const view = resolve([payment(40000, new Date("2026-07-01T00:00:00"))]);
    expect(view.interestCovered).toBe(false);
    expect(view.capitalEnabled).toBe(false);
    expect(view.interestEnabled).toBe(true);
    expect(view.dueInterestCents).toBe(60000); // RD$600 remaining
  });
});

describe("resolveOpenCreditPayOptions — interest covered", () => {
  const covered = [payment(100000, new Date("2026-07-01T00:00:00"))];

  it("unlocks Solo capital and disables both interest options", () => {
    const view = resolve(covered);
    expect(view.interestCovered).toBe(true);
    expect(view.capitalEnabled).toBe(true);
    expect(view.interestEnabled).toBe(false);
    expect(view.interestCapitalEnabled).toBe(false);
  });

  it("never offers the following cycle's interest", () => {
    const state = openCreditState(baseLoan(), covered, TODAY);
    // The engine has already rolled forward to next cycle's RD$1,000...
    expect(state.interestDueCents).toBe(100000);
    // ...but the collect screen must show nothing collectible for this cycle.
    expect(resolveOpenCreditPayOptions(state).dueInterestCents).toBe(0);
  });

  it("defaults to Solo capital, the only thing left to collect", () => {
    expect(resolve(covered).defaultOption).toBe("capital");
  });

  it("counts interest covered by two smaller payments in the same cycle", () => {
    const view = resolve([
      payment(60000, new Date("2026-06-20T00:00:00")),
      payment(40000, new Date("2026-07-01T00:00:00"))
    ]);
    expect(view.interestCovered).toBe(true);
    expect(view.capitalEnabled).toBe(true);
  });

  it("counts interest covered by a payment made on the cycle's due date", () => {
    // Cycle 1 falls due Jul 16; a payment that day settles it, not cycle 2.
    const view = resolve(
      [payment(100000, new Date("2026-07-16T00:00:00"))],
      new Date("2026-07-16T00:00:00")
    );
    expect(view.interestCovered).toBe(true);
    expect(view.capitalEnabled).toBe(true);
  });

  it("stays covered once capital has also been paid down", () => {
    const view = resolve([
      payment(100000, new Date("2026-07-01T00:00:00")),
      payment(500000, new Date("2026-07-05T00:00:00"))
    ]);
    expect(view.interestCovered).toBe(true);
    expect(view.capitalEnabled).toBe(true);
    expect(view.dueInterestCents).toBe(0);
  });
});

describe("resolveOpenCreditPayOptions — cycle rollover", () => {
  it("re-arms the interest options once the next cycle opens", () => {
    // Interest covered in cycle 1, then we move into cycle 2 (Aug 1).
    const view = resolve(
      [payment(100000, new Date("2026-07-01T00:00:00"))],
      new Date("2026-08-01T00:00:00")
    );
    expect(view.interestCovered).toBe(false);
    expect(view.interestEnabled).toBe(true);
    expect(view.interestCapitalEnabled).toBe(true);
    expect(view.capitalEnabled).toBe(false);
    expect(view.defaultOption).toBe("interest");
  });
});

describe("resolveOpenCreditPayOptions — edge cases", () => {
  it("treats a zero-interest cycle as covered, leaving only capital", () => {
    const view = resolve([], TODAY, baseLoan({ interestRateBps: 0 }));
    expect(view.interestCovered).toBe(true);
    expect(view.dueInterestCents).toBe(0);
    expect(view.capitalEnabled).toBe(true);
    expect(view.interestEnabled).toBe(false);
    expect(view.defaultOption).toBe("capital");
  });

  it("offers nothing at all once the loan is closed", () => {
    // Interest plus the whole balance drives it to zero.
    const view = resolve([payment(1100000, new Date("2026-07-01T00:00:00"))]);
    expect(view.capitalEnabled).toBe(false);
    expect(view.interestEnabled).toBe(false);
    expect(view.interestCapitalEnabled).toBe(false);
    expect(view.dueInterestCents).toBe(0);
    expect(view.defaultOption).toBeNull();
  });

  it("leaves Solo capital locked before the loan's first cycle has started", () => {
    const view = resolve([], TODAY, baseLoan({ startDate: new Date("2026-09-01T00:00:00") }));
    expect(view.interestCovered).toBe(false);
    expect(view.capitalEnabled).toBe(false);
    expect(view.defaultOption).toBe("interest");
  });
});
