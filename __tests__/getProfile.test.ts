/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createGetProfile } from "../lib/profile/getProfile";
import type { Database } from "../lib/db/client";

function makeDbStub(rows: unknown[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { select, from, where } as unknown as Database & Record<string, jest.Mock>;
}

describe("createGetProfile", () => {
  it("returns the profile row when one exists", async () => {
    // Arrange
    const row = {
      id: "self",
      name: "Julia Reyes",
      avatarKey: "female2",
      businessName: null,
      phone: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    };
    const db = makeDbStub([row]);
    const getProfile = createGetProfile({ db: db as unknown as Database });

    // Act
    const result = await getProfile({});

    // Assert
    expect(result).toEqual({
      name: "Julia Reyes",
      avatarKey: "female2",
      businessName: null,
      phone: null
    });
  });

  it("returns null when no profile row exists yet", async () => {
    // Arrange
    const db = makeDbStub([]);
    const getProfile = createGetProfile({ db: db as unknown as Database });

    // Act
    const result = await getProfile({});

    // Assert
    expect(result).toBeNull();
  });
});
