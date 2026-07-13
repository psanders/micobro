/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateLoan } from "../lib/loans/createLoan";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

function makeDbStub() {
  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });
  return { insert, values } as unknown as Database & { insert: jest.Mock; values: jest.Mock };
}

describe("createCreateLoan", () => {
  describe("with valid input", () => {
    it("inserts the loan and enqueues a pending sync mutation", async () => {
      // Arrange
      const db = makeDbStub();
      const createLoan = createCreateLoan({ db: db as unknown as Database });

      // Act
      const result = await createLoan({
        customerId: "customer-1",
        principal: 5000,
        interestRate: 10,
        termCount: 12,
        frequency: "weekly"
      });

      // Assert
      expect(result.id).toEqual(expect.any(String));
      expect(result.principalCents).toBe(500000);
      expect(result.interestRateBps).toBe(1000);
      expect(result.status).toBe("active");
      expect(db.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const db = makeDbStub();
      const createLoan = createCreateLoan({ db: db as unknown as Database });

      // Act + Assert
      await expect(
        createLoan({
          customerId: "customer-1",
          principal: -1,
          interestRate: 10,
          termCount: 12,
          frequency: "weekly"
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
