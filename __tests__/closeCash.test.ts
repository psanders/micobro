/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: cash-close "Closing requires the verified total to match the
 * system total" and "Closing records a ledger entry for the reconciled
 * period and resets the total".
 */
import { createCloseCash } from "../lib/cashClose/closeCash";
import type { Database } from "../lib/db/client";

function makeDbStub(closeRows: unknown[], paymentRows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(closeRows);
  const orderBy = jest.fn().mockReturnValue({ limit });
  const fromCloses = jest.fn().mockReturnValue({ orderBy });
  const fromPayments = jest.fn().mockResolvedValue(paymentRows);

  const select = jest
    .fn()
    .mockReturnValueOnce({ from: fromCloses })
    .mockReturnValueOnce({ from: fromPayments });

  const insertValues = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  return { select, insert, insertValues } as unknown as Database & {
    insert: jest.Mock;
    insertValues: jest.Mock;
  };
}

const payment = (amountCents: number, paidAt: Date) => ({
  id: `p-${amountCents}`,
  loanId: "loan-1",
  amountCents,
  paidAt,
  method: "cash",
  notes: null,
  createdAt: paidAt
});

describe("createCloseCash", () => {
  it("rejects when the total is 0 — no side effect", async () => {
    const db = makeDbStub([], []);
    const closeCash = createCloseCash({ db });

    await expect(closeCash({ verifiedCents: 0 })).rejects.toThrow("RD$0");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects when the verified total doesn't match — no side effect", async () => {
    const db = makeDbStub([], [payment(50000, new Date())]);
    const closeCash = createCloseCash({ db });

    await expect(closeCash({ verifiedCents: 40000 })).rejects.toThrow("no coincide");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("records a ledger entry and enqueues a pending mutation when totals match", async () => {
    const db = makeDbStub([], [payment(50000, new Date())]);
    const closeCash = createCloseCash({ db });

    const close = await closeCash({ verifiedCents: 50000 });

    expect(close.amountCents).toBe(50000);
    expect(close.periodStart).toBeNull();
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db.insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ amountCents: 50000 })
    );
    expect(db.insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ entity: "cashClose", operation: "create" })
    );
  });
});
