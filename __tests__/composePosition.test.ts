/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: owner-position — "Capital lent and amount to collect", "Amount at
 * risk from late loans", "To collect by loan type", "This month's outlook".
 */
import { composePosition } from "../lib/reports/composePosition";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const TODAY = new Date(2026, 9, 20, 12); // 20 Oct 2026

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-1",
    customerId: "customer-1",
    principalCents: 1000000, // RD$10,000
    interestRateBps: 2000, // 20% flat
    termCount: 4, // cuota RD$3,000
    frequency: "monthly",
    startDate: new Date(2026, 7, 20),
    status: "active",
    notes: null,
    graceDays: 0,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: null,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...overrides
  };
}

function payment(
  loanId: string,
  amountCents: number,
  paidAt: Date,
  notes: string | null = null
): Payment {
  return {
    id: `p-${loanId}-${paidAt.getTime()}-${amountCents}`,
    loanId,
    amountCents,
    paidAt,
    method: "cash",
    notes,
    createdAt: paidAt
  };
}

describe("composePosition", () => {
  it("sums lent, to collect and collected across a term and an open-credit loan", () => {
    const position = composePosition({
      today: TODAY,
      loans: [
        loan({ id: "a" }),
        loan({
          id: "oc",
          principalCents: 500000,
          interestRateBps: 1000,
          termCount: 0,
          startDate: new Date(2026, 8, 25),
          loanType: "open_credit"
        })
      ],
      payments: [
        payment("a", 300000, new Date(2026, 8, 21)),
        payment("a", 300000, new Date(2026, 9, 5))
      ]
    });

    expect(position.lentCents).toBe(1500000);
    expect(position.receivableCents).toBe(600000 + 500000);
    expect(position.collectedTotalCents).toBe(600000);
    expect(position.byType.term).toEqual({ loanCount: 1, outstandingCents: 600000 });
    expect(position.byType.openCredit).toEqual({ loanCount: 1, outstandingCents: 500000 });
    expect(
      position.byType.term.outstandingCents + position.byType.openCredit.outstandingCents
    ).toBe(position.receivableCents);
  });

  it("counts a loan with an overdue cuota as late, with its share of what is to collect", () => {
    const position = composePosition({
      today: TODAY,
      loans: [
        loan({ id: "on-time", startDate: new Date(2026, 8, 20) }),
        loan({ id: "late", startDate: new Date(2026, 6, 20) })
      ],
      payments: [payment("on-time", 300000, new Date(2026, 9, 1))]
    });

    // on-time: 1,200,000 - 300,000 = 900,000; late: nothing paid = 1,200,000
    expect(position.receivableCents).toBe(2100000);
    expect(position.overdue).toEqual({ cents: 1200000, loanCount: 1, percent: 57 });
  });

  it("counts a crédito abierto with unpaid cycles added to its balance as late", () => {
    const position = composePosition({
      today: TODAY,
      loans: [
        loan({
          id: "oc",
          principalCents: 1000000,
          interestRateBps: 1000,
          termCount: 0,
          startDate: new Date(2026, 6, 15),
          loanType: "open_credit"
        })
      ],
      payments: []
    });

    expect(position.overdue.loanCount).toBe(1);
    expect(position.overdue.cents).toBe(position.receivableCents);
    expect(position.overdue.percent).toBe(100);
  });

  it("reports this month's collected, still due and best-case total", () => {
    const position = composePosition({
      today: TODAY,
      loans: [
        loan({ id: "paid-up" }),
        loan({ id: "late", startDate: new Date(2026, 6, 20) }),
        loan({
          id: "oc",
          principalCents: 500000,
          interestRateBps: 1000,
          termCount: 0,
          startDate: new Date(2026, 8, 25),
          loanType: "open_credit"
        })
      ],
      payments: [
        payment("paid-up", 300000, new Date(2026, 8, 21)),
        payment("paid-up", 300000, new Date(2026, 9, 5))
      ]
    });

    // paid-up: due by month end 600,000 - paid 600,000 = 0
    // late: cuotas due 20 Aug, 20 Sep, 20 Oct = 900,000, nothing paid
    // oc: next interest due 25 Oct = 50,000
    expect(position.month.collectedCents).toBe(300000);
    expect(position.month.remainingCents).toBe(950000);
    expect(position.month.expectedCents).toBe(1250000);
    expect(position.month.progress).toBeCloseTo(0.24);
  });

  it("leaves archived and fully paid loans out of every figure", () => {
    const position = composePosition({
      today: TODAY,
      loans: [loan({ id: "archived", status: "cancelled" }), loan({ id: "settled" })],
      payments: [payment("settled", 1200000, new Date(2026, 8, 1))]
    });

    expect(position.lentCents).toBe(0);
    expect(position.receivableCents).toBe(0);
    expect(position.collectedTotalCents).toBe(0);
    expect(position.byType.term.loanCount).toBe(0);
  });

  it("is all zeros with no loans, with a 0% late share", () => {
    const position = composePosition({ today: TODAY, loans: [], payments: [] });

    expect(position.receivableCents).toBe(0);
    expect(position.overdue).toEqual({ cents: 0, loanCount: 0, percent: 0 });
    expect(position.month).toEqual({
      collectedCents: 0,
      remainingCents: 0,
      expectedCents: 0,
      progress: 0
    });
  });

  it("counts mora payments as collected without changing what is to collect", () => {
    const position = composePosition({
      today: TODAY,
      loans: [loan({ id: "a", startDate: new Date(2026, 8, 20) })],
      payments: [payment("a", 20000, new Date(2026, 9, 10), "mora")]
    });

    expect(position.collectedTotalCents).toBe(20000);
    expect(position.receivableCents).toBe(1200000);
  });
});
