/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: open-credit-presentation — crédito abierto (compuesto) shows its
 * balance as capital (never above what was lent) + intereses sumados, and
 * receipts break each payment down the same way. The math is unchanged:
 * capital + intereses sumados always equals the engine's balance.
 *
 * Worked example: RD$10,000 @ 10% mensual, disbursed 5 Jan 2026; interest
 * paid in months 1–2, month 3 (due 5 Apr) skipped, caught up on 5 May.
 */
import { openCreditState, openCreditReceiptBreakdown } from "../lib/loans/openCredit";
import { buildPaymentReceipt } from "../lib/loans/loanViews";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";
import type { Customer } from "../lib/customers/customer.schema";

const d = (iso: string) => new Date(`${iso}T10:00:00`);

const loan: Loan = {
  id: "loan-oc",
  customerId: "customer-1",
  principalCents: 1000000,
  interestRateBps: 1000,
  termCount: 0,
  frequency: "monthly",
  startDate: d("2026-01-05"),
  status: "active",
  notes: null,
  graceDays: null,
  moraEnabled: null,
  moraRateBps: null,
  skipSundays: null,
  loanType: "open_credit",
  createdAt: d("2026-01-05"),
  updatedAt: d("2026-01-05")
};

const customer: Customer = {
  id: "customer-1",
  name: "José Núñez",
  phone: "8091234567",
  address: null,
  cedula: null,
  avatarKey: null,
  createdAt: d("2026-01-05"),
  updatedAt: d("2026-01-05")
};

const pay = (id: string, iso: string, amountCents: number): Payment => ({
  id,
  loanId: "loan-oc",
  amountCents,
  paidAt: d(iso),
  method: "cash",
  notes: null,
  createdAt: d(iso)
});

const onTime = [pay("p1", "2026-02-05", 100000), pay("p2", "2026-03-05", 100000)];
const shortDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

describe("openCreditState — capital vs intereses sumados", () => {
  it("keeps capital at the principal when a skipped cycle is added to the balance", () => {
    const state = openCreditState(loan, onTime, d("2026-04-20"));

    expect(state.balanceCents).toBe(1100000);
    expect(state.principalBalanceCents).toBe(1000000);
    expect(state.capitalizedInterestCents).toBe(100000);
    expect(state.interestDueCents).toBe(110000);
    expect(state.cycles[2]).toMatchObject({ status: "skipped", capitalizedCents: 100000 });
  });

  it("clears intereses sumados before capital when the customer catches up", () => {
    const state = openCreditState(
      loan,
      [...onTime, pay("p3", "2026-05-05", 210000)],
      d("2026-05-05")
    );

    expect(state.principalBalanceCents).toBe(1000000);
    expect(state.capitalizedInterestCents).toBe(0);
    expect(state.balanceCents).toBe(1000000);
    expect(state.cycles[3]).toMatchObject({
      capitalPaidCents: 100000,
      capitalizedPaidCents: 100000,
      principalPaidCents: 0
    });
  });

  it("lowers capital only with what's left after intereses sumados are cleared", () => {
    const state = openCreditState(
      loan,
      [...onTime, pay("p3", "2026-05-05", 410000)],
      d("2026-05-05")
    );

    expect(state.capitalizedInterestCents).toBe(0);
    expect(state.principalBalanceCents).toBe(800000);
    expect(state.balanceCents).toBe(800000);
  });

  it("always splits the balance exactly, even when it compounds twice", () => {
    const state = openCreditState(loan, onTime, d("2026-05-20"));

    expect(state.balanceCents).toBe(1210000);
    expect(state.principalBalanceCents + state.capitalizedInterestCents).toBe(state.balanceCents);
    expect(state.principalBalanceCents).toBe(1000000);
  });

  it("reports zero of both parts once an overpayment closes the loan", () => {
    const state = openCreditState(
      loan,
      [...onTime, pay("p3", "2026-05-05", 2000000)],
      d("2026-05-05")
    );

    expect(state.isClosed).toBe(true);
    expect(state.principalBalanceCents).toBe(0);
    expect(state.capitalizedInterestCents).toBe(0);
  });
});

describe("openCreditReceiptBreakdown", () => {
  it("shows the catch-up payment as interest plus intereses sumados, not capital", () => {
    const payments = [...onTime, pay("p3", "2026-05-05", 210000)];

    const result = openCreditReceiptBreakdown(loan, payments, "p3", shortDate);

    expect(result?.lines).toEqual([
      { label: "Interés · ciclo 4", amountCents: 110000 },
      { label: "Intereses sumados", amountCents: 100000 }
    ]);
    expect(result?.balanceAfter).toEqual([
      { label: "Capital pendiente", amountCents: 1000000 },
      { label: "Intereses sumados", amountCents: 0 },
      { label: "Próx. interés 5/6", amountCents: 100000 }
    ]);
  });

  it("labels an on-time interest payment as that cycle's interest", () => {
    const result = openCreditReceiptBreakdown(loan, onTime, "p1", shortDate);

    expect(result?.lines).toEqual([{ label: "Interés · ciclo 1", amountCents: 100000 }]);
    expect(result?.balanceAfter[0]).toEqual({ label: "Capital pendiente", amountCents: 1000000 });
  });

  it("shows an abono beyond the intereses sumados as capital", () => {
    const payments = [...onTime, pay("p3", "2026-05-05", 410000)];

    const result = openCreditReceiptBreakdown(loan, payments, "p3", shortDate);

    expect(result?.lines).toEqual([
      { label: "Interés · ciclo 4", amountCents: 110000 },
      { label: "Intereses sumados", amountCents: 100000 },
      { label: "Abono a capital", amountCents: 200000 }
    ]);
    expect(result?.balanceAfter[0]).toEqual({ label: "Capital pendiente", amountCents: 800000 });
  });

  it("returns null for a payment that isn't this loan's", () => {
    expect(openCreditReceiptBreakdown(loan, onTime, "missing", shortDate)).toBeNull();
  });

  it("matches the receipt rebuilt from history (Ver recibo)", () => {
    const payments = [...onTime, pay("p3", "2026-05-05", 210000)];

    const direct = openCreditReceiptBreakdown(
      loan,
      payments,
      "p3",
      (date) =>
        // buildPaymentReceipt formats with formatShortDate ("DD/MM")
        `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`
    );
    const rebuilt = buildPaymentReceipt("p3", loan, customer, payments);

    expect(rebuilt?.isOpenCredit).toBe(true);
    expect(rebuilt?.lines).toEqual(direct?.lines);
    expect(rebuilt?.balanceAfter).toEqual(direct?.balanceAfter);
  });
});
