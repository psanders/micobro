/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreatePayment } from "../lib/payments/createPayment";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

function makeDbStub() {
  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });
  return { insert, values } as unknown as Database & { insert: jest.Mock; values: jest.Mock };
}

describe("createCreatePayment", () => {
  describe("with valid input", () => {
    it("inserts the payment and enqueues a pending sync mutation", async () => {
      // Arrange
      const db = makeDbStub();
      const createPayment = createCreatePayment({ db: db as unknown as Database });

      // Act
      const result = await createPayment({
        loanId: "loan-1",
        amount: 500,
        method: "cash"
      });

      // Assert
      expect(result.id).toEqual(expect.any(String));
      expect(result.amountCents).toBe(50000);
      expect(result.loanId).toBe("loan-1");
      expect(db.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const db = makeDbStub();
      const createPayment = createCreatePayment({ db: db as unknown as Database });

      // Act + Assert
      await expect(createPayment({ loanId: "loan-1", amount: -5 })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
