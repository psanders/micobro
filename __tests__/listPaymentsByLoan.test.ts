/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createListPaymentsByLoan } from "../lib/payments/listPaymentsByLoan";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

function makeDbStub(rows: unknown[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { select, from, where } as unknown as Database & {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
  };
}

describe("createListPaymentsByLoan", () => {
  describe("with valid input", () => {
    it("returns payments for the given loan", async () => {
      // Arrange
      const fixture = [{ id: "payment-1", loanId: "loan-1" }];
      const db = makeDbStub(fixture);
      const listPaymentsByLoan = createListPaymentsByLoan({ db: db as unknown as Database });

      // Act
      const result = await listPaymentsByLoan({ loanId: "loan-1" });

      // Assert
      expect(result).toBe(fixture);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const db = makeDbStub([]);
      const listPaymentsByLoan = createListPaymentsByLoan({ db: db as unknown as Database });

      // Act + Assert
      await expect(listPaymentsByLoan({ loanId: "" })).rejects.toBeInstanceOf(ValidationError);
      expect(db.select).not.toHaveBeenCalled();
    });
  });
});
