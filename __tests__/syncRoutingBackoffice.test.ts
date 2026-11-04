/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The sync repo sends to the back office while connected and to the Google
 * Sheet otherwise (connect-backoffice: sync-engine and pull-two-way-sync deltas).
 */
jest.mock("../lib/sync/push", () => ({
  ...jest.requireActual("../lib/sync/outbox"),
  pushPendingMutations: jest.fn().mockResolvedValue({ pushed: 1, failed: 0 })
}));
jest.mock("../lib/sync/pull", () => ({
  ...jest.requireActual("../lib/sync/pullResult"),
  LAST_PULLED_AT_KEY: "lastPulledAt",
  HELD_DELETIONS_KEY: "heldDeletions",
  SYNC_PROBLEMS_KEY: "syncProblems",
  pullEntities: jest
    .fn()
    .mockResolvedValue({ ...jest.requireActual("../lib/sync/pullResult").EMPTY_PULL_RESULT })
}));
jest.mock("../lib/sync/config", () => ({ getSheetId: jest.fn().mockResolvedValue("sheet-1") }));
jest.mock("../lib/sync/googleAuth", () => ({
  isSignedInToGoogle: jest.fn().mockReturnValue(true),
  signInWithGoogle: jest.fn(),
  signOutOfGoogle: jest.fn()
}));
jest.mock("../lib/sync/provisionSheet", () => ({ provisionSheet: jest.fn() }));

import { createTestDb } from "./helpers/testDb";
import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import { pushPendingMutations } from "../lib/sync/push";
import { pullEntities } from "../lib/sync/pull";
import type { AppBackoffice } from "../lib/sync/backoffice";

function backofficeStub(active: boolean, revoked = false): AppBackoffice {
  return {
    available: true,
    connection: {
      isActive: jest.fn().mockResolvedValue(active),
      get: jest.fn().mockResolvedValue(
        active || revoked
          ? {
              tenantId: "mikro",
              businessName: "Mikro SRL",
              connectedAt: "",
              revokedAt: revoked ? "x" : null
            }
          : null
      ),
      credential: jest.fn(),
      deviceId: jest.fn(),
      save: jest.fn(),
      markRevoked: jest.fn(),
      clear: jest.fn()
    },
    push: jest.fn().mockResolvedValue({ pushed: 3, failed: 1, revoked: false }),
    connect: jest.fn(),
    disconnect: jest.fn()
  };
}

beforeEach(() => jest.clearAllMocks());

function repoWith(backoffice: AppBackoffice) {
  const t = createTestDb();
  return createRealSyncRepo({ db: t.db, sql: t.sql, backupDriver: t.backupDriver, backoffice });
}

describe("sync routing", () => {
  it("connected: push and sync go to the back office, never to the Sheet", async () => {
    const backoffice = backofficeStub(true);
    const repo = repoWith(backoffice);
    expect(await repo.pushNow()).toEqual({ pushed: 3, failed: 1 });
    const synced = await repo.syncNow();
    expect(synced.push).toEqual({ pushed: 3, failed: 1 });
    expect(backoffice.push).toHaveBeenCalledTimes(2);
    expect(pushPendingMutations).not.toHaveBeenCalled();
    expect(pullEntities).not.toHaveBeenCalled();
    expect((await repo.getStatus()).backoffice).toEqual({
      businessName: "Mikro SRL",
      revoked: false
    });
  });

  it("not connected: push and sync go to the Sheet as before", async () => {
    const backoffice = backofficeStub(false);
    const repo = repoWith(backoffice);
    await repo.pushNow();
    await repo.syncNow();
    expect(pushPendingMutations).toHaveBeenCalled();
    expect(pullEntities).toHaveBeenCalled();
    expect(backoffice.push).not.toHaveBeenCalled();
    expect((await repo.getStatus()).backoffice).toBeNull();
  });

  it("a revoked device reads as disconnected-by-the-business and syncs nowhere new", async () => {
    const backoffice = backofficeStub(false, true);
    const repo = repoWith(backoffice);
    expect((await repo.getStatus()).backoffice).toEqual({
      businessName: "Mikro SRL",
      revoked: true
    });
  });
});
