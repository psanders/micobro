/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateCustomer } from "../lib/customers/createCustomer";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

function makeDbStub() {
  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });
  return { insert, values } as unknown as Database & { insert: jest.Mock; values: jest.Mock };
}

describe("createCreateCustomer", () => {
  describe("with valid input", () => {
    it("inserts the customer and enqueues a pending sync mutation", async () => {
      // Arrange
      const db = makeDbStub();
      const createCustomer = createCreateCustomer({ db: db as unknown as Database });

      // Act
      const result = await createCustomer({ name: "  Juana Pérez  ", phone: "8091234567" });

      // Assert
      expect(result.id).toEqual(expect.any(String));
      expect(result.name).toBe("Juana Pérez");
      expect(result.phone).toBe("8091234567");
      expect(db.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError and never touches the database", async () => {
      // Arrange
      const db = makeDbStub();
      const createCustomer = createCreateCustomer({ db: db as unknown as Database });

      // Act + Assert
      await expect(createCustomer({ name: "", phone: "8091234567" })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("cédula", () => {
    it("stores a valid 11-digit cédula normalized to digits only", async () => {
      // Arrange
      const db = makeDbStub();
      const createCustomer = createCreateCustomer({ db: db as unknown as Database });

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
      const db = makeDbStub();
      const createCustomer = createCreateCustomer({ db: db as unknown as Database });

      // Act
      const result = await createCustomer({ name: "Juana Pérez", phone: "8091234567" });

      // Assert
      expect(result.cedula).toBeNull();
    });

    it("rejects a cédula that isn't 11 digits", async () => {
      // Arrange
      const db = makeDbStub();
      const createCustomer = createCreateCustomer({ db: db as unknown as Database });

      // Act + Assert
      await expect(
        createCustomer({ name: "Juana Pérez", phone: "8091234567", cedula: "001-123456-8" })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("avatarKey", () => {
    it("accepts a key from the curated set", async () => {
      // Arrange
      const db = makeDbStub();
      const createCustomer = createCreateCustomer({ db: db as unknown as Database });

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
      const db = makeDbStub();
      const createCustomer = createCreateCustomer({ db: db as unknown as Database });

      // Act + Assert
      await expect(
        createCustomer({
          name: "Juana Pérez",
          phone: "8091234567",
          avatarKey: "not-a-real-avatar"
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
