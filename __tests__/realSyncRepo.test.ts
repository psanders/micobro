/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync-engine "Retryable failures keep retrying; exhausted ones are
 * surfaced, never silently dropped" — pendingCount must include retryable
 * "failed" rows (not just "pending"), and stuckCount must isolate rows that
 * exhausted MAX_RETRIES so they're surfaced rather than vanishing.
 */
jest.mock("../lib/sync/googleAuth", () => ({
  isSignedInToGoogle: jest.fn().mockReturnValue(true),
  signInWithGoogle: jest.fn(),
  signOutOfGoogle: jest.fn()
}));

jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn().mockResolvedValue("sheet-1")
}));

jest.mock("../lib/sync/provisionSheet", () => ({
  provisionSheet: jest.fn()
}));

import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import { MAX_RETRIES } from "../lib/sync/push";
import type { Database } from "../lib/db/client";

function makeDbStub(
  pendingRows: unknown[],
  stuckRows: unknown[],
  pushMetaRows: unknown[] = [],
  pullMetaRows: unknown[] = []
) {
  const where = jest
    .fn()
    .mockResolvedValueOnce(pendingRows)
    .mockResolvedValueOnce(stuckRows)
    .mockResolvedValueOnce(pushMetaRows)
    .mockResolvedValueOnce(pullMetaRows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { select } as unknown as Database;
}

describe("createRealSyncRepo.getStatus", () => {
  it("counts a retryable failed row (below MAX_RETRIES) as pending, not stuck", async () => {
    const db = makeDbStub([{ id: "m1", status: "failed", retryCount: MAX_RETRIES - 1 }], []);
    const repo = createRealSyncRepo({ db });

    const status = await repo.getStatus();

    expect(status.pendingCount).toBe(1);
    expect(status.stuckCount).toBe(0);
  });

  it("counts a retry-cap-exhausted failed row as stuck, not pending", async () => {
    const db = makeDbStub([], [{ id: "m2", status: "failed", retryCount: MAX_RETRIES }]);
    const repo = createRealSyncRepo({ db });

    const status = await repo.getStatus();

    expect(status.pendingCount).toBe(0);
    expect(status.stuckCount).toBe(1);
  });

  it("counts plain pending rows normally alongside stuck rows", async () => {
    const db = makeDbStub(
      [{ id: "m3", status: "pending", retryCount: 0 }],
      [{ id: "m4", status: "failed", retryCount: MAX_RETRIES }]
    );
    const repo = createRealSyncRepo({ db });

    const status = await repo.getStatus();

    expect(status.pendingCount).toBe(1);
    expect(status.stuckCount).toBe(1);
  });
});
