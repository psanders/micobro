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
      expect(result.skipSundays).toBeNull();
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it("persists skipSundays for a daily loan with Saltar domingos on", async () => {
      // Arrange
      const db = makeDbStub();
      const createLoan = createCreateLoan({ db: db as unknown as Database });

      // Act
      const result = await createLoan({
        customerId: "customer-1",
        principal: 5000,
        interestRate: 10,
        termCount: 30,
        frequency: "daily",
        skipSundays: true
      });

      // Assert
      expect(result.skipSundays).toBe(true);
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ skipSundays: true }));
    });

    it("persists loanType 'open_credit' and needs no termCount", async () => {
      // Arrange
      const db = makeDbStub();
      const createLoan = createCreateLoan({ db: db as unknown as Database });

      // Act — no termCount at all, only loanType: "open_credit"
      const result = await createLoan({
        customerId: "customer-1",
        principal: 10000,
        interestRate: 5,
        frequency: "weekly",
        loanType: "open_credit"
      });

      // Assert — 0 is a safe placeholder the open-credit paths never read
      // (see lib/loans/openCredit.ts).
      expect(result.loanType).toBe("open_credit");
      expect(result.termCount).toBe(0);
      expect(result.principalCents).toBe(1000000);
      expect(result.interestRateBps).toBe(500);
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({ loanType: "open_credit", termCount: 0 })
      );
    });

    it("stores loanType null (term) when omitted", async () => {
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
      expect(result.loanType).toBeNull();
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

    it("throws ValidationError for a term loan (default) missing termCount", async () => {
      // Arrange
      const db = makeDbStub();
      const createLoan = createCreateLoan({ db: db as unknown as Database });

      // Act + Assert — loanType omitted defaults to "term", which still
      // requires a termCount (see createLoanSchema's .refine).
      await expect(
        createLoan({
          customerId: "customer-1",
          principal: 5000,
          interestRate: 10,
          frequency: "weekly"
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
