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
    graceDays: null,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: null,
    penaltyCents: null,
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
    tipo: "cuota",
    createdAt: TODAY,
    ...overrides
  };
}

describe("composeRouteDay", () => {
  it("leaves an archived loan out of the route, the goal and upcoming customers", () => {
    // Arrange — same overdue shape as a real visit, but archived (loan-edit-archive)
    const archived = loan({ id: "loan-archived", status: "cancelled", graceDays: 0 });

    // Act
    const day = composeRouteDay({
      customers: [customer({})],
      loans: [archived],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(day.visits).toEqual([]);
    expect(day.goalCents).toBe(0);
    expect(day.upcomingCustomers).toEqual([]);
  });

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
    // Arrange — loan A: weekly cuota1 due 3 days ago (overdue), no payments.
    // graceDays: 0 keeps this test's mora numbers exactly as before grace
    // was wired in — its own default-grace behavior is covered separately
    // below ("flags a cuota overdue immediately, but withholds mora...").
    const customerA = customer({ id: "customer-a", name: "Ana Overdue", address: "Calle A" });
    const loanA = loan({
      id: "loan-a",
      customerId: "customer-a",
      startDate: daysBeforeToday(10),
      graceDays: 0
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
    // cuota RD$110 (flat add-on interest) + mora (0.1 * 3/30 * 11000 = 110 cents,
    // rounded to RD$1) = 11100 cents
    expect(day.visits[0]!.amountCents).toBe(11100);

    expect(day.visits[1]!.status).toBe("pending");
    expect(day.visits[1]!.hasMora).toBe(false);
    expect(day.visits[1]!.installmentLabel).toBe("Cuota 1/4");
    expect(day.visits[1]!.amountCents).toBe(11000);

    expect(day.goalCents).toBe(22100);
    expect(day.collectedCents).toBe(0);
    expect(day.clientCount).toBe(2);
    expect(day.pendingCount).toBe(2);
    // Both loans are due today or overdue — nothing left over as "upcoming"
    expect(day.upcomingCustomers).toEqual([]);
  });

  it("flags a cuota overdue immediately, but withholds mora until the grace period elapses", () => {
    // Arrange — loan A: weekly cuota1 due 3 days ago, still inside the
    // default 7-day grace — the visit is "overdue" (needs a collection
    // visit today) but no late fee has accrued yet.
    const loanA = loan({ id: "loan-a", startDate: daysBeforeToday(10) });

    // Act
    const day = composeRouteDay({
      customers: [customer({})],
      loans: [loanA],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(day.visits[0]!.status).toBe("overdue");
    expect(day.visits[0]!.overdueDays).toBe(3);
    expect(day.visits[0]!.hasMora).toBe(false);
    expect(day.visits[0]!.amountCents).toBe(11000);
  });

  it("respects a loan's own grace-period override", () => {
    // Arrange — same 3-days-overdue loan, but this lender configured a
    // zero-day grace for it, so mora accrues right away.
    const loanA = loan({ id: "loan-a", startDate: daysBeforeToday(10), graceDays: 0 });

    // Act
    const day = composeRouteDay({
      customers: [customer({})],
      loans: [loanA],
      payments: [],
      today: TODAY
    });

    // Assert — mora (0.1 * 3/30 * 11000 = 110 cents, rounded to RD$1) on top of the cuota
    expect(day.visits[0]!.hasMora).toBe(true);
    expect(day.visits[0]!.amountCents).toBe(11100);
  });

  it("marks a visit done and moves it out of pendingCount once collected today", () => {
    // Arrange — same two loans as above, but loan B's cuota is paid today
    const customerA = customer({ id: "customer-a", name: "Ana Overdue" });
    const loanA = loan({
      id: "loan-a",
      customerId: "customer-a",
      startDate: daysBeforeToday(10),
      graceDays: 0
    });
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
    expect(day.goalCents).toBe(22100);
    expect(day.collectedCents).toBe(10000);
    expect(day.pendingCount).toBe(1);
    expect(day.clientCount).toBe(2);
  });

  it("puts a Tradicional Plus loan with owed penalties on the route as overdue for the penalties", () => {
    // Arrange — quincenal, cycles due 20 and 5 days ago, both past their 3
    // días de gracia: two owed penalties (RD$600), no mora
    const plus = loan({
      frequency: "biweekly",
      startDate: daysBeforeToday(35),
      termCount: 4,
      graceDays: 3,
      moraEnabled: false,
      loanType: "term_plus",
      penaltyCents: 30000
    });

    // Act
    const day = composeRouteDay({
      customers: [customer({})],
      loans: [plus],
      payments: [],
      today: TODAY
    });

    // Assert
    expect(day.visits).toHaveLength(1);
    expect(day.visits[0]).toMatchObject({
      status: "overdue",
      overdueDays: 20,
      amountCents: 60000,
      hasMora: false
    });
  });

  it("moves a Tradicional Plus loan off today's route once its penalty is paid", () => {
    // Arrange — cycle due yesterday, penalty paid before today: next cycle in 14 days
    const plus = loan({
      frequency: "biweekly",
      startDate: daysBeforeToday(16),
      termCount: 4,
      graceDays: 3,
      moraEnabled: false,
      loanType: "term_plus",
      penaltyCents: 30000
    });
    const penalty = payment({
      amountCents: 30000,
      tipo: "penalidad",
      paidAt: daysBeforeToday(1),
      createdAt: daysBeforeToday(1)
    });

    // Act
    const day = composeRouteDay({
      customers: [customer({})],
      loans: [plus],
      payments: [penalty],
      today: TODAY
    });

    // Assert
    expect(day.visits).toHaveLength(0);
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

  // Issue #81: open-credit loans were silently dropped from the route —
  // composeRouteDay ran every loan through the term-only
  // `buildLoanDetailView`, which reports no next due date at all for a loan
  // stored with `termCount: 0`.
  describe("open-credit loans", () => {
    // RD$10,000 @ 5% weekly, disbursed a week ago: cycle 1's RD$500 interest
    // falls due today.
    function openCreditLoan(overrides: Partial<Loan> = {}): Loan {
      return loan({
        id: "loan-oc",
        principalCents: 1000000,
        interestRateBps: 500,
        termCount: 0,
        frequency: "weekly",
        loanType: "open_credit",
        penaltyCents: null,
        startDate: daysBeforeToday(7),
        ...overrides
      });
    }

    it("visits an open-credit loan on the day its cycle interest falls due", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan()],
        payments: [],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({
        customerId: "customer-1",
        amountCents: 50000, // the cycle's RD$500 interest
        hasMora: false, // open credit never accrues mora
        status: "pending",
        installmentLabel: "Interés del ciclo"
      });
      expect(day.goalCents).toBe(50000);
      expect(day.pendingCount).toBe(1);
    });

    it("marks the visit done once the interest is collected today", () => {
      const payments = [
        payment({ id: "p-oc", loanId: "loan-oc", amountCents: 50000, paidAt: TODAY })
      ];

      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan()],
        payments,
        today: TODAY
      });

      // Today's cobro must not erase the visit — it flips it to done.
      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]?.status).toBe("done");
      expect(day.collectedCents).toBe(50000);
      expect(day.pendingCount).toBe(0);
    });

    it("does not visit an open-credit loan before its cycle comes due", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan({ startDate: daysBeforeToday(3) })],
        payments: [],
        today: TODAY
      });

      expect(day.visits).toEqual([]);
      // ...it shows up under "Próximas visitas" instead.
      expect(day.upcomingCustomers).toHaveLength(1);
      expect(day.upcomingCustomers[0]).toMatchObject({
        customerId: "customer-1",
        amountCents: 50000
      });
    });

    it("does not visit an open-credit loan whose capital is paid off", () => {
      const payments = [
        payment({
          id: "p-oc-settle",
          loanId: "loan-oc",
          amountCents: 1050000, // interest + the full RD$10,000 capital
          paidAt: daysBeforeToday(2)
        })
      ];

      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan()],
        payments,
        today: TODAY
      });

      expect(day.visits).toEqual([]);
    });
  });

  // Issue #215: "Vencidos" means the loan is past its end date — the same
  // `loanEndDate()` the receipt prints as "Vencimiento" — not "more than 5
  // days late on the oldest cuota". `daysPastEnd` carries that count.
  describe("days past the loan's end date", () => {
    // Weekly 4-cuota loan disbursed 31 days ago: cuotas due 24, 17, 10 and 3
    // days ago, so the loan ended 3 days ago. Cuota = RD$110.
    function endedLoan(overrides: Partial<Loan> = {}): Loan {
      return loan({ startDate: daysBeforeToday(31), ...overrides });
    }

    it("counts whole days since the end date on a loan past its last cuota", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [endedLoan()],
        payments: [],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({ status: "overdue", overdueDays: 24, daysPastEnd: 3 });
    });

    it("counts from the start of the end date's day, whatever the loan's time of day", () => {
      const start = daysBeforeToday(31);
      start.setHours(15, 30, 0, 0);

      const day = composeRouteDay({
        customers: [customer({})],
        loans: [endedLoan({ startDate: start })],
        payments: [],
        today: TODAY
      });

      expect(day.visits[0]!.daysPastEnd).toBe(3);
    });

    it("is not past its end date on the day the last cuota falls due", () => {
      const threeCuotas = payment({
        amountCents: 33000,
        paidAt: daysBeforeToday(2),
        createdAt: daysBeforeToday(2)
      });

      const day = composeRouteDay({
        customers: [customer({})],
        loans: [loan({ startDate: daysBeforeToday(28) })],
        payments: [threeCuotas],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({ status: "pending", installmentLabel: "Cuota 4/4" });
      expect(day.visits[0]!.daysPastEnd).toBeUndefined();
    });

    it("leaves a mid-term loan that is weeks late without days past end", () => {
      // Monthly 12-cuota loan: first cuota about 20 days late, end date ~10 months out
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [loan({ frequency: "monthly", termCount: 12, startDate: daysBeforeToday(50) })],
        payments: [],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]!.status).toBe("overdue");
      expect(day.visits[0]!.overdueDays).toBeGreaterThan(5);
      expect(day.visits[0]!.daysPastEnd).toBeUndefined();
    });

    it("never sets days past end on an open-credit loan", () => {
      // Three weekly cycles in with no interest paid: the unpaid interest
      // rolls into the cycle that falls due today.
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [
          loan({
            principalCents: 1000000,
            interestRateBps: 500,
            termCount: 0,
            loanType: "open_credit",
            startDate: daysBeforeToday(21)
          })
        ],
        payments: [],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]!.daysPastEnd).toBeUndefined();
    });

    it("follows a Tradicional Plus end date that a paid penalty moved past today", () => {
      // Quincenal (15-day cycles), 4 cycles from 64 days ago: originally
      // ended 4 days ago. One penalty paid moves every unpaid cuota a cycle:
      // it now ends in 11 days.
      const plus = loan({
        frequency: "biweekly",
        startDate: daysBeforeToday(64),
        termCount: 4,
        graceDays: 3,
        moraEnabled: false,
        loanType: "term_plus",
        penaltyCents: 30000
      });
      const penalty = payment({
        amountCents: 30000,
        tipo: "penalidad",
        paidAt: daysBeforeToday(5),
        createdAt: daysBeforeToday(5)
      });

      const withoutPenalty = composeRouteDay({
        customers: [customer({})],
        loans: [plus],
        payments: [],
        today: TODAY
      });
      const withPenalty = composeRouteDay({
        customers: [customer({})],
        loans: [plus],
        payments: [penalty],
        today: TODAY
      });

      expect(withoutPenalty.visits[0]!.daysPastEnd).toBe(4);
      expect(withPenalty.visits).toHaveLength(1);
      expect(withPenalty.visits[0]!.status).toBe("overdue");
      expect(withPenalty.visits[0]!.daysPastEnd).toBeUndefined();
    });

    it("marks a loan past its end date done once collected today", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [endedLoan()],
        payments: [payment({ amountCents: 11000, paidAt: TODAY })],
        today: TODAY
      });

      expect(day.visits[0]).toMatchObject({ status: "done", daysPastEnd: 3 });
    });
  });

  // Issue: Mi ruta's "Hechas" left out payments collected today on loans
  // that weren't due today — common for crédito abierto (early interest,
  // capital mid-cycle), occasional for an early term cuota.
  describe("payments today on loans not due today", () => {
    function openCreditLoan(overrides: Partial<Loan> = {}): Loan {
      return loan({
        id: "loan-oc",
        principalCents: 1000000,
        interestRateBps: 500,
        termCount: 0,
        frequency: "weekly",
        loanType: "open_credit",
        startDate: daysBeforeToday(5),
        ...overrides
      });
    }

    it("lists early crédito abierto interest as a done visit", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan()],
        payments: [payment({ id: "p-oc", loanId: "loan-oc", amountCents: 50000 })],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({
        id: "route-loan-oc",
        status: "done",
        amountCents: 50000,
        paidAt: TODAY,
        hasMora: false
      });
      expect(day.visits[0]).not.toHaveProperty("installmentLabel");
      expect(day.visits[0]).not.toHaveProperty("overdueDays");
      expect(day.goalCents).toBe(50000);
      expect(day.collectedCents).toBe(50000);
      expect(day.clientCount).toBe(1);
      expect(day.pendingCount).toBe(0);
    });

    it("lists a mid-cycle capital payment as a done visit for what was collected", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan({ startDate: daysBeforeToday(3) })],
        payments: [payment({ id: "p-cap", loanId: "loan-oc", amountCents: 200000 })],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({ status: "done", amountCents: 200000 });
    });

    it("lists a term cuota paid a day early as a done visit", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [loan({ startDate: daysBeforeToday(6) })],
        payments: [payment({ amountCents: 11000 })],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({ status: "done", amountCents: 11000 });
      expect(day.pendingCount).toBe(0);
    });

    it("sorts the not-due visit after the due ones", () => {
      const day = composeRouteDay({
        customers: [customer({}), customer({ id: "customer-2", name: "Otro" })],
        loans: [
          openCreditLoan({ customerId: "customer-2" }),
          loan({ startDate: daysBeforeToday(7) })
        ],
        payments: [payment({ id: "p-oc", loanId: "loan-oc", amountCents: 50000 })],
        today: TODAY
      });

      expect(day.visits.map((v) => v.id)).toEqual(["route-loan-1", "route-loan-oc"]);
      expect(day.visits.map((v) => v.status)).toEqual(["pending", "done"]);
    });

    it("lists a crédito abierto settled in full today, mid-cycle", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan({ startDate: daysBeforeToday(3) })],
        payments: [payment({ id: "p-settle", loanId: "loan-oc", amountCents: 1050000 })],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({ status: "done", amountCents: 1050000 });
      expect(day.collectedCents).toBe(1050000);
    });

    it("lists a term loan prepaid in full today", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [loan({ startDate: daysBeforeToday(6) })],
        payments: [payment({ amountCents: 44000 })],
        today: TODAY
      });

      expect(day.visits).toHaveLength(1);
      expect(day.visits[0]).toMatchObject({ status: "done", amountCents: 44000 });
      expect(day.collectedCents).toBe(44000);
    });

    it("counts one client when the same customer has a due loan and a not-due paid one", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan(), loan({ startDate: daysBeforeToday(7) })],
        payments: [payment({ id: "p-oc", loanId: "loan-oc", amountCents: 50000 })],
        today: TODAY
      });

      expect(day.visits).toHaveLength(2);
      expect(day.clientCount).toBe(1);
    });

    it("leaves out a not-due loan with no payment today", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan()],
        payments: [],
        today: TODAY
      });

      expect(day.visits).toEqual([]);
    });

    it("leaves out an archived loan even with a payment today", () => {
      const day = composeRouteDay({
        customers: [customer({})],
        loans: [openCreditLoan({ status: "cancelled" })],
        payments: [payment({ id: "p-oc", loanId: "loan-oc", amountCents: 50000 })],
        today: TODAY
      });

      expect(day.visits).toEqual([]);
    });
  });
});
