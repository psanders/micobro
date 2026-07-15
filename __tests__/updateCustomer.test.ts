/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createUpdateCustomer } from "../lib/customers/updateCustomer";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

const existingCustomer = {
  id: "customer-1",
  name: "Juana Pérez",
  phone: "8091234567",
  address: "Calle Duarte 12",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

function makeDbStub(rows: unknown[] = [existingCustomer]) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set });

  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });

  return { select, from, where, update, set, updateWhere, insert, values } as unknown as Database &
    Record<string, jest.Mock>;
}

describe("createUpdateCustomer", () => {
  describe("with valid input", () => {
    it("updates the customer and enqueues a pending sync mutation", async () => {
      // Arrange
      const db = makeDbStub();
      const updateCustomer = createUpdateCustomer({ db: db as unknown as Database });

      // Act
      const result = await updateCustomer({
        id: "customer-1",
        name: "  Juana Pérez Reyes  ",
        phone: "8097654321",
        address: "Calle Duarte 20"
      });

      // Assert
      expect(result.name).toBe("Juana Pérez Reyes");
      expect(result.phone).toBe("8097654321");
      expect(result.address).toBe("Calle Duarte 20");
      expect(result.createdAt).toBe(existingCustomer.createdAt);
      expect((db as unknown as Record<string, jest.Mock>).update).toHaveBeenCalledTimes(1);
      expect((db as unknown as Record<string, jest.Mock>).insert).toHaveBeenCalledTimes(1);
    });

    it("clears the address when omitted", async () => {
      // Arrange
      const db = makeDbStub();
      const updateCustomer = createUpdateCustomer({ db: db as unknown as Database });

      // Act
      const result = await updateCustomer({
        id: "customer-1",
        name: "Juana Pérez",
        phone: "8091234567"
      });

      // Assert
      expect(result.address).toBeNull();
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const db = makeDbStub();
      const updateCustomer = createUpdateCustomer({ db: db as unknown as Database });

      // Act + Assert
      await expect(
        updateCustomer({ id: "customer-1", name: "", phone: "8091234567" })
      ).rejects.toBeInstanceOf(ValidationError);
      expect((db as unknown as Record<string, jest.Mock>).select).not.toHaveBeenCalled();
    });
  });

  describe("with an unknown customer", () => {
    it("throws instead of writing a phantom row", async () => {
      // Arrange
      const db = makeDbStub([]);
      const updateCustomer = createUpdateCustomer({ db: db as unknown as Database });

      // Act + Assert
      await expect(
        updateCustomer({ id: "missing", name: "Juana Pérez", phone: "8091234567" })
      ).rejects.toThrow("Customer not found");
      expect((db as unknown as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
    });
  });
});
