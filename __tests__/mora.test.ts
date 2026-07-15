/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Golden values mirror mikro's mods/apiserver/test/utils/lateFee.test.ts
 * (same formula, ported to cents) — see lib/loans/mora.ts for why this is
 * ported rather than imported from @mikro/common.
 */
import {
  computeAccruedMora,
  oldestOverdueInstallment,
  computeLoanMora,
  DEFAULT_MORA_POLICY
} from "../lib/loans/mora";
import { MORA_NOTE } from "../lib/loans/loanViews";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

/** Midnight-aligned so day-boundary math in computeLoanMora is deterministic. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const baseLoan: Loan = {
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 120000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: daysAgo(28),
  status: "active",
  notes: null,
  createdAt: daysAgo(28),
  updatedAt: daysAgo(28)
};

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "p1",
    loanId: "loan-1",
    amountCents: 0,
    paidAt: new Date(),
    method: "cash",
    notes: null,
    createdAt: new Date(),
    ...overrides
  };
}

describe("computeAccruedMora", () => {
  it("returns zero when not yet late", () => {
    // Act
    const r = computeAccruedMora(0, 65000);

    // Assert
    expect(r).toEqual({ moraCents: 0, moraDays: 0 });
  });

  it("matches the rate × (daysLate / 30) × cuota formula", () => {
    // Act
    const r = computeAccruedMora(9, 65000, DEFAULT_MORA_POLICY);

    // Assert — 0.1 * (9/30) * 65000 = 1950
    expect(r).toEqual({ moraCents: 1950, moraDays: 9 });
  });

  it("applies the grace period", () => {
    // Act
    const r = computeAccruedMora(3, 65000, { ...DEFAULT_MORA_POLICY, graceDays: 5 });

    // Assert
    expect(r.moraCents).toBe(0);
    expect(r.moraDays).toBe(3);
  });

  it("caps mora at capInCuotas × cuota", () => {
    // Act
    const r = computeAccruedMora(100, 65000, {
      ...DEFAULT_MORA_POLICY,
      rate: 10,
      capInCuotas: 0.5
    });

    // Assert
    expect(r.moraCents).toBe(32500);
  });

  it("enforces the minCents floor", () => {
    // Act
    const r = computeAccruedMora(2, 65000, { ...DEFAULT_MORA_POLICY, minCents: 50000 });

    // Assert
    expect(r.moraCents).toBe(50000);
  });

  it("returns zero when the rate is zero", () => {
    // Act
    const r = computeAccruedMora(30, 65000, { ...DEFAULT_MORA_POLICY, rate: 0 });

    // Assert
    expect(r.moraCents).toBe(0);
  });

  it("returns zero when the cuota is zero", () => {
    // Act
    const r = computeAccruedMora(30, 0);

    // Assert
    expect(r.moraCents).toBe(0);
  });
});

describe("oldestOverdueInstallment", () => {
  it("returns the first unpaid cuota once its due date has passed", () => {
    // Act — weekly ×12, cuota1 due 21 days ago, still unpaid
    const result = oldestOverdueInstallment(baseLoan, []);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(10000);
  });

  it("skips paid cuotas and returns the next overdue one", () => {
    // Arrange — cuota1 (RD$100) paid off
    const payments = [payment({ amountCents: 10000, paidAt: daysAgo(25) })];

    // Act
    const result = oldestOverdueInstallment(baseLoan, payments);

    // Assert — cuota2 was due 14 days ago
    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(10000);
    expect(result?.dueDate.getTime()).toBeGreaterThan(daysAgo(28).getTime());
  });

  it("returns null when nothing is overdue yet", () => {
    // Arrange — loan started 3 days ago, first cuota not due for 4 more days
    const freshLoan: Loan = { ...baseLoan, startDate: daysAgo(3), createdAt: daysAgo(3) };

    // Act
    const result = oldestOverdueInstallment(freshLoan, []);

    // Assert
    expect(result).toBeNull();
  });
});

describe("computeLoanMora", () => {
  it("returns zero mora for a loan with nothing overdue", () => {
    // Arrange
    const freshLoan: Loan = { ...baseLoan, startDate: daysAgo(3), createdAt: daysAgo(3) };

    // Act
    const result = computeLoanMora(freshLoan, []);

    // Assert
    expect(result).toEqual({ moraCents: 0, moraDays: 0 });
  });

  it("nets out mora already collected on or after the oldest overdue due date", () => {
    // Arrange — cuota1 (RD$100) due 21 days ago, unpaid; RD$5 of mora already collected
    const payments = [payment({ amountCents: 500, notes: MORA_NOTE, paidAt: daysAgo(10) })];

    // Act
    const gross = computeLoanMora(baseLoan, []);
    const net = computeLoanMora(baseLoan, payments);

    // Assert
    expect(gross.moraCents).toBeGreaterThan(0);
    expect(net.moraCents).toBe(gross.moraCents - 500);
  });

  it("ignores mora payments made before the oldest overdue due date", () => {
    // Arrange
    const payments = [payment({ amountCents: 500, notes: MORA_NOTE, paidAt: daysAgo(27) })];

    // Act
    const gross = computeLoanMora(baseLoan, []);
    const net = computeLoanMora(baseLoan, payments);

    // Assert
    expect(net.moraCents).toBe(gross.moraCents);
  });

  it("clamps net mora to zero when collected exceeds gross", () => {
    // Arrange
    const payments = [payment({ amountCents: 999999, notes: MORA_NOTE, paidAt: daysAgo(10) })];

    // Act
    const result = computeLoanMora(baseLoan, payments);

    // Assert
    expect(result.moraCents).toBe(0);
  });
});
