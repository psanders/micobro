/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The Tradicional Plus fixture issue #191's acceptance criteria use: start
 * 14 Feb 2026, quincenal, 10 × RD$1,300, penalty RD$300, 3 grace days.
 * Cycle 1 is due 1 Mar, cycle 2 16 Mar, cycle 3 31 Mar; on 20 Mar two
 * penalties are owed.
 */
import { buildLoanDetailView } from "../../lib/loans/loanViews";
import type { Loan } from "../../lib/loans/loan.schema";
import type { Payment, PaymentKind } from "../../lib/payments/payment.schema";
import type { LoanDetailView, TradicionalPlusView } from "../../lib/repo/types";

export const start = new Date(2026, 1, 14);
/** 10:00 on `date` of `month` (1-based), 2026. */
export const day = (month: number, date: number, hour = 10) =>
  new Date(2026, month - 1, date, hour);
export const sameDay = (a: Date | null | undefined, b: Date) =>
  a?.toDateString() === b.toDateString();

export const plusLoan: Loan = {
  id: "loan-plus",
  customerId: "customer-1",
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
export function pay(
  at: Date,
  amountCents: number,
  tipo: PaymentKind = "cuota",
  overrides: Partial<Payment> = {}
): Payment {
  seq += 1;
  return {
    id: `p${seq}`,
    loanId: plusLoan.id,
    amountCents,
    paidAt: at,
    method: "cash",
    notes: null,
    tipo,
    createdAt: new Date(at.getTime() + seq),
    ...overrides
  };
}
export const cuota = (at: Date) => pay(at, 130_000);
export const penalty = (at: Date) => pay(at, 30_000, "penalidad");

export function viewAt(payments: Payment[], today: Date, loan: Loan = plusLoan): LoanDetailView {
  return buildLoanDetailView({ loan, customerName: "Ana Pérez", business: null, payments, today });
}

export function plusAt(payments: Payment[], today: Date): TradicionalPlusView {
  return viewAt(payments, today).tradicionalPlus!;
}
