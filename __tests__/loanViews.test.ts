/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: loan-detail "Plan de pagos schedule" + "Total a pagar hoy" — the
 * schedule derives paid/overdue/upcoming from payments and due dates, and
 * the due-today breakdown lists overdue cuotas plus mora.
 */
import {
  buildLoanDetailView,
  loanCode,
  installmentDueDate,
  addFrequencyInterval,
  defaultFirstPaymentDate
} from "../lib/loans/loanViews";
import type { Loan, LoanFrequency } from "../lib/loans/loan.schema";
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
  graceDays: null,
  moraEnabled: null,
  moraRateBps: null,
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

  it("the schedule reconciles to totalRepayCents — the last cuota absorbs rounding (issue #59)", () => {
    // Without mora, the sum of every installment must equal exactly what the
    // loan collects: principal + flat interest, never the naive cuota × term.
    const view = buildLoanDetailView({
      loan,
      customerName: "José Núñez",
      business: "Motoconcho",
      payments: [],
      today
    });

    const scheduledCents = view.schedule.reduce((sum, item) => sum + item.amountCents, 0);
    expect(scheduledCents).toBe(view.totalRepayCents);
    expect(scheduledCents).toBe(3225600);
    // The naive "cuota × term" a lender might compute overshoots the true total.
    expect(view.schedule[0]!.amountCents * loan.termCount).toBeGreaterThan(view.totalRepayCents);
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

// Spec: loan-configuration "First payment date" — the healthy per-frequency
// default and the round-trip between "first payment date" and the
// `startDate` anchor installmentDueDate builds the schedule from.
describe("addFrequencyInterval / defaultFirstPaymentDate", () => {
  const now = new Date("2026-07-18T14:00:00");

  it.each([
    ["daily", 1],
    ["weekly", 7],
    ["biweekly", 14]
  ] as [LoanFrequency, number][])("%s shifts by %d days per interval", (frequency, days) => {
    const shifted = addFrequencyInterval(now, frequency, 1);
    expect(shifted.getTime() - now.getTime()).toBe(days * DAY_MS);
  });

  it("monthly shifts by calendar months, not a fixed day count", () => {
    const shifted = addFrequencyInterval(now, "monthly", 1);
    expect(shifted.getMonth()).toBe((now.getMonth() + 1) % 12);
    expect(shifted.getDate()).toBe(now.getDate());
  });

  it("supports negative counts to shift backward", () => {
    const forward = addFrequencyInterval(now, "weekly", 1);
    const backward = addFrequencyInterval(forward, "weekly", -1);
    expect(backward.getTime()).toBe(now.getTime());
  });

  it("defaultFirstPaymentDate is one interval from `from` per frequency", () => {
    (["daily", "weekly", "biweekly", "monthly"] as LoanFrequency[]).forEach((frequency) => {
      expect(defaultFirstPaymentDate(frequency, now).getTime()).toBe(
        addFrequencyInterval(now, frequency, 1).getTime()
      );
    });
  });

  it("never lands the default first payment on the same calendar day as `from`, for every frequency", () => {
    (["daily", "weekly", "biweekly", "monthly"] as LoanFrequency[]).forEach((frequency) => {
      const due = defaultFirstPaymentDate(frequency, now);
      expect(due.toDateString()).not.toBe(now.toDateString());
    });
  });

  it("installmentDueDate(loan, 1) equals startDate + one interval, matching addFrequencyInterval", () => {
    const loan: Loan = {
      id: "loan-x",
      customerId: "customer-x",
      principalCents: 100000,
      interestRateBps: 1000,
      termCount: 6,
      frequency: "weekly",
      startDate: now,
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: null,
      moraRateBps: null,
      createdAt: now,
      updatedAt: now
    };
    expect(installmentDueDate(loan, 1).getTime()).toBe(
      addFrequencyInterval(now, "weekly", 1).getTime()
    );
  });
});
