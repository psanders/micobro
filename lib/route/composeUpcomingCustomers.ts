/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure builder for the Hoy screen's "Próximas visitas" fallback: given
 * every customer, loan, and payment plus "today", derive the customers
 * whose next unpaid installment isn't due yet. Unlike `composeRouteDay`
 * (today's actionable route — due today or overdue), this is deliberately
 * a *different* set: loans included here are explicitly excluded from
 * `composeRouteDay`'s visits, so the two never overlap. Reuses
 * `lib/loans/loanViews.ts`'s `buildLoanDetailView` the same way
 * `composeRouteDay` does, so amounts auto-correct if that builder changes.
 *
 * Inclusion rule: an active loan's next unpaid installment must be due
 * strictly after today. A customer with more than one qualifying loan
 * gets a single entry — the one with the soonest due date.
 *
 * Ordering: ascending by next due date (soonest first).
 */
import { buildLoanDetailView } from "../loans/loanViews";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { UpcomingCustomer } from "../repo/types";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface ComposeUpcomingCustomersInput {
  customers: Customer[];
  loans: Loan[];
  payments: Payment[];
  today?: Date;
}

export function composeUpcomingCustomers({
  customers,
  loans,
  payments,
  today = new Date()
}: ComposeUpcomingCustomersInput): UpcomingCustomer[] {
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const startOfToday = startOfDay(today);

  const byCustomer = new Map<string, UpcomingCustomer>();

  for (const loan of loans) {
    if (loan.status !== "active") continue;

    const loanPayments = payments.filter((p) => p.loanId === loan.id);
    const customer = customersById.get(loan.customerId);
    const view = buildLoanDetailView({
      loan,
      customerName: customer?.name ?? "Cliente",
      business: null,
      payments: loanPayments,
      today
    });

    if (!view.nextDueDate) continue; // fully paid

    const dueDate = startOfDay(view.nextDueDate);
    if (dueDate <= startOfToday) continue; // covered by composeRouteDay's visits instead

    const existing = byCustomer.get(loan.customerId);
    if (existing && existing.nextDueDate.getTime() <= dueDate.getTime()) continue;

    byCustomer.set(loan.customerId, {
      customerId: loan.customerId,
      name: customer?.name ?? "Cliente",
      avatarKey: customer?.avatarKey ?? null,
      address: customer?.address ?? "",
      business: null,
      nextDueDate: view.nextDueDate,
      amountCents: view.dueTodayCents
    });
  }

  return Array.from(byCustomer.values()).sort(
    (a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime()
  );
}
