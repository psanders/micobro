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
  // No grace: the fixture dates assume a cycle ends the day after it is due.
  graceDays: 0,
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

  // Issue #204: after a round-up, plain Tradicional charges only what's left
  // of the current cuota; Tradicional Plus keeps the full cuota, which is
  // the only amount collectPayment accepts there.
  describe("what Cobrar cuota charges after principal carried in", () => {
    // RD$28,800 @ 10% / 12 weekly: cuota RD$2,640.
    const roundUpLoan = { ...termLoanRow, principalCents: 2880000, graceDays: null };
    const row = (id: string, amountCents: number, n: number) => ({
      id,
      loanId: "loan-1",
      amountCents,
      paidAt: daysAgo(n),
      method: "cash",
      notes: null,
      tipo: "cuota",
      createdAt: daysAgo(n)
    });

    it("AC12c: a RD$10 round-up leaves RD$2,630 for the next cuota", async () => {
      const db = makeDbStub(roundUpLoan, [row("p1", 265000, 14)]);
      const ctx = await createGetCollectContext({ db })({ loanId: "loan-1" });
      expect(ctx?.cuotaCents).toBe(263000);
      expect(ctx?.principalPaidCents).toBe(265000);
      expect(ctx?.scheduleCents).toHaveLength(12);
    });

    it("AC4b: after a RD$200 abono, Cobrar cuota offers the rest, then a full cuota again", async () => {
      const abono = await createGetCollectContext({
        db: makeDbStub(roundUpLoan, [row("p1", 20000, 7)])
      })({ loanId: "loan-1" });
      expect(abono?.cuotaCents).toBe(244000);
      const finished = await createGetCollectContext({
        db: makeDbStub(roundUpLoan, [row("p1", 20000, 7), row("p2", 244000, 1)])
      })({ loanId: "loan-1" });
      expect(finished?.cuotaCents).toBe(264000);
    });

    it("AC12c: at the last cuota it offers the last cuota's own remainder", async () => {
      // RD$1,000 @ 0% over 3 cuotas: 333, 333, 334.
      const small = { ...termLoanRow, principalCents: 100000, interestRateBps: 0, termCount: 3 };
      const db = makeDbStub(small, [row("p1", 33300, 14), row("p2", 33300, 7)]);
      const ctx = await createGetCollectContext({ db })({ loanId: "loan-1" });
      expect(ctx?.cuotaCents).toBe(33400);
    });

    it("AC12b: Tradicional Plus keeps the full cuota", async () => {
      const plusLoan = { ...roundUpLoan, loanType: "term_plus", penaltyCents: 50000 };
      const db = makeDbStub(plusLoan, [row("p1", 265000, 14)]);
      const ctx = await createGetCollectContext({ db })({ loanId: "loan-1" });
      expect(ctx?.cuotaCents).toBe(264000);
    });
  });
});
