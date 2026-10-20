/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createRestoreLoan } from "../lib/loans/restoreLoan";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

const existingLoan = {
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 1500000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: new Date("2026-10-13T00:00:00Z"),
  status: "active",
  notes: null,
  graceDays: null,
  moraEnabled: false,
  moraRateBps: null,
  skipSundays: null,
  loanType: null,
  createdAt: new Date("2026-10-13T00:00:00Z"),
  updatedAt: new Date("2026-10-13T00:00:00Z")
};

/** Each select(...).where(...) resolves to the next entry of `reads`, in call order. */
function makeDbStub(...reads: unknown[][]) {
  const where = jest.fn();
  for (const rows of reads) where.mockResolvedValueOnce(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set });

  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });

  return { select, update, set, insert, values } as unknown as Database & Record<string, jest.Mock>;
}

describe("createRestoreLoan", () => {
  it("moves the loan from cancelled to active and enqueues a full-row update mutation", async () => {
    // Arrange
    const db = makeDbStub([{ ...existingLoan, status: "cancelled" }]);
    const run = createRestoreLoan({ db });

    // Act
    const result = await run({ id: "loan-1" });

    // Assert
    expect(result.status).toBe("active");
    expect(result.principalCents).toBe(existingLoan.principalCents);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
    const mutation = (db as unknown as Record<string, jest.Mock>).values!.mock.calls[0][0];
    expect(mutation).toMatchObject({ entity: "loan", entityId: "loan-1", operation: "update" });
    expect(JSON.parse(mutation.payload)).toMatchObject({
      id: "loan-1",
      customerId: "customer-1",
      termCount: 12,
      status: "active"
    });
  });

  it("never deletes anything", async () => {
    // Arrange
    const db = makeDbStub([{ ...existingLoan, status: "cancelled" }]);
    const run = createRestoreLoan({ db });

    // Act
    await run({ id: "loan-1" });

    // Assert
    expect((db as unknown as Record<string, unknown>).delete).toBeUndefined();
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("refuses a loan in the wrong state and writes nothing", async () => {
    // Arrange
    const db = makeDbStub([existingLoan]);
    const run = createRestoreLoan({ db });

    // Act & Assert
    await expect(run({ id: "loan-1" })).rejects.toThrow("no está archivado");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws a ValidationError for an empty id and never touches the db", async () => {
    // Arrange
    const db = makeDbStub([{ ...existingLoan, status: "cancelled" }]);
    const run = createRestoreLoan({ db });

    // Act & Assert
    await expect(run({ id: "" })).rejects.toBeInstanceOf(ValidationError);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
