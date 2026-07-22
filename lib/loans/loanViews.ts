/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure builders shared by the mock and real repos: given a loan, its
 * payments, and (optionally) accrued mora, derive the schedule and the
 * detail/summary views the collection screens render. Mora rows
 * (payments flagged `notes: "mora"`) never count toward principal. The
 * cuota is interest-inclusive (flat add-on, see `./loanMath`) and the
 * balance is against the full principal-plus-interest repay amount, not
 * bare principal.
 */
import { methodLabels } from "../payments/labels";
import { cuotaCents, lastCuotaCents, totalInterestCents, totalRepayCents } from "./loanMath";
import type { Loan, LoanFrequency } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";
import type {
  CustomerLoanSummary,
  DueTodayLine,
  LoanDetailView,
  LoanScheduleItem,
  PaymentHistoryEntry,
  PaymentHistoryView
} from "../repo/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const MORA_NOTE = "mora";

/** "loan-3" → "L-00003"; UUIDs hash to a stable 5-digit code. */
export function loanCode(id: string): string {
  const digits = id.replace(/\D/g, "").slice(-5);
  if (digits) return `L-${digits.padStart(5, "0")}`;
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  return `L-${String(hash).padStart(5, "0")}`;
}

/**
 * `date` shifted by `count` payment intervals for `frequency` (monthly
 * shifts by calendar months, everything else by a fixed day count).
 * `count` may be negative to shift backward. Shared by `installmentDueDate`
 * (schedule math) and the new-loan form's "primer pago" default/override,
 * so both agree on what "one interval" means per frequency.
 */
export function addFrequencyInterval(date: Date, frequency: LoanFrequency, count: number): Date {
  if (frequency === "monthly") {
    const due = new Date(date);
    due.setMonth(due.getMonth() + count);
    return due;
  }
  const days = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 14;
  return new Date(date.getTime() + count * days * DAY_MS);
}

export function installmentDueDate(loan: Loan, number: number): Date {
  return addFrequencyInterval(new Date(loan.startDate), loan.frequency, number);
}

/**
 * Healthy per-frequency default for the first payment date, used by the
 * new-loan form: daily → mañana, weekly → en 1 semana, biweekly → en 1
 * quincena, monthly → en 1 mes. This is exactly `installmentDueDate(loan, 1)`
 * for a loan whose `startDate` is `from` — i.e. the disbursement-day
 * default the lender gets when they don't override it.
 */
export function defaultFirstPaymentDate(frequency: LoanFrequency, from: Date = new Date()): Date {
  return addFrequencyInterval(from, frequency, 1);
}

export function principalPaidCents(payments: Payment[]): number {
  return payments.filter((p) => p.notes !== MORA_NOTE).reduce((sum, p) => sum + p.amountCents, 0);
}

export interface LoanViewInput {
  loan: Loan;
  customerName: string;
  business: string | null;
  payments: Payment[];
  moraCents?: number;
  moraDays?: number;
  today?: Date;
}

export function buildLoanDetailView({
  loan,
  customerName,
  business,
  payments,
  moraCents = 0,
  moraDays = 0,
  today = new Date()
}: LoanViewInput): LoanDetailView {
  const cuota = cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  const lastCuota = lastCuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  const repayCents = totalRepayCents(loan.principalCents, loan.interestRateBps);
  const paidCents = principalPaidCents(payments);
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const schedule: LoanScheduleItem[] = [];
  let cumulative = 0;
  let moraAttached = false;
  for (let number = 1; number <= loan.termCount; number++) {
    // The last cuota absorbs the rounding remainder (see `lastCuotaCents`).
    const amountCents = number === loan.termCount ? lastCuota : cuota;
    cumulative += amountCents;
    const dueDate = installmentDueDate(loan, number);
    const status: LoanScheduleItem["status"] =
      paidCents >= cumulative ? "paid" : dueDate < startOfToday ? "overdue" : "upcoming";
    const withMora = status === "overdue" && !moraAttached && moraCents > 0;
    if (withMora) moraAttached = true;
    schedule.push({
      number,
      dueDate,
      amountCents: withMora ? amountCents + moraCents : amountCents,
      status
    });
  }

  const overdue = schedule.filter((item) => item.status === "overdue");
  const firstUnpaid = schedule.find((item) => item.status !== "paid") ?? null;

  const dueTodayLines: DueTodayLine[] = [];
  for (const item of overdue) {
    dueTodayLines.push({
      kind: "installment",
      installmentNumber: item.number,
      dueDate: item.dueDate,
      // Report the bare cuota here; mora gets its own line below.
      amountCents:
        item.number === overdue[0]?.number && moraCents > 0
          ? item.amountCents - moraCents
          : item.amountCents
    });
  }
  if (moraCents > 0) {
    dueTodayLines.push({ kind: "mora", moraDays, amountCents: moraCents });
  }
  if (dueTodayLines.length === 0 && firstUnpaid) {
    dueTodayLines.push({
      kind: "installment",
      installmentNumber: firstUnpaid.number,
      dueDate: firstUnpaid.dueDate,
      amountCents: firstUnpaid.amountCents
    });
  }

  return {
    id: loan.id,
    code: loanCode(loan.id),
    customerId: loan.customerId,
    customerName,
    business,
    frequency: loan.frequency,
    termCount: loan.termCount,
    startDate: loan.startDate,
    endDate: schedule.length > 0 ? schedule[schedule.length - 1]!.dueDate : null,
    principalCents: loan.principalCents,
    totalInterestCents: totalInterestCents(loan.principalCents, loan.interestRateBps),
    totalRepayCents: repayCents,
    balanceCents: Math.max(0, repayCents - paidCents),
    paidCents,
    installmentsPaid: schedule.filter((item) => item.status === "paid").length,
    installmentsTotal: loan.termCount,
    nextDueDate: firstUnpaid?.dueDate ?? null,
    moraCents,
    moraDays,
    dueTodayCents: dueTodayLines.reduce((sum, line) => sum + line.amountCents, 0),
    dueTodayLines,
    schedule
  };
}

/**
 * Histórico de Pagos for one loan. `allPayments` is the whole payments
 * table (not just this loan's) because receipt numbers are assigned by
 * creation order across every loan, matching how `collectPayment` mints
 * them (`R-${index in the whole table}`).
 */
export function buildPaymentHistoryView(loan: Loan, allPayments: Payment[]): PaymentHistoryView {
  const cuota = cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  const byCreatedAt = [...allPayments].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const receiptIndex = new Map(byCreatedAt.map((p, i) => [p.id, i]));
  const receiptNumberOf = (id: string) =>
    `R-${String((receiptIndex.get(id) ?? 0) + 1).padStart(5, "0")}`;

  const loanPayments = allPayments.filter((p) => p.loanId === loan.id);
  const chronological = [...loanPayments].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  let cuotaNumber = 0;
  let moraPaidCents = 0;
  const entries: PaymentHistoryEntry[] = [];
  for (const payment of chronological) {
    const isMora = payment.notes === MORA_NOTE;
    if (isMora) {
      moraPaidCents += payment.amountCents;
      entries.push({
        id: payment.id,
        date: payment.paidAt,
        label: "Pago de mora",
        subLabel: `${methodLabels[payment.method ?? "cash"]} · Recibo #${receiptNumberOf(payment.id)}`,
        amountCents: payment.amountCents
      });
      continue;
    }
    const isFullCuota = payment.amountCents >= cuota;
    if (isFullCuota) cuotaNumber += 1;
    entries.push({
      id: payment.id,
      date: payment.paidAt,
      label: isFullCuota ? `Cuota ${cuotaNumber}` : "Abono a cuenta",
      subLabel: isFullCuota
        ? `Pago completo · ${methodLabels[payment.method ?? "cash"]} · Recibo #${receiptNumberOf(payment.id)} · sin mora`
        : `Anticipo del cliente · Recibo #${receiptNumberOf(payment.id)}`,
      amountCents: payment.amountCents
    });
  }
  entries.reverse();

  return {
    totalCollectedCents: loanPayments.reduce((sum, p) => sum + p.amountCents, 0),
    installmentsPaid: cuotaNumber,
    installmentsTotal: loan.termCount,
    moraPaidCents,
    lastPaymentAt: chronological.length ? chronological[chronological.length - 1]!.paidAt : null,
    entries
  };
}

export function buildCustomerLoanSummary(view: LoanDetailView, loan: Loan): CustomerLoanSummary {
  const nextLine = view.dueTodayLines.find((line) => line.kind === "installment");
  return {
    loanId: view.id,
    code: view.code,
    principalCents: loan.principalCents,
    frequency: loan.frequency,
    installmentsPaid: view.installmentsPaid,
    installmentsTotal: view.installmentsTotal,
    nextDueDate: view.nextDueDate,
    nextAmountCents: nextLine ? view.dueTodayCents : 0
  };
}
