/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: app-lock "PIN unlock on every subsequent open" — personalized
 * greeting comes from the profile repo. The real client now reads/writes
 * the `profile` table: null only when the lender hasn't captured it yet,
 * a row once "Editar perfil" has run.
 */
import { createRealProfileRepo } from "../lib/repo/real/profileRepo";
import type { Database } from "../lib/db/client";

function makeDbStub(rows: unknown[] = []) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values });

  return { select, from, where, insert, values, onConflictDoUpdate } as unknown as Database &
    Record<string, jest.Mock>;
}

describe("real profile repo", () => {
  it("returns null when no profile row has been captured yet", async () => {
    const db = makeDbStub([]);
    const repo = createRealProfileRepo({ db: db as unknown as Database });

    expect(await repo.get()).toBeNull();
  });

  it("returns the captured row once one exists", async () => {
    const row = {
      id: "self",
      name: "Julia Reyes",
      avatarKey: "female2",
      businessName: "Financiera Julia",
      phone: "8095551234",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    };
    const db = makeDbStub([row]);
    const repo = createRealProfileRepo({ db: db as unknown as Database });

    const profile = await repo.get();
    expect(profile).toEqual({
      name: "Julia Reyes",
      avatarKey: "female2",
      businessName: "Financiera Julia",
      phone: "8095551234"
    });
  });

  it("set() writes an upsert to the profile table", async () => {
    const db = makeDbStub([]);
    const repo = createRealProfileRepo({ db: db as unknown as Database });

    const profile = await repo.set({ name: "Julia Reyes", avatarKey: "female2" });

    expect(profile.name).toBe("Julia Reyes");
    expect((db as unknown as Record<string, jest.Mock>).insert).toHaveBeenCalledTimes(1);
    expect((db as unknown as Record<string, jest.Mock>).onConflictDoUpdate).toHaveBeenCalledTimes(
      1
    );
  });
});
