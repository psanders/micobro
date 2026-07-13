/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createGetCustomer } from "../lib/customers/getCustomer";
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

describe("createGetCustomer", () => {
  describe("with valid input", () => {
    it("returns the matching customer", async () => {
      // Arrange
      const fixture = { id: "1", name: "Juana Pérez", phone: "8091234567" };
      const db = makeDbStub([fixture]);
      const getCustomer = createGetCustomer({ db: db as unknown as Database });

      // Act
      const result = await getCustomer({ id: "1" });

      // Assert
      expect(result).toBe(fixture);
    });

    it("returns null when no customer matches", async () => {
      // Arrange
      const db = makeDbStub([]);
      const getCustomer = createGetCustomer({ db: db as unknown as Database });

      // Act
      const result = await getCustomer({ id: "missing" });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const db = makeDbStub([]);
      const getCustomer = createGetCustomer({ db: db as unknown as Database });

      // Act + Assert
      await expect(getCustomer({ id: "" })).rejects.toBeInstanceOf(ValidationError);
      expect(db.select).not.toHaveBeenCalled();
    });
  });
});
