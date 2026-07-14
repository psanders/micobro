/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Confirm and record" — the real collect wraps the
 * payment domain: mora and cuota land as separate rows (mora flagged) and
 * invalid input fails validation without touching the db.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createCollectPayment } from "../lib/payments/collectPayment";
import { ValidationError } from "../lib/errors/ValidationError";
import { customers, loans } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

const loanRow = { id: "loan-1", customerId: "customer-1" };
const customerRow = { id: "customer-1", name: "José Núñez" };

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

describe("collectPayment", () => {
  it("records mora and cuota as separate rows and returns the receipt", async () => {
    const { db, inserted } = makeDbStub();
    const collect = createCollectPayment({ db });

    const receipt = await collect({
      loanId: "loan-1",
      amountCents: 315000,
      method: "cash",
      moraCents: 75000,
      lines: [{ label: "Mora (prioridad)", amountCents: 75000 }]
    });

    const paymentRows = inserted.filter((row) => "loanId" in row && "amountCents" in row);
    expect(paymentRows).toHaveLength(2);
    expect(paymentRows[0]).toMatchObject({ amountCents: 75000, notes: "mora", method: "cash" });
    expect(paymentRows[1]).toMatchObject({ amountCents: 240000, notes: null });

    expect(receipt.receiptNumber).toBe("R-00001");
    expect(receipt.totalCents).toBe(315000);
    expect(receipt.customerName).toBe("José Núñez");
  });

  it("records a single row when there is no mora", async () => {
    const { db, inserted } = makeDbStub();
    const collect = createCollectPayment({ db });

    await collect({
      loanId: "loan-1",
      amountCents: 240000,
      method: "transfer",
      moraCents: 0,
      lines: []
    });

    const paymentRows = inserted.filter((row) => "loanId" in row && "amountCents" in row);
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]).toMatchObject({
      amountCents: 240000,
      notes: null,
      method: "transfer"
    });
  });

  it("rejects invalid input without touching the db", async () => {
    const { db } = makeDbStub();
    const collect = createCollectPayment({ db });

    await expect(
      collect({
        loanId: "loan-1",
        amountCents: -5,
        method: "cash",
        moraCents: 0,
        lines: []
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect((db as unknown as { select: jest.Mock }).select).not.toHaveBeenCalled();
  });
});
