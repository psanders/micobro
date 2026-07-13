/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createListLoansByCustomer } from "../lib/loans/listLoansByCustomer";
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

describe("createListLoansByCustomer", () => {
  describe("with valid input", () => {
    it("returns loans for the given customer", async () => {
      // Arrange
      const fixture = [{ id: "loan-1", customerId: "customer-1" }];
      const db = makeDbStub(fixture);
      const listLoansByCustomer = createListLoansByCustomer({ db: db as unknown as Database });

      // Act
      const result = await listLoansByCustomer({ customerId: "customer-1" });

      // Assert
      expect(result).toBe(fixture);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const db = makeDbStub([]);
      const listLoansByCustomer = createListLoansByCustomer({ db: db as unknown as Database });

      // Act + Assert
      await expect(listLoansByCustomer({ customerId: "" })).rejects.toBeInstanceOf(ValidationError);
      expect(db.select).not.toHaveBeenCalled();
    });
  });
});
