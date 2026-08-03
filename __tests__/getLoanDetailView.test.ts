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

// RD$10,000 @ 5% per cycle (500 bps), weekly, disbursed exactly one cycle
// ago — cycle 1 is completed as of "now" (see lib/loans/openCredit.ts).
const openCreditLoanRow = {
  id: "loan-2",
  customerId: "customer-1",
  principalCents: 1000000,
  interestRateBps: 500,
  termCount: 0,
  frequency: "weekly",
  // 8 days back, not 7: a cycle isn't over until its due date has passed,
  // so a loan started exactly one week ago still has cycle 1 open today.
  startDate: daysAgo(8),
  status: "active",
  notes: null,
  loanType: "open_credit",
  createdAt: daysAgo(8),
  updatedAt: daysAgo(8)
};

function makeDbStub(paymentRows: unknown[] = [], loanRowOverride: unknown = loanRow) {
  const from = jest.fn((table: unknown) => {
    const rows =
      table === loans
        ? [loanRowOverride]
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

    // Assert — cuota1 (interest-inclusive: RD$110, see lib/loans/loanMath.ts)
    // is 21 days overdue: 0.1 * (21/30) * 11000 = 770
    expect(result?.moraCents).toBe(770);
    expect(result?.moraDays).toBe(21);
    expect(result?.dueTodayCents).toBeGreaterThan(0);
  });

  it("returns zero mora once every overdue cuota is paid", async () => {
    // Arrange — clears every cuota due so far (cuotas 1–3, RD$330 total)
    const db = makeDbStub([
      { id: "p1", loanId: "loan-1", amountCents: 33000, paidAt: daysAgo(25) }
    ]);
    const getLoanDetailView = createGetLoanDetailView({ db });

    // Act
    const result = await getLoanDetailView({ id: "loan-1" });

    // Assert
    expect(result?.moraCents).toBe(0);
  });

  it("leaves openCredit null for a term loan", async () => {
    const db = makeDbStub([]);
    const getLoanDetailView = createGetLoanDetailView({ db });

    const result = await getLoanDetailView({ id: "loan-1" });

    expect(result?.openCredit).toBeNull();
  });

  describe("open-credit loan", () => {
    it("populates openCredit and overrides balance/mora when the cycle is skipped", async () => {
      // Arrange — no payments: cycle 1's RD$500 interest capitalizes.
      const db = makeDbStub([], openCreditLoanRow);
      const getLoanDetailView = createGetLoanDetailView({ db });

      // Act
      const result = await getLoanDetailView({ id: "loan-2" });

      // Assert
      expect(result?.openCredit).not.toBeNull();
      expect(result?.openCredit?.balanceCents).toBe(1050000); // RD$10,500
      expect(result?.openCredit?.interestDueCents).toBe(52500); // 5% of RD$10,500
      expect(result?.openCredit?.isClosed).toBe(false);
      expect(result?.openCredit?.interestRateBps).toBe(500);
      expect(result?.openCredit?.cycles[0]).toMatchObject({ index: 1, status: "skipped" });
      // Overridden top-level fields — open credit has no mora/cuota schedule.
      expect(result?.balanceCents).toBe(1050000);
      expect(result?.moraCents).toBe(0);
    });

    it("reflects a paid interest+capital cycle in the balance", async () => {
      // Arrange — RD$500 interest + RD$2,000 capital paid within cycle 1.
      const db = makeDbStub(
        [{ id: "p1", loanId: "loan-2", amountCents: 250000, paidAt: daysAgo(4) }],
        openCreditLoanRow
      );
      const getLoanDetailView = createGetLoanDetailView({ db });

      // Act
      const result = await getLoanDetailView({ id: "loan-2" });

      // Assert
      expect(result?.openCredit?.balanceCents).toBe(800000); // RD$8,000
      expect(result?.openCredit?.interestDueCents).toBe(40000); // 5% of RD$8,000
      expect(result?.openCredit?.cycles[0]).toMatchObject({
        status: "interest_plus_capital",
        paidCents: 250000,
        capitalPaidCents: 200000
      });
      expect(result?.balanceCents).toBe(800000);
      expect(result?.moraCents).toBe(0);
    });
  });
});
