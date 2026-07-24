/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Collect an open-credit payment" — an open-credit
 * cobro (interest, or interest + capital) is recorded as ONE ordinary
 * payment row with no mora split (collectPayment.ts needs no open-credit
 * branch: `moraCents: 0` already produces exactly one row, per
 * collectPayment.test.ts). This test confirms that end-to-end and that the
 * recorded row is exactly what `openCreditState` needs to reflect the lower
 * balance — and, on a full payoff, close the loan.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createCollectPayment } from "../lib/payments/collectPayment";
import { openCreditState } from "../lib/loans/openCredit";
import { customers, loans } from "../lib/db/schema";
import type { Database } from "../lib/db/client";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const loanRow = { id: "loan-1", customerId: "customer-1" };
const customerRow = { id: "customer-1", name: "Luis Pérez" };

function makeDbStub() {
  const inserted: Record<string, unknown>[] = [];
  const from = jest.fn((table: unknown) => {
    const rows =
      table === loans ? [loanRow] : table === customers ? [customerRow] : ([] as unknown[]);
    const promise = Promise.resolve(rows);
    return Object.assign(promise, { where: jest.fn(() => Promise.resolve(rows)) });
  });
  const db = {
    select: jest.fn(() => ({ from })),
    insert: jest.fn(() => ({
      values: jest.fn(async (row: Record<string, unknown>) => {
        inserted.push(row);
      })
    }))
  } as unknown as Database;
  return { db, inserted };
}

describe("collecting an open-credit payment", () => {
  it("records interest + capital as a single row with no mora note", async () => {
    const { db, inserted } = makeDbStub();
    const collect = createCollectPayment({ db });

    const receipt = await collect({
      loanId: "loan-1",
      amountCents: 250000, // RD$500 interest + RD$2,000 capital
      method: "cash",
      moraCents: 0,
      lines: [
        { label: "Interés", amountCents: 50000 },
        { label: "Capital", amountCents: 200000 }
      ]
    });

    const paymentRows = inserted.filter((row) => "loanId" in row && "amountCents" in row);
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]).toMatchObject({ amountCents: 250000, notes: null, method: "cash" });
    expect(receipt.totalCents).toBe(250000);
  });

  it("lowers the open-credit balance and eventually closes the loan once replayed", () => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const TODAY = new Date("2026-07-16T00:00:00");
    const loan: Loan = {
      id: "loan-oc",
      customerId: "customer-1",
      principalCents: 1000000,
      interestRateBps: 500,
      termCount: 0,
      frequency: "weekly",
      startDate: new Date(TODAY.getTime() - WEEK_MS),
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: null,
      moraRateBps: null,
      skipSundays: null,
      loanType: "open_credit",
      createdAt: TODAY,
      updatedAt: TODAY
    };

    // Exactly the single-row shape a real collect() of "interest + capital"
    // inserts: one payment, no mora note.
    const partialPayment: Payment = {
      id: "p1",
      loanId: "loan-oc",
      amountCents: 250000, // RD$500 interest + RD$2,000 capital
      paidAt: new Date(TODAY.getTime() - WEEK_MS + 24 * 60 * 60 * 1000),
      method: "cash",
      notes: null,
      createdAt: TODAY
    };

    const state = openCreditState(loan, [partialPayment], TODAY);
    expect(state.balanceCents).toBe(800000); // RD$10,000 - RD$2,000 capital
    expect(state.isClosed).toBe(false);

    // A single row covering interest + the full remaining capital closes it.
    const payoffPayment: Payment = { ...partialPayment, id: "p2", amountCents: 1050000 };
    const closedState = openCreditState(loan, [payoffPayment], TODAY);
    expect(closedState.isClosed).toBe(true);
    expect(closedState.balanceCents).toBe(0);
  });
});
