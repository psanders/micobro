/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: payment-history "Histórico de pagos summary" + "Payment entries
 * list" — totals, cuota numbering, and a partial "Abono a cuenta" entry
 * that doesn't cover a full cuota.
 */
import { buildPaymentHistoryView } from "../lib/loans/loanViews";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const today = new Date("2026-07-14T12:00:00");
const daysAgo = (days: number) => new Date(today.getTime() - days * DAY_MS);

const loan: Loan = {
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 2880000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: daysAgo(28),
  status: "active",
  notes: null,
  graceDays: null,
  createdAt: daysAgo(28),
  updatedAt: daysAgo(28)
};

const payment = (
  id: string,
  amountCents: number,
  paidAt: Date,
  notes: string | null = null
): Payment => ({
  id,
  loanId: "loan-1",
  amountCents,
  paidAt,
  method: "cash",
  notes,
  createdAt: paidAt
});

// 265000 = the interest-inclusive cuota for principal 2880000 @ 1000 bps / 12
// (see lib/loans/loanMath.ts).
describe("buildPaymentHistoryView", () => {
  it("totals collections, numbers full cuotas, and lists newest first", () => {
    const payments = [
      payment("payment-1", 265000, daysAgo(21)),
      payment("payment-2", 265000, daysAgo(14)),
      payment("payment-3", 265000, daysAgo(7))
    ];

    const view = buildPaymentHistoryView(loan, payments);

    expect(view.totalCollectedCents).toBe(795000);
    expect(view.installmentsPaid).toBe(3);
    expect(view.installmentsTotal).toBe(12);
    expect(view.moraPaidCents).toBe(0);
    expect(view.lastPaymentAt).toEqual(daysAgo(7));
    expect(view.entries).toHaveLength(3);
    expect(view.entries[0]!.label).toBe("Cuota 3");
    expect(view.entries[2]!.label).toBe("Cuota 1");
  });

  it("labels a partial amount as an abono and a mora row separately", () => {
    const payments = [
      payment("payment-1", 265000, daysAgo(21)),
      payment("payment-2", 5000, daysAgo(15)),
      payment("payment-3", 265000, daysAgo(14)),
      payment("payment-4", 7500, daysAgo(14), "mora")
    ];

    const view = buildPaymentHistoryView(loan, payments);

    expect(view.installmentsPaid).toBe(2);
    expect(view.moraPaidCents).toBe(7500);
    const abono = view.entries.find((e) => e.id === "payment-2");
    expect(abono?.label).toBe("Abono a cuenta");
    const mora = view.entries.find((e) => e.id === "payment-4");
    expect(mora?.label).toBe("Pago de mora");
  });

  it("returns null-safe zero totals for a loan with no payments", () => {
    const view = buildPaymentHistoryView(loan, []);
    expect(view.totalCollectedCents).toBe(0);
    expect(view.installmentsPaid).toBe(0);
    expect(view.lastPaymentAt).toBeNull();
    expect(view.entries).toHaveLength(0);
  });
});
