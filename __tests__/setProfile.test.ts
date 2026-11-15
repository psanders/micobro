/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createSetProfile } from "../lib/profile/setProfile";
import { ValidationError } from "../lib/errors/ValidationError";
import { pendingMutations, profile as profileTable } from "../lib/db/schema";
import { createTestDb } from "./helpers/testDb";
import type { Database } from "../lib/db/client";

function makeDbStub() {
  // No stored profile yet: an omitted photo reads back as none.
  const where = jest.fn().mockResolvedValue([]);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values });
  return { select, insert, values, onConflictDoUpdate } as unknown as Database &
    Record<string, jest.Mock>;
}

describe("createSetProfile", () => {
  describe("with valid input", () => {
    it("upserts the singleton profile row", async () => {
      // Arrange
      const db = makeDbStub();
      const setProfile = createSetProfile({ db: db as unknown as Database });

      // Act
      const result = await setProfile({
        name: "  Julia Reyes  ",
        avatarKey: "female2",
        businessName: "Financiera Julia",
        phone: "8095551234"
      });

      // Assert
      expect(result.name).toBe("Julia Reyes");
      expect(result.avatarKey).toBe("female2");
      expect(result.businessName).toBe("Financiera Julia");
      expect(result.phone).toBe("8095551234");
      expect((db as unknown as Record<string, jest.Mock>).insert).toHaveBeenCalledWith(
        profileTable
      );
      expect((db as unknown as Record<string, jest.Mock>).onConflictDoUpdate).toHaveBeenCalledTimes(
        1
      );
    });

    it("defaults optional fields to null when omitted", async () => {
      // Arrange
      const db = makeDbStub();
      const setProfile = createSetProfile({ db: db as unknown as Database });

      // Act
      const result = await setProfile({ name: "Julia Reyes" });

      // Assert
      expect(result.avatarKey).toBeNull();
      expect(result.businessName).toBeNull();
      expect(result.phone).toBeNull();
    });
  });

  describe("with invalid input", () => {
    it("rejects a missing name and never touches the database", async () => {
      // Arrange
      const db = makeDbStub();
      const setProfile = createSetProfile({ db: db as unknown as Database });

      // Act + Assert
      await expect(setProfile({ name: "" })).rejects.toBeInstanceOf(ValidationError);
      expect((db as unknown as Record<string, jest.Mock>).insert).not.toHaveBeenCalled();
    });

    it("rejects an avatarKey outside the curated set", async () => {
      // Arrange
      const db = makeDbStub();
      const setProfile = createSetProfile({ db: db as unknown as Database });

      // Act + Assert
      await expect(
        setProfile({ name: "Julia Reyes", avatarKey: "not-a-real-avatar" })
      ).rejects.toBeInstanceOf(ValidationError);
      expect((db as unknown as Record<string, jest.Mock>).insert).not.toHaveBeenCalled();
    });
  });

  describe("queuing the profile for the Sheet's Extra tab", () => {
    async function queued(db: Database) {
      const rows = await db.select().from(pendingMutations);
      return rows.map((m) => [m.entity, m.entityId, m.operation, JSON.parse(m.payload)]);
    }

    it("queues every profile Campo on the first save", async () => {
      // Arrange
      const { db } = createTestDb();
      const setProfile = createSetProfile({ db });

      // Act
      await setProfile({ name: "Julia Reyes", phone: "8095551234" });

      // Assert
      expect(await queued(db)).toEqual([
        [
          "profile",
          "self",
          "update",
          { campos: ["Nombre", "Negocio", "Teléfono", "Avatar", "Foto"] }
        ]
      ]);
    });

    it("queues only the Campos that changed against the stored row", async () => {
      // Arrange
      const { db } = createTestDb();
      const setProfile = createSetProfile({ db });
      await setProfile({ name: "Julia Reyes", avatarKey: "female2", phone: "8095551234" });
      await db.delete(pendingMutations);

      // Act: a new name and photo; the omitted photo of the first save was none.
      await setProfile({
        name: "Julia M. Reyes",
        avatarKey: "female2",
        phone: "809-555-1234",
        photo: "/9j/AAAA"
      });

      // Assert
      expect(await queued(db)).toEqual([
        ["profile", "self", "update", { campos: ["Nombre", "Foto"] }]
      ]);
    });

    it("queues nothing when a save changes nothing", async () => {
      // Arrange
      const { db } = createTestDb();
      const setProfile = createSetProfile({ db });
      await setProfile({ name: "Julia Reyes", photo: "/9j/AAAA" });
      await db.delete(pendingMutations);

      // Act: an omitted photo keeps the stored one.
      await setProfile({ name: "Julia Reyes" });

      // Assert
      expect(await queued(db)).toEqual([]);
    });

    it("never queues an invalid save", async () => {
      // Arrange
      const { db } = createTestDb();
      const setProfile = createSetProfile({ db });

      // Act + Assert
      await expect(setProfile({ name: "Julia", avatarKey: "dragon" })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(await queued(db)).toEqual([]);
    });
  });
});
