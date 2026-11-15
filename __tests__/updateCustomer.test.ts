/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createUpdateCustomer } from "../lib/customers/updateCustomer";
import { ValidationError } from "../lib/errors/ValidationError";
import { customers } from "../lib/db/schema";
import { createTestDb } from "./helpers/testDb";
import type { TestDb } from "./helpers/testDb";

const existingCustomer = {
  id: "customer-1",
  name: "Juana Pérez",
  phone: "8091234567",
  address: "Calle Duarte 12",
  cedula: null,
  avatarKey: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

async function makeDb(seed = true) {
  const t = createTestDb();
  if (seed) await t.db.insert(customers).values(existingCustomer);
  return { t, updateCustomer: createUpdateCustomer({ db: t.db, sql: t.sql }) };
}

function mutationCount(t: TestDb): number {
  return t.raw.prepare("SELECT id FROM pending_mutations").all().length;
}

/** The seeded customer is untouched and nothing was queued. */
function expectNothingWritten(t: TestDb) {
  expect(t.raw.prepare("SELECT name, phone FROM customers").all()).toEqual([
    { name: existingCustomer.name, phone: existingCustomer.phone }
  ]);
  expect(mutationCount(t)).toBe(0);
}

describe("createUpdateCustomer", () => {
  describe("with valid input", () => {
    it("updates the customer and enqueues a pending sync mutation", async () => {
      // Arrange
      const { t, updateCustomer } = await makeDb();

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
      expect(result.createdAt).toEqual(existingCustomer.createdAt);
      expect(t.raw.prepare("SELECT name, phone FROM customers").all()).toEqual([
        { name: "Juana Pérez Reyes", phone: "8097654321" }
      ]);
      expect(
        t.raw.prepare("SELECT entity, entity_id, operation FROM pending_mutations").all()
      ).toEqual([{ entity: "customer", entity_id: "customer-1", operation: "update" }]);
    });

    it("clears the address when omitted", async () => {
      // Arrange
      const { updateCustomer } = await makeDb();

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
      const { t, updateCustomer } = await makeDb();

      // Act + Assert
      await expect(
        updateCustomer({ id: "customer-1", name: "", phone: "8091234567" })
      ).rejects.toBeInstanceOf(ValidationError);
      expectNothingWritten(t);
    });
  });

  describe("with an unknown customer", () => {
    it("throws instead of writing a phantom row", async () => {
      // Arrange
      const { t, updateCustomer } = await makeDb(false);

      // Act + Assert
      await expect(
        updateCustomer({ id: "missing", name: "Juana Pérez", phone: "8091234567" })
      ).rejects.toThrow("Customer not found");
      expect(t.raw.prepare("SELECT id FROM customers").all()).toEqual([]);
      expect(mutationCount(t)).toBe(0);
    });
  });

  describe("phone", () => {
    it("stores a valid 10-digit phone (dashed input) normalized to digits only", async () => {
      // Arrange
      const { updateCustomer } = await makeDb();

      // Act
      const result = await updateCustomer({
        id: "customer-1",
        name: "Juana Pérez",
        phone: "809-765-4321"
      });

      // Assert
      expect(result.phone).toBe("8097654321");
    });

    it("rejects a phone that isn't 10 digits", async () => {
      // Arrange
      const { t, updateCustomer } = await makeDb();

      // Act + Assert
      await expect(
        updateCustomer({ id: "customer-1", name: "Juana Pérez", phone: "12345" })
      ).rejects.toBeInstanceOf(ValidationError);
      expectNothingWritten(t);
    });
  });

  describe("cédula", () => {
    it("stores a valid 11-digit cédula (dashed input) normalized to digits only", async () => {
      // Arrange
      const { updateCustomer } = await makeDb();

      // Act
      const result = await updateCustomer({
        id: "customer-1",
        name: "Juana Pérez",
        phone: "8091234567",
        cedula: "001-1234567-8"
      });

      // Assert
      expect(result.cedula).toBe("00112345678");
    });

    it("clears the cédula when omitted", async () => {
      // Arrange
      const { updateCustomer } = await makeDb();

      // Act
      const result = await updateCustomer({
        id: "customer-1",
        name: "Juana Pérez",
        phone: "8091234567"
      });

      // Assert
      expect(result.cedula).toBeNull();
    });

    it("rejects a cédula that isn't 11 digits", async () => {
      // Arrange
      const { t, updateCustomer } = await makeDb();

      // Act + Assert
      await expect(
        updateCustomer({
          id: "customer-1",
          name: "Juana Pérez",
          phone: "8091234567",
          cedula: "12345"
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expectNothingWritten(t);
    });
  });

  describe("avatarKey", () => {
    it("accepts a key from the curated set", async () => {
      // Arrange
      const { updateCustomer } = await makeDb();

      // Act
      const result = await updateCustomer({
        id: "customer-1",
        name: "Juana Pérez",
        phone: "8091234567",
        avatarKey: "male4"
      });

      // Assert
      expect(result.avatarKey).toBe("male4");
    });

    it("rejects a key outside the curated set", async () => {
      // Arrange
      const { t, updateCustomer } = await makeDb();

      // Act + Assert
      await expect(
        updateCustomer({
          id: "customer-1",
          name: "Juana Pérez",
          phone: "8091234567",
          avatarKey: "robot9"
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expectNothingWritten(t);
    });
  });
});
