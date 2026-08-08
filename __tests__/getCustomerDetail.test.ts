/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: customer-detail "Customer profile card" — cédula/avatarKey now come
 * off the customers row instead of always being null in real mode.
 * Spec: customer-detail "Active loans section" / "Recent visits section" —
 * open-credit loans carry a capital-paid ratio + next-cycle interest
 * instead of a cuota count, never accrue mora, and their payments read
 * "Pago ciclo N" instead of "Pago cuota N".
 */
import { createGetCustomerDetail } from "../lib/customers/getCustomerDetail";
import { addFrequencyInterval } from "../lib/loans/loanViews";
import { ValidationError } from "../lib/errors/ValidationError";
import { customers, loans, payments, visits } from "../lib/db/schema";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";
import type { Database } from "../lib/db/client";

const baseCustomerRow = {
  id: "customer-1",
  name: "Juana Pérez",
  phone: "8091234567",
  address: "Calle Duarte 12",
  cedula: "00112345678",
  avatarKey: "female2",
  createdAt: new Date("2024-04-12T10:00:00"),
  updatedAt: new Date("2024-04-12T10:00:00")
};

/** Midnight-aligned so day-boundary math in computeLoanMora/openCreditState
 * is deterministic, mirroring getLoanDetailView.test.ts's helper — neither
 * function accepts an injected "today", so fixture dates are anchored to
 * the real clock at test-run time instead of a fixed calendar date. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function loanRow(overrides: Partial<Loan>): Loan {
  return {
    id: "loan-1",
    customerId: "customer-1",
    principalCents: 2880000,
    interestRateBps: 1200,
    termCount: 12,
    frequency: "weekly",
    startDate: daysAgo(31),
    status: "active",
    notes: null,
    graceDays: null,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: null,
    createdAt: daysAgo(31),
    updatedAt: daysAgo(31),
    ...overrides
  };
}

function paymentRow(overrides: Partial<Payment>): Payment {
  return {
    id: "p1",
    loanId: "loan-1",
    amountCents: 270000,
    paidAt: daysAgo(24),
    method: "cash",
    notes: null,
    createdAt: daysAgo(24),
    ...overrides
  };
}

// RD$10,000 @ 5% per cycle (500 bps), weekly, disbursed exactly one cycle
// ago — cycle 1 is completed as of "now" (see lib/loans/openCredit.ts and
// getLoanDetailView.test.ts, which shares this exact fixture).
const openCreditLoanRow = loanRow({
  id: "loan-oc-1",
  principalCents: 1000000,
  interestRateBps: 500,
  termCount: 0,
  frequency: "weekly",
  startDate: daysAgo(8),
  loanType: "open_credit",
  createdAt: daysAgo(8),
  updatedAt: daysAgo(8)
});

/**
 * `db.select().from(table).where(...)` stub. `paymentsPerLoan` is consumed
 * in call order — one array per loan, matching `getCustomerDetail`'s
 * per-loan `payments` query in `customerLoans` order — since the real
 * `eq(payments.loanId, loan.id)` filter has no effect on this in-memory
 * double.
 */
function makeDbStub(rows: {
  customers?: unknown[];
  loans?: unknown[];
  paymentsPerLoan?: unknown[][];
  visits?: unknown[];
}) {
  let paymentCallIndex = 0;
  const from = jest.fn((table: unknown) => ({
    where: jest.fn().mockImplementation(() => {
      if (table === customers) return Promise.resolve(rows.customers ?? []);
      if (table === loans) return Promise.resolve(rows.loans ?? []);
      if (table === payments) {
        const result = rows.paymentsPerLoan?.[paymentCallIndex] ?? [];
        paymentCallIndex += 1;
        return Promise.resolve(result);
      }
      if (table === visits) return Promise.resolve(rows.visits ?? []);
      return Promise.resolve([]);
    })
  }));
  return { select: jest.fn(() => ({ from })) } as unknown as Database;
}

describe("createGetCustomerDetail", () => {
  it("carries the customer's cédula and avatarKey through", async () => {
    const getCustomerDetail = createGetCustomerDetail({
      db: makeDbStub({ customers: [baseCustomerRow] })
    });
    const result = await getCustomerDetail({ id: "customer-1" });

    expect(result?.cedula).toBe("00112345678");
    expect(result?.avatarKey).toBe("female2");
  });

  it("returns null cédula/avatarKey when the customer never captured them", async () => {
    const row = { ...baseCustomerRow, cedula: null, avatarKey: null };
    const getCustomerDetail = createGetCustomerDetail({ db: makeDbStub({ customers: [row] }) });
    const result = await getCustomerDetail({ id: "customer-1" });

    expect(result?.cedula).toBeNull();
    expect(result?.avatarKey).toBeNull();
  });

  it("returns null for an unknown customer id", async () => {
    const getCustomerDetail = createGetCustomerDetail({ db: makeDbStub({}) });

    expect(await getCustomerDetail({ id: "missing" })).toBeNull();
  });

  describe("term loan", () => {
    it("stays unchanged: cuota fields populate normally, openCredit stays null", async () => {
      // Arrange — fresh loan, cuota 1 not due for another 4 days: nothing
      // overdue, so this only guards installments/openCredit wiring, not
      // mora accrual (covered by mora.test.ts).
      const freshLoan = loanRow({ startDate: daysAgo(3) });
      const db = makeDbStub({
        customers: [baseCustomerRow],
        loans: [freshLoan],
        paymentsPerLoan: [[]]
      });
      const getCustomerDetail = createGetCustomerDetail({ db });

      // Act
      const result = await getCustomerDetail({ id: "customer-1" });
      const summary = result?.activeLoans[0];

      // Assert
      expect(summary?.openCredit).toBeNull();
      expect(summary?.installmentsPaid).toBe(0);
      expect(summary?.installmentsTotal).toBe(12);
      expect(summary?.nextDueDate).not.toBeNull();
      expect(result?.standing).toBe("al_dia");
    });
  });

  describe("open-credit loan", () => {
    it("carries capital-paid ratio + next-cycle interest, no cuota count", async () => {
      // Arrange — RD$500 interest + RD$2,000 capital paid within cycle 1
      // (same fixture as getLoanDetailView.test.ts): balance drops to
      // RD$8,000, i.e. 20% of principal repaid.
      const db = makeDbStub({
        customers: [baseCustomerRow],
        loans: [openCreditLoanRow],
        paymentsPerLoan: [
          [paymentRow({ id: "p1", loanId: "loan-oc-1", amountCents: 250000, paidAt: daysAgo(4) })]
        ]
      });
      const getCustomerDetail = createGetCustomerDetail({ db });

      // Act
      const result = await getCustomerDetail({ id: "customer-1" });
      const summary = result?.activeLoans[0];

      // Assert
      expect(summary?.installmentsPaid).toBe(0);
      expect(summary?.installmentsTotal).toBe(0);
      expect(summary?.openCredit).not.toBeNull();
      expect(summary?.openCredit?.interestRateBps).toBe(500);
      expect(summary?.openCredit?.capitalPaidRatio).toBeCloseTo(0.2);
      expect(summary?.nextAmountCents).toBe(40000); // 5% of the RD$8,000 balance
      expect(summary?.nextDueDate?.getTime()).toBe(
        addFrequencyInterval(openCreditLoanRow.startDate, "weekly", 2).getTime()
      );
    });

    it("clamps capital-paid ratio to 0% when a skipped cycle capitalizes interest past principal", async () => {
      // Arrange — no payments: cycle 1's RD$500 interest capitalizes,
      // growing the balance to RD$10,500 — above the RD$10,000 principal.
      const db = makeDbStub({
        customers: [baseCustomerRow],
        loans: [openCreditLoanRow],
        paymentsPerLoan: [[]]
      });
      const getCustomerDetail = createGetCustomerDetail({ db });

      // Act
      const result = await getCustomerDetail({ id: "customer-1" });
      const summary = result?.activeLoans[0];

      // Assert — never negative.
      expect(summary?.openCredit?.capitalPaidRatio).toBe(0);
    });

    it("never drives standing to mora, even with a skipped, capitalized cycle", async () => {
      const db = makeDbStub({
        customers: [baseCustomerRow],
        loans: [openCreditLoanRow],
        paymentsPerLoan: [[]]
      });
      const getCustomerDetail = createGetCustomerDetail({ db });

      const result = await getCustomerDetail({ id: "customer-1" });

      expect(result?.standing).toBe("al_dia");
    });
  });

  describe("recent activity", () => {
    it("labels open-credit payments 'Pago ciclo N', term payments 'Pago cuota N', and mora rows 'Pago de mora'", async () => {
      // Arrange — a term loan with two cuotas and a mora row, plus an
      // open-credit loan with one cycle-1 payment.
      const termLoan = loanRow({ id: "loan-term-1" });
      const cuota1 = paymentRow({ id: "cuota-1", loanId: "loan-term-1", paidAt: daysAgo(24) });
      const cuota2 = paymentRow({ id: "cuota-2", loanId: "loan-term-1", paidAt: daysAgo(17) });
      const moraPayment = paymentRow({
        id: "mora-1",
        loanId: "loan-term-1",
        amountCents: 75000,
        paidAt: daysAgo(10),
        notes: "mora"
      });
      const ocPayment = paymentRow({
        id: "oc-1",
        loanId: "loan-oc-1",
        amountCents: 250000,
        paidAt: daysAgo(4)
      });
      const db = makeDbStub({
        customers: [baseCustomerRow],
        loans: [termLoan, openCreditLoanRow],
        paymentsPerLoan: [[cuota1, cuota2, moraPayment], [ocPayment]]
      });
      const getCustomerDetail = createGetCustomerDetail({ db });

      // Act
      const result = await getCustomerDetail({ id: "customer-1" });

      // Assert — newest first.
      expect(result?.recentActivity.map((a) => a.description)).toEqual([
        "Pago ciclo 1 · RD$2,500",
        "Pago de mora · RD$750",
        "Pago cuota 2 · RD$2,700",
        "Pago cuota 1 · RD$2,700"
      ]);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      const db = makeDbStub({});
      const getCustomerDetail = createGetCustomerDetail({ db });

      await expect(getCustomerDetail({ id: "" })).rejects.toBeInstanceOf(ValidationError);
      expect((db as unknown as { select: jest.Mock }).select).not.toHaveBeenCalled();
    });
  });
});
