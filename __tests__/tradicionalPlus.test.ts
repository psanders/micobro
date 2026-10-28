/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: tradicional-plus-schedule — each cycle is covered by a cuota or a
 * penalty, a penalty moves the remaining schedule one quincena (15 days),
 * unpaid cycles become owed penalties after the grace period, owed penalties
 * come before any cuota, and the loan is en atraso like a Tradicional loan.
 * Also the loan-detail "Tradicional Plus" view, history and receipt lines.
 */
import {
  tradicionalPlusDueDates,
  tradicionalPlusReceipt,
  tradicionalPlusState
} from "../lib/loans/tradicionalPlus";
import {
  buildCustomerLoanSummary,
  buildLoanDetailView,
  buildPaymentHistoryView,
  PENALTY_NOTE
} from "../lib/loans/loanViews";
import { computeLoanMora, loanMoraPolicy } from "../lib/loans/mora";
import { resolveTradicionalPlusPayOptions } from "../lib/payments/tradicionalPlusPayOptions";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

// Quincenal steps 15 days: cycle 1 = 1 Mar, 2 = 16 Mar, 3 = 31 Mar, …
const start = new Date(2026, 1, 14);
const day = (month: number, date: number) => new Date(2026, month - 1, date, 10);

// RD$10,000 at 30% flat over 10 cuotas → 10 × RD$1,300; penalty RD$300.
const loan: Loan = {
  id: "loan-plus",
  customerId: "c1",
  principalCents: 1_000_000,
  interestRateBps: 3000,
  termCount: 10,
  frequency: "biweekly",
  startDate: start,
  status: "active",
  notes: null,
  graceDays: 3,
  moraEnabled: false,
  moraRateBps: null,
  skipSundays: null,
  loanType: "term_plus",
  penaltyCents: 30_000,
  createdAt: start,
  updatedAt: start
};

let seq = 0;
function pay(at: Date, amountCents: number, notes: string | null = null): Payment {
  seq += 1;
  return {
    id: `p${seq}`,
    loanId: loan.id,
    amountCents,
    paidAt: at,
    method: "cash",
    notes,
    createdAt: at
  };
}
const cuota = (at: Date) => pay(at, 130_000);
const penalty = (at: Date) => pay(at, 30_000, PENALTY_NOTE);
const sameDay = (a: Date | null, b: Date) => a?.toDateString() === b.toDateString();

describe("tradicionalPlusState", () => {
  it("a cuota covers its cycle and lowers the balance", () => {
    const payments = [cuota(day(3, 1))];

    const state = tradicionalPlusState(loan, payments, day(3, 2));
    const view = buildLoanDetailView({
      loan,
      customerName: "",
      business: null,
      payments,
      today: day(3, 2)
    });

    expect(state.installmentsPaid).toBe(1);
    expect(state.nextCuotaNumber).toBe(2);
    expect(sameDay(state.nextDueDate, day(3, 16))).toBe(true);
    expect(view.balanceCents).toBe(1_300_000 - 130_000);
  });

  it("a penalty covers its cycle without touching the balance and moves the schedule", () => {
    const payments = [cuota(day(3, 1)), penalty(day(3, 16))];

    const state = tradicionalPlusState(loan, payments, day(3, 17));
    const view = buildLoanDetailView({
      loan,
      customerName: "",
      business: null,
      payments,
      today: day(3, 17)
    });

    expect(state.timesMoved).toBe(1);
    expect(state.installmentsPaid).toBe(1);
    expect(state.nextCuotaCents).toBe(130_000);
    // Cuota 2 moves from 16 Mar to 31 Mar; the last from cycle 10 to cycle 11.
    expect(sameDay(state.nextDueDate, day(3, 31))).toBe(true);
    expect(sameDay(state.endDate, new Date(2026, 1, 14 + 15 * 11))).toBe(true);
    expect(view.balanceCents).toBe(1_300_000 - 130_000);
    expect(state.isOverdue).toBe(false);
  });

  it("keeps a paid cuota at the date it had when it was paid", () => {
    const payments = [penalty(day(3, 1)), cuota(day(3, 16)), penalty(day(3, 31))];

    const dates = tradicionalPlusDueDates(loan, payments);

    // Cuota 1 was paid after one move (cycle 2), cuota 2 now sits at cycle 4.
    expect(sameDay(dates[0]!, day(3, 16))).toBe(true);
    expect(sameDay(dates[1]!, new Date(2026, 1, 14 + 60))).toBe(true);
  });

  it("accepts any number of moves", () => {
    const payments = Array.from({ length: 13 }, (_, i) =>
      penalty(new Date(2026, 1, 14 + 15 * (i + 1), 10))
    );

    const state = tradicionalPlusState(loan, payments, new Date(2026, 1, 14 + 15 * 13, 12));

    expect(state.timesMoved).toBe(13);
    expect(state.owedPenalties).toBe(0);
    expect(state.canCollectCuota).toBe(true);
  });

  it("owes nothing while the cycle is within its grace", () => {
    const state = tradicionalPlusState(loan, [], day(3, 3));

    expect(state.owedPenalties).toBe(0);
    expect(state.canCollectCuota).toBe(true);
    expect(state.canCollectPenalty).toBe(true);
    // Still en atraso: ATRASO is due-date-only, like Tradicional.
    expect(state.isOverdue).toBe(true);
    expect(state.daysLate).toBe(2);
  });

  it("owes one penalty once the grace has passed, and never mora", () => {
    const state = tradicionalPlusState(loan, [], day(3, 5));

    expect(state.owedPenalties).toBe(1);
    expect(state.owedCents).toBe(30_000);
    expect(state.canCollectCuota).toBe(false);
    expect(computeLoanMora(loan, [], day(3, 5), loanMoraPolicy(loan))).toEqual({
      moraCents: 0,
      moraDays: 0
    });
  });

  it("accumulates one penalty per lapsed cycle", () => {
    // 1 Mar and 16 Mar both past their 3-day grace on 20 Mar.
    const state = tradicionalPlusState(loan, [], day(3, 20));

    expect(state.owedPenalties).toBe(2);
    expect(state.owedCents).toBe(60_000);
    expect(state.penaltyCountToCollect).toBe(2);
  });

  it("brings the loan al día once the owed penalties are paid", () => {
    const payments = [penalty(day(3, 20)), penalty(day(3, 20))];

    const state = tradicionalPlusState(loan, payments, day(3, 20));

    expect(state.owedPenalties).toBe(0);
    expect(state.timesMoved).toBe(2);
    expect(sameDay(state.nextDueDate, day(3, 31))).toBe(true);
    expect(state.isOverdue).toBe(false);
    expect(state.nextCuotaCents).toBe(130_000);
  });

  it("only offers a penalty once the next cycle is due", () => {
    const state = tradicionalPlusState(loan, [], day(2, 25));

    expect(state.canCollectCuota).toBe(true);
    expect(state.canCollectPenalty).toBe(false);
  });

  it("is paid off after every cuota, however many penalties were paid", () => {
    const payments = [
      penalty(day(3, 1)),
      penalty(day(3, 16)),
      penalty(day(3, 31)),
      ...Array.from({ length: 10 }, (_, i) => cuota(new Date(2026, 3, 1 + i, 10)))
    ];

    const state = tradicionalPlusState(loan, payments, new Date(2026, 3, 20));
    const view = buildLoanDetailView({
      loan,
      customerName: "",
      business: null,
      payments,
      today: new Date(2026, 3, 20)
    });

    expect(state.paidOff).toBe(true);
    expect(state.canCollectCuota).toBe(false);
    expect(state.canCollectPenalty).toBe(false);
    expect(view.balanceCents).toBe(0);
    expect(view.nextDueDate).toBeNull();
  });
});

describe("Tradicional Plus loan detail view", () => {
  it("shows owed penalties as the only Total a pagar hoy line, with no mora", () => {
    const view = buildLoanDetailView({
      loan,
      customerName: "",
      business: null,
      payments: [],
      moraCents: 75_000,
      today: day(3, 20)
    });

    expect(view.dueTodayLines).toEqual([{ kind: "penalty", penaltyCount: 2, amountCents: 60_000 }]);
    expect(view.dueTodayCents).toBe(60_000);
    expect(view.moraCents).toBe(0);
    expect(view.tradicionalPlus).toMatchObject({ owedPenalties: 2, timesMoved: 0 });
    expect(view.schedule[0]).toMatchObject({ status: "overdue", amountCents: 130_000 });
  });

  it("shows the next cuota when nothing is owed, at its moved date", () => {
    const payments = [penalty(day(3, 1))];

    const view = buildLoanDetailView({
      loan,
      customerName: "",
      business: null,
      payments,
      today: day(3, 2)
    });

    expect(view.dueTodayLines).toEqual([
      expect.objectContaining({ kind: "installment", installmentNumber: 1, amountCents: 130_000 })
    ]);
    expect(sameDay(view.schedule[0]!.dueDate, day(3, 16))).toBe(true);
    expect(view.tradicionalPlus?.timesMoved).toBe(1);
  });

  it("lists a penalty as Penalidad in the history, apart from cuotas", () => {
    const payments = [cuota(day(3, 1)), penalty(day(3, 16))];

    const history = buildPaymentHistoryView(loan, payments);

    expect(history.installmentsPaid).toBe(1);
    expect(history.entries.map((e) => e.label)).toEqual(["Penalidad", "Cuota 1"]);
  });
});

describe("tradicionalPlusReceipt", () => {
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

  it("names the date the penalty moved the cuota to", () => {
    const p = penalty(day(3, 1));

    const receipt = tradicionalPlusReceipt(loan, [p], [p], fmt);

    expect(receipt.penaltyLine).toEqual({
      label: "Penalidad · Cuota 1 pasa al 16/3",
      amountCents: 30_000
    });
    expect(sameDay(receipt.endDate, new Date(2026, 1, 14 + 15 * 11))).toBe(true);
  });

  it("combines several penalties paid in one cobro", () => {
    const at = day(3, 20);
    const rows = [penalty(at), penalty(at)];

    const receipt = tradicionalPlusReceipt(loan, rows, rows, fmt);

    expect(receipt.penaltyLine).toEqual({
      label: "Penalidades (2) · Cuota 1 pasa al 31/3",
      amountCents: 60_000
    });
  });

  it("reads the same on a reprint after later payments", () => {
    const first = penalty(day(3, 1));
    const later = [first, cuota(day(3, 16)), penalty(day(3, 31))];

    const receipt = tradicionalPlusReceipt(loan, later, [first], fmt);

    expect(receipt.penaltyLine?.label).toBe("Penalidad · Cuota 1 pasa al 16/3");
  });
});

describe("resolveTradicionalPlusPayOptions", () => {
  const optionsAt = (payments: Payment[], today: Date) =>
    resolveTradicionalPlusPayOptions(
      buildLoanDetailView({ loan, customerName: "", business: null, payments, today })
        .tradicionalPlus!
    );

  it("preselects the cuota and enables the penalty when the cycle is due today", () => {
    const options = optionsAt([], day(3, 1));

    expect(options.defaultOption).toBe("cuota");
    expect(options.cuota).toMatchObject({ enabled: true, amountCents: 130_000 });
    expect(options.penalty).toMatchObject({ enabled: true, amountCents: 30_000, count: 1 });
  });

  it("disables the penalty before the cycle is due", () => {
    const options = optionsAt([], day(2, 24));

    expect(options.defaultOption).toBe("cuota");
    expect(options.penalty).toMatchObject({ enabled: false, note: "La cuota aún no vence" });
  });

  it("preselects every owed penalty and locks the cuota", () => {
    const options = optionsAt([], day(3, 20));

    expect(options.defaultOption).toBe("penalty");
    expect(options.penalty).toMatchObject({
      label: "Cobrar penalidad (2)",
      amountCents: 60_000,
      count: 2,
      enabled: true
    });
    expect(options.cuota).toMatchObject({
      enabled: false,
      note: "Primero debe pagar 2 penalidades"
    });
  });
});

describe("buildCustomerLoanSummary — Tradicional Plus", () => {
  it("shows the owed penalties as the next amount on the customer card", () => {
    const view = buildLoanDetailView({
      loan,
      customerName: "",
      business: null,
      payments: [],
      today: day(3, 20)
    });

    expect(buildCustomerLoanSummary(view, loan).nextAmountCents).toBe(60_000);
  });
});
