/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateCustomer } from "../lib/customers/createCustomer";
import { ValidationError } from "../lib/errors/ValidationError";
import { createTestDb } from "./helpers/testDb";
import type { TestDb } from "./helpers/testDb";

function makeDb() {
  const t = createTestDb();
  return { t, createCustomer: createCreateCustomer({ db: t.db, sql: t.sql }) };
}

function rowCount(t: TestDb, table: string): number {
  return t.raw.prepare(`SELECT id FROM ${table}`).all().length;
}

function expectNothingWritten(t: TestDb) {
  expect(rowCount(t, "customers")).toBe(0);
  expect(rowCount(t, "pending_mutations")).toBe(0);
}

describe("createCreateCustomer", () => {
  describe("with valid input", () => {
    it("inserts the customer and enqueues a pending sync mutation", async () => {
      // Arrange
      const { t, createCustomer } = makeDb();

      // Act
      const result = await createCustomer({ name: "  Juana Pérez  ", phone: "8091234567" });

      // Assert
      expect(result.id).toEqual(expect.any(String));
      expect(result.name).toBe("Juana Pérez");
      expect(result.phone).toBe("8091234567");
      expect(t.raw.prepare("SELECT id, name FROM customers").all()).toEqual([
        { id: result.id, name: "Juana Pérez" }
      ]);
      expect(
        t.raw.prepare("SELECT entity, entity_id, operation FROM pending_mutations").all()
      ).toEqual([{ entity: "customer", entity_id: result.id, operation: "create" }]);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const { t, createCustomer } = makeDb();

      // Act + Assert
      await expect(createCustomer({ name: "", phone: "8091234567" })).rejects.toBeInstanceOf(
        ValidationError
      );
      expectNothingWritten(t);
    });
  });

  describe("phone", () => {
    it("stores a valid 10-digit phone (dashed input) normalized to digits only", async () => {
      // Arrange
      const { createCustomer } = makeDb();

      // Act
      const result = await createCustomer({ name: "Juana Pérez", phone: "809-251-2222" });

      // Assert
      expect(result.phone).toBe("8092512222");
    });

    it("rejects a phone that isn't 10 digits", async () => {
      // Arrange
      const { t, createCustomer } = makeDb();

      // Act + Assert
      await expect(
        createCustomer({ name: "Juana Pérez", phone: "809-251-222" })
      ).rejects.toBeInstanceOf(ValidationError);
      expectNothingWritten(t);
    });

    it("rejects an empty phone", async () => {
      // Arrange
      const { t, createCustomer } = makeDb();

      // Act + Assert
      await expect(createCustomer({ name: "Juana Pérez", phone: "" })).rejects.toBeInstanceOf(
        ValidationError
      );
      expectNothingWritten(t);
    });
  });

  describe("cédula", () => {
    it("stores a valid 11-digit cédula normalized to digits only", async () => {
      // Arrange
      const { createCustomer } = makeDb();

      // Act
      const result = await createCustomer({
        name: "Juana Pérez",
        phone: "8091234567",
        cedula: "001-1234567-8"
      });

      // Assert
      expect(result.cedula).toBe("00112345678");
    });

    it("is null when omitted", async () => {
      // Arrange
      const { createCustomer } = makeDb();

      // Act
      const result = await createCustomer({ name: "Juana Pérez", phone: "8091234567" });

      // Assert
      expect(result.cedula).toBeNull();
    });

    it("rejects a cédula that isn't 11 digits", async () => {
      // Arrange
      const { t, createCustomer } = makeDb();

      // Act + Assert
      await expect(
        createCustomer({ name: "Juana Pérez", phone: "8091234567", cedula: "001-123456-8" })
      ).rejects.toBeInstanceOf(ValidationError);
      expectNothingWritten(t);
    });
  });

  describe("avatarKey", () => {
    it("accepts a key from the curated set", async () => {
      // Arrange
      const { createCustomer } = makeDb();

      // Act
      const result = await createCustomer({
        name: "Juana Pérez",
        phone: "8091234567",
        avatarKey: "female2"
      });

      // Assert
      expect(result.avatarKey).toBe("female2");
    });

    it("rejects a key outside the curated set", async () => {
      // Arrange
      const { t, createCustomer } = makeDb();

      // Act + Assert
      await expect(
        createCustomer({
          name: "Juana Pérez",
          phone: "8091234567",
          avatarKey: "not-a-real-avatar"
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expectNothingWritten(t);
    });
  });
});
