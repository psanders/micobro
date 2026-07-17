/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: loan-detail "Plan de pagos schedule" + "Total a pagar hoy" — the
 * schedule derives paid/overdue/upcoming from payments and due dates, and
 * the due-today breakdown lists overdue cuotas plus mora.
 */
import { buildLoanDetailView, loanCode } from "../lib/loans/loanViews";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const today = new Date("2026-07-14T12:00:00");
const daysAgo = (days: number) => new Date(today.getTime() - days * DAY_MS);

const loan: Loan = {
  id: "loan-3",
  customerId: "customer-2",
  principalCents: 2880000,
  interestRateBps: 1200,
  termCount: 12,
  frequency: "weekly",
  startDate: daysAgo(31),
  status: "active",
  notes: null,
  createdAt: daysAgo(31),
  updatedAt: daysAgo(31)
};

// 270000 = the interest-inclusive cuota for principal 2880000 @ 1200 bps / 12
// (see lib/loans/loanMath.ts).
const cuotaPayment = (id: string, paidAt: Date, amountCents = 270000): Payment => ({
  id,
  loanId: "loan-3",
  amountCents,
  paidAt,
  method: "cash",
  notes: null,
  createdAt: paidAt
});

const threePaid = [
  cuotaPayment("p1", daysAgo(24)),
  cuotaPayment("p2", daysAgo(17)),
  cuotaPayment("p3", daysAgo(10))
];

describe("buildLoanDetailView", () => {
  it("derives paid/overdue/upcoming and attaches mora to the first overdue cuota", () => {
    const view = buildLoanDetailView({
      loan,
      customerName: "José Núñez",
      business: "Motoconcho",
      payments: threePaid,
      moraCents: 75000,
      moraDays: 3,
      today
    });

    expect(view.schedule.slice(0, 3).every((c) => c.status === "paid")).toBe(true);
    expect(view.schedule[3]!.status).toBe("overdue");
    expect(view.schedule[3]!.amountCents).toBe(345000);
    expect(view.schedule[4]!.status).toBe("upcoming");
    expect(view.installmentsPaid).toBe(3);
    // totalRepayCents (3225600 = 2880000 principal + 345600 flat interest) - paidCents (810000).
    expect(view.balanceCents).toBe(3225600 - 810000);
  });

  it("breaks down due-today as overdue cuota + mora line", () => {
    const view = buildLoanDetailView({
      loan,
      customerName: "José Núñez",
      business: null,
      payments: threePaid,
      moraCents: 75000,
      moraDays: 3,
      today
    });

    expect(view.dueTodayCents).toBe(345000);
    expect(view.dueTodayLines).toHaveLength(2);
    expect(view.dueTodayLines[0]).toMatchObject({
      kind: "installment",
      installmentNumber: 4,
      amountCents: 270000
    });
    expect(view.dueTodayLines[1]).toMatchObject({ kind: "mora", moraDays: 3, amountCents: 75000 });
  });

  it("falls back to the next upcoming cuota when nothing is overdue", () => {
    const freshLoan: Loan = { ...loan, startDate: daysAgo(3) };
    const view = buildLoanDetailView({
      loan: freshLoan,
      customerName: "Cliente",
      business: null,
      payments: [],
      today
    });

    expect(view.schedule.every((c) => c.status !== "overdue")).toBe(true);
    expect(view.dueTodayLines).toHaveLength(1);
    expect(view.dueTodayLines[0]).toMatchObject({ kind: "installment", installmentNumber: 1 });
  });

  it("mora rows never count toward principal", () => {
    const view = buildLoanDetailView({
      loan,
      customerName: "Cliente",
      business: null,
      payments: [...threePaid, { ...cuotaPayment("p-mora", daysAgo(1), 75000), notes: "mora" }],
      today
    });
    expect(view.paidCents).toBe(810000);
  });

  it("loanCode derives a stable 5-digit code", () => {
    expect(loanCode("loan-3")).toBe("L-00003");
    expect(loanCode("8f14e45f-ceea-467f-9575-0844ab0c1b2d")).toMatch(/^L-\d{5}$/);
  });
});
