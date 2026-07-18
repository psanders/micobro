/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure builder for today's collection route: given every customer, loan,
 * and payment plus "today", derive which loans should be visited and in
 * what order. This never recomputes loan math itself — it composes the
 * existing `lib/loans/loanViews.ts` (schedule + "Total a pagar hoy") and
 * `lib/loans/mora.ts` (accrued mora) builders per loan, the same way
 * `getLoanDetailView` does for the Préstamo Detalle screen. Amounts and
 * mora auto-correct if those builders change.
 *
 * Inclusion rule: an active loan gets a visit when its earliest unpaid
 * installment (as of *before* today's payments) is due today or overdue.
 * Payments made today are excluded from that "as of" snapshot on purpose —
 * otherwise a cobro collected this morning would erase the loan's
 * `nextDueDate` and the visit would vanish from the route instead of
 * showing as done. Today's payments are re-introduced afterward only to
 * decide the visit's status (done vs. pending/overdue) and to sum
 * `collectedCents`.
 *
 * Ordering: ascending by the earliest unpaid due date — overdue loans
 * (due date < today) sort before today's-due loans (due date === today)
 * for free, since overdue due dates are always earlier.
 *
 * Alongside `visits`, this also composes `upcomingCustomers` — the
 * customers this same loan set would visit *later* (next unpaid
 * installment due after today), via the sibling pure builder
 * `composeUpcomingCustomers.ts`. It's a distinct, non-overlapping set from
 * `visits` and never affects `goalCents`/`collectedCents`/`clientCount`/
 * `pendingCount`; it exists purely so the Hoy screen has something to show
 * instead of an empty state when `visits` is empty. Mi Ruta ignores it.
 */
import { buildLoanDetailView } from "../loans/loanViews";
import { computeLoanMora } from "../loans/mora";
import { composeUpcomingCustomers } from "./composeUpcomingCustomers";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { RouteDay, RouteVisit } from "../repo/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface ComposeRouteDayInput {
  customers: Customer[];
  loans: Loan[];
  payments: Payment[];
  today?: Date;
}

interface VisitCandidate {
  visit: RouteVisit;
  dueDate: Date;
  collectedTodayCents: number;
}

export function composeRouteDay({
  customers,
  loans,
  payments,
  today = new Date()
}: ComposeRouteDayInput): RouteDay {
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const startOfToday = startOfDay(today);

  const candidates: VisitCandidate[] = [];

  for (const loan of loans) {
    if (loan.status !== "active") continue;

    const loanPayments = payments.filter((p) => p.loanId === loan.id);
    const paymentsBeforeToday = loanPayments.filter((p) => !isSameDay(p.paidAt, today));
    const paymentsToday = loanPayments.filter((p) => isSameDay(p.paidAt, today));

    const customer = customersById.get(loan.customerId);
    const { moraCents, moraDays } = computeLoanMora(loan, paymentsBeforeToday, today);
    const view = buildLoanDetailView({
      loan,
      customerName: customer?.name ?? "Cliente",
      business: null,
      payments: paymentsBeforeToday,
      moraCents,
      moraDays,
      today
    });

    if (!view.nextDueDate) continue; // fully paid as of before today

    const dueDate = startOfDay(view.nextDueDate);
    if (dueDate > startOfToday) continue; // next cuota isn't due yet

    const isOverdue = dueDate < startOfToday;
    const overdueDays = isOverdue
      ? Math.round((startOfToday.getTime() - dueDate.getTime()) / DAY_MS)
      : undefined;

    const collectedTodayCents = paymentsToday.reduce((sum, p) => sum + p.amountCents, 0);

    const visit: RouteVisit = {
      id: `route-${loan.id}`,
      customerId: loan.customerId,
      name: customer?.name ?? "Cliente",
      business: null,
      address: customer?.address ?? "",
      avatarKey: null,
      amountCents: view.dueTodayCents,
      hasMora: moraCents > 0,
      status: collectedTodayCents > 0 ? "done" : isOverdue ? "overdue" : "pending",
      ...(isOverdue ? { overdueDays } : {}),
      ...(collectedTodayCents > 0
        ? { paidAt: paymentsToday.reduce((a, b) => (a.paidAt > b.paidAt ? a : b)).paidAt }
        : {}),
      ...(!isOverdue && collectedTodayCents === 0
        ? { installmentLabel: `Cuota ${view.installmentsPaid + 1}/${view.installmentsTotal}` }
        : {})
    };

    candidates.push({ visit, dueDate, collectedTodayCents });
  }

  candidates.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const visits = candidates.map((c) => c.visit);
  const goalCents = visits.reduce((sum, v) => sum + v.amountCents, 0);
  const collectedCents = candidates.reduce((sum, c) => sum + c.collectedTodayCents, 0);
  const clientCount = new Set(visits.map((v) => v.customerId)).size;
  const pendingCount = visits.filter((v) => v.status !== "done").length;

  return {
    date: today,
    goalCents,
    collectedCents,
    clientCount,
    pendingCount,
    visits,
    upcomingCustomers: composeUpcomingCustomers({ customers, loans, payments, today })
  };
}
