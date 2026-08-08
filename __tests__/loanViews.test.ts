/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: loan-detail "Plan de pagos schedule" + "Total a pagar hoy" — the
 * schedule derives paid/overdue/upcoming from payments and due dates, and
 * the due-today breakdown lists overdue cuotas plus mora.
 */
import {
  buildLoanDetailView,
  buildCustomerLoanSummary,
  cycleIndexForPayment,
  loanCode,
  cuotaLabel,
  installmentDueDate,
  addFrequencyInterval,
  addNonSundayDays,
  buildPaymentReceipt,
  defaultFirstPaymentDate,
  healthyFirstPaymentFloor
} from "../lib/loans/loanViews";
import { openCreditState } from "../lib/loans/openCredit";
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

// Spec: loan-configuration "First payment date" — monthly cuota/cycle dates
// clamp to the target month's last day when it's shorter than the anchor
// day, and return to the anchor day in a later month long enough for it
// (issue #110). Before this fix, a bare `setMonth` normalized an invalid
// date (e.g. Sep 31) forward into the next month instead of clamping.
describe("addFrequencyInterval — monthly month-end clamp (issue #110)", () => {
  it.each([
    // [start ISO, count, expected result ISO, why]
    ["2026-01-31T00:00:00", 1, "2026-02-28T00:00:00"], // Jan 31 +1 → Feb 28 (2026 is not a leap year)
    ["2026-01-31T00:00:00", 2, "2026-03-31T00:00:00"], // +2 → Mar 31, anchor restored (Mar has 31 days)
    ["2026-01-30T00:00:00", 1, "2026-02-28T00:00:00"], // regression: 30 Jan lands on Feb 28, not Mar 02
    ["2026-07-31T00:00:00", 1, "2026-08-31T00:00:00"], // Aug has 31 days — no clamp needed
    ["2026-07-31T00:00:00", 2, "2026-09-30T00:00:00"], // Sep has 30 — clamps
    ["2026-07-31T00:00:00", 3, "2026-10-31T00:00:00"], // Oct has 31 — anchor restored, not sticky at 30
    ["2026-07-31T00:00:00", 4, "2026-11-30T00:00:00"], // Nov has 30 — clamps again
    ["2026-07-31T00:00:00", 5, "2026-12-31T00:00:00"], // Dec has 31 — restored again
    ["2028-01-31T00:00:00", 1, "2028-02-29T00:00:00"] // leap year: Feb 2028 has 29 days
  ])("%s + %d month(s) -> %s", (isoDate, count, expectedIso) => {
    const result = addFrequencyInterval(new Date(isoDate), "monthly", count as number);
    expect(result.toDateString()).toBe(new Date(expectedIso).toDateString());
  });

  it("negative counts clamp correctly too (backward from a long month into a short one)", () => {
    const oct31 = new Date("2026-10-31T00:00:00");
    // Sep has 30 days.
    expect(addFrequencyInterval(oct31, "monthly", -1).toDateString()).toBe(
      new Date("2026-09-30T00:00:00").toDateString()
    );
    // Aug has 31 — anchor restored going backward too.
    expect(addFrequencyInterval(oct31, "monthly", -2).toDateString()).toBe(
      new Date("2026-08-31T00:00:00").toDateString()
    );
    // 8 months back from Oct 2026 is Feb 2026 (non-leap, 28 days) — clamps.
    expect(addFrequencyInterval(oct31, "monthly", -8).toDateString()).toBe(
      new Date("2026-02-28T00:00:00").toDateString()
    );
  });

  it("preserves time-of-day through the clamp", () => {
    const withTime = new Date("2026-07-31T15:42:07");
    const result = addFrequencyInterval(withTime, "monthly", 2);
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(42);
    expect(result.getSeconds()).toBe(7);
  });
});

// Spec: loan-configuration "First payment date" — NewLoanFormScreen derives
// the stored `startDate` by going backward one interval from the lender's
// chosen first-payment date (`addFrequencyInterval(firstPaymentDate,
// frequency, -1)`), so that `installmentDueDate(loan, 1)` lands back on
// exactly what the lender picked, per the spec's "loan created SHALL have
// its first cuota due exactly on the date the lender lands on" line.
describe("NewLoanFormScreen startDate round-trip (monthly)", () => {
  function loanWithStartDate(startDate: Date): Loan {
    return {
      id: "loan-rt",
      customerId: "customer-rt",
      principalCents: 100000,
      interestRateBps: 1000,
      termCount: 6,
      frequency: "monthly",
      startDate,
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: null,
      moraRateBps: null,
      skipSundays: null,
      loanType: null,
      createdAt: startDate,
      updatedAt: startDate
    };
  }

  it.each([
    ["2026-01-31T12:00:00", "31 Jan — December (the preceding month) also has 31 days"],
    ["2026-04-30T12:00:00", "30 Apr — March has 31 days, so no clamp either direction"],
    ["2028-02-29T12:00:00", "29 Feb (leap) — January has 31 days"]
  ])("round-trips exactly for %s (%s)", (isoDate) => {
    const firstPaymentDate = new Date(isoDate);
    const startDate = addFrequencyInterval(firstPaymentDate, "monthly", -1);
    const loan = loanWithStartDate(startDate);
    expect(installmentDueDate(loan, 1).getTime()).toBe(firstPaymentDate.getTime());
  });

  // KNOWN LIMITATION (not introduced by the #110 clamp fix, and not fixed by
  // it either): when the chosen first-payment day doesn't exist in the
  // PRECEDING month, going back one interval clamps the day away, and a
  // bare `Date` startDate has no way to carry the original anchor ("31")
  // through that clamp — it only remembers whatever day it landed on. The
  // forward step then re-anchors on that clamped day, not the lender's
  // original pick. Closing this would need a persisted "anchor day of
  // month" separate from `startDate`, which is a schema change out of scope
  // for this fix (see the captain's brief for issue #110).
  it("KNOWN LIMITATION: round-trip breaks when the chosen day doesn't exist in the preceding month (31 Mar -> Feb has 28 days)", () => {
    const firstPaymentDate = new Date("2026-03-31T12:00:00");
    const startDate = addFrequencyInterval(firstPaymentDate, "monthly", -1);
    expect(startDate.toDateString()).toBe(new Date("2026-02-28T12:00:00").toDateString());

    const loan = loanWithStartDate(startDate);
    const roundTripped = installmentDueDate(loan, 1);
    // Falls on Mar 28, not the lender's chosen Mar 31 — a narrower gap than
    // the pre-fix behavior (which landed on Apr 03), but not closed.
    expect(roundTripped.toDateString()).toBe(new Date("2026-03-28T12:00:00").toDateString());
    expect(roundTripped.getTime()).not.toBe(firstPaymentDate.getTime());
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

// Spec: customer-detail "Active loans section" — the Cliente Detalle loan
// card's summary, term (cuota count) vs. open-credit (capital-paid ratio).
describe("buildCustomerLoanSummary", () => {
  // RD$10,000 @ 5% per cycle (500 bps), weekly, disbursed exactly one cycle
  // before `today` — cycle 1 is completed as of `today` (see
  // lib/loans/openCredit.ts and getLoanDetailView.test.ts's matching fixture).
  const openCreditLoan: Loan = {
    id: "loan-oc",
    customerId: "customer-3",
    principalCents: 1000000,
    interestRateBps: 500,
    termCount: 0,
    frequency: "weekly",
    startDate: new Date(today.getTime() - 8 * DAY_MS),
    status: "active",
    notes: null,
    graceDays: null,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: "open_credit",
    createdAt: today,
    updatedAt: today
  };

  it("term loan: cuota fields drive the summary, openCredit stays null", () => {
    const view = buildLoanDetailView({
      loan,
      customerName: "José Núñez",
      business: null,
      payments: threePaid,
      today
    });

    const summary = buildCustomerLoanSummary(view, loan);

    expect(summary.openCredit).toBeNull();
    expect(summary.installmentsPaid).toBe(3);
    expect(summary.installmentsTotal).toBe(12);
    expect(summary.nextDueDate?.getTime()).toBe(installmentDueDate(loan, 4).getTime());
  });

  it("open-credit loan: capital-paid ratio + next-cycle interest replace the cuota count", () => {
    // RD$500 interest + RD$2,000 capital paid within cycle 1: balance drops
    // to RD$8,000 — 20% of principal repaid.
    const ocPayments: Payment[] = [
      {
        id: "p1",
        loanId: "loan-oc",
        amountCents: 250000,
        paidAt: new Date(today.getTime() - 4 * DAY_MS),
        method: "cash",
        notes: null,
        createdAt: today
      }
    ];
    const state = openCreditState(openCreditLoan, ocPayments, today);
    const view = buildLoanDetailView({
      loan: openCreditLoan,
      customerName: "Cliente",
      business: null,
      payments: ocPayments,
      today
    });

    const summary = buildCustomerLoanSummary(view, openCreditLoan, state);

    expect(summary.installmentsPaid).toBe(0);
    expect(summary.installmentsTotal).toBe(0);
    expect(summary.openCredit?.interestRateBps).toBe(500);
    expect(summary.openCredit?.capitalPaidRatio).toBeCloseTo(0.2);
    expect(summary.nextAmountCents).toBe(40000); // 5% of the RD$8,000 balance
    expect(summary.nextDueDate?.getTime()).toBe(
      addFrequencyInterval(openCreditLoan.startDate, "weekly", 2).getTime()
    );
  });

  it("clamps the capital-paid ratio to 0 when a skipped cycle capitalizes interest past principal", () => {
    // No payments: cycle 1's RD$500 interest capitalizes, growing the
    // balance to RD$10,500 — above the RD$10,000 principal.
    const state = openCreditState(openCreditLoan, [], today);
    const view = buildLoanDetailView({
      loan: openCreditLoan,
      customerName: "Cliente",
      business: null,
      payments: [],
      today
    });

    const summary = buildCustomerLoanSummary(view, openCreditLoan, state);

    expect(state.balanceCents).toBeGreaterThan(openCreditLoan.principalCents);
    expect(summary.openCredit?.capitalPaidRatio).toBe(0);
  });

  describe("cycleIndexForPayment", () => {
    it("matches a payment to the cycle whose window it falls in", () => {
      const paidWithinCycle1: Payment = {
        id: "p1",
        loanId: "loan-oc",
        amountCents: 50000,
        paidAt: new Date(today.getTime() - 4 * DAY_MS),
        method: "cash",
        notes: null,
        createdAt: today
      };
      const state = openCreditState(openCreditLoan, [paidWithinCycle1], today);

      expect(cycleIndexForPayment(state.cycles, paidWithinCycle1)).toBe(1);
    });

    it("falls back to the last cycle for a payment outside every replayed window", () => {
      const state = openCreditState(openCreditLoan, [], today);
      const strayPayment: Payment = {
        id: "stray",
        loanId: "loan-oc",
        amountCents: 1000,
        paidAt: new Date(today.getTime() + 30 * DAY_MS),
        method: "cash",
        notes: null,
        createdAt: today
      };

      expect(cycleIndexForPayment(state.cycles, strayPayment)).toBe(
        state.cycles[state.cycles.length - 1]!.index
      );
    });
  });
});
