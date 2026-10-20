/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createUpdateLoan } from "../lib/loans/updateLoan";
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

const corrected = {
  id: "loan-1",
  principal: 10000,
  interestRate: 15,
  termCount: 10,
  frequency: "weekly" as const
};

describe("createUpdateLoan", () => {
  describe("with a payment-free active loan", () => {
    it("rewrites the terms in place and enqueues a full-row update mutation", async () => {
      // Arrange
      const db = makeDbStub([existingLoan], []);
      const updateLoan = createUpdateLoan({ db });

      // Act
      const result = await updateLoan(corrected);

      // Assert
      expect(result.id).toBe("loan-1");
      expect(result.customerId).toBe("customer-1");
      expect(result.principalCents).toBe(1000000);
      expect(result.interestRateBps).toBe(1500);
      expect(result.termCount).toBe(10);
      expect(result.status).toBe("active");
      expect(result.createdAt).toBe(existingLoan.createdAt);
      expect(result.updatedAt.getTime()).toBeGreaterThan(existingLoan.updatedAt.getTime());
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ principalCents: 1000000 }));
      const mutation = (db as unknown as Record<string, jest.Mock>).values!.mock.calls[0][0];
      expect(mutation).toMatchObject({ entity: "loan", entityId: "loan-1", operation: "update" });
      expect(JSON.parse(mutation.payload)).toMatchObject({
        id: "loan-1",
        customerId: "customer-1",
        principalCents: 1000000,
        termCount: 10,
        status: "active"
      });
    });

    it("keeps the start date when none is sent", async () => {
      // Arrange
      const db = makeDbStub([existingLoan], []);
      const updateLoan = createUpdateLoan({ db });

      // Act
      const result = await updateLoan(corrected);

      // Assert
      expect(result.startDate).toBe(existingLoan.startDate);
    });

    it("can turn a term loan into crédito abierto without a cuota count", async () => {
      // Arrange
      const db = makeDbStub([existingLoan], []);
      const updateLoan = createUpdateLoan({ db });

      // Act
      const result = await updateLoan({
        id: "loan-1",
        principal: 10000,
        interestRate: 5,
        frequency: "weekly",
        loanType: "open_credit"
      });

      // Assert
      expect(result.loanType).toBe("open_credit");
      expect(result.termCount).toBe(0);
    });
  });

  describe("when the loan can't be edited", () => {
    it("refuses a loan that already has a payment and writes nothing", async () => {
      // Arrange
      const db = makeDbStub([existingLoan], [{ id: "payment-1", loanId: "loan-1" }]);
      const updateLoan = createUpdateLoan({ db });

      // Act & Assert
      await expect(updateLoan(corrected)).rejects.toThrow("ya tiene pagos");
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("refuses an archived loan", async () => {
      // Arrange
      const db = makeDbStub([{ ...existingLoan, status: "cancelled" }], []);
      const updateLoan = createUpdateLoan({ db });

      // Act & Assert
      await expect(updateLoan(corrected)).rejects.toThrow(
        "Solo se pueden editar préstamos activos"
      );
      expect(db.update).not.toHaveBeenCalled();
    });

    it("refuses a loan that doesn't exist", async () => {
      // Arrange
      const db = makeDbStub([]);
      const updateLoan = createUpdateLoan({ db });

      // Act & Assert
      await expect(updateLoan(corrected)).rejects.toThrow("No encontramos este préstamo");
    });
  });

  describe("with invalid input", () => {
    it("throws a ValidationError for a zero principal and never touches the db", async () => {
      // Arrange
      const db = makeDbStub([existingLoan], []);
      const updateLoan = createUpdateLoan({ db });

      // Act & Assert
      await expect(updateLoan({ ...corrected, principal: 0 })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(db.select).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("requires a cuota count for a term loan, same as creating one", async () => {
      // Arrange
      const db = makeDbStub([existingLoan], []);
      const updateLoan = createUpdateLoan({ db });
      const withoutTerm = { id: "loan-1", principal: 10000, interestRate: 15, frequency: "weekly" };

      // Act & Assert
      await expect(updateLoan(withoutTerm)).rejects.toBeInstanceOf(ValidationError);
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
