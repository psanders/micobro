/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateVisit } from "../lib/visits/createVisit";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

function makeDbStub() {
  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });
  return { insert, values } as unknown as Database & { insert: jest.Mock; values: jest.Mock };
}

describe("createCreateVisit", () => {
  describe("with valid input", () => {
    it("records a non-promise outcome and enqueues a pending sync mutation", async () => {
      // Arrange
      const db = makeDbStub();
      const createVisit = createCreateVisit({ db: db as unknown as Database });

      // Act
      const result = await createVisit({ customerId: "customer-1", outcome: "no_contact" });

      // Assert
      expect(result.id).toEqual(expect.any(String));
      expect(result.customerId).toBe("customer-1");
      expect(result.outcome).toBe("no_contact");
      expect(result.promiseDate).toBeNull();
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it("records a promise with its date and amount", async () => {
      // Arrange
      const db = makeDbStub();
      const createVisit = createCreateVisit({ db: db as unknown as Database });
      const promiseDate = new Date("2026-07-15T15:00:00");

      // Act
      const result = await createVisit({
        customerId: "customer-1",
        loanId: "loan-1",
        outcome: "promise",
        promiseDate,
        promiseAmount: 3150,
        note: "Confirmó pago mañana"
      });

      // Assert
      expect(result.outcome).toBe("promise");
      expect(result.promiseDate).toEqual(promiseDate);
      expect(result.promiseAmountCents).toBe(315000);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError for a promise missing date/amount and never touches the database", async () => {
      // Arrange
      const db = makeDbStub();
      const createVisit = createCreateVisit({ db: db as unknown as Database });

      // Act + Assert
      await expect(
        createVisit({ customerId: "customer-1", outcome: "promise" })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
