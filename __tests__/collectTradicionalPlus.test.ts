/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Penalties first when penalties are owed" and
 * tradicional-plus-schedule "Partial payments are not accepted" — the real
 * collect re-checks a Tradicional Plus cobro against the stored payments,
 * writes one penalty row per penalty, and names the moved date on the receipt.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createCollectPayment } from "../lib/payments/collectPayment";
import { customers, loans, payments } from "../lib/db/schema";
import { PENALTY_NOTE } from "../lib/loans/loanViews";
import type { Database } from "../lib/db/client";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

// Quincenal: cycle 1 = 1 Mar, 2 = 16 Mar, 3 = 31 Mar.
const start = new Date(2026, 1, 14);
const loanRow: Loan = {
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
const customerRow = { id: "customer-1", name: "José Núñez" };

function makeDbStub(existing: Payment[] = [], loan: Loan = loanRow) {
  const inserted: Record<string, unknown>[] = [];
  const from = jest.fn((table: unknown) => {
    const rows =
      table === loans
        ? [loan]
        : table === customers
          ? [customerRow]
          : table === payments
            ? existing
            : ([] as unknown[]);
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
  const paymentRows = () => inserted.filter((row) => "loanId" in row && "amountCents" in row);
  return { db, paymentRows };
}

const base = { loanId: "loan-plus", method: "cash" as const, moraCents: 0, lines: [] };

describe("collectPayment — Tradicional Plus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("collects the cuota when nothing is owed", async () => {
    jest.setSystemTime(new Date(2026, 2, 1, 10));
    const { db, paymentRows } = makeDbStub();

    await createCollectPayment({ db })({
      ...base,
      amountCents: 130_000,
      lines: [{ label: "Cuota 1/10", amountCents: 130_000 }]
    });

    expect(paymentRows()).toEqual([expect.objectContaining({ amountCents: 130_000, notes: null })]);
  });

  it("rejects a partial amount and records nothing", async () => {
    jest.setSystemTime(new Date(2026, 2, 1, 10));
    const { db, paymentRows } = makeDbStub();

    await expect(createCollectPayment({ db })({ ...base, amountCents: 80_000 })).rejects.toThrow(
      "Este préstamo solo acepta la cuota completa o la penalidad."
    );
    expect(paymentRows()).toHaveLength(0);
  });

  it("rejects the cuota while penalties are owed", async () => {
    jest.setSystemTime(new Date(2026, 2, 20, 10));
    const { db, paymentRows } = makeDbStub();

    await expect(createCollectPayment({ db })({ ...base, amountCents: 130_000 })).rejects.toThrow(
      "Primero debe pagar 2 penalidades."
    );
    expect(paymentRows()).toHaveLength(0);
  });

  it("writes one row per owed penalty and names the moved date", async () => {
    jest.setSystemTime(new Date(2026, 2, 20, 10));
    const { db, paymentRows } = makeDbStub();

    const receipt = await createCollectPayment({ db })({
      ...base,
      amountCents: 60_000,
      penaltyCount: 2
    });

    expect(paymentRows()).toEqual([
      expect.objectContaining({ amountCents: 30_000, notes: PENALTY_NOTE }),
      expect.objectContaining({ amountCents: 30_000, notes: PENALTY_NOTE })
    ]);
    expect(receipt.lines).toEqual([
      { label: expect.stringMatching(/^Penalidades \(2\) · Cuota 1 pasa al /), amountCents: 60_000 }
    ]);
    // Two moves: the last cuota sits at cycle 12 instead of 10.
    expect(receipt.loanEndDate?.toDateString()).toBe(
      new Date(2026, 1, 14 + 15 * 12).toDateString()
    );
  });

  it("rejects collecting fewer penalties than are owed", async () => {
    jest.setSystemTime(new Date(2026, 2, 20, 10));
    const { db } = makeDbStub();

    await expect(
      createCollectPayment({ db })({ ...base, amountCents: 30_000, penaltyCount: 1 })
    ).rejects.toThrow("El monto no coincide con la penalidad de este préstamo.");
  });

  it("rejects a penalty before the cycle is due", async () => {
    jest.setSystemTime(new Date(2026, 1, 24, 10));
    const { db } = makeDbStub();

    await expect(
      createCollectPayment({ db })({ ...base, amountCents: 30_000, penaltyCount: 1 })
    ).rejects.toThrow("La cuota de este préstamo aún no vence.");
  });

  it("rejects a penalty on a loan that isn't Tradicional Plus", async () => {
    jest.setSystemTime(new Date(2026, 2, 1, 10));
    const { db } = makeDbStub([], { ...loanRow, loanType: null, penaltyCents: null });

    await expect(
      createCollectPayment({ db })({ ...base, amountCents: 30_000, penaltyCount: 1 })
    ).rejects.toThrow("Solo un préstamo Tradicional Plus cobra penalidad.");
  });
});
