/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Collect an open-credit payment" — the open-credit
 * branch surfaces the current cycle's interest as the default ("Solo
 * interés") amount and the balance for the "Interés + capital" preview,
 * with no mora and no fixed installment count.
 */
import { createGetCollectContext } from "../lib/payments/getCollectContext";
import { customers, loans, payments } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

/** Midnight-aligned so cycle-boundary math in openCreditState is deterministic. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const termLoanRow = {
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

// RD$10,000 @ 5% per cycle (500 bps), weekly, disbursed exactly one cycle
// ago — cycle 1 is completed as of "now" and its interest capitalizes
// (see lib/loans/openCredit.ts).
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

const customerRow = { id: "customer-1", name: "José Núñez" };

function makeDbStub(loanRow: unknown, paymentRows: unknown[] = []) {
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

describe("createGetCollectContext", () => {
  it("leaves openCredit null for a term loan", async () => {
    const db = makeDbStub(termLoanRow, []);
    const getCollectContext = createGetCollectContext({ db });

    const result = await getCollectContext({ loanId: "loan-1" });

    expect(result?.openCredit).toBeNull();
    expect(result?.cuotaCents).toBeGreaterThan(0);
    expect(result?.installmentsTotal).toBe(12);
  });

  describe("open-credit loan", () => {
    it("defaults cuotaCents to the current cycle's interest, with no mora and no fixed installments", async () => {
      const db = makeDbStub(openCreditLoanRow, []);
      const getCollectContext = createGetCollectContext({ db });

      const result = await getCollectContext({ loanId: "loan-2" });

      expect(result?.openCredit).not.toBeNull();
      // Cycle 1 (no payments) capitalizes its RD$500 interest, so cycle 2's
      // current interest due is 5% of RD$10,500 = RD$525.
      expect(result?.cuotaCents).toBe(52500);
      expect(result?.openCredit?.interestDueCents).toBe(52500);
      expect(result?.openCredit?.balanceCents).toBe(1050000);
      expect(result?.remainingBalanceCents).toBe(1050000);
      expect(result?.moraCents).toBe(0);
      expect(result?.currentInstallmentNumber).toBe(0);
      expect(result?.installmentsTotal).toBe(0);
      expect(result?.remainingInstallments).toBe(0);
    });
  });
});
