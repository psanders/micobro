/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: route-view — real client composes today's route from
 * customers/loans/payments via the existing loan-schedule/mora builders.
 */
import { composeRouteDay } from "../lib/route/composeRouteDay";
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

describe("composeRouteDay", () => {
  it("returns an empty day when nothing is due or overdue", () => {
    // Arrange — loan started 3 days ago, weekly cuota1 not due for 4 more days
    const freshLoan = loan({ id: "loan-fresh", startDate: daysBeforeToday(3) });
    // Arrange — a loan fully paid off before today
    const paidLoan = loan({ id: "loan-paid", startDate: daysBeforeToday(10) });
    const paidPayments = [
      payment({ id: "p-paid", loanId: "loan-paid", amountCents: 40000, paidAt: daysBeforeToday(5) })
    ];

    // Act
    const day = composeRouteDay({
      customers: [customer({})],
      loans: [freshLoan, paidLoan],
      payments: paidPayments,
      today: TODAY
    });

    // Assert
    expect(day.visits).toEqual([]);
    expect(day.goalCents).toBe(0);
    expect(day.collectedCents).toBe(0);
    expect(day.clientCount).toBe(0);
    expect(day.pendingCount).toBe(0);
    // The fresh loan's cuota 1 isn't due for 4 more days — it surfaces as
    // an upcoming customer instead (see composeUpcomingCustomers.test.ts
    // for the dedicated coverage), never as a visit.
    expect(day.upcomingCustomers).toHaveLength(1);
    expect(day.upcomingCustomers[0]!.customerId).toBe("customer-1");
  });

  it("orders overdue before today's-due and sums the aggregates", () => {
    // Arrange — loan A: weekly cuota1 due 3 days ago (overdue), no payments
    const customerA = customer({ id: "customer-a", name: "Ana Overdue", address: "Calle A" });
    const loanA = loan({
      id: "loan-a",
      customerId: "customer-a",
      startDate: daysBeforeToday(10)
    });
    // Arrange — loan B: weekly cuota1 due exactly today, no payments
    const customerB = customer({ id: "customer-b", name: "Beto Hoy", address: "Calle B" });
    const loanB = loan({
      id: "loan-b",
      customerId: "customer-b",
      startDate: daysBeforeToday(7)
    });

    // Act
    const day = composeRouteDay({
      customers: [customerA, customerB],
      loans: [loanA, loanB],
      payments: [],
      today: TODAY
    });

    // Assert — most-overdue first, today's-due after
    expect(day.visits.map((v) => v.id)).toEqual(["route-loan-a", "route-loan-b"]);
    expect(day.visits[0]!.status).toBe("overdue");
    expect(day.visits[0]!.overdueDays).toBe(3);
    expect(day.visits[0]!.hasMora).toBe(true);
    // cuota RD$150 (flat add-on interest) + mora (0.1 * 3/30 * 15000 = 150 cents) = 15150 cents
    expect(day.visits[0]!.amountCents).toBe(15150);

    expect(day.visits[1]!.status).toBe("pending");
    expect(day.visits[1]!.hasMora).toBe(false);
    expect(day.visits[1]!.installmentLabel).toBe("Cuota 1/4");
    expect(day.visits[1]!.amountCents).toBe(15000);

    expect(day.goalCents).toBe(30150);
    expect(day.collectedCents).toBe(0);
    expect(day.clientCount).toBe(2);
    expect(day.pendingCount).toBe(2);
    // Both loans are due today or overdue — nothing left over as "upcoming"
    expect(day.upcomingCustomers).toEqual([]);
  });

  it("marks a visit done and moves it out of pendingCount once collected today", () => {
    // Arrange — same two loans as above, but loan B's cuota is paid today
    const customerA = customer({ id: "customer-a", name: "Ana Overdue" });
    const loanA = loan({ id: "loan-a", customerId: "customer-a", startDate: daysBeforeToday(10) });
    const customerB = customer({ id: "customer-b", name: "Beto Hoy" });
    const loanB = loan({ id: "loan-b", customerId: "customer-b", startDate: daysBeforeToday(7) });
    const todaysPayment = payment({
      id: "p-today",
      loanId: "loan-b",
      amountCents: 10000,
      paidAt: TODAY
    });

    // Act
    const day = composeRouteDay({
      customers: [customerA, customerB],
      loans: [loanA, loanB],
      payments: [todaysPayment],
      today: TODAY
    });

    // Assert
    const done = day.visits.find((v) => v.id === "route-loan-b")!;
    expect(done.status).toBe("done");
    expect(done.paidAt).toEqual(TODAY);

    const overdue = day.visits.find((v) => v.id === "route-loan-a")!;
    expect(overdue.status).toBe("overdue");

    // goal stays the expected total; collected reflects only today's payments
    expect(day.goalCents).toBe(30150);
    expect(day.collectedCents).toBe(10000);
    expect(day.pendingCount).toBe(1);
    expect(day.clientCount).toBe(2);
  });

  it("ignores loans that are not active", () => {
    // Arrange
    const defaultedLoan = loan({
      id: "loan-defaulted",
      status: "defaulted",
      startDate: daysBeforeToday(10)
    });

    // Act
    const day = composeRouteDay({
      customers: [customer({})],
      loans: [defaultedLoan],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(day.visits).toEqual([]);
    expect(day.upcomingCustomers).toEqual([]);
  });
});
