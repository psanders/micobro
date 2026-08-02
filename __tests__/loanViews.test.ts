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
  cuotaLabel,
  installmentDueDate,
  addFrequencyInterval,
  addNonSundayDays,
  buildPaymentReceipt,
  defaultFirstPaymentDate,
  healthyFirstPaymentFloor
} from "../lib/loans/loanViews";
import type { Loan, LoanFrequency } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";
import type { Customer } from "../lib/customers/customer.schema";

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
  skipSundays: null,
  loanType: null,
  createdAt: daysAgo(31),
  updatedAt: daysAgo(31)
};

// 268800 = the interest-inclusive cuota for principal 2880000 @ 1200 bps / 12
// (see lib/loans/loanMath.ts); these payments default to a slightly larger
// 270000 to model a lender who rounds a cobro up in the field.
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
    expect(view.schedule[3]!.amountCents).toBe(343800);
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
    // For this loan the whole-peso cuota happens to divide the repay amount
    // evenly, so "cuota × term" already matches the true total exactly — no
    // absorption needed. loanMath.test.ts's `lastCuotaCents` suite covers
    // the (more common) case where it doesn't divide evenly and the last
    // cuota must absorb the remainder.
    expect(view.schedule[0]!.amountCents * loan.termCount).toBe(view.totalRepayCents);
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

    expect(view.dueTodayCents).toBe(343800);
    expect(view.dueTodayLines).toHaveLength(2);
    expect(view.dueTodayLines[0]).toMatchObject({
      kind: "installment",
      installmentNumber: 4,
      amountCents: 268800
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

// Spec: collect-payment — receipts (digital and printed) show the current
// cuota against the loan's total cuota count, not just the current number
// (issue #64).
describe("cuotaLabel", () => {
  it("formats the current cuota against the loan's total", () => {
    expect(cuotaLabel(1, 42)).toBe("Cuota 1/42");
    expect(cuotaLabel(4, 12)).toBe("Cuota 4/12");
  });

  it("stays correct at the edges of the schedule", () => {
    expect(cuotaLabel(1, 1)).toBe("Cuota 1/1");
    expect(cuotaLabel(12, 12)).toBe("Cuota 12/12");
  });

  it("works for loans with large or small term counts", () => {
    expect(cuotaLabel(3, 200)).toBe("Cuota 3/200");
    expect(cuotaLabel(1, 4)).toBe("Cuota 1/4");
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
    ["biweekly", 15]
  ] as [LoanFrequency, number][])("%s shifts by %d days per interval", (frequency, days) => {
    const shifted = addFrequencyInterval(now, frequency, 1);
    expect(shifted.getTime() - now.getTime()).toBe(days * DAY_MS);
  });

  it("biweekly (quincenal) installments land 15 days apart, not 14 — regression for #78", () => {
    // First payment on Sep 15 (a 30-day month): installment 2 must fall on
    // the 30th (15 + 15 = 30), and installment 3 on the 15th of the next
    // month — not one day earlier each time, which is what a 14-day
    // interval would silently drift toward.
    const firstPayment = new Date("2026-09-15T12:00:00");
    const installment2 = addFrequencyInterval(firstPayment, "biweekly", 1);
    const installment3 = addFrequencyInterval(firstPayment, "biweekly", 2);
    expect(installment2.getDate()).toBe(30);
    expect(installment2.getMonth()).toBe(firstPayment.getMonth());
    expect(installment3.getDate()).toBe(15);
    expect(installment3.getMonth()).toBe((firstPayment.getMonth() + 1) % 12);
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
      skipSundays: null,
      loanType: null,
      createdAt: now,
      updatedAt: now
    };
    expect(installmentDueDate(loan, 1).getTime()).toBe(
      addFrequencyInterval(now, "weekly", 1).getTime()
    );
  });
});

// Spec: loan-configuration "First payment date" — the calendar picker's
// minimum date and the value the form resets to on a frequency change.
describe("healthyFirstPaymentFloor", () => {
  const saturday = new Date("2026-07-18T14:00:00"); // tomorrow is Sunday 19th
  const wednesday = new Date("2026-07-15T14:00:00"); // tomorrow is Thursday 16th

  it("equals defaultFirstPaymentDate for non-daily frequencies, regardless of skipSundays", () => {
    (["weekly", "biweekly", "monthly"] as LoanFrequency[]).forEach((frequency) => {
      expect(healthyFirstPaymentFloor(frequency, true, saturday).getTime()).toBe(
        defaultFirstPaymentDate(frequency, saturday).getTime()
      );
      expect(healthyFirstPaymentFloor(frequency, false, saturday).getTime()).toBe(
        defaultFirstPaymentDate(frequency, saturday).getTime()
      );
    });
  });

  it("equals defaultFirstPaymentDate for daily when skipSundays is off, even if that lands on a Sunday", () => {
    expect(healthyFirstPaymentFloor("daily", false, saturday).getTime()).toBe(
      defaultFirstPaymentDate("daily", saturday).getTime()
    );
    expect(healthyFirstPaymentFloor("daily", false, saturday).getDay()).toBe(0);
  });

  it("skips forward to Monday when the naive daily default would land on a Sunday and skipSundays is on", () => {
    const floor = healthyFirstPaymentFloor("daily", true, saturday);
    expect(floor.getDay()).toBe(1);
    expect(floor.getTime()).not.toBe(defaultFirstPaymentDate("daily", saturday).getTime());
  });

  it("equals defaultFirstPaymentDate for daily with skipSundays on when tomorrow isn't a Sunday", () => {
    expect(healthyFirstPaymentFloor("daily", true, wednesday).getTime()).toBe(
      defaultFirstPaymentDate("daily", wednesday).getTime()
    );
  });
});

// Spec: loan-configuration "Sunday-skip for daily loans" — a per-loan opt-in
// (mirroring moraEnabled) that keeps every daily cuota off Sundays.
describe("installmentDueDate with skipSundays", () => {
  // 2026-07-18 is a Saturday, so the naive daily schedule (startDate + n
  // days) would land cuota 1 on Sunday 2026-07-19.
  const saturday = new Date("2026-07-18T00:00:00");

  function dailyLoan(overrides: Partial<Loan> = {}): Loan {
    return {
      id: "loan-daily",
      customerId: "customer-x",
      principalCents: 3000000,
      interestRateBps: 1000,
      termCount: 30,
      frequency: "daily",
      startDate: saturday,
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: null,
      moraRateBps: null,
      skipSundays: null,
      loanType: null,
      createdAt: saturday,
      updatedAt: saturday,
      ...overrides
    };
  }

  it("shifts a Sunday due date to the following Monday", () => {
    const loan = dailyLoan({ skipSundays: true });

    // Naively, cuota 1 = startDate + 1 day = Sunday 2026-07-19.
    const cuota1 = installmentDueDate(loan, 1);
    expect(cuota1.getDay()).not.toBe(0);
    expect(cuota1.toDateString()).toBe(new Date("2026-07-20T00:00:00").toDateString());
  });

  it("never lands a cuota on a Sunday across a schedule that crosses one", () => {
    const loan = dailyLoan({ skipSundays: true });

    const dueDates = Array.from({ length: 10 }, (_, i) => installmentDueDate(loan, i + 1));
    expect(dueDates.every((d) => d.getDay() !== 0)).toBe(true);

    // Cuota 7 naively falls on startDate + 7 days = Saturday 2026-07-25; with
    // the Sunday (07-26) skipped, it actually lands two calendar days later,
    // on Monday 2026-07-27 — the schedule spans extra calendar days.
    const naiveCuota7 = addFrequencyInterval(saturday, "daily", 7);
    expect(naiveCuota7.toDateString()).toBe(new Date("2026-07-25T00:00:00").toDateString());
    expect(dueDates[6]!.toDateString()).toBe(new Date("2026-07-27T00:00:00").toDateString());
    expect(dueDates[6]!.getTime()).toBeGreaterThan(naiveCuota7.getTime());
  });

  it("matches addFrequencyInterval exactly when skipSundays is off", () => {
    const loan = dailyLoan({ skipSundays: null });

    for (let n = 1; n <= 10; n++) {
      expect(installmentDueDate(loan, n).getTime()).toBe(
        addFrequencyInterval(saturday, "daily", n).getTime()
      );
    }
  });

  it("leaves non-daily loans unaffected even if skipSundays is set", () => {
    const weeklyLoan: Loan = { ...dailyLoan({ skipSundays: true }), frequency: "weekly" };

    expect(installmentDueDate(weeklyLoan, 1).getTime()).toBe(
      addFrequencyInterval(saturday, "weekly", 1).getTime()
    );
  });

  it("addNonSundayDays walks forward, skipping Sundays without counting them", () => {
    // From Saturday, 2 non-Sunday days forward is Monday then Tuesday
    // (Sunday is skipped entirely, not counted).
    expect(addNonSundayDays(saturday, 2).toDateString()).toBe(
      new Date("2026-07-21T00:00:00").toDateString()
    );
  });
});

// Spec: payment-history "Ver recibo desde el historial" — reconstructing a
// past cobro's receipt, combining a mora+installment cobro's two rows into
// one receipt with one canonical receipt number.
describe("buildPaymentReceipt", () => {
  const customer: Customer = {
    id: "customer-2",
    name: "José Núñez",
    phone: "8095551234",
    address: null,
    cedula: null,
    avatarKey: null,
    createdAt: today,
    updatedAt: today
  };

  it("returns null when the payment doesn't belong to the loan", () => {
    const receipt = buildPaymentReceipt("does-not-exist", loan, customer, threePaid);
    expect(receipt).toBeNull();
  });

  it("rebuilds a single-line receipt for a standalone cuota payment", () => {
    const receipt = buildPaymentReceipt("p2", loan, customer, threePaid);
    expect(receipt).not.toBeNull();
    expect(receipt!.paymentId).toBe("p2");
    expect(receipt!.customerName).toBe("José Núñez");
    expect(receipt!.totalCents).toBe(270000);
    expect(receipt!.lines).toEqual([{ label: "Cuota 2/12", amountCents: 270000 }]);
  });

  it("combines a mora row and an installment row from the same cobro into one receipt", () => {
    const paidAt = daysAgo(3);
    const moraRow: Payment = {
      id: "mora-1",
      loanId: "loan-3",
      amountCents: 15000,
      paidAt,
      method: "cash",
      notes: "mora",
      createdAt: paidAt
    };
    const cuotaRow = cuotaPayment("p4", paidAt);
    const allPayments = [...threePaid, moraRow, cuotaRow];

    const fromMora = buildPaymentReceipt("mora-1", loan, customer, allPayments);
    const fromCuota = buildPaymentReceipt("p4", loan, customer, allPayments);

    expect(fromMora).not.toBeNull();
    expect(fromCuota).not.toBeNull();
    expect(fromMora!.totalCents).toBe(285000);
    expect(fromCuota!.totalCents).toBe(285000);
    expect(fromMora!.lines).toEqual([
      { label: "Mora (prioridad)", amountCents: 15000 },
      { label: "Cuota 4/12", amountCents: 270000 }
    ]);
    expect(fromCuota!.lines).toEqual(fromMora!.lines);
    // Tapping either sibling row opens the same receipt, same number.
    expect(fromCuota!.receiptNumber).toBe(fromMora!.receiptNumber);
  });
});
