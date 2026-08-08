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
import { effectiveLoanType } from "./loan.schema";
import type { Loan, LoanFrequency } from "./loan.schema";
import type { Customer } from "../customers/customer.schema";
import type { Payment } from "../payments/payment.schema";
import type { OpenCreditCycle, OpenCreditState } from "./openCredit";
import type {
  CustomerLoanSummary,
  DueTodayLine,
  LoanDetailView,
  LoanScheduleItem,
  PaymentHistoryEntry,
  PaymentHistoryView,
  PaymentReceipt,
  ReceiptLine
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
 * "Cuota 1/42" — the current installment against the loan's total cuota
 * count, shared by the digital receipt (`ReceiptView`) and the printed
 * thermal receipt (`lib/printer.ts`), which both render whatever label
 * `CollectPaymentScreen` puts in the receipt line — see issue #64.
 */
export function cuotaLabel(currentInstallmentNumber: number, installmentsTotal: number): string {
  return `Cuota ${currentInstallmentNumber}/${installmentsTotal}`;
}

/**
 * `date` shifted by `count` payment intervals for `frequency` (monthly
 * shifts by calendar months, everything else by a fixed day count).
 * `count` may be negative to shift backward.
 *
 * Monthly is anchor-preserving: the day-of-month is `date`'s, clamped to
 * the target month's last day when that month is too short (31 Jul → 30
 * Sep for +2), but a later month long enough for the original day returns
 * to it rather than staying clamped (31 Jul → 31 Oct for +3) — see issue
 * #110. `date.getDate()` is only ever the anchor because every caller
 * passes the loan's original `startDate` as `date` with an increasing
 * `count`, never the previous call's result.
 *
 * Shared by `installmentDueDate` (schedule math) and the new-loan form's
 * "primer pago" default/override, so both agree on what "one interval"
 * means per frequency.
 */
export function addFrequencyInterval(date: Date, frequency: LoanFrequency, count: number): Date {
  if (frequency === "monthly") {
    const anchorDay = date.getDate();
    const due = new Date(date);
    due.setDate(1); // avoid overflow while shifting the month
    due.setMonth(due.getMonth() + count);
    const daysInTargetMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
    due.setDate(Math.min(anchorDay, daysInTargetMonth));
    return due;
  }
  const days = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 15;
  return new Date(date.getTime() + count * days * DAY_MS);
}

/**
 * `date` shifted forward by `count` non-Sunday calendar days: Sundays are
 * walked over (never counted, never returned) so the result always lands
 * on a Monday–Saturday. Used for daily loans with `skipSundays` on, where
 * a naive `addFrequencyInterval` could land a cuota on a Sunday.
 */
export function addNonSundayDays(date: Date, count: number): Date {
  let result = new Date(date);
  let remaining = count;
  while (remaining > 0) {
    result = new Date(result.getTime() + DAY_MS);
    if (result.getDay() !== 0) {
      remaining -= 1;
    }
  }
  return result;
}

export function installmentDueDate(loan: Loan, number: number): Date {
  if (loan.frequency === "daily" && loan.skipSundays) {
    return addNonSundayDays(new Date(loan.startDate), number);
  }
  return addFrequencyInterval(new Date(loan.startDate), loan.frequency, number);
}

/**
 * The loan's end date — the last scheduled cuota's due date, same as
 * `buildLoanDetailView`'s `endDate`. `null` for a crédito abierto loan,
 * which has no fixed term (empty schedule) — shared by `buildPaymentReceipt`
 * and `collectPayment`/the mock repo's `collect`, both of which need it
 * without building the whole schedule.
 */
export function loanEndDate(loan: Loan): Date | null {
  if (effectiveLoanType(loan) !== "term" || loan.termCount <= 0) return null;
  return installmentDueDate(loan, loan.termCount);
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

/**
 * `defaultFirstPaymentDate`, except for a skip-Sundays daily loan, where the
 * floor itself must be a non-Sunday day so it agrees with
 * `installmentDueDate(loan, 1)` (which walks the schedule the same way).
 * Used by the new-loan form as both the "primer pago" calendar's minimum
 * selectable date and the value it resets to on a frequency change.
 */
export function healthyFirstPaymentFloor(
  frequency: LoanFrequency,
  skipSundays: boolean,
  from: Date = new Date()
): Date {
  return frequency === "daily" && skipSundays
    ? addNonSundayDays(from, 1)
    : defaultFirstPaymentDate(frequency, from);
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
    schedule,
    // Callers building an open-credit view override this after the fact
    // (buildLoanDetailView's cuota/schedule math is term-only) — see
    // getLoanDetailView.ts / repo/mock/index.ts's viewOf.
    openCredit: null
  };
}

/**
 * Receipt number for every payment row, assigned by creation order across
 * the whole `payments` table — matching how `collectPayment` mints them
 * (`R-${index in the whole table}`).
 */
export function buildReceiptNumberIndex(allPayments: Payment[]): Map<string, string> {
  const byCreatedAt = [...allPayments].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  return new Map(byCreatedAt.map((p, i) => [p.id, `R-${String(i + 1).padStart(5, "0")}`]));
}

/**
 * One cobro (`collectPayment.ts`) can write up to two payment rows — a mora
 * row and an installment row — sharing one `loanId` and one `paidAt`
 * instant. Both should read as the same receipt: this returns the
 * canonical (lower, i.e. earliest-written) receipt number for every row in
 * `loanPayments`, keyed by payment id, using the per-row numbers from
 * `buildReceiptNumberIndex`.
 */
export function canonicalReceiptNumbers(
  loanPayments: Payment[],
  receiptNumberIndex: Map<string, string>
): Map<string, string> {
  const byTimestamp = new Map<number, Payment[]>();
  for (const payment of loanPayments) {
    const key = payment.paidAt.getTime();
    const group = byTimestamp.get(key) ?? [];
    group.push(payment);
    byTimestamp.set(key, group);
  }
  const canonical = new Map<string, string>();
  for (const group of byTimestamp.values()) {
    const numbers = group.map((p) => receiptNumberIndex.get(p.id) ?? "");
    const lowest = numbers.reduce((a, b) => (a <= b ? a : b));
    for (const payment of group) canonical.set(payment.id, lowest);
  }
  return canonical;
}

/**
 * Which cuota number (1-based, among full-cuota payments only) each
 * non-mora `loanPayments` row is, in chronological order — shared by
 * `buildPaymentHistoryView` (list label "Cuota N") and `buildPaymentReceipt`
 * (receipt label "Cuota N/Total", via `cuotaLabel`, matching the live
 * just-collected receipt's format).
 */
function cuotaNumbersByPaymentId(loan: Loan, loanPayments: Payment[]): Map<string, number> {
  const cuota = cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  const chronological = [...loanPayments].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
  let cuotaNumber = 0;
  const numbers = new Map<string, number>();
  for (const payment of chronological) {
    if (payment.notes === MORA_NOTE) continue;
    if (payment.amountCents >= cuota) {
      cuotaNumber += 1;
      numbers.set(payment.id, cuotaNumber);
    }
  }
  return numbers;
}

/**
 * Histórico de Pagos for one loan. `allPayments` is the whole payments
 * table (not just this loan's) because receipt numbers are assigned by
 * creation order across every loan (see `buildReceiptNumberIndex`).
 */
export function buildPaymentHistoryView(loan: Loan, allPayments: Payment[]): PaymentHistoryView {
  const receiptNumberIndex = buildReceiptNumberIndex(allPayments);

  const loanPayments = allPayments.filter((p) => p.loanId === loan.id);
  const receiptNumberOf = canonicalReceiptNumbers(loanPayments, receiptNumberIndex);
  const cuotaNumbers = cuotaNumbersByPaymentId(loan, loanPayments);
  const chronological = [...loanPayments].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

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
        subLabel: `${methodLabels[payment.method ?? "cash"]} · Recibo #${receiptNumberOf.get(payment.id)}`,
        amountCents: payment.amountCents
      });
      continue;
    }
    const cuotaNumber = cuotaNumbers.get(payment.id);
    entries.push({
      id: payment.id,
      date: payment.paidAt,
      label: cuotaNumber ? `Cuota ${cuotaNumber}` : "Abono a cuenta",
      subLabel: cuotaNumber
        ? `Pago completo · ${methodLabels[payment.method ?? "cash"]} · Recibo #${receiptNumberOf.get(payment.id)} · sin mora`
        : `Anticipo del cliente · Recibo #${receiptNumberOf.get(payment.id)}`,
      amountCents: payment.amountCents
    });
  }
  entries.reverse();

  return {
    totalCollectedCents: loanPayments.reduce((sum, p) => sum + p.amountCents, 0),
    installmentsPaid: cuotaNumbers.size,
    installmentsTotal: loan.termCount,
    moraPaidCents,
    lastPaymentAt: chronological.length ? chronological[chronological.length - 1]!.paidAt : null,
    entries
  };
}

/**
 * Reconstructs the receipt for a past cobro — the same shape
 * `collectPayment.ts` returns right after collecting, rebuilt from the
 * stored rows for the Histórico de Pagos "Ver recibo" screen. `paymentId`
 * may be either sibling row of a combined mora+installment cobro (see
 * `canonicalReceiptNumbers`); both resolve to the same receipt, combining
 * both amounts into separate lines. Returns `null` if `paymentId` doesn't
 * belong to `loan`.
 */
export function buildPaymentReceipt(
  paymentId: string,
  loan: Loan,
  customer: Customer,
  allPayments: Payment[]
): PaymentReceipt | null {
  const target = allPayments.find((p) => p.id === paymentId && p.loanId === loan.id);
  if (!target) return null;

  const loanPayments = allPayments.filter((p) => p.loanId === loan.id);
  const siblings = loanPayments.filter((p) => p.paidAt.getTime() === target.paidAt.getTime());

  const receiptNumberIndex = buildReceiptNumberIndex(allPayments);
  const canonicalNumbers = canonicalReceiptNumbers(loanPayments, receiptNumberIndex);
  const cuotaNumbers = cuotaNumbersByPaymentId(loan, loanPayments);

  const lines: ReceiptLine[] = [...siblings]
    .sort((a, b) => (a.notes === MORA_NOTE ? 0 : 1) - (b.notes === MORA_NOTE ? 0 : 1))
    .map((p) => {
      if (p.notes === MORA_NOTE) return { label: "Mora (prioridad)", amountCents: p.amountCents };
      const cuotaNumber = cuotaNumbers.get(p.id);
      const label = cuotaNumber ? cuotaLabel(cuotaNumber, loan.termCount) : "Abono a cuenta";
      return { label, amountCents: p.amountCents };
    });

  return {
    paymentId: target.id,
    receiptNumber: canonicalNumbers.get(target.id) ?? "",
    paidAt: target.paidAt,
    totalCents: siblings.reduce((sum, p) => sum + p.amountCents, 0),
    method: target.method ?? "cash",
    customerName: customer.name,
    lines,
    loanStartDate: loan.startDate,
    loanEndDate: loanEndDate(loan),
    isOpenCredit: effectiveLoanType(loan) === "open_credit"
  };
}

/**
 * Which cycle (1-based `OpenCreditCycle.index`) a payment falls in, by the
 * same `[start, end]` calendar-day window `openCreditState` matches
 * internally (cycle 1 also owns the disbursement day itself — see
 * `lib/loans/openCredit.ts`). Shared by `getCustomerDetail.ts` and the mock
 * repo's `getDetail` for the "Pago ciclo N" activity label; `cycles` should
 * already be the loan's own `openCreditState(...).cycles`. Falls back to
 * the last cycle for a payment that (in principle) shouldn't land outside
 * every replayed window.
 */
export function cycleIndexForPayment(cycles: OpenCreditCycle[], payment: Payment): number {
  const day = startOfDayMs(payment.paidAt);
  for (const cycle of cycles) {
    const startDay = startOfDayMs(cycle.start);
    const dueDay = startOfDayMs(cycle.end);
    const ownsDay = (cycle.index === 1 ? day >= startDay : day > startDay) && day <= dueDay;
    if (ownsDay) return cycle.index;
  }
  return cycles[cycles.length - 1]?.index ?? 1;
}

function startOfDayMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Ratio of capital repaid, clamped to `[0, 1]` — capitalized interest can
 * grow the balance past the original principal (negative raw ratio) or, in
 * principle, a zero-principal loan (division guard); both must read 0%,
 * never negative or NaN.
 */
function capitalPaidRatio(principalCents: number, balanceCents: number): number {
  if (principalCents <= 0) return 0;
  const raw = 1 - balanceCents / principalCents;
  return Math.min(1, Math.max(0, raw));
}

/**
 * The Cliente Detalle loan-card summary. For a term loan, `installmentsPaid`/
 * `installmentsTotal` drive the "Cuota N de Total" vocabulary as before. For
 * an open-credit loan — signaled by passing its `openCredit` state (from
 * `openCreditState`, see `lib/loans/openCredit.ts`) — the term-only cuota
 * fields are meaningless and left at 0; `nextDueDate`/`nextAmountCents`
 * instead carry the next cycle's due date/interest, and `openCredit` carries
 * the rate and capital-paid ratio the card renders instead of a cuota count.
 */
export function buildCustomerLoanSummary(
  view: LoanDetailView,
  loan: Loan,
  openCredit?: OpenCreditState
): CustomerLoanSummary {
  if (openCredit) {
    return {
      loanId: view.id,
      code: view.code,
      principalCents: loan.principalCents,
      frequency: loan.frequency,
      installmentsPaid: 0,
      installmentsTotal: 0,
      nextDueDate: openCredit.nextDueDate,
      nextAmountCents: openCredit.interestDueCents,
      openCredit: {
        interestRateBps: loan.interestRateBps,
        balanceCents: openCredit.balanceCents,
        capitalPaidRatio: capitalPaidRatio(loan.principalCents, openCredit.balanceCents)
      }
    };
  }

  const nextLine = view.dueTodayLines.find((line) => line.kind === "installment");
  return {
    loanId: view.id,
    code: view.code,
    principalCents: loan.principalCents,
    frequency: loan.frequency,
    installmentsPaid: view.installmentsPaid,
    installmentsTotal: view.installmentsTotal,
    nextDueDate: view.nextDueDate,
    nextAmountCents: nextLine ? view.dueTodayCents : 0,
    openCredit: null
  };
}
