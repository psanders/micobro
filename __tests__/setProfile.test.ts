/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createSetProfile } from "../lib/profile/setProfile";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

function makeDbStub() {
  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values });
  return { insert, values, onConflictDoUpdate } as unknown as Database & Record<string, jest.Mock>;
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
      expect((db as unknown as Record<string, jest.Mock>).insert).toHaveBeenCalledTimes(1);
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
});
