/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: home-dashboard "Próximas visitas list" fallback — customers whose
 * next unpaid installment isn't due yet, shown on Hoy instead of an empty
 * state when nothing is due today or overdue. Complements
 * composeRouteDay.test.ts, which covers the (non-overlapping) visits set.
 */
import { composeUpcomingCustomers } from "../lib/route/composeUpcomingCustomers";
import type { Customer } from "../lib/customers/customer.schema";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const TODAY = new Date("2026-07-16T00:00:00");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBeforeToday(n: number): Date {
  return new Date(TODAY.getTime() - n * DAY_MS);
}

function customer(overrides: Partial<Customer>): Customer {
  return {
    id: "customer-1",
    name: "Cliente",
    phone: "8091234567",
    address: "Calle 1",
    cedula: null,
    avatarKey: null,
    createdAt: daysBeforeToday(100),
    updatedAt: daysBeforeToday(100),
    ...overrides
  };
}

function loan(overrides: Partial<Loan>): Loan {
  return {
    id: "loan-1",
    customerId: "customer-1",
    principalCents: 40000,
    interestRateBps: 1000,
    termCount: 4,
    frequency: "weekly",
    startDate: daysBeforeToday(10),
    status: "active",
    notes: null,
    graceDays: null,
    createdAt: daysBeforeToday(10),
    updatedAt: daysBeforeToday(10),
    ...overrides
  };
}

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "p1",
    loanId: "loan-1",
    amountCents: 0,
    paidAt: TODAY,
    method: "cash",
    notes: null,
    createdAt: TODAY,
    ...overrides
  };
}

describe("composeUpcomingCustomers", () => {
  it("includes a customer whose next cuota is due after today", () => {
    // Arrange — weekly loan started 3 days ago: cuota 1 due in 4 more days
    const freshLoan = loan({ id: "loan-fresh", startDate: daysBeforeToday(3) });

    // Act
    const upcoming = composeUpcomingCustomers({
      customers: [customer({})],
      loans: [freshLoan],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]!.customerId).toBe("customer-1");
    expect(upcoming[0]!.nextDueDate.getTime()).toBeGreaterThan(TODAY.getTime());
    expect(upcoming[0]!.amountCents).toBeGreaterThan(0);
  });

  it("excludes loans due today or overdue — those belong to composeRouteDay's visits instead", () => {
    // Arrange — cuota due exactly today
    const dueToday = loan({ id: "loan-today", startDate: daysBeforeToday(7) });
    // Arrange — cuota overdue
    const overdue = loan({
      id: "loan-overdue",
      customerId: "customer-2",
      startDate: daysBeforeToday(10)
    });

    // Act
    const upcoming = composeUpcomingCustomers({
      customers: [customer({}), customer({ id: "customer-2" })],
      loans: [dueToday, overdue],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(upcoming).toEqual([]);
  });

  it("excludes a fully paid-off loan", () => {
    // Arrange — principal 40000 @ 1000bps/4 cuotas repays 45000 (interest
    // folded in, rounded up to the nearest 5000-cent cuota) — pay it all off
    const paidLoan = loan({ id: "loan-paid", startDate: daysBeforeToday(10) });
    const paidPayments = [
      payment({ id: "p-paid", loanId: "loan-paid", amountCents: 45000, paidAt: daysBeforeToday(5) })
    ];

    // Act
    const upcoming = composeUpcomingCustomers({
      customers: [customer({})],
      loans: [paidLoan],
      payments: paidPayments,
      today: TODAY
    });

    // Assert
    expect(upcoming).toEqual([]);
  });

  it("ignores loans that are not active", () => {
    // Arrange
    const defaultedLoan = loan({
      id: "loan-defaulted",
      status: "defaulted",
      startDate: daysBeforeToday(3)
    });

    // Act
    const upcoming = composeUpcomingCustomers({
      customers: [customer({})],
      loans: [defaultedLoan],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(upcoming).toEqual([]);
  });

  it("dedupes a customer with two upcoming loans to their soonest one", () => {
    // Arrange — customer has two active loans, both not yet due
    const soonLoan = loan({ id: "loan-soon", startDate: daysBeforeToday(3) }); // due in 4 days
    const laterLoan = loan({ id: "loan-later", startDate: daysBeforeToday(1) }); // due in 6 days

    // Act
    const upcoming = composeUpcomingCustomers({
      customers: [customer({})],
      loans: [laterLoan, soonLoan],
      payments: [],
      today: TODAY
    });

    // Assert — one entry, the soonest of the two
    expect(upcoming).toHaveLength(1);
    const soonDueDate = new Date(daysBeforeToday(3).getTime() + 7 * DAY_MS);
    expect(upcoming[0]!.nextDueDate).toEqual(soonDueDate);
  });

  it("sorts multiple customers soonest-due-first", () => {
    // Arrange
    const customerA = customer({ id: "customer-a", name: "Later Luis" });
    const loanA = loan({ id: "loan-a", customerId: "customer-a", startDate: daysBeforeToday(1) }); // due in 6 days
    const customerB = customer({ id: "customer-b", name: "Sooner Sara" });
    const loanB = loan({ id: "loan-b", customerId: "customer-b", startDate: daysBeforeToday(5) }); // due in 2 days

    // Act
    const upcoming = composeUpcomingCustomers({
      customers: [customerA, customerB],
      loans: [loanA, loanB],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(upcoming.map((c) => c.customerId)).toEqual(["customer-b", "customer-a"]);
  });
});
