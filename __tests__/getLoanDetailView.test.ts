/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createGetLoanDetailView } from "../lib/loans/getLoanDetailView";
import { customers, loans, payments } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

/** Midnight-aligned so day-boundary math in computeLoanMora is deterministic. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const loanRow = {
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

const customerRow = { id: "customer-1", name: "José Núñez" };

function makeDbStub(paymentRows: unknown[] = []) {
  const from = jest.fn((table: unknown) => {
    const rows =
      table === loans
        ? [loanRow]
        : table === customers
          ? [customerRow]
          : table === payments
            ? paymentRows
            : [];
    return { where: jest.fn().mockResolvedValue(rows) };
  });
  return { select: jest.fn(() => ({ from })) } as unknown as Database;
}

describe("createGetLoanDetailView", () => {
  it("accrues mora for an overdue cuota with no payments", async () => {
    // Arrange
    const db = makeDbStub([]);
    const getLoanDetailView = createGetLoanDetailView({ db });

    // Act
    const result = await getLoanDetailView({ id: "loan-1" });

    // Assert — cuota1 (RD$100) is 21 days overdue: 0.1 * (21/30) * 10000 = 700
    expect(result?.moraCents).toBe(700);
    expect(result?.moraDays).toBe(21);
    expect(result?.dueTodayCents).toBeGreaterThan(0);
  });

  it("returns zero mora once every overdue cuota is paid", async () => {
    // Arrange — clears every cuota due so far (cuotas 1–3, RD$300 total)
    const db = makeDbStub([
      { id: "p1", loanId: "loan-1", amountCents: 30000, paidAt: daysAgo(25) }
    ]);
    const getLoanDetailView = createGetLoanDetailView({ db });

    // Act
    const result = await getLoanDetailView({ id: "loan-1" });

    // Assert
    expect(result?.moraCents).toBe(0);
  });
});
